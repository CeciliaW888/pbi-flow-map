import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { Persist, Context, tooltip, Fill } from "../pbi";
import { visualObjects as numberObjects, build as numberFormat } from '../pbi/numberFormat';
import { coords } from '../pbi/misc';
import { Format } from "./format";

import { override, groupBy, StringMap, Func, copy, values, sort, dict } from '../lava/type';
import { selex } from "../lava/d3";
import { MapFormat, ILocation } from "../lava/maplibre";
import * as app from '../lava/flowmap/app';
import { keys, sum } from "d3";

// Set to true to enable the on-screen debug overlay during development.
// Must be false for production/AppSource builds.
const DEBUG = false;

type Role = 'Origin' | 'Dest' | 'width' | 'color' | 'OLati' | 'OLong' | 'DLati' | 'DLong' | 'OName' | 'DName' | 'Tooltip' | 'Label';
type Read<T> = Func<number, T>;
type Ctx = Context<Role, Format>;

const persist = {
    map: new Persist<[[number, number], number]>('persist', 'map'),  // [lon, lat], zoom
    geocode: new Persist<StringMap<ILocation>>('persist', 'geocoding'),
    manual: new Persist<StringMap<ILocation>>('persist', 'manual'),
    banner: new Persist<string[]>('persist', 'banner')
} as const;

class helper {
    private static _items(ctx: Ctx, role: Role = 'Tooltip'): Read<string[]> {
        const conv = numberFormat(ctx.meta.valueFormat);
        const values = (ctx.roles.columns(role) || []).map(c => c.values);
        return r => values.map(c => typeof c[r] === 'number' ? conv(+c[r]) : c[r] + '');
    }

    private static _tips(ctx: Ctx, rows: number[], name: Read<string>, header: string, value: Read<string[]>) {
        const tops = helper._top(ctx, rows), color = ctx.cat('color') && ctx.meta.color.customize;
        const rowToColor = (r: number) => color ? app.$state.color(r) : undefined;
        const result = tops.map(r => tooltip.item(value(r).join(', '), name(r), header, rowToColor(r)));
        if (tops.length < rows.length) {
            result.push(tooltip.item(`(${rows.length - tops.length} more)`, `...`, header, color ? '#00000000' : undefined));
        }
        return result;
    }

    public static pieTooltip(rows: number[], type: 'in' | 'out', ctx: Ctx): VisualTooltipDataItem[] {
        const src = ctx.cat('OName') ? ctx.key('OName') : ctx.key('Origin');
        const tar = ctx.cat('DName') ? ctx.key('DName') : ctx.key('Dest');
        const [header, name] = type === 'out' ? [src(rows[0]), tar] : [tar(rows[0]), src];
        if (!ctx.cat('Tooltip')) {
            return [tooltip.item(header)];
        }
        const items = helper._items(ctx), names = ctx.columns('Tooltip').map(c => c.source.displayName);
        if (rows.length === 1) {
            return items(rows[0]).map((v, i) => tooltip.item(v, names[i], header));
        }
        else {
            return helper._tips(ctx, rows, name, header, items);
        }
    }

    public static description(role: Role, ctx: Ctx): Read<string> {
        if (!ctx.roles.exist(role)) {
            return null;
        }
        const items = helper._items(ctx, role);
        return r => items(r).join(', ');
    }

    private static _top(ctx: Ctx, rows: number[]) {
        const { sort, top } = ctx.meta.valueFormat, w = app.$state.config.weight.conv;
        if (w) {
            rows = sort === 'des' ? rows.sort((a, b) => w(b) - w(a)) : rows.sort((a, b) => w(a) - w(b));
        }
        return +top >= rows.length ? rows : rows.slice(0, +top);
    }

