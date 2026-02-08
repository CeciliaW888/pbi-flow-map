# Power BI Flow Map - Development Guide for AI Assistants

This document provides context and guidelines for AI assistants (Claude, etc.) working on this Power BI custom visual project.

---

## 📋 Project Overview

**What This Is:**
A Microsoft Power BI custom visual that creates interactive flow maps showing origin-destination movements between geographic locations with curved lines on a map.

**Version:** 2.0.0.0
**Language:** TypeScript 4.9.5
**Framework:** Power BI Visuals API 5.1.0
**Mapping Library:** MapLibre GL JS 5.17.0 (migrated from Bing Maps)
**Build Tool:** pbiviz (Power BI Custom Visuals Tools)

**Key Achievement:**
- ✅ Fully free solution (no API keys, no costs)
- ✅ Successfully migrated from discontinued Bing Maps to MapLibre
- ✅ Free geocoding via Photon API

---

## 🏗️ Architecture

### High-Level Structure

```
Power BI Desktop
    ↓
Visual.ts (Entry Point)
    ↓
FlowMap Visual (flowmap/visual.ts)
    ↓
    ├─→ MapLibre Controller (map rendering)
    │   └─→ MapLibre GL JS (OpenStreetMap tiles)
    ├─→ Geocoding Service (location lookup)
    │   └─→ Photon API (free geocoding)
    ├─→ Flow Renderer (D3.js SVG paths)
    ├─→ Pin Renderer (location markers)
    ├─→ Pie Renderer (bubble charts)
    └─→ Legend Renderer (visual legend)
```

### Key Directories

```
/code/src/
├── visual.ts                   # Power BI entry point
├── flowmap/
│   ├── visual.ts              # Main visual logic
│   └── format.ts              # Settings/format definitions
├── lava/
│   ├── maplibre/              # ⭐ MapLibre integration (NEW in v2.0)
│   │   ├── controller.ts      # Map control & event handling
│   │   ├── converter.ts       # Coordinate conversions
│   │   ├── geoService.ts      # Free geocoding service
│   │   └── geoQuery.ts        # Batch geocoding queue
│   ├── flowmap/               # Flow visualization logic
│   │   ├── app.ts            # Main app state & initialization
│   │   ├── flow.ts           # Flow line rendering
│   │   ├── shape.ts          # Flow path calculations
│   │   ├── arc.ts            # Great circle arc math
│   │   ├── algo.ts           # Flow bundling algorithms
│   │   ├── pin.ts            # Location pin markers
│   │   ├── pie.ts            # Pie chart bubbles
│   │   ├── popup.ts          # Popup labels
│   │   ├── legend.ts         # Legend generation
│   │   └── config.ts         # Configuration types
│   ├── d3.ts                 # D3.js wrapper utilities
│   └── type.ts               # Common TypeScript types
└── pbi/
    ├── Context.ts            # Power BI data context
    ├── Format.ts             # Format pane settings
    ├── tooltip.ts            # Tooltip utilities
    └── misc.ts               # Coordinate helpers
```

---

## 🔑 Key Concepts

### 1. Coordinate System (CRITICAL!)

**MapLibre uses GeoJSON standard: `[longitude, latitude]` order**
- ⚠️ Different from Bing Maps which used `{latitude, longitude}` objects
- All MapLibre methods expect `[lon, lat]` arrays
- Our `ILocation` interface: `{latitude: number, longitude: number}`
- Convert when calling MapLibre: `[location.longitude, location.latitude]`

**Example:**
```typescript
// Wrong (old Bing way)
map.setCenter({ latitude: 40.7, longitude: -74.0 });

// Correct (MapLibre way)
map.setCenter([-74.0, 40.7]);  // [lon, lat]
```

### 2. Map Controller Pattern

The `Controller` class wraps MapLibre to provide a consistent API:

```typescript
// src/lava/maplibre/controller.ts
export class Controller {
  private _map: maplibregl.Map;

  // Key methods:
  pixel(location: ILocation): IPoint      // Location → screen pixels
  location(pixel: IPoint): ILocation      // Screen pixels → location
  fitView(bounds: IBound[])               // Fit all data in view
  restyle(format: MapFormat)              // Change map appearance
}
```

