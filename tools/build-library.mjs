#!/usr/bin/env node
/**
 * build-library.mjs — scan /png, stamp attribution into each file, write manifest.json.
 *
 * The PNGs in /png are the free tier and the only artwork in this repository.
 * The SVGs are the product: they are delivered by Stripe after purchase and must
 * never be committed here. `npm run check` fails the build if one shows up.
 *
 * Adding artwork is: drop the PNG in /png, describe it in data/taxonomy.json,
 * run this script, commit. Nothing in index.html or gallery.js needs touching.
 *
 * Usage:  node tools/build-library.mjs
 *         node tools/build-library.mjs --check   # verify, change nothing
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";

const PNG_DIR = "png";
const MANIFEST = "manifest.json";
const CONFIG = "data/config.json";
const TAXONOMY = "data/taxonomy.json";

const readJSON = (p, fallback) => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
};

const cfg = readJSON(CONFIG, null);
if (!cfg) { console.error(`Missing ${CONFIG}`); process.exit(1); }

const { author, site, free } = cfg;
const titleize = (id) =>
  id.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/* ---------------------------------------------------------------- PNG chunks */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Split a PNG into its chunk list. */
function parsePNG(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const length = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + length);
    chunks.push({ type, data });
    off += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function serializePNG(chunks) {
  const parts = [SIGNATURE];
  for (const { type, data } of chunks) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    parts.push(len, typeBuf, data, crc);
  }
  return Buffer.concat(parts);
}

/** A tEXt chunk is "keyword\0value" in latin-1. */
const textChunk = (keyword, value) => ({
  type: "tEXt",
  data: Buffer.concat([
    Buffer.from(keyword, "latin1"),
    Buffer.from([0]),
    Buffer.from(value.normalize("NFKD").replace(/[^\x20-\x7E]/g, ""), "latin1"),
  ]),
});

const readTextChunks = (chunks) =>
  Object.fromEntries(
    chunks
      .filter((c) => c.type === "tEXt")
      .map((c) => {
        const i = c.data.indexOf(0);
        return [c.data.toString("latin1", 0, i), c.data.toString("latin1", i + 1)];
      })
  );

const dimensions = (chunks) => {
  const ihdr = chunks.find((c) => c.type === "IHDR");
  return { width: ihdr.data.readUInt32BE(0), height: ihdr.data.readUInt32BE(4) };
};

/* ------------------------------------------------------------------- stamping */

const STAMP_KEYS = ["Title", "Author", "Copyright", "Source", "Software", "Comment"];

function stampFields(id, title) {
  return {
    Title: title,
    Author: author.name,
    Copyright: `(c) ${author.name}. ${free.license}.`,
    Source: `${site}/png/${id}.png`,
    Software: "Pay for Layers",
    Comment:
      `Hand-drawn by ${author.name} (${author.handle}). ` +
      `This PNG is free under ${free.license} - credit required. ` +
      `The editable SVG is available at ${site}`,
  };
}

/* ----------------------------------------------------------------------- main */

function main() {
  const check = process.argv.includes("--check");
  const taxonomy = readJSON(TAXONOMY, {});
  const problems = [];

  // The product must never end up in the public tree — anywhere in it, not just
  // the folder we happen to stage from. GitHub Pages serves every path here.
  const strays = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith(".svg")) strays.push(full);
    }
  })(".");

  if (strays.length) {
    problems.push(
      `${strays.length} SVG(s) are being served publicly — the vectors are the paid\n  ` +
      `product, so every one of these is the product given away for free:\n    ` +
      strays.join("\n    ")
    );
  }

  const files = readdirSync(PNG_DIR)
    .filter((f) => extname(f).toLowerCase() === ".png")
    .sort();

  const items = [];

  for (const file of files) {
    const id = basename(file, ".png");
    const path = join(PNG_DIR, file);
    const meta = taxonomy[id] || {};
    const title = meta.title || titleize(id);

    if (!taxonomy[id]) problems.push(`${file} has no entry in ${TAXONOMY}`);

    const buf = readFileSync(path);
    let chunks;
    try {
      chunks = parsePNG(buf);
    } catch (e) {
      problems.push(`${file}: ${e.message}`);
      continue;
    }

    const want = stampFields(id, title);

    if (check) {
      const have = readTextChunks(chunks);
      const missing = STAMP_KEYS.filter((k) => have[k] !== want[k]);
      if (missing.length) problems.push(`${file} attribution stale or missing: ${missing.join(", ")}`);
    } else {
      const kept = chunks.filter(
        (c) => !(c.type === "tEXt" && STAMP_KEYS.includes(c.data.toString("latin1", 0, c.data.indexOf(0))))
      );
      const ihdrAt = kept.findIndex((c) => c.type === "IHDR");
      kept.splice(ihdrAt + 1, 0, ...STAMP_KEYS.map((k) => textChunk(k, want[k])));
      const out = serializePNG(kept);
      if (!out.equals(buf)) writeFileSync(path, out);
      chunks = kept;
    }

    const { width, height } = dimensions(chunks);
    items.push({
      id,
      title,
      category: meta.category || "illustration",
      tags: meta.tags || [],
      png: `png/${file}`,
      url: `${site}/png/${file}`,
      width,
      height,
      bytes: readFileSync(path).length,
      svg: "pro",
    });
  }

  if (check) {
    if (problems.length) {
      console.error("Problems:\n  " + problems.join("\n  "));
      process.exit(1);
    }
    console.log(`OK — ${items.length} illustrations, all stamped, no SVGs in the public tree.`);
    return;
  }

  if (problems.length) console.warn("Warnings:\n  " + problems.join("\n  "));

  const manifest = {
    name: "Pay for Layers — hand-drawn illustrations",
    description:
      "Hand-drawn black and white illustrations. Every PNG is free, including for " +
      "commercial use, under CC BY 4.0. The editable SVG source is the paid product.",
    author,
    homepage: site,
    free: {
      format: free.format,
      license: free.license,
      license_url: free.license_url,
      attribution_required: true,
      base_url: `${site}/png/`,
    },
    pro: {
      format: cfg.pro.format,
      price: cfg.pro.price,
      checkout_url: cfg.pro.checkout_url,
      includes: "Every illustration as an editable, layered SVG.",
    },
    attribution: `Illustration by ${author.name} — ${site}`,
    llms_txt: `${site}/llms.txt`,
    updated: new Date().toISOString().slice(0, 10),
    count: items.length,
    categories: [...new Set(items.map((i) => i.category))].sort(),
    illustrations: items,
  };

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Stamped ${items.length} PNGs · wrote ${MANIFEST}`);
}

main();
