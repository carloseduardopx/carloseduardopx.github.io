# Pay For Layers v3

Static site for payforlayers.com. Lives in `pfl/`, deploys from Vercel.

The v.2 site is still at the repo root and still ships from GitHub Pages. It
stays there until the DNS switch below is done. Nothing in `pfl/` touches it.

---

## Where the design came from

Every colour, size and space in `pfl/css/pfl.css` is a value already in use in
`css/pfl-418f99.webflow.css` — v.2's own stylesheet, at the repo root. Nothing
is invented. Two deliberate departures, both flagged in the CSS:

| | v.2 | v3 | why |
|---|---|---|---|
| secondary grey | `#999` | `#595959` | `#999` is 2.85:1 on white and fails AA. v.2 puts it on 12px labels. |
| section headings | `h3` at 170% ≈ 41px | gone; scale tops at 26px | display sizes for copy that is not display copy |

Typefaces are v.2's: **Mint Grotesk V131** self-hosted for headings and UI
labels, **Inter** for body copy.

The type scale, all five steps present in v.2:

| role | v3 | from |
|---|---|---|
| `h1` | Mint 26/34, 700 | `.heading` 24, `.heading-2` 24 |
| `h2` | Mint 20/28, 700 | `.text-span` 20 |
| `h3` | Inter 16/24, 700 | `.paragraph` 16 |
| body | Inter 16/1.6, 500 | `.paragraph` 16/180% |
| `.small` | Inter 14/1.5 | `.paragraph.ar` 14 |
| `.micro` | Inter 12/1.7 | `.legenda` 12/170% |

The accent is `#0000ee` — v.2's own link colour, and the browser default.
Everything blue is interactive; everything interactive is blue, wordmarks
included. `node scripts/contrast.mjs` checks every pair and fails the build
below AA. All of them currently clear AAA at 12px, which is the smallest text
on the site.

## The counts, and not blurring them

Three different numbers, never used interchangeably:

- **11** — drawings published on this site, free as PNG with credit.
- **15** — files in the free Gumroad sample.
- **156** — files in the $42 pack: 121 illustrations + 35 scribbles. The FAQ
  says 165 because 9 bonus illustrations from v1 ride along uncounted.

The `+145` cell at the end of the grid is `156 − 11`. It is not a stat band —
it is what stops the grid reading as the whole library, and it is why there is
no separate stats section. It does not appear on tag pages, because the per-tag
split of the other 145 files is not known and guessing it would be inventing a
metric.

## Adding an illustration

1. Export two PNGs into `pfl/images/png/`, named semantically
   (`backpack-line-illustration.png`, never `Backpack.png`):
   - `<slug>.png` — 1000px on the long edge. This is the free download.
   - `<slug>-500.png` — 500px on the long edge. This is the grid thumbnail.
2. Add an entry to `pfl/manifest.json` with `slug`, `name`, `tags` and `alt`.
   Write the alt text for a person, not a crawler — describe what is happening
   in the drawing.
3. Run the build.

```
node scripts/build.mjs
```

It measures `width`, `height` and `bytes` out of the files themselves and writes
them back into the manifest, so those can never drift from what is served. Then
it regenerates the grid, every tag page, `sitemap.xml`, `robots.txt` and
`llms.txt`. Commit the result.

**Do not hand-edit `pfl/tags/*.html`** — they are overwritten on every build.
They are generated from `pfl/index.html`, so edit that and rebuild.

Everything in `pfl/index.html` outside the `<!-- build:x -->` markers is yours
to edit by hand.

## The other two scripts

```
node scripts/og.mjs        # re-renders pfl/og.png (1200x630) from scripts/og.html
node scripts/contrast.mjs  # WCAG check on every colour pair; non-zero exit on failure
```

Neither has dependencies. `og.mjs` drives whatever Chrome or Chromium it finds
over the DevTools Protocol — set `CHROMIUM_PATH` if it lives somewhere unusual.
It uses CDP rather than `chrome --screenshot` because the CLI sizes the capture
from the window and clips ~90px off the bottom.

Re-run `og.mjs` if you change the card copy or swap which illustrations appear
on it. Run `contrast.mjs` after touching any colour in `pfl/css/pfl.css`.

## Licence

Not Creative Commons, deliberately. CC BY permits redistribution and resale of
the licensed files — it would let anyone repackage the free PNGs and sell them,
irrevocably — which contradicts the terms of use. It would also leave the $42
tier buying nothing but the removal of a credit line.

Two short licences instead, both at `pfl/licence.html`:

- **PFL-Free-1.0** — free PNGs. Personal and commercial use, credit required.
- **PFL-Commercial-1.0** — the pack. Same, minus the credit requirement.

The credit line is exactly this, and it appears identically in four places —
the footer, the FAQ, `licence.html` and `terms.html`:

```
Illustration by Carlos Peixoto — payforlayers.com
```

`grep -rl "Illustration by Carlos Peixoto — payforlayers.com" pfl/` must return
all four, plus `manifest.json` and `llms.txt`.