    public static pathTooltip(ctx: Ctx, rows: number[], type: 'in' | 'out'): VisualTooltipDataItem[] {
        const src = ctx.cat('OName') ? ctx.key('OName') : ctx.key('Origin');
        const tar = ctx.cat('DName') ? ctx.key('DName') : ctx.key('Dest');
        if (!ctx.cat('Tooltip')) {
            if (type === 'out') {
                return [tooltip.item(src(rows[0]), 'From'), tooltip.item(rows.map(tar).join(', '), 'To')];
            }
            else {
                return [tooltip.item(tar(rows[0]), 'To'), tooltip.item(rows.map(src).join(', '), 'From')];
            }
        }
        const items = helper._items(ctx), names = ctx.columns('Tooltip').map(c => c.source.displayName);
        if (rows.length === 1) {
            return items(rows[0]).map((v, i) => tooltip.item(v, names[i], src(rows[0]) + ' → ' + tar(rows[0])));
        }
        else {
            const [header, name] = type === 'out' ? ['(From) ' + src(rows[0]), tar] : ['(To) ' + tar(rows[0]), src];
            return helper._tips(ctx, rows, name, header, items);
        }
    }
}
export class Visual implements IVisual {
    private _target: HTMLElement;
    private _ctx = null as Ctx;
    private _cfg = null as app.Config;
    constructor(options: VisualConstructorOptions) {
        if (!options) {
            return;
        }
        selex(this._target = options.element).sty.cursor('default');

        // Debug overlay — shows update() calls and code paths.
        // Controlled by the DEBUG flag at the top of this file.
        if (DEBUG) {
            const debugBox = document.createElement('div');
            debugBox.id = 'pbi-debug';
            debugBox.style.cssText = 'position:absolute;top:8px;left:8px;z-index:9999;background:rgba(0,0,0,0.75);color:#0f0;font:9px/1.3 monospace;padding:4px 6px;border-radius:4px;max-height:30%;max-width:40%;overflow-y:auto;pointer-events:auto;';
            debugBox.innerHTML = '<div style="color:#fff;font-weight:bold;margin-bottom:4px;">DEBUG: update() log</div>';
            this._target.appendChild(debugBox);
            this._debugBox = debugBox;
            this._debugCount = 0;
            app.$state.log = (msg: string) => this._dbg(msg, '#6cf');
        }

        tooltip.init(options);
        const ctx = this._ctx = new Context(options.host, new Format());
        ctx.fmt.width.bind('width', "item", "customize");
        ctx.fmt.color.bind("color", "item", 'customize', 'autofill', k => <Fill>{ solid: { color: ctx.palette(k) } });
        ctx.fmt.legend.bind('width', 'width_label', 'width', 'width_default', '');
        ctx.fmt.legend.bind('color', 'color_label', 'color', 'color_default', '');
        app.events.flow.pathInited = group => {
            tooltip.add(group, arg => helper.pathTooltip(this._ctx, arg.data.leafs as number[], ctx.meta.style.direction));
        };
        app.events.doneGeocoding = locs => {
            copy(locs, persist.geocode.value({}));
            ctx.meta.advance.cache && persist.geocode.write(persist.geocode.value(), 10);
        }
        app.events.popup.onChanged = addrs => persist.banner.write(addrs, 10);
        app.events.pin.onDrag = (addr, loc) => {
            persist.manual.value({})[addr] = this._cfg.injections[addr] = loc;
        };
        app.events.pie.onPieCreated = group => {
            tooltip.add(group, arg => helper.pieTooltip(arg.data.rows, arg.data.type, this._ctx));
        };
    }

    private _buildLegendLabels(role: 'color' | 'width'): StringMap<string> {
        const ctx = this._ctx, legend = ctx.fmt.legend;
        const autofill = role === 'color' ? 'color_default' : 'width_default';
        const label = role === 'color' ? 'color_label' : 'width_label';
        if (!legend.config(role)) {
            return {};//hide
        }
        const cat = ctx.cat(role);
        if (!cat || !ctx.meta[role].customize) {
            const txt = (legend.config(label) || '').trim();
            return txt ? { [ctx.config(role, 'item')]: txt } : {};
        }
        else if (cat.type.numeric) {
            return null;//smooth
        }
        else {
            //has cat && distinct
            const labels = ctx.labels(ctx.binding(role, 'item'), legend.special(label));
            if (legend.config(autofill)) {
                return dict(labels, r => r.key, r => r.value || r.name);
            }
            else {
                return dict(labels.filter(a => a.value), r => r.key, r => r.value);
            }
        }
    }

