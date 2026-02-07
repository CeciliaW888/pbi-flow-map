# Azure Maps Upgrade Guide

This guide explains how to upgrade from the free MapLibre GL JS implementation to Azure Maps (Microsoft's paid mapping service) if you need premium features.

---

## 🤔 Should You Upgrade?

### Stay with MapLibre (Free) If:

✅ Current functionality meets your needs
✅ OpenStreetMap data quality is sufficient
✅ You don't need Microsoft support
✅ Budget is a concern ($0 vs $0-500+/month)
✅ You don't need premium features (see below)

### Upgrade to Azure Maps If:

✅ You need **official Microsoft support**
✅ You want **premium map data** (HERE Technologies)
✅ You need **traffic layer** visualization
✅ You want **advanced POI data** (points of interest)
✅ You need **indoor mapping** capabilities
✅ You require **Microsoft ecosystem integration**
✅ Your company has an **Azure Enterprise Agreement**

---

## 💰 Cost Analysis

### MapLibre (Current - FREE)

| Feature | Cost |
|---------|------|
| Map tile requests | $0 |
| Geocoding | $0 |
| API calls | $0 |
| Monthly total | **$0** |

### Azure Maps (Paid)

**Pricing (as of 2026):**

| Tier | Monthly Transactions | Cost |
|------|---------------------|------|
| **Free Tier** | 1,000 map tiles + 1,000 geocodes | $0 |
| **S0 Tier** | Per transaction pricing | ~$4-6 per 1,000 transactions |
| **S1 Tier** | Unlimited + premium features | ~$500/month |

**Typical Power BI Usage:**
- 10 users × 100 refreshes/day × 30 days = 30,000 transactions/month
- **Estimated cost:** $120-180/month on S0 tier
- **Annual cost:** ~$1,440-2,160/year

**Enterprise Agreement:**
- Significantly lower costs with Microsoft EA
- May already be included in your agreement
- Contact your Microsoft account manager

---

## 🆚 Feature Comparison

| Feature | MapLibre (Free) | Azure Maps (Paid) |
|---------|----------------|-------------------|
| **Base Maps** | ✅ OpenStreetMap | ✅ HERE, TomTom |
| **Map Styles** | ✅ 5 styles | ✅ 20+ styles |
| **Geocoding** | ✅ Photon/Nominatim | ✅ Azure Search |
| **Traffic Layer** | ❌ No | ✅ Real-time traffic |
| **Satellite Imagery** | ⚠️ Limited (free sources) | ✅ High-res satellite |
| **POI Data** | ✅ Basic (OSM) | ✅ Premium (HERE) |
| **Indoor Maps** | ❌ No | ✅ Yes |
| **Routing** | ❌ Not implemented | ✅ Advanced routing |
| **Geofencing** | ❌ No | ✅ Yes |
| **Support** | ✅ Community | ✅ Microsoft Support |
| **SLA** | ❌ None | ✅ 99.9% uptime |
| **Data Privacy** | ✅ GDPR compliant | ✅ GDPR + EU Data Boundary |

---

## 🔧 Upgrade Process

### Prerequisites

1. **Azure Subscription**
   - Create at: https://azure.microsoft.com/free/
   - Or use existing subscription

2. **Azure Maps Account**
   - Go to Azure Portal: https://portal.azure.com
   - Search for "Azure Maps"
   - Click "Create"
   - Select pricing tier (S0 or S1)
   - Note your **Subscription Key**

### Step-by-Step Upgrade

#### 1. Install Azure Maps SDK

```bash
cd code

# Remove MapLibre
npm uninstall maplibre-gl

# Install Azure Maps
npm install azure-maps-control azure-maps-rest
```

Update `package.json`:
```json
{
  "dependencies": {
    "azure-maps-control": "^3.0.0",
    "azure-maps-rest": "^3.0.0",
    // ... other dependencies
  }
}
```

#### 2. Create Azure Maps Controller

Create new file: `/code/src/lava/azuremaps/controller.ts`

```typescript
import * as atlas from 'azure-maps-control';
import 'azure-maps-control/dist/atlas.min.css';
import { ILocation, IBound } from './converter';
import { anchorPixel, bound, anchor, fitOptions, area } from './converter';
import { keys, IPoint, partial } from '../type';
import { ISelex, selex } from '../d3';

type Map = atlas.Map;
type Action<T> = (a: T) => void;

export interface IMapElement {
  forest: boolean,
  label: boolean,
  road: "color" | "gray" | 'gray_label' | "hidden",
  icon: boolean,
  area: boolean,
  building: boolean,
  city: boolean,
  scale: boolean
}

export interface IMapControl {
  type: 'hidden' | 'aerial' | 'road' | 'grayscale' | 'canvasDark' | 'canvasLight',
  lang: string,
  pan: boolean,
  zoom: boolean,
  subscriptionKey: string  // NEW: Azure Maps key
}

export interface IMapFormat extends IMapControl, IMapElement { }

export function defaultZoom(width: number, height: number): number {
  const min = Math.min(width, height);
  for (var level = 1; level < 20; level++) {
    if (256 * Math.pow(2, level) > min) {
      break;
    }
  }
  return level;
}

export function pixel(map: atlas.Map, loc: ILocation): IPoint {
  const point = map.positionsToPixels([loc.longitude, loc.latitude])[0];
  return { x: point[0], y: point[1] };
}

export class MapFormat implements IMapFormat {
  type = 'road' as 'aerial' | 'road' | 'grayscale' | 'canvasDark' | 'canvasLight';
  lang = 'default';
  pan = true;
  zoom = true;
  city = false;
  road = "color" as "color" | "gray" | 'gray_label' | "hidden";
  label = true;
  forest = true;
  icon = false;
  building = false;
  area = false;
  scale = false;
  subscriptionKey = '';  // Set from Power BI settings

  public static build(...fmts: any[]): MapFormat {
    var ret = new MapFormat();
    for (let f of fmts.filter(v => v)) {
      for (var key in ret) {
        if (key in f) {
          ret[key] = f[key];
        }
      }
    }
    return ret;
  }

  public static control<T>(fmt: MapFormat, extra: T): IMapControl & T {
    let result = partial(fmt, ['type', 'lang', 'pan', 'zoom', 'subscriptionKey']) as any;
    for (let key in extra) {
      result[key] = extra[key];
    }
    return result;
  }

  public static element<T>(fmt: MapFormat, extra: T): IMapElement & T {
    let result = partial(fmt, ['road', 'forest', 'label', 'city', 'icon', 'building', 'area', 'scale']) as any;
    for (let key in extra) {
      result[key] = extra[key];
    }
    return result;
  }
}

export function coordinate(map: atlas.Map, pixel: IPoint): ILocation {
  const position = map.pixelsToPositions([[pixel.x, pixel.y]])[0];
  return { latitude: position[1], longitude: position[0] };
}

export interface IListener {
  transform?(ctl: Controller, pzoom: number, end?: boolean): void;
  resize?(ctl: Controller): void;
}

export class Controller {
  private _div: HTMLDivElement;
  private _map: Map;
  private _fmt: IMapFormat;
  private _svg: ISelex;
  private _svgroot: ISelex;

  public get map() { return this._map; }
  public get format() { return this._fmt; }
  public get svg() { return this._svgroot; }

  private _canvas: ISelex;
  public get canvas() { return this._canvas; }

  public location(p: IPoint): ILocation {
    const position = this._map.pixelsToPositions([[p.x, p.y]])[0];
    return { latitude: position[1], longitude: position[0] };
  }

  public setCenterZoom(center: { latitude: number, longitude: number }, zoom: number) {
    if (this._map) {
      this._map.setCamera({
        center: [center.longitude, center.latitude],
        zoom: zoom
      });
    }
  }

  public pixel(loc: ILocation | IBound): IPoint {
    if ((loc as IBound).anchor) {
      return anchorPixel(this._map, loc as any);
    }
    else {
      return pixel(this._map, loc as any);
    }
  }

  public anchor(locs: ILocation[]) { return anchor(locs); }
  public area(locs: ILocation[], level = 20) { return area(locs, level); }
  public bound(locs: ILocation[]): IBound { return bound(locs); }

  private _listener = [] as IListener[];
  public add(v: IListener) { this._listener.push(v); return this; }

  public fitView(areas: IBound[], backupCenter?: ILocation) {
    const container = this._map.getMapContainer();
    const width = container.clientWidth;
    const height = container.clientHeight;
    const config = fitOptions(areas, { width, height });

    if (config.zoom < 1) {
      config.zoom = 1;
      if (backupCenter) {
        config.center = [backupCenter.longitude, backupCenter.latitude];
      }
    }

    this._map.setCamera({
      center: config.center as [number, number],
      zoom: config.zoom
    });
    this._viewChange(false);
  }

  constructor(id: string) {
    const div = selex(id).node<HTMLDivElement>();
    this._fmt = {} as IMapFormat;
    this._div = div;

    let config = (root: ISelex) => {
      root.att.tabIndex(-1)
        .sty.pointer_events('none')
        .sty.position('absolute')
        .sty.visibility('inherit')
        .sty.user_select('none');
      return root;
    };

    this._canvas = config(selex(div).append('canvas'));
    this._svg = config(selex(div).append('svg'));
    this._svgroot = this._svg.append('g').att.id('root');
  }

  private _createMap(): Map {
    const mapStyle = this._getMapStyle(this._fmt.type);

    const map = new atlas.Map(this._div, {
      authOptions: {
        authType: atlas.AuthenticationType.subscriptionKey,
        subscriptionKey: this._fmt.subscriptionKey
      },
      center: this._map ? this._map.getCamera().center : [0, 0],
      zoom: this._map ? this._map.getCamera().zoom : 2,
      style: mapStyle,
      language: this._fmt.lang !== 'default' ? this._fmt.lang : 'en-US',
      showFeedbackLink: false,
      showLogo: false,
      interactive: this._fmt.pan || this._fmt.zoom,
      dragPanInteraction: this._fmt.pan,
      scrollZoomInteraction: this._fmt.zoom,
      dblClickZoomInteraction: this._fmt.zoom,
      touchInteraction: this._fmt.pan || this._fmt.zoom
    });

    // Remove old event handlers
    if (this._map) {
      this._map.events.remove('moveend', this._moveEndHandler);
      this._map.events.remove('resize', this._resizeHandler);
      this._map.dispose();
    }

    // Set up event handlers
    map.events.add('ready', () => {
      const container = map.getMapContainer();
      this._canvas && container.appendChild(this._canvas.node());
      this._svg && container.appendChild(this._svg.node());

      if (!this._map) {
        this._map = map;
        this._resize();
      } else {
        this._map = map;
      }
    });

    this._moveEndHandler = () => this._viewChange(true);
    this._resizeHandler = () => this._resize();

    map.events.add('moveend', this._moveEndHandler);
    map.events.add('resize', this._resizeHandler);

    return map;
  }

  private _getMapStyle(type: string): string {
    const styles = {
      'road': 'road',
      'aerial': 'satellite_road_labels',
      'grayscale': 'grayscale_light',
      'canvasDark': 'night',
      'canvasLight': 'road',
      'hidden': 'blank'
    };
    return styles[type] || 'road';
  }

  private _moveEndHandler: () => void;
  private _resizeHandler: () => void;

  private _viewChange(end = false) {
    if (!this._map) return;
    let zoom = this._map.getCamera().zoom;
    for (let l of this._listener) {
      l.transform && l.transform(this, this._zoom, end);
    }
    this._zoom = zoom;
  }

  private _zoom: number;

  private _resize(): void {
    if (!this._map) return;
    const container = this._map.getMapContainer();
    let w = container.clientWidth;
    let h = container.clientHeight;
    this._svg.att.width('100%').att.height('100%');
    this._canvas && this._canvas.att.size(w, h);
    this._svgroot.att.translate(w / 2, h / 2);
    for (let l of this._listener) {
      l.resize && l.resize(this);
    }
  }

  private _then: Action<Map>;

  restyle(fmt: Partial<IMapFormat>, then?: Action<Map>): Controller {
    then = then || (() => { });
    var dirty = {} as Partial<IMapFormat>;

    for (var k in fmt) {
      if (fmt[k] !== this._fmt[k]) {
        dirty[k] = this._fmt[k] = fmt[k];
      }
    }

    if (keys(dirty).length === 0 && this._map) {
      return this;
    }

    // Check if we need to recreate the map
    const remap = { type: 1, label: 1, forest: 1, road: 1, city: 1, icon: 1, area: 1, building: 1, subscriptionKey: 1 };
    let needsRemap = false;

    for (var k in dirty) {
      if (k in remap) {
        needsRemap = true;
        break;
      }
    }

    if (needsRemap || !this._map) {
      setTimeout(() => {
        const newMap = this._createMap();
        newMap.events.add('ready', () => then(newMap));
      }, 0);
      return this;
    }

    // Handle interactive settings
    if ('pan' in dirty || 'zoom' in dirty) {
      this._map.setUserInteraction({
        dragPanInteraction: this._fmt.pan,
        scrollZoomInteraction: this._fmt.zoom,
        dblClickZoomInteraction: this._fmt.zoom,
        touchInteraction: this._fmt.pan || this._fmt.zoom
      });
    }

    then(null);
    return this;
  }
}
```

#### 3. Create Azure Geocoding Service

Create new file: `/code/src/lava/azuremaps/geoService.ts`

```typescript
import * as atlas from 'azure-maps-rest';
import { copy } from '../type';
import { ILocation } from './converter';
import { Func, StringMap, keys } from '../type';

var _injected = {} as StringMap<ILocation>;

export function inject(locs: StringMap<ILocation>, reset = false): void {
    locs = locs || {};
    if (reset) {
        _injected = locs;
        return;
    }
    for (var key of keys(locs)) {
        var loc = locs[key];
        if (loc) {
            _injected[key] = loc;
        }
        else {
            delete _injected[key];
        }
    }
}

export function remove(where: Func<ILocation, boolean>): void {
    for (var key of keys(_injected)) {
        if (where(_injected[key])) {
            delete _injected[key];
        }
    }
}

export function latitude(addr: string): number {
    var loc = query(addr);
    if (loc) {
        return loc.latitude;
    }
    else {
        return null;
    }
}

export function longitude(addr: string): number{
    var loc = query(addr);
    if (loc) {
        return loc.longitude;
    }
    else {
        return null;
    }
}

export function query(addr: string): ILocation;
export function query(addr: string, then: Func<ILocation, void>): void;
export function query(addr: string, then?: Func<ILocation, void>): any {
    if (then) {
        var loc = _injected[addr];
        if (loc) {
            loc.address = addr;
            then(loc);
        }
        else if (addr in _initCache) {
            loc = _initCache[addr];
            loc.address = addr;
            then(loc);
        }
        else {
            geocodeCore(new GeocodeQuery(addr), then);
        }
        return undefined;
    }
    else {
        if (_injected[addr]) {
            return _injected[addr];
        }
        else if (_initCache[addr]) {
            return _initCache[addr];
        }
        var rec = geocodeCache[addr.toLowerCase()];
        if (rec) {
            rec.query.incrementCacheHit();
            return rec.coordinate;
        }
        return null;
    }
}

var _initCache = {} as StringMap<ILocation>;
export function initCache(locs: StringMap<ILocation>) {
    _initCache = copy(locs);
}

export var settings = {
    // Azure Maps settings
    MaxConcurrentRequests: 10,  // Azure allows more concurrent requests
    MinRequestInterval: 100,     // Faster than free services

    // Maximum cache size
    MaxCacheSize: 3000,
    MaxCacheSizeOverflow: 1000,

    // Azure Maps subscription key
    SubscriptionKey: '',  // Set from Power BI settings

    // Azure Search API URL
    AzureSearchURL: "https://atlas.microsoft.com/search/address/json"
};

// ... rest of the geocoding implementation similar to MapLibre version
// but using Azure Maps Search API instead of Photon/Nominatim
```

#### 4. Update Capabilities

Add Azure Maps key setting to `/code/capabilities.json`:

```json
{
  "objects": {
    "mapControl": {
      "displayName": "Map control",
      "properties": {
        "azureMapsKey": {
          "displayName": "Azure Maps Subscription Key",
          "description": "Your Azure Maps subscription key (required)",
          "type": { "text": true }
        },
        // ... other properties
      }
    }
  }
}
```

#### 5. Update Format Settings

In `/code/src/flowmap/format.ts`:

```typescript
export class Format {
    mapControl = {
        type: 'road',
        lang: 'default',
        pan: true,
        zoom: true,
        autoFit: true,
        azureMapsKey: ''  // NEW: Azure Maps key
    };
    // ... rest unchanged
}
```

#### 6. Update Imports

Change all imports from `maplibre` to `azuremaps`:

```bash
# Find and replace in all files
find ./src -type f -name "*.ts" -exec sed -i 's/from.*maplibre/from..\/azuremaps/g' {} +
```

Or manually update:
```typescript
// Before
import { Controller, MapFormat, GeoQuery, ILocation } from '../lava/maplibre';

// After
import { Controller, MapFormat, GeoQuery, ILocation } from '../lava/azuremaps';
```

#### 7. Build and Test

```bash
cd code
npm install
npx pbiviz package
```

---

## 🧪 Testing the Upgrade

1. **Get your Azure Maps key** from Azure Portal
2. **Import the new visual** into Power BI Desktop
3. **Configure the key:**
   - Add visual to report
   - Open Format panel
   - Enter your Azure Maps subscription key in "Map control" section
4. **Test with sample data:**
   - Verify map loads
   - Check geocoding works
   - Try different map styles
   - Test traffic layer (if S1 tier)

---

## 🔄 Rollback Plan

If you need to revert to MapLibre:

1. **Keep MapLibre code:**
   ```bash
   # Don't delete /src/lava/maplibre/ folder
   # Just create /src/lava/azuremaps/ alongside it
   ```

2. **Use Git branching:**
   ```bash
   git checkout -b azure-maps-upgrade
   # Make all changes in this branch
   # Keep main branch on MapLibre
   ```

3. **Maintain both versions:**
   - Keep MapLibre as default
   - Offer Azure Maps as "premium" version
   - Let users choose based on their needs

---

## 📊 Migration Checklist

### Pre-Migration

- [ ] Obtain Azure subscription
- [ ] Create Azure Maps resource
- [ ] Get subscription key
- [ ] Backup current working visual
- [ ] Review pricing and budget approval

### Migration

- [ ] Install Azure Maps SDK
- [ ] Create Azure Maps controller
- [ ] Create Azure geocoding service
- [ ] Update capabilities.json
- [ ] Update format.ts
- [ ] Update all imports
- [ ] Build and package

### Post-Migration

- [ ] Test in Power BI Desktop
- [ ] Verify all map styles work
- [ ] Test geocoding with various locations
- [ ] Check performance with large datasets
- [ ] Monitor Azure Maps usage/costs
- [ ] Update documentation

---

## 💡 Best Practices

### API Key Security

**Don't hardcode keys!**
```typescript
// ❌ Bad - hardcoded key
const key = 'your-azure-key-here';

// ✅ Good - from Power BI settings
const key = this._ctx.meta.mapControl.azureMapsKey;
```

**Validate key before use:**
```typescript
if (!key || key.trim() === '') {
    throw new Error('Azure Maps subscription key is required. Please add it in the Format panel.');
}
```

### Cost Optimization

1. **Use caching aggressively** (3000+ items)
2. **Pre-geocode locations** in data prep when possible
3. **Use coordinates** (Lat/Lon fields) to avoid geocoding
4. **Monitor usage** in Azure Portal
5. **Set up alerts** for unusual usage spikes

### Performance

1. **Batch geocoding** - queue requests
2. **Lazy load map tiles** - only load what's visible
3. **Debounce pan/zoom** - reduce tile requests
4. **Optimize data** - filter before loading into visual

---

## 🆘 Troubleshooting

### Issue: "Authentication failed"

**Cause:** Invalid or missing subscription key

**Solution:**
1. Verify key in Azure Portal
2. Check key is entered correctly in Power BI Format panel
3. Ensure key hasn't expired
4. Try regenerating key in Azure Portal

### Issue: "Billing disabled"

**Cause:** Azure subscription payment issue

**Solution:**
1. Check Azure subscription status
2. Verify payment method on file
3. Check for any holds on subscription

### Issue: "Map not loading"

**Cause:** Network/firewall blocking Azure endpoints

**Solution:**
1. Whitelist `*.azure.com` in firewall
2. Check corporate proxy settings
3. Test from different network

### Issue: "High costs"

**Cause:** Excessive API calls

**Solution:**
1. Enable caching (should already be implemented)
2. Use Lat/Lon fields to skip geocoding
3. Aggregate data before loading
4. Consider downgrading to S0 tier

---

## 📞 Support

### Azure Maps Support

- **Documentation:** https://learn.microsoft.com/azure/azure-maps/
- **API Reference:** https://learn.microsoft.com/rest/api/maps/
- **Pricing:** https://azure.microsoft.com/pricing/details/azure-maps/
- **Support Portal:** https://portal.azure.com → Support

### Microsoft Enterprise Support

If you have a Microsoft Enterprise Agreement:
- Contact your Microsoft account manager
- Open a support ticket via Azure Portal
- May get preferential pricing or included allocation

---

## 🎯 Summary

**When to upgrade:**
- Need premium features (traffic, POI, routing)
- Require Microsoft support
- Have Azure EA with included credits
- Budget allows ($100-500+/month)

**Upgrade effort:** ~4-8 hours
**Code changes:** Minimal (~200 lines)
**Reversibility:** Easy (keep MapLibre code)
**Cost:** $0-500+/month depending on usage

**Recommendation:**
- Start with free MapLibre
- Upgrade to Azure Maps only if specific premium features needed
- Consider hybrid: MapLibre for most users, Azure for premium reports

---

**Questions?** Refer to:
- Azure Maps documentation
- This project's CLAUDE.md for development guidance
- Migration summary for technical details
