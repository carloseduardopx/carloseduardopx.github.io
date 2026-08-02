# Free SVGs — the only vectors that may ever live on this server

A drawing's vector goes here **only** if its manifest entry has `"freeSvg": true`.
The filename must match the slug exactly: `<slug>.svg`.

`vercel.json` serves this one directory and returns 404 for every other `.svg`
path on the host, whatever is on disk. Paid vectors are never committed to this
repo — they are delivered through the Gumroad zip. That is what keeps a guessable
path like `/images/png/hiker-line-illustration.svg` from resolving.

`node scripts/build.mjs` checks each flagged slug for a file here. If it is
missing, that card falls back to the Gumroad link and the build prints a warning
rather than shipping a dead download.