    private _config(): app.Config {
        const config = new app.Config(), ctx = this._ctx;
        /* #region  legend */
        override(ctx.meta.legend, config.legend);
        config.legend.colorLabels = this._buildLegendLabels('color');
        config.legend.widthLabels = this._buildLegendLabels('width');
        /* #endregion */

        /* #region  numberSorter, numberFormat */
        override(ctx.meta.valueFormat, config.numberSorter);
        override(ctx.meta.valueFormat, config.numberFormat);
        /* #endregion */

        if (!ctx.cat('Origin')) {
            config.error = '"Origin" field is required.';
        }
        else if (!ctx.cat('Dest')) {
            config.error = '"Destination" field is required.'
        }

        /* #endregion */

        /* #region  source, target, label */
        config.source = ctx.key('Origin');
        config.target = ctx.key('Dest');
        config.popup = {
            description: helper.description('Label', ctx),
            origin: ctx.cat('OName') ? ctx.key('OName') : config.source,
            destination: ctx.cat('DName') ? ctx.key('DName') : config.target
        };

        let sourceRole = 'Origin' as Role;
        let groups = null as number[][];

        //swith source/target
        if (ctx.meta.style.direction === 'in') {
            [config.source, config.target] = [config.target, config.source];
            sourceRole = 'Dest';
        }
        /* #endregion */

        /* #region  color */
        if (!ctx.cat('color') || !ctx.meta.color.customize) {
            const color = ctx.config('color', 'item');
            config.color = _ => color;
        }
        else if (ctx.type('color').numeric) {
            const values = ctx.nums('color');
            config.color = r => values[r];
            config.color.min = ctx.config('color', 'min');
            config.color.max = ctx.config('color', 'max');
        }
        else {
            config.color = ctx.fmt.color.item('item');
        }
        /* #endregion */

        /* #region  update style */
        config.style = ctx.meta.style.style;
        if (config.style === null) {
            if (config.color.max) {
                config.style = ctx.rows().length < 512 ? 'arc' : 'straight';
            }
            else {
                groups = values(groupBy(ctx.rows(), ctx.key(sourceRole, 'color')));
                if (keys(groups).length <= ctx.meta.style.limit) {
                    config.style = 'flow';
                }
                else {
                    config.style = ctx.rows().length < 512 ? 'arc' : 'straight';
                }
            }
        }
        else if (config.style === 'flow') {
            if (config.color.max) {
                config.style = ctx.rows().length < 512 ? 'arc' : 'straight';
            }
        }
        /* #endregion */

        /* #region  width */
        if (!ctx.cat('width') || ctx.type('width').numeric) {
            const { max, min, item, unit, scale } = ctx.meta.width;
            if (config.style !== 'flow' && !ctx.cat('width')) {
                config.weight = { conv: _ => item, scale: null };
            }
            else {
                const values = ctx.nums('width'), conv: Read<number> = (values ? r => values[r] : _ => 1);
                config.weight = scale === 'none' ? { conv, unit, scale: 'none' } : { conv, scale, max, min };
            }
        }
        else {
            //has width column and is discrete
            if (ctx.meta.width.customize) {
                config.weight = { conv: ctx.fmt.width.item('item'), scale: null };
            }
            else {
                const width = ctx.meta.width.item;
                config.weight = { conv: _ => width, scale: null };
            }
        }
        /* #endregion */

        /* #region  update bubble.for if null */
        copy(ctx.meta.bubble, config.bubble);
        if (config.bubble.for === null) {
            config.bubble.for = ctx.meta.style.direction !== 'in' ? 'dest' : 'origin';
        }
        if (config.bubble.for === 'origin' || config.bubble.for === 'both') {
            config.bubble.out = ctx.key('Origin');
        }
        if (config.bubble.for === 'dest' || config.bubble.for === 'both') {
            config.bubble.in = ctx.key('Dest');
        }
        /* #endregion */

        /* #region  collect groups and valid rows */
        let rows = ctx.rows();

        /* #endregion */

        if (config.style === 'flow') {
            if (!groups) {
                groups = values(groupBy(ctx.rows(), ctx.key(sourceRole, 'color')));
            }
            const weights = groups.map(g => sum(g, i => config.weight.conv(i)));
            groups = sort(groups, (_, i) => weights[i]);
            if (ctx.meta.style.limit < groups.length) {
                groups = groups.slice(0, ctx.meta.style.limit);
                rows = [].concat(...groups);
            }
        }
        else {
            groups = values(groupBy(ctx.rows(), ctx.key(sourceRole)));
        }
        /* #endregion */

        /* #region  update bubble.slice if null */
        if (config.bubble.slice === null) {
            let mark = {}, cnt = 0;
            for (const r of rows) {
                const color = config.color(r);
                if (!(color in mark)) {
                    mark[color] = true;
                    if (cnt++ > 32) {
                        config.bubble.slice = false;
                        break;
                    }
                }
            }
            if (config.bubble.slice !== false) {
                config.bubble.slice = true;
            }
        }
        /* #endregion */


        override(ctx.original('mapControl'), override(ctx.original('mapElement'), config.map));

        config.injections = Object.assign({}, persist.geocode.value({}));
        copy(coords(ctx, 'Origin', 'OLati', 'OLong', coords(ctx, 'Dest', 'DLati', 'DLong', {})), config.injections);
        copy(persist.manual.value({}), config.injections);

        copy(ctx.meta.advance, config.advance);
        config.groups = groups;
        return config;
    }

