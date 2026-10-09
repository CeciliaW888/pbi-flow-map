import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ILocation, IBound } from './converter';
import { anchorPixel, bound, anchor, fitOptions, area } from './converter';
import { keys, IPoint, partial } from '../type';
import { ISelex, selex } from '../d3';

type Map = maplibregl.Map;
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
  provider: BasemapProvider,
  apiKey: string
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

export function pixel(map: maplibregl.Map, loc: ILocation): IPoint {
  const point = map.project([loc.longitude, loc.latitude]);
  return { x: point.x, y: point.y };
}

export class MapFormat implements IMapFormat {
  type = 'road' as 'aerial' | 'road' | 'grayscale' | 'canvasDark' | 'canvasLight';
  lang = 'default';
  provider = 'openfreemap' as BasemapProvider;
  apiKey = '';
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
    let result = partial(fmt, ['type', 'lang', 'provider', 'apiKey', 'pan', 'zoom']) as any;
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

export function coordinate(map: maplibregl.Map, pixel: IPoint): ILocation {
  const lngLat = map.unproject([pixel.x, pixel.y]);
  return { latitude: lngLat.lat, longitude: lngLat.lng };
}

var capability = {
  "mapControl": {
    "displayName": "Map control",
    "properties": {
      "type": {
        "displayName": "Type", "type": {
          "enumeration": [
            { "displayName": "Road", "value": "road" },
            { "displayName": "Gray", "value": "grayscale" },
            { "displayName": "Dark", "value": "canvasDark" },
            { "displayName": "Light", "value": "canvasLight" },
            { "displayName": "Hidden", "value": "hidden" }
          ]
        }
      },
      "lang": {
        "displayName": "Language",
        "description": "The language used in the map",
        "type": {
          "enumeration": [
            { "displayName": "Default", "value": "default" },
            { "displayName": "Chinese", "value": "zh-HK" },
            { "displayName": "Czech", "value": "cs-CZ" },
            { "displayName": "Danish", "value": "da-DK" },
            { "displayName": "Dutch", "value": "nl-NL" },
            { "displayName": "English", "value": "en-US" },
            { "displayName": "Finnish", "value": "fi-FI" },
            { "displayName": "French", "value": "fr-FR" },
            { "displayName": "German", "value": "de-DE" },
            { "displayName": "Italian", "value": "it-IT" },
            { "displayName": "Japanese", "value": "ja-JP" },
            { "displayName": "Korean", "value": "Ko-KR" },
            { "displayName": "Norwegian(Bokmal)", "value": "nb-NO" },
            { "displayName": "Polish", "value": "pl-PL" },
            { "displayName": "Portuguese", "value": "pt-BR" },
            { "displayName": "Russian", "value": "ru-RU" },
            { "displayName": "Spanish", "value": "es-ES" },
            { "displayName": "Swedish", "value": "sv-SE" }
          ]
        }
      },
      "pan": { "displayName": "Pan", "type": { "bool": true } },
      "zoom": { "displayName": "Zoom", "type": { "bool": true } },
      "autofit": {
        "displayName": "Auto fit",
        "description": "Fit all data in the view when data changed",
        "type": { "bool": true }
      }
    }
  },
  "mapElement": {
    "displayName": "Map element",
    "properties": {
      "forest": { "displayName": "Forest", "type": { "bool": true } },
      "road": {
        "displayName": "Road", "type": {
          "enumeration": [
            { "displayName": "Default", "value": "color" },
            { "displayName": "Gray w/ label", "value": "gray_label" },
            { "displayName": "Gray w/o label", "value": "gray" },
            { "displayName": "Hidden", "value": "hidden" }
          ]
        }
      },
      "label": { "displayName": "Label", "type": { "bool": true } },
      "city": { "displayName": "City", "type": { "bool": true } },
      "icon": { "displayName": "Icon", "type": { "bool": true } },
      "building": { "displayName": "Building", "type": { "bool": true } },
      "area": { "displayName": "Area", "type": { "bool": true } },
      "scale": { "displayName": "Scale bar", "type": { "bool": true } }
    }
  }
}

/**
 * Basemap providers.
 *
 * OpenFreeMap is the default: free, no key, commercial use allowed.
 * CARTO is opt-in and needs the report author's own API key — since Aug 2026
 * CARTO serves keyless requests as HTTP-200 "API KEY REQUIRED" watermark
 * tiles, which no error-based fallback can detect.
 *
 * We deliberately do NOT fall back to other keyless tile servers (Esri, OSM):
 * their terms don't cover anonymous use in this visual, and OSM already blocks
 * us with ordinary-looking "Access blocked" image tiles. See adr/0002. If the
 * basemap fails, the visual shows a blank background plus a visible notice,
 * and flows still render.
 */
export type BasemapProvider = 'openfreemap' | 'carto';

const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

function openFreeMapStyleUrl(mapType: string): string {
  let style: string;
  switch (mapType) {
    case 'canvasDark':  style = 'dark'; break;
    case 'grayscale':
    case 'canvasLight': style = 'positron'; break;
    default:            style = 'liberty'; break;
  }
  return `https://tiles.openfreemap.org/styles/${style}`;
}

function cartoStyle(mapType: string, apiKey: string): maplibregl.StyleSpecification {
  let style: string;
  switch (mapType) {
    case 'canvasDark':  style = 'dark_all'; break;
    case 'grayscale':
    case 'canvasLight': style = 'light_all'; break;
    default:            style = 'rastertiles/voyager'; break;
  }
  const key = encodeURIComponent(apiKey);
  return {
    version: 8,
    sources: {
      'basemap': {
        type: 'raster',
        tiles: ['a', 'b', 'c', 'd'].map(s =>
          `https://${s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}@2x.png?key=${key}`
        ),
        tileSize: 256,
        maxzoom: 19,
        attribution: CARTO_ATTRIBUTION
      }
    },
    layers: [{ id: 'basemap-tiles', type: 'raster', source: 'basemap', minzoom: 0, maxzoom: 19 }]
  };
}

function blankStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#FFFFFF' } }]
  };
}