**Listeners:** Components register with controller to receive events:
```typescript
controller.add({
  transform: (ctl, prevZoom, isEnd) => { /* on pan/zoom */ },
  resize: (ctl) => { /* on resize */ }
});
```

### 3. Geocoding Architecture

**Two-tier caching:**
1. **Local Cache** (3000 items, LRU eviction) - instant lookups
2. **API Call** (Photon or Nominatim) - only when cache misses

**Flow:**
```
Location Name
    ↓
Check Cache → Found? → Return
    ↓ Miss
Add to Queue
    ↓
Rate Limit (1 req/sec for Nominatim)
    ↓
Call Photon API
    ↓
Cache Result
    ↓
Return to Caller
```

**Files:**
- `geoService.ts` - API calls, caching, rate limiting
- `geoQuery.ts` - Batch processing queue

### 4. Flow Rendering (D3.js + SVG)

Flows are rendered as SVG paths overlaid on the map:

1. **Calculate paths** (great circle arcs, bundled flows, or straight lines)
2. **Convert to pixels** using map projection
3. **Render as SVG** with D3.js
4. **Update on pan/zoom** by recalculating pixel positions

**Key Files:**
- `flow.ts` - Main flow rendering logic
- `shape.ts` - Path calculation (arc, bundled, straight)
- `arc.ts` - Great circle math for curved paths
- `algo.ts` - Force-directed bundling algorithm

### 5. Power BI Data Binding

**Data Roles** (defined in `capabilities.json`):
- `Origin` - Starting location names
- `Dest` - Ending location names
- `width` - Flow quantities (line thickness)
- `color` - Categories (for coloring)
- `OLati/OLong` - Optional coordinates (skip geocoding)
- `DLati/DLong` - Optional coordinates (skip geocoding)

**Data Flow:**
```
Power BI Dataset
    ↓
update(options: VisualUpdateOptions)
    ↓
Parse data roles via Context
    ↓
Geocode location names
    ↓
Calculate flow paths
    ↓
Render SVG overlay
```

---

## 🛠️ Development Guidelines

### Build Commands

```bash
# Install dependencies
cd code && npm install

# Development mode (auto-reload in Power BI)
npm start

# Build and package
npx pbiviz package

# Output: dist/*.pbiviz file
```

### Code Style

**TypeScript:**
- Use strict type checking
- Prefer interfaces over types for object shapes
- Use `readonly` for immutable data
- Avoid `any` - use specific types

**Naming Conventions:**
- Classes: `PascalCase`
- Functions/methods: `camelCase`
- Private members: `_prefixed`
- Interfaces: `IPascalCase`
- Constants: `UPPER_SNAKE_CASE`

**Example:**
```typescript
export class FlowRenderer {
  private _cache: Map<string, ILocation>;

  public render(data: number[]): void {
    // ...
  }
}
```

### Important Patterns

**1. D3 Wrapper (selex)**

Don't use D3 directly - use the `selex` wrapper:

```typescript
import { selex } from '../d3';

// ✅ Good
const svg = selex(element).append('svg');
svg.att.width(100).att.height(100);

// ❌ Avoid
const svg = d3.select(element).append('svg');
svg.attr('width', 100).attr('height', 100);
```

**2. State Management**

Global state in `lava/flowmap/app.ts`:

```typescript
export let $state = new State();

// Access map controller
$state.mapctl.map

// Get location
$state.loc(address: string)

// Convert to pixels
$state.pixel(address: string)
```

**3. Event Handling**

Use the events object:

```typescript
import { events } from './app';

events.doneGeocoding = (locations) => {
  // Called after all locations geocoded
};
```

---

## 🧪 Testing

### Standalone Overlay Test (Quick)

Open `test-overlay.html` in a browser to test SVG-to-map alignment without Power BI. Uses real sample data (top 75 US county migration flows from `dist/sample.xlsx`). Has a toggle to switch between buggy center-origin and correct top-left-origin modes.

