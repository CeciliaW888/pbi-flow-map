# ADR 0002: No keyless third-party basemap fallbacks

- **Status:** Accepted
- **Date:** 2026-10-09
- **Commit:** 50e4807 (fallbacks removed, released in v2.0.3.0)

## Context

Up to v2.0.2.0 the visual used a raster fallback chain: CARTO → Esri
(`server.arcgisonline.com` legacy MapServer) → OpenStreetMap
(`tile.openstreetmap.org`). The chain switched provider only when tile requests
**errored**.

That design failed in practice. Providers refuse service with ordinary HTTP-200
image tiles, which no error check can detect:

- OpenStreetMap blocked Power BI traffic in March 2026 and serves an
  "Access blocked" image instead of map tiles.
- In August 2026 CARTO started serving an "API KEY REQUIRED" watermark to keyless
  requests (GitHub issues #2, #3). The chain never fired; users saw the watermark.

v2.0.3.0 replaced the chain with OpenFreeMap as the default (free, no key,
commercial use allowed) and CARTO as an opt-in using the report author's own key.

### Re-check on 2026-10-09

One zoom-4 tile per provider, requested as a Power BI visual would (no Referer,
`Origin: null`). Every response was HTTP 200; the images were inspected by eye:

| Provider | Result |
|---|---|
| OpenStreetMap | "403 Access blocked" image. Unusable. |
| CARTO, no key | "API KEY REQUIRED" watermark. Unusable. |
| Esri legacy raster (World Street Map, Light Gray Canvas) | Real map tiles. Works. |
| Esri vector World Street Map (`basemaps.arcgis.com/.../World_Basemap_v2/VectorTileServer`, item `de26a3cf4cc9451298ea173c4b324736`) | Style, `.pbf` tiles, sprites and fonts all served anonymously. Rendering inside a sandboxed iframe was **not** tested. |

So the code comment in `controller.ts` that says Esri "too" signals refusal with
image tiles is not supported by this check: Esri currently serves real tiles.
Esri was excluded on licensing grounds, not because it failed.

## Decision

Do not ship any fallback to a third-party basemap the visual is not licensed to
use anonymously. If the selected basemap fails to load, show flows on a blank
background with a visible on-map notice.

- **OpenStreetMap:** excluded. Its tile usage policy forbids this use, and it
  actively blocks us.
- **Esri (legacy raster and new vector):** excluded. Both are under the Esri
  Master License Agreement, which covers licensed ArcGIS users, not anonymous
  use inside a commercially used product. Working today is not permission, and
  Esri can start requiring a key without notice, as CARTO did.

## Alternatives considered

- **Keep the chain.** Rejected: its failures are undetectable, so it shows block
  or watermark tiles instead of falling back.
- **Use Esri anonymously.** Rejected: licensing, and the same silent-failure risk
  as CARTO.
- **Esri with the report author's own ArcGIS key** (like the CARTO option).
  Viable and licensed; not built because nobody has asked for it. Esri's style
  uses relative URLs (`../../`, `../sprites/sprite`), which MapLibre does not
  resolve, so the style would need rewriting to absolute URLs before use.

## Consequences

- If OpenFreeMap is down, there is no map background until it returns (flows
  still render).
- Only failures before the style loads are detected. Individual tile failures
  after that, and watermark-style refusals, are not.
- Fewer WebAccess domains to declare and explain in the privacy policy.

## Revisit when

- OpenFreeMap breaks: unreachable, rate-limits Power BI, changes its terms, or
  starts watermarking or requiring a key.
- CARTO extends its key requirement or changes free-tier limits in a way that
  affects authors using the CARTO option.
- Users ask for Esri, or another provider offers keyless use with terms that
  allow it.

When revisiting, re-run the tile check above and **look at the images**: an
HTTP 200 proves nothing. Then test rendering inside `<iframe sandbox="allow-scripts">`
with MapLibre 3.6.2 (see ADR 0001).