// The basemap (provider + map type + key) whose style failed to load. Kept
// across map recreations so we don't retry a dead server on every format
// change, but a different provider/type/key gets a fresh attempt.
let failedBasemap: string = null;

function basemapId(fmt: IMapFormat): string {
  return `${resolveProvider(fmt)}|${fmt.type}|${(fmt.apiKey || '').trim()}`;
}

/** Effective provider: CARTO only when chosen AND a key is supplied. */
function resolveProvider(fmt: IMapFormat): BasemapProvider {
  return fmt.provider === 'carto' && (fmt.apiKey || '').trim() ? 'carto' : 'openfreemap';
}

// OpenFreeMap's liberty/positron styles hide state/province borders below
// zoom 5/8, but flow maps usually sit at country zoom where users expect them
// (the old CARTO raster tiles showed them). The dark style already shows them.
const STATE_BORDER_LAYERS = ['boundary_3'];

function showStateBorders(map: Map): void {
  for (const id of STATE_BORDER_LAYERS) {
    const layer = map.getLayer(id);
    if (layer) {
      map.setLayerZoomRange(id, 0, layer.maxzoom === undefined ? 24 : layer.maxzoom);
      // The style's hsl(0,0%,70%) is too faint to read when zoomed out.
      map.setPaintProperty(id, 'line-color', 'hsl(0,0%,55%)');
    }
  }
}

function createMapStyle(fmt: IMapFormat): maplibregl.StyleSpecification | string {
  if (fmt.type === 'hidden' || failedBasemap === basemapId(fmt)) {
    return blankStyle();
  }
  if (resolveProvider(fmt) === 'carto') {
    return cartoStyle(fmt.type, fmt.apiKey.trim());
  }
  return openFreeMapStyleUrl(fmt.type);
}

export interface IListener {
  transform?(ctl: Controller, pzoom: number, end?: boolean): void;
  resize?(ctl: Controller): void;
}

export class Controller {
  private _div: HTMLDivElement;
  private _map: Map;
  private _pending: Map;
  private _fmt: IMapFormat;
  private _svg: ISelex;
  private _svgroot: ISelex;

  public get map() { return this._map; }

  public get format() { return this._fmt; }

  public get svg() { return this._svgroot; }

  private _canvas: ISelex;
  public get canvas() { return this._canvas; }

  public location(p: IPoint): ILocation {
    const lngLat = this._map.unproject([p.x, p.y]);
    return { latitude: lngLat.lat, longitude: lngLat.lng };
  }