### Manual Testing (Full)

1. **Build the visual:**
   ```bash
   npx pbiviz package
   ```

2. **Import into Power BI Desktop:**
   - File → Options → Security → Enable custom visuals
   - Import the `.pbiviz` file from `/dist/`

3. **Test with sample data** (`dist/sample.xlsx`):
   - Contains 1,585 US county-to-county migration flows
   - Columns: from, to, count, from lat, from lon, to lat, to lon

4. **Verify:**
   - [ ] Map loads with OpenStreetMap tiles
   - [ ] Locations geocode successfully
   - [ ] Flow lines render between points
   - [ ] **Flows/pins/pies align with correct map locations at all zoom levels**
   - [ ] Zoom/pan works and overlay tracks the map
   - [ ] Tooltips display
   - [ ] Legend shows correctly

### Common Test Scenarios

**Edge Cases:**
- Empty dataset (should show "no data" message)
- Single location (no flows to render)
- Invalid location names (should handle gracefully)
- Very large datasets (50+ flows)
- Duplicate flows (same origin/destination)

**Performance:**
- 50 flows: Should be smooth
- 100 flows: Acceptable
- 200+ flows: May be slow (expected)

---

## ⚠️ Important Gotchas

### 1. SVG Overlay Coordinate Origin (CRITICAL!)

**MapLibre's `map.project()` returns pixel coordinates from the TOP-LEFT corner of the container (0,0 = top-left).**

The SVG root `<g>` in `controller.ts` MUST use `translate(0, 0)` — NOT `translate(w/2, h/2)`.

The old Bing Maps code used a center-origin SVG because Bing's pixel methods returned center-relative coordinates. MapLibre's `project()` returns top-left-relative coordinates. If the SVG root is translated to the center, every overlay element (flows, pins, pies) will be shifted right and down by half the container size.

**Rule:** All SVG positioning that uses `map.project()`, `controller.pixel()`, or `$state.pixel()` expects the SVG coordinate origin at (0, 0) = top-left.

```typescript
// ❌ WRONG — creates offset between map and SVG overlay
this._svgroot.att.translate(w / 2, h / 2);

// ✅ CORRECT — SVG origin matches MapLibre's project() origin
this._svgroot.att.translate(0, 0);
```

**Files that depend on top-left origin:**
- `controller.ts` — SVG root transform
- `shape.ts` — line and arc path generation via `map.project()`
- `flow.ts` — mask rect positioning and FlowShape anchor translate
- `pin.ts` — pin marker positioning and invalid pin placer
- `pie.ts` — pie bubble positioning

**Test file:** `test-overlay.html` in the project root demonstrates this visually with a toggle between center-origin (bug) and top-left-origin (fix).

### 2. Coordinate Order Swap

**Most common error!**
```typescript
// ❌ Wrong - This is lat/lon but MapLibre expects lon/lat
map.setCenter([latitude, longitude]);

// ✅ Correct
map.setCenter([longitude, latitude]);
```

### 3. Map Methods Changed

MapLibre doesn't have these Bing methods:
```typescript
// ❌ Bing Maps (doesn't exist in MapLibre)
map.getWidth()
map.getHeight()

// ✅ MapLibre
const container = map.getContainer();
const width = container.clientWidth;
const height = container.clientHeight;
```

### 4. TypeScript Version Matters

- **Must use TypeScript 4.9.5+** (not 3.6.3)
- MapLibre type definitions use modern syntax
- Older TypeScript can't parse MapLibre's `.d.ts` files

### 5. No Default Export

```typescript
// ❌ Wrong
import maplibregl from 'maplibre-gl';

// ✅ Correct
import * as maplibregl from 'maplibre-gl';
```

### 6. Power BI API Changes

Version 5.1.0 changed some types:
```typescript
// ❌ Old API
options.type === VisualUpdateType.Resize

// ✅ New API (const enums issue)
options.type === 2  // Resize value
```

### 7. CSS Import Required

