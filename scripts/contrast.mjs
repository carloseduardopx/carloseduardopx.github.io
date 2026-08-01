#!/usr/bin/env node
/**
 * WCAG 2.1 contrast check for every colour pair the site actually uses.
 *
 *   node scripts/contrast.mjs
 *
 * Exits non-zero if any pair carrying text falls below AA. The smallest
 * text on the site is 12px, so there is no large-text exemption to lean
 * on — everything textual must clear 4.5:1.
 *
 * Colours are read from pfl/css/pfl.css so this cannot drift from the
 * stylesheet.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'pfl', 'css', 'pfl.css'), 'utf8');

const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  if (!m) throw new Error(`token --${name} not found in pfl.css`);
  return m[1];
};

const luminance = (hex) => {
  const h = hex.length === 4
    ? '#' + [...hex.slice(1)].map((c) => c + c).join('')
    : hex;
  const channels = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const ink = token('ink');
const body = token('body');
const muted = token('muted');
const rule = token('rule');
const tile = token('tile');
const paper = token('paper');
const link = token('link');
const visited = token('visited');

// `text: false` means the pair is decorative (hairlines) and is reported but
// not required to pass.
const pairs = [
  { fg: link,    bg: paper,   text: true,  note: 'card names, tag nav, inline links (12px)' },
  { fg: visited, bg: paper,   text: true,  note: 'visited links (12px)' },
  { fg: paper,   bg: link,    text: true,  note: 'Gumroad buttons (14px)' },
  { fg: paper,   bg: visited, text: true,  note: 'Gumroad buttons, hover and visited' },
  { fg: ink,     bg: paper,   text: true,  note: 'headings, FAQ questions, table cells' },
  { fg: body,    bg: paper,   text: true,  note: 'running text (16px)' },
  { fg: muted,   bg: paper,   text: true,  note: 'secondary text — replaces v.2 #999 (12px)' },
  { fg: ink,     bg: tile,    text: true,  note: 'anything over the illustration tile' },
  { fg: link,    bg: tile,    text: true,  note: 'links over the illustration tile' },
  { fg: rule,    bg: paper,   text: false, note: '--rule: hairlines only, never text' },
];

let failures = 0;
console.log('  ratio  level  pair');
for (const p of pairs) {
  const r = ratio(p.fg, p.bg);
  const level = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA ' : '---';
  const bad = p.text && r < 4.5;
  if (bad) failures++;
  console.log(
    `${r.toFixed(2).padStart(7)}  ${level}   ${p.fg} on ${p.bg}  ${p.note}${bad ? '   <-- FAILS AA' : ''}`,
  );
}

console.log(failures === 0
  ? '\nAll text pairs pass WCAG AA at 12px.'
  : `\n${failures} text pair(s) below AA.`);

process.exit(failures ? 1 : 0);
