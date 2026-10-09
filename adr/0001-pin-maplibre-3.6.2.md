# ADR 0001: Pin MapLibre GL JS at 3.6.2

- **Status:** Accepted
- **Date:** 2026-10-09
- **Commit:** a03b970 (released in v2.0.3.0)

## Context

Power BI hosts every custom visual in a sandboxed iframe with an opaque origin
(`sandbox="allow-scripts"`, no `allow-same-origin`), in Power BI Desktop as well
as the Power BI service.

v2.0.3.0 switched the default basemap from CARTO raster tiles to OpenFreeMap,
because CARTO began serving "API KEY REQUIRED" watermark tiles to keyless
requests (GitHub issues #2, #3). OpenFreeMap only offers vector tiles.

MapLibre decodes vector tiles in a web worker. With `maplibre-gl` 5.17.0 (the
version the project had used since the initial commit) that worker cannot start
inside the Power BI sandbox, and it fails silently:

- no console error and no failed network request
- the map never fires `load`
- raster layers still draw, so the map looks half-loaded (no labels or borders)
- after 20 seconds the visual's watchdog shows "The map failed to load"

The CARTO basemap was raster-only, which is why the problem was never seen
before OpenFreeMap.

Tested in Power BI Desktop and in a browser page wrapped in
`<iframe sandbox="allow-scripts">`: 5.17 fails, 3.6.2 works. In 3.6.2 the worker
is created from an in-memory `blob:` URL built from the bundle, which works
under an opaque origin.

## Decision

Pin `maplibre-gl` to exactly `3.6.2` in `package.json` (no `^` or `~`), for every
basemap provider.

## Alternatives considered

- **Stay on 5.x and keep a raster-only basemap.** Rejected: there is no free,
  keyless raster provider left that is safe to depend on (OSM blocks Power BI
  traffic; CARTO now requires a key).
- **Load 3.6.2 for OpenFreeMap and 5.x for CARTO.** Rejected: CARTO is raster
  and 3.6.2 draws it identically, so users gain nothing, while the visual would
  ship two copies of MapLibre, need two code paths around the controller, and
  double the testing.
- **Find and patch the 4.x/5.x worker problem.** Not pursued: the exact cause
  was not traced, and a patched fork would need maintaining.

## Consequences

- No MapLibre 4.x/5.x features (e.g. globe projection). None are currently needed.
- Any MapLibre upgrade, including from automated dependency updates, can break
  the map in a way that **normal browser tests do not catch**.
- Unknown: whether any 4.x release works. Only 3.6.2 and 5.17 were tested.

## Before changing this pin

1. Build the visual with the new version.
2. Load a test page inside `<iframe sandbox="allow-scripts">` with the
   OpenFreeMap basemap, and confirm the map fires `load` and shows labels and
   borders.
3. Repeat in Power BI Desktop, waiting more than 20 seconds for the watchdog.
4. Only then update this ADR (status "Superseded") and the pin.

Note: installs need `npm install --legacy-peer-deps` because of an unrelated
peer conflict between the old tslint packages and TypeScript 4.9.5. A failed
plain `npm install` can leave a stale MapLibre in `node_modules` and produce a
broken package; check `node -p "require('maplibre-gl/package.json').version"`.