```typescript
// Must import MapLibre CSS
import 'maplibre-gl/dist/maplibre-gl.css';
```

---

## 🔍 Where to Find Things

### "How do I...?"

**Change map style?**
- See: `src/lava/maplibre/controller.ts` → `createMapStyle()`
- Styles defined in `capabilities.json` → mapControl.type

**Add new geocoding provider?**
- See: `src/lava/maplibre/geoService.ts` → `makeRequest()`
- Add URL in `settings` object

**Modify flow appearance?**
- Colors: `src/flowmap/visual.ts` → color configuration
- Width: `src/flowmap/visual.ts` → width configuration
- Shape: `src/lava/flowmap/shape.ts` → `build()` function

**Change map tiles?**
- See: `src/lava/maplibre/controller.ts` → `createMapStyle()`
- Update `sources` object with new tile URL

**Add new Power BI setting?**
1. Add to `capabilities.json` → objects
2. Add to `src/flowmap/format.ts` → Format class
3. Use in `src/flowmap/visual.ts` → `_config()`

**Fix geocoding issues?**
- Check cache: `src/lava/maplibre/geoService.ts` → `getCacheSize()`
- Change provider: `settings.GeocodingService = 'photon'` or `'nominatim'`
- Adjust rate limit: `settings.MinRequestInterval`

---

## 📦 Dependencies

### Core Dependencies

```json
{
  "maplibre-gl": "^5.17.0",        // Map rendering (FREE!)
  "d3": "5.12.0",                  // Data visualization
  "powerbi-visuals-api": "~5.1.0"  // Power BI integration
}
```

### Why These Versions?

- **MapLibre 5.17.0**: Latest stable, full TypeScript support
- **D3 5.12.0**: Compatible with existing code, stable
- **Power BI API 5.1.0**: Required for modern Power BI features

**Don't upgrade blindly!** Power BI has specific version requirements.

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module 'maplibre-gl'"

**Solution:**
```bash
cd code && npm install
```

### Issue: "Package wasn't created. X errors found."

**Solution:**
1. Check TypeScript version: `npx tsc --version` (should be 4.9+)
2. Read error messages carefully
3. Look for coordinate order issues (lon/lat swap)
4. Check for missing imports

### Issue: "Map not rendering in Power BI"

**Solution:**
1. Check browser console (F12) for errors
2. Verify internet connection (map tiles load from web)
3. Check if custom visuals enabled in Power BI settings
4. Try clearing Power BI cache

### Issue: "Geocoding not working"

**Solution:**
1. Check internet connection
2. Use specific location names: "Paris, France" not just "Paris"
3. Try alternative geocoding service (Nominatim vs Photon)
4. Check browser console for API errors

### Issue: "SVG overlay (flows/pins/pies) not aligned with map"

**Solution:**
1. Check that the SVG root `<g>` uses `translate(0, 0)` in `controller.ts` `_resize()` — NOT `translate(w/2, h/2)`
2. Check that `flow.ts` mask rect uses `.att.x(0).att.y(0)` — NOT `.att.x(-w/2).att.y(-h/2)`
3. Check that `pin.ts` invalid pin placer uses top-left relative coords (e.g. `y: height - 20`) — NOT center-relative (e.g. `y: height/2 - 20`)
4. Open `test-overlay.html` in a browser to visually confirm coordinate alignment

**Root cause:** MapLibre's `map.project()` returns top-left-relative coordinates. If the SVG root is translated to the center, everything shifts by (w/2, h/2).

### Issue: "Build succeeds but visual crashes"

**Solution:**
1. Check for runtime errors in browser console
2. Verify all imports use correct paths
3. Look for coordinate conversion bugs
4. Test with minimal dataset first

---

## 📝 Common Tasks

### Add a New Map Style

1. **Add to capabilities.json:**
```json
{
  "displayName": "Satellite",
  "value": "satellite"
}
```

2. **Add to controller.ts:**
```typescript
function createMapStyle(fmt: IMapFormat) {
  if (fmt.type === 'satellite') {
    return {
      version: 8,
      sources: {
        'satellite': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256
        }
      },
      layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
    };
  }
  // ...
}
```