  public setCenterZoom(center: { latitude: number, longitude: number }, zoom: number) {
    if (this._map) {
      const minZoom = this._map.getMinZoom();
      const maxZoom = this._map.getMaxZoom();
      zoom = Math.min(maxZoom, 20, Math.max(minZoom, 1, zoom));
      this._map.setCenter([center.longitude, center.latitude]);
      this._map.setZoom(zoom);
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
    const width = this._map.getContainer().clientWidth;
    const height = this._map.getContainer().clientHeight;
    const config = fitOptions(areas, { width, height });
    const minZoom = this._map.getMinZoom();

    if (config.zoom < minZoom) {
      config.zoom = minZoom;
      if (backupCenter) {
        config.center = [backupCenter.longitude, backupCenter.latitude];
      }
    }

    this._map.setCenter(config.center as [number, number]);
    this._map.setZoom(config.zoom);
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

  private _createMap(then?: Action<Map>): Map {
    const style = createMapStyle(this._fmt);

    const mapOptions: maplibregl.MapOptions = {
      container: this._div,
      style: style,
      center: this._map ? this._map.getCenter().toArray() : [0, 0],
      zoom: this._map ? this._map.getZoom() : 2,
      interactive: this._fmt.pan || this._fmt.zoom,
      scrollZoom: this._fmt.zoom,
      dragPan: this._fmt.pan,
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: this._fmt.zoom,
      touchPitch: false,
      doubleClickZoom: this._fmt.zoom,
      keyboard: this._fmt.pan || this._fmt.zoom,
      maxZoom: 18,
      minZoom: 1
    };

    // Old maps must be removed BEFORE constructing the new one: they share
    // this._div, and Map.remove() strips the 'maplibregl-map' class from it,
    // which would drop MapLibre's container CSS from the replacement.
    // A map whose style never loaded was never promoted to _map; drop it so
    // its canvas doesn't linger under the replacement.
    if (this._pending && this._pending !== this._map) {
      this._pending.remove();
    }

    // Remove old event handlers if map exists
    if (this._map) {
      this._map.off('move', this._moveHandler);
      this._map.off('moveend', this._moveEndHandler);
      this._map.off('resize', this._resizeHandler);
      this._map.remove();
    }

    const map = new maplibregl.Map(mapOptions);
    this._pending = map;

    // A style URL that fails to load means 'load' never fires, which would
    // leave the visual stuck with no flows. Detect that and rebuild on a blank
    // background so the data still renders, with a visible explanation.
    let styleLoaded = false;
    let switching = false;
    map.on('style.load', () => {
      styleLoaded = true;
      showStateBorders(map);
    });
    map.on('error', (e: any) => {
      if (styleLoaded || switching || failedBasemap === basemapId(this._fmt)) {
        return;
      }
      switching = true;
      failedBasemap = basemapId(this._fmt);
      console.warn('Basemap style failed to load', e && e.error);
      this._notice('Basemap unavailable — showing flows without a background map');
      setTimeout(() => this._createMap(then), 0);
    });

    if (this._fmt.provider === 'carto' && !(this._fmt.apiKey || '').trim() && this._fmt.type !== 'hidden') {
      this._notice('CARTO needs your API key (Format › Map control). Showing OpenFreeMap instead.');
    }

    // Set up event handlers
    map.on('load', () => {
      // Append canvas and SVG overlays
      const container = map.getCanvasContainer();
      this._canvas && container.appendChild(this._canvas.node());
      this._svg && container.appendChild(this._svg.node());

      this._map = map;
      // Also needed on recreation: the container may have resized while the
      // replacement map was loading, leaving overlay mask/canvas sizes stale.
      this._resize();
      then && then(map);
    });

    // Store handlers for cleanup
    this._moveHandler = () => this._viewChange(false);
    this._moveEndHandler = () => this._viewChange(true);
    this._resizeHandler = () => this._resize();

    map.on('move', this._moveHandler);
    map.on('moveend', this._moveEndHandler);
    map.on('resize', this._resizeHandler);

    return map;
  }

  private _moveHandler: () => void;
  private _moveEndHandler: () => void;
  private _resizeHandler: () => void;

  // Transient on-map note so tile-provider fallbacks are visible to the user
  // (tile failures are otherwise silent and hard to capture).
  private _notice(text: string) {
    if (!this._div) {
      return;
    }
    const note = document.createElement('div');
    note.textContent = text;
    note.style.cssText = 'position:absolute;left:8px;bottom:24px;z-index:10;' +
      'background:rgba(255,255,255,0.92);color:#444;font:11px sans-serif;' +
      'padding:3px 8px;border-radius:3px;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.25);';
    this._div.appendChild(note);
    setTimeout(() => note.remove(), 10000);
  }

  private _viewChange(end = false) {
    if (!this._map) return;
    let zoom = this._map.getZoom();
    for (let l of this._listener) {
      l.transform && l.transform(this, this._zoom, end);
    }
    this._zoom = zoom;
  }

  private _zoom: number;

  private _resize(): void {
    if (!this._map) {
      return;
    }
    const container = this._map.getContainer();
    let w = container.clientWidth;
    let h = container.clientHeight;
    this._svg.att.width('100%').att.height('100%');
    this._canvas && this._canvas.att.size(w, h);
    this._svgroot.att.translate(0, 0);
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
    const remap = { type: 1, provider: 1, apiKey: 1, label: 1, forest: 1, road: 1, city: 1, icon: 1, area: 1, building: 1 };
    let needsRemap = false;

    for (var k in dirty) {
      if (k in remap) {
        needsRemap = true;
        break;
      }
    }

    if (needsRemap || !this._map) {
      setTimeout(() => {
        this._createMap(then);
      }, 0);
      return this;
    }

    // Handle interactive settings
    if ('pan' in dirty) {
      if (dirty.pan) {
        this._map.dragPan.enable();
        this._map.keyboard.enable();
      } else {
        this._map.dragPan.disable();
        if (!this._fmt.zoom) {
          this._map.keyboard.disable();
        }
      }
    }

    if ('zoom' in dirty) {
      if (dirty.zoom) {
        this._map.scrollZoom.enable();
        this._map.doubleClickZoom.enable();
        this._map.touchZoomRotate.enable();
        this._map.keyboard.enable();
      } else {
        this._map.scrollZoom.disable();
        this._map.doubleClickZoom.disable();
        this._map.touchZoomRotate.disable();
        if (!this._fmt.pan) {
          this._map.keyboard.disable();
        }
      }
    }

    then(null);
    return this;
  }
}
