import { Func } from '../type';
import { $state } from './app';
import { IShape, build } from './shape';
import { IPath } from './algo';
import { ISelex } from '../d3';
import { IListener, IBound, ILocation } from '../maplibre';
import * as maplibregl from 'maplibre-gl';

let root: ISelex;

export const events = {
    hover: null as Func<number[], void>,
    pathInited: null as Func<ISelex<IPath>, void>
}

class VisualFlow {
     rows: number[];
    
    public get bound() {
        return this._shape.bound;
    }
  
    public get source() {
        return this._shape.source;
    }

    reweight(weight: Func<number, number>) {
        return this._shape.calc(weight);
    }

    private _tRoot: ISelex;
    private _sRoot: ISelex;
    private _shape: IShape;
    constructor(d3: ISelex, rows: number[]) {
        this._tRoot = d3.datum(this).att.class('vflow anchor');
        this._sRoot = this._tRoot.append('g').att.class('scale');
        this.rows = rows;
        this._relayout();
    }

    remove() {
        this._tRoot.remove();
    }

    public reformat(recolor: boolean, rewidth: boolean) {
        if (recolor) {
            const paths = this._sRoot.selectAll<IPath>('.base');
            if ($state.config.style === 'flow') {
                const color = $state.color(this.rows[0]);
                paths.att.stroke(color);
            }
            else {
                paths.att.stroke(p => $state.color(+p.id));
            }
        }
        if (rewidth && this._shape) {
            this._shape.rewidth();
        }
    }
    
    private _hoverTimer = null as number;
    private _hoverState = null as any;
    private _onover = (p: IPath) => {
        const rows = p.leafs as number[];
        if (this._hoverTimer) {
            clearTimeout(this._hoverTimer);
            this._hoverTimer = null;
        }
        if (this._hoverState !== p.id && this._hoverState) {
            this._hoverState = null;
            events.hover && events.hover(null);
        }
        if (this._hoverState === null) {
            this._hoverTimer = window.setTimeout(() => {
                if (this._hoverState) {
                    events.hover && events.hover(null);
                }
                events.hover && events.hover(rows);
                this._hoverState = p.id;
                this._hoverTimer = null;
            }, 300);
        }
    };

    private _onout = () => {
        if (this._hoverTimer) {
            clearTimeout(this._hoverTimer);
            this._hoverTimer = null;
        }
        this._hoverTimer = window.setTimeout(() => {
            if (this._hoverState) {
                this._hoverState = null;
                events.hover && events.hover(null);
            }
            this._hoverTimer = null;
        }, 100);
    };

    private _relayout() {
        try {
            this._shape = this._build();
        } catch (e) {
            $state.log(`flow._relayout: BUILD ERROR: ${e}`);
            return;
        }
        if (!this._shape) {
            $state.log(`flow._relayout: shape is null/undefined`);
            return;
        }
        const pathCount = this._shape.paths().length;
        $state.log(`flow._relayout: shape OK, ${pathCount} paths, screenCoords=${this._shape.usesScreenCoordinates()}`);
        let all = this._sRoot
            .selectAll<IPath>('.flow')
            .on('mouseover', this._onover)
            .on('mouseout', this._onout);

        this._translate();
        events.pathInited && events.pathInited(all);
    }

    transform(map: maplibregl.Map, pzoom: number) {
        if (this._shape) {
            this._shape.transform(map, pzoom);
            this._translate();
        }
    }

    private _translate() {
        // Both FlowShape and LineShape now use absolute screen coordinates
        // (via map.project()), so no group transform needed.
        this._tRoot.att.transform('translate(0,0)');
    }

    private _build() {
        const source = $state.loc($state.config.source(this.rows[0]));
        const weights = this.rows.map(r => Math.max($state.config.weight.conv(r), 0));
        const targets = this.rows.map(r => $state.loc($state.config.target(r)));
        const nullTargets = targets.filter(t => !t).length;
        const zeroWeights = weights.filter(w => w === 0).length;
        $state.log(`flow._build: src=${source ? 'OK' : 'NULL'} targets=${targets.length} nullTgts=${nullTargets} zeroWts=${zeroWeights}`);
        return build($state.config.style, this._sRoot, source, targets, this.rows, weights);
    }
}

export function init(d3: ISelex): IListener {
    const rect = d3.append('rect')
        .att.fill_opacity(0.01)
        .sty.pointer_events('none');
    const remask = () => {
        const container = $state.mapctl.map.getContainer();
        const width = container.clientWidth;
        const height = container.clientHeight;
        return rect.att.width(width)
            .att.height(height)
            .att.x(0)
            .att.y(0);
    };
    root = d3.append('g');
    return {
        transform: (ctl, pzoom) => {
            flows.forEach(v => v.transform(ctl.map, pzoom));
            remask();
        },
        resize: () => remask()
    }
}

export function add(rows: number[]) {
    $state.log(`flow.add: ${rows.length} rows, style=${$state.config.style}`);
    flows.push(new VisualFlow(root.append('g'), rows));
}

export function count(): number {
    return flows.length;
}

export function clear() {
    for (const v of flows) {
        v.remove();
    }
    flows = [];
}

export function bounds(): IBound[] {
    return flows.map(f => f.bound);
}

export function sources(): ILocation[] {
  return flows.map(f => f.source);
}

let flows = [] as VisualFlow[];

export function reweight(weight: Func<number, number>): number[] {
    let exts = flows.map(v => v.reweight(weight));
    let min = Math.min(...exts.map(e => e[0]));
    let max = Math.max(...exts.map(e => e[1]));
    return [min, max];
}

export function reformat(recolor: boolean, rewidth: boolean) {
    for (let f of flows) {
        f.reformat(recolor, rewidth);
    }
}

/** Inspect actual SVG DOM and return debug info */
export function debugDom(): string {
    if (!root) return 'flow.debugDom: no root';
    const node = root.node();
    if (!node) return 'flow.debugDom: no node';
    const groups = node.querySelectorAll('g.vflow');
    const paths = node.querySelectorAll('path.flow');
    let info = `DOM: ${groups.length} flow-groups, ${paths.length} path elements`;
    // Log group transforms
    for (let i = 0; i < Math.min(groups.length, 2); i++) {
        const g = groups[i] as SVGGElement;
        info += `\n  g[${i}].transform="${g.getAttribute('transform') || 'NONE'}"`;
    }
    // Log first few path attributes
    for (let i = 0; i < Math.min(paths.length, 3); i++) {
        const p = paths[i] as SVGPathElement;
        const d = p.getAttribute('d') || 'EMPTY';
        const sw = p.getAttribute('stroke-width') || 'NONE';
        const st = p.getAttribute('stroke') || 'NONE';
        info += `\n  path[${i}] stroke=${st} sw=${sw} d="${d.substring(0, 60)}..."`;
    }
    if (paths.length === 0 && groups.length > 0) {
        // Check what's inside the groups
        const g = groups[0] as SVGGElement;
        info += `\n  g[0] children: ${g.innerHTML.substring(0, 200)}`;
    }
    return info;
}