## Paid files

**No SVG is in `pfl/`, and none should ever be.** PNGs sit at predictable public
paths, so `/images/png/<slug>.svg` is the first thing anyone will try. Paid
delivery is the Gumroad zip; the vectors do not need to be on the server at all.

Three things enforce it: `vercel.json` rewrites every `*.svg` request to a
non-existent path (a real 404 status, not a 200 with an error page) regardless
of what is on disk, `robots.txt` disallows the pattern, and Vercel static
hosting has no directory listing.

Two leaks were closed while building this, both on the **GitHub Pages** side:

- `images/Maps.svg` — 788 KB of paid vector, publicly served and linked from
  the v.2 `index.html`. Deleted; the grid cell now uses `images/Confuse.png`,
  which was already in the repo and unused, so v.2's `+114` arithmetic is
  unchanged.
- `Back-up/` holds four PFL v1 SVGs, and the v1 drawings now ship inside the
  paid pack. `_config.yml` excludes that directory from GitHub Pages so the
  archive stays in git and off the web.

**Both files remain in git history.** Anyone who clones the repo can recover
them. Fully removing them needs a history rewrite (`git filter-repo`) and a
force-push, which will break every existing clone — your call, not something to
do casually.

## Deploying to Vercel

Import the repo as a new Vercel project. `vercel.json` already sets:

- output directory `pfl`, no build command
- `Access-Control-Allow-Origin: *` on `/images/png/*` and `/manifest.json`
- immutable caching on images, fonts and CSS
- the `*.svg` 404 rewrite
- `/library` and `/api/*` reserved for the gated route (nothing built there yet)

The grid renders from `manifest.json`, so a gated `/library` can read the same
manifest at request time and serve signed URLs without changing markup or CSS.

### DNS — do this yourself, nothing here touches it

The live site is on **GitHub Pages**, not Webflow — the `CNAME` file at the repo
root claims `payforlayers.com`. So the records to remove are GitHub's.

1. Add `payforlayers.com` and `www.payforlayers.com` as domains in the Vercel
   project first. Vercel then shows you the exact records. **Use what the
   dashboard shows, not the table below** — these are current as of now but
   Vercel has changed them before.
2. Drop TTL to 3600 or lower a day before the switch.
3. Delete the GitHub Pages apex `A` records — `185.199.108.153`,
   `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, plus any `AAAA` in
   `2606:50c0::/32` — and the `www` `CNAME` to `carloseduardopx.github.io`.
   Verification stalls on conflicting records.
4. Add:

   | Type    | Host  | Value                  |
   |---------|-------|------------------------|
   | `A`     | `@`   | `76.76.21.21`          |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

5. Leave `MX` and `TXT` alone — email and domain verification run through those.
6. Keep GitHub Pages live until Vercel reports the domain as valid.
7. Only then delete the root `CNAME` file, or GitHub Pages keeps claiming the
   domain.

`carlospx.com` is a separate site and its DNS is unaffected — do not touch
those records.

## Verifying

With the site served locally (`npx http-server pfl -p 8899`):

- `node scripts/contrast.mjs` — non-zero exit means a text pair is below AA.
- Disable JavaScript and click every tag — each must be a real page load with
  its own title, description and canonical.
- Tab through the grid, the tag row, both Gumroad buttons and the newsletter
  form; focus must be visible at every stop.
- Confirm `/images/png/*.png` sends `Access-Control-Allow-Origin: *`, and that
  any `*.svg` path 404s.
- Check the JSON-LD parses on the index and on a tag page, and that the OG card
  renders in a preview debugger.
- `find pfl -iname '*.svg'` must return nothing.
- Lighthouse mobile.

## Open items

- **Inter is not self-hosted.** It still loads from Google Fonts — through the
  CSS API, not v.2's render-blocking `webfont.js`, and the stack falls back to
  `system-ui`, so a blocked or slow Google Fonts costs nothing but the exact
  face. Neither `fonts.gstatic.com` nor `rsms.me` was reachable from the
  container this was built in. Drop the `.woff2` files into `pfl/fonts/`, add
  the `@font-face` blocks next to Mint Grotesk's, and delete the three
  `fonts.googleapis.com` lines from each page's `<head>`. That removes the last
  third-party request.
- **The v.2 "Change / edit" section is not carried over.** It leaned on
  `images/vide-128.gif`, which is 3.7 MB — enough on its own to sink a mobile
  Lighthouse score. Its job is done by the `SVG / FIG / PNG` definition list
  instead. If you want the animation back, re-encode it as a muted, looping
  `<video>` (WebM + MP4 fallback) and it can return.
- **The grid holds 11 drawings, not 15.** These are the real v.2 PNGs that were
  in this repo; the free-sample files are not. Export the rest into
  `pfl/images/png/`, add them to the manifest, rebuild — no markup or CSS
  changes needed. The counter arithmetic follows automatically.
- **Newsletter frequency** is stated as "a few times a year" in the copy and
  in the JavaScript confirmation message. Both need changing together if that
  changes.