3. **Update format.ts:**
```typescript
type = 'road' as 'aerial' | 'road' | 'satellite' | 'grayscale' | ...
```

### Add Performance Monitoring

```typescript
// In app.ts
const start = performance.now();
// ... do work ...
const end = performance.now();
console.log(`Geocoding took ${end - start}ms`);
```

### Debug Geocoding

```typescript
// In geoService.ts, add logging
export function query(addr: string, then?: Func<ILocation, void>) {
  console.log('Geocoding:', addr);
  // ... existing code ...
}
```

---

## 🔐 Security Notes

**No Secrets in Code:**
- ✅ MapLibre requires NO API keys
- ✅ Photon geocoding requires NO API keys
- ✅ No credentials needed anywhere

**Safe for Public Repos:**
- All dependencies are open source
- No commercial API keys to leak
- No user data collected

---

## 📚 Reference Documentation

**Official Docs:**
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [Power BI Visuals](https://learn.microsoft.com/power-bi/developer/visuals/)
- [D3.js](https://d3js.org/)
- [TypeScript](https://www.typescriptlang.org/)

**Key APIs:**
- [Photon Geocoding](https://photon.komoot.io/)
- [Nominatim Geocoding](https://nominatim.org/release-docs/latest/api/Search/)
- [OpenStreetMap](https://wiki.openstreetmap.org/)

---

## 🎯 Code Quality Guidelines

### Before Committing:

1. **Build succeeds:** `npx pbiviz package` with no errors
2. **No console errors:** Test in Power BI Desktop
3. **TypeScript strict:** No `any` types added
4. **Comments added:** For non-obvious code
5. **Dependencies minimal:** Don't add unnecessary packages

### Code Review Checklist:

- [ ] Coordinate order correct (lon, lat)?
- [ ] SVG root origin at top-left (0,0), not center?
- [ ] Error handling in place?
- [ ] Performance acceptable (tested with 50+ flows)?
- [ ] No hardcoded credentials?
- [ ] Types properly defined?
- [ ] D3 wrapper (`selex`) used instead of raw D3?
- [ ] Map controller methods used correctly?

---

## 🚀 Future Enhancement Ideas

**Low Effort:**
- Add more map styles (different OSM styles)
- Improve error messages for failed geocoding
- Add loading indicators during geocoding
- Expose cache size in format panel

**Medium Effort:**
- Add clustering for 500+ flows
- Implement WebWorker for geocoding (parallel processing)
- Add custom tile source option
- Improve flow bundling algorithm

**High Effort:**
- Add 3D terrain visualization
- Implement animated flow paths
- Add heat map overlay option
- Support for Azure Maps (paid alternative)

---

## ⚡ Performance Tips

**Optimize Geocoding:**
- Pre-cache common locations
- Use coordinates (Lat/Lon fields) when possible
- Batch geocode during data prep, not in visual

**Optimize Rendering:**
- Limit to 100-200 flows for smooth performance
- Use flow bundling to reduce visual complexity
- Filter data before loading into visual

**Optimize Build:**
- Use production mode: `npx pbiviz package`
- Minimize dependencies
- Remove unused code

---

## 📌 Version History

**v2.0.0.0** (February 2026)
- ✅ Migrated from Bing Maps to MapLibre GL JS
- ✅ Added free geocoding (Photon API)
- ✅ Upgraded to TypeScript 4.9.5
- ✅ Upgraded to Power BI API 5.1.0
- ✅ Removed all API key requirements
- ✅ Fixed SVG overlay coordinate mismatch (center-origin → top-left-origin)
- ⚠️ Removed aerial/satellite view

**v1.4.9** (Previous)
- Used Bing Maps (now discontinued)
- Required Bing Maps API key
- Had aerial view capability

---

**This guide should help you navigate and modify this project successfully!**

For questions or issues, refer to:
- [README.md](README.md) - User documentation
- [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) - Technical migration details
- Source code comments (we use JSDoc where helpful)

**Happy coding! 🚀**