    private _inited = false;
    private _initing = false;
    private _debugBox: HTMLElement;
    private _debugCount: number;

    private _dbg(msg: string, color = '#0f0') {
        if (!this._debugBox) return;
        this._debugCount++;
        const line = document.createElement('div');
        line.style.color = color;
        line.textContent = `[${this._debugCount}] ${msg}`;
        this._debugBox.appendChild(line);
        // Keep last 30 lines
        while (this._debugBox.children.length > 31) {
            this._debugBox.removeChild(this._debugBox.children[1]);
        }
        this._debugBox.scrollTop = this._debugBox.scrollHeight;
    }

    public update(options: VisualUpdateOptions) {
        const typeNames = [] as string[];
        if (options && options.type) {
            if (options.type & 2) typeNames.push('Data');
            if (options.type & 4) typeNames.push('Resize');
            if (options.type & 8) typeNames.push('ViewMode');
            if (options.type & 16) typeNames.push('Style');
            if (options.type & 32) typeNames.push('ResizeEnd');
        }
        const typeStr = `type=${options ? options.type : 'null'} [${typeNames.join('|')}]`;
        this._dbg(`update() ${typeStr}`, '#ff0');

        if (!options || !options.dataViews || !options.dataViews[0]) {
            this._dbg('  EXIT: no dataViews', '#f66');
            return;
        }

        const view = options.dataViews && options.dataViews[0] || {} as powerbi.DataView;
        if (Persist.update(view)) {
            this._dbg('  EXIT: Persist.update=true (persist write bounce)', '#f90');
            return;
        }
        if (this._initing) {
            this._dbg('  EXIT: _initing=true (map still loading)', '#f90');
            return;
        }
        const ctx = this._ctx.update(view);
        const reset = (config: app.Config) => app.reset(config, () => ctx.meta.mapControl.autoFit && app.tryFitView());
        if (!this._inited) {
            this._dbg('  INIT: _inited=false, starting app.init()', '#0ff');
            this._initing = true;
            const mapFmt = new MapFormat();
            override(ctx.original('mapElement'), override(ctx.original('mapControl'), mapFmt));
            app.init(this._target, mapFmt, persist.banner.value() || [], ctl => {
                const [center, zoom] = persist.map.value() || [null, null];
                if (center) {
                    ctl.setCenterZoom({ latitude: center[1], longitude: center[0] }, zoom);
                }
                ctl.add({ transform: (c, p, e) => {
                    if (e) {
                        const lngLat = c.map.getCenter();
                        persist.map.write([[lngLat.lng, lngLat.lat], c.map.getZoom()], 400);
                    }
                } });
                this._initing = false;
                this._dbg('  INIT CALLBACK: map loaded, _initing=false', '#0ff');
                if (center) {
                    this._dbg('  INIT: reset(config) with saved center', '#0f0');
                    app.reset(this._cfg = this._config());
                }
                else {
                    this._dbg('  INIT: reset(config) with autofit', '#0f0');
                    reset(this._cfg = this._config());
                }
            });
            this._inited = true;
            this._dbg('  _inited=true (async map load pending)', '#0ff');
        }
        else {
            // Ensure map canvas is properly sized after visibility changes (e.g. page switch)
            if (app.$state.mapctl && app.$state.mapctl.map) {
                app.$state.mapctl.map.resize();
            }
            if (ctx.isResizeVisualUpdateType(options)) {
                this._dbg('  EXIT: isResize=true, skip', '#888');
                return;
            }
            const config = this._cfg = this._config(), fmt = ctx.fmt;
            if (ctx.dirty()) {
                const dirtyParts = [] as string[];
                if (fmt.style.dirty()) dirtyParts.push('style');
                if (fmt.advance.dirty()) dirtyParts.push('advance');
                if (fmt.color.dirty() || fmt.width.dirty()) dirtyParts.push('color/width');
                if (fmt.bubble.dirty()) dirtyParts.push('bubble');
                if (fmt.valueFormat.dirty()) dirtyParts.push('valueFormat');
                if (fmt.legend.dirty()) dirtyParts.push('legend');
                if (fmt.mapControl.dirty() || fmt.mapElement.dirty()) dirtyParts.push('map');
                this._dbg(`  DIRTY: [${dirtyParts.join(', ')}]`, '#f0f');
                if (fmt.style.dirty()) {
                    reset(config);
                }
                if (fmt.advance.dirty()) {
                    if (fmt.advance.dirty('cache') === 'off') {
                        persist.geocode.write({}, 10);
                        persist.manual.write({}, 10);
                    }
                    else if (fmt.advance.dirty('cache') === 'on') {
                        copy(app.$state.geocode, persist.geocode.value({}));
                        persist.geocode.write(persist.geocode.value(), 10);
                        persist.manual.write(persist.manual.value(), 10);
                    }
                    else {
                        if (fmt.advance.dirty('relocate') === 'off') {
                            persist.manual.write(persist.manual.value() || {}, 10);
                        }
                        reset(config);
                    }
                }
                if (fmt.color.dirty() || fmt.width.dirty()) {
                    app.repaint(config, 'flow');
                }
                if (fmt.bubble.dirty()) {
                    app.repaint(config, 'bubble');
                }
                if (fmt.valueFormat.dirty()) {
                    app.repaint(config, 'banner');
                }
                if (fmt.legend.dirty()) {
                    app.repaint(config, 'legend');
                }
                if (fmt.mapControl.dirty() || fmt.mapElement.dirty()) {
                    if (fmt.mapControl.dirty(['type', 'lang', 'pan', 'zoom']) || fmt.mapElement.dirty()) {
                        app.repaint(config, 'map');
                    }
                    fmt.mapControl.dirty('autoFit') === 'on' && app.tryFitView();
                }
            }
            else {
                this._dbg('  NOT DIRTY: calling reset(config)', '#0f0');
                reset(config);
            }
        }
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
        const oname = options.objectName as keyof Format, ctx = this._ctx, fmt = ctx.fmt, cfg = this._cfg;
        if (ctx.meta.advance.relocate) {
            if (oname !== 'advance') {
                return null;
            }
            return fmt.advance.dumper().metas(['relocate', 'located', 'unlocated']).result;
        }
        switch (oname) {
            case 'advance':
                return fmt.advance.dumper().metas(['cache', 'relocate']).result;
            case 'legend':
                return fmt.legend.dumper()
                    .metas(['show', 'position', 'fontSize'])
                    .labels(fmt.color.binding('item'), 'color_label')
                    .labels(fmt.width.binding('item'), 'width_label', d => d.metas(['width']))
                    .result;
            case 'style':
                return fmt.style.dumper().metas(['style'], cfg)
                    .metas(cfg.style === 'flow', ['direction', 'limit'])
                    .result;
            case 'color':
                const color = fmt.color.dumper().metas(['item']);
                if (!ctx.cat('color')) {
                    return color.result;
                }
                else if (ctx.type('color').numeric) {
                    return color.metas('customize', ['min', 'max']).result;
                }
                else {
                    return color.items('item').result;
                }
            case 'width':
                const width = fmt.width.dumper();
                if (!ctx.cat('width') && cfg.style !== 'flow') {
                    width.metas(['item']);
                }
                if (cfg.weight.scale === null) {//district
                    width.metas(['item']).items('item');
                }
                else if (cfg.weight.scale === 'none') {
                    width.metas(['scale', 'unit'], cfg.weight);
                }
                else {
                    width.metas(['scale', 'min', 'max'], cfg.weight);
                }
                return width.result;
            case 'valueFormat':
                return fmt.valueFormat.dumper().metas(['sort', 'top'])
                    .add(numberObjects(ctx.meta.valueFormat, oname))
                    .result;
            case 'bubble':
                const bubble = fmt.bubble.dumper().metas(['for'], cfg.bubble);
                if (ctx.meta.bubble.for !== 'none') {
                    bubble.metas(['scale', 'slice'], cfg.bubble);
                    if (!cfg.bubble.slice) {
                        bubble.metas(['bubbleColor']);
                    }
                    bubble.metas(['label']);
                    if (ctx.meta.bubble.label !== 'hide' && ctx.meta.bubble.label !== 'none') {
                        const both = ctx.meta.bubble.for === 'both';
                        bubble.metas(['labelOpacity'])
                            .metas(both || cfg.bubble.for === 'dest', ['labelColor'])
                            .metas(both || cfg.bubble.for === 'origin', ['labelColor'])
                    }
                }
                return bubble.result;
            default:
                return fmt[oname].dumper().default;
        }
    }
}