import { ILocation, IBound, Converter } from '../maplibre';
import * as maplibregl from 'maplibre-gl';
import { Func, StringMap, values } from '../type';
import { Key, IPathPoint, IPoint, ILayout, IPath, layout } from './algo';
import { extent } from 'd3-array';
import { arc } from './arc';
import { ISelex } from '../d3';

import { $state } from './app';

const map20 = new Converter(20);
const MAP20_SIZE = 256 * Math.pow(2, 20); // 268435456 pixels at zoom 20

class LinePath implements IPath {
    id: Key;
    leafs: Key[];

    private _width: number;
    private _path = '';
    private _pathGenerator: () => string; // Function to regenerate path on demand

    constructor(path: string | (() => string), key: number, public weight: number) {
        this.id = key;
        this._width = weight;
        this.leafs = [key];

        if (typeof path === 'string') {
            this._path = path;
            this._pathGenerator = null;
        } else {
            this._pathGenerator = path;
            this._path = path();
        }
    }

    d(tran?: (input: IPathPoint, output: number[]) => void): string {
        // Regenerate path if we have a generator function (handles zoom changes)
        if (this._pathGenerator) {
            this._path = this._pathGenerator();
        }
        return this._path;
    }

    width(scale?: Func<number, number>): number {
        if (scale) {
            this._width = scale(this.weight);
        }
        return this._width;
    }
    minLatitude: number;
    maxLatitude: number;
}

class helper {
    public static initPaths(root: ISelex, shape: IShape) {
        root.selectAll('*').remove();
        root.selectAll('.base').data(shape.paths()).enter().append('path');
        root.selectAll('path').att.class('base flow').att.d(p => p.d())
            .att.stroke_linecap('round').att.fill('none');
    }

    public static line(src: ILocation, tlocs: ILocation[], trows: number[], weis: number[]) {
        try {
            if (!src) return { paths: {}, bound: null };

            let all = tlocs.concat(src);
            let bound = $state.mapctl.bound(all);

            if (!bound || !bound.anchor) {
                return { paths: {}, bound: bound };
            }

            let paths = {} as StringMap<LinePath>;
            let row2tar = {} as StringMap<ILocation>;
            for (let i = 0; i < tlocs.length; i++) {
                if (!tlocs[i]) continue;
                row2tar[i] = tlocs[i];
                let trow = trows[i];
                const target = tlocs[i];

                // Create a generator function that uses current map projection
                const pathGenerator = () => {
                    const srcPixel = $state.mapctl.map.project([src.longitude, src.latitude]);
                    const tarPixel = $state.mapctl.map.project([target.longitude, target.latitude]);
                    return 'M ' + Math.round(srcPixel.x) + ' ' + Math.round(srcPixel.y) +
                           ' L ' + Math.round(tarPixel.x) + ' ' + Math.round(tarPixel.y);
                };

                paths[trow] = new LinePath(pathGenerator, trow, weis[i]);
            }
            return { paths, bound };
        } catch (e) {
            return { paths: {}, bound: null };
        }
    }

    public static arc(src: ILocation, tlocs: ILocation[], trows: number[], weis: number[]) {
        try {
            if (!src || typeof src.longitude !== 'number' || typeof src.latitude !== 'number') {
                $state.log(`[Error] Invalid Source: ${JSON.stringify(src)}`);
                throw new Error("Invalid source location");
            }

            let slon = src.longitude, slat = src.latitude;
            let scoord = { x: 0, y: slat }, tcoord = { x: 0, y: 0 };
            let all = tlocs.concat(src);
            let bound = $state.mapctl.bound(all);

            if (!bound || !bound.anchor) {
                return {
                    paths: {},
                    bound: bound || {
                        anchor: { longitude: 0, latitude: 0 },
                        margin: { north: 0, south: 0, west: 0, east: 0 },
                        offsets: []
                    } as IBound
                };
            }

            let anchor = bound.anchor;
            anchor.latitude = slat;

            let paths = {} as StringMap<LinePath>;
            let row2tar = {} as StringMap<ILocation>;
            let minlat = Number.POSITIVE_INFINITY;
            let maxlat = Number.NEGATIVE_INFINITY;

            for (var i = 0, len = tlocs.length; i < len; i++) {
                let t = tlocs[i];
                if (!t || typeof t.longitude !== 'number') continue;

                let tlon = t.longitude, trow = trows[i];
                row2tar[trow] = t;
                let miny = Number.POSITIVE_INFINITY;
                let maxy = Number.NEGATIVE_INFINITY;
                tcoord.y = t.latitude;

                // Calculate relative longitude considering wrapping
                if (Math.abs(tlon - slon) < 180) {
                    tcoord.x = tlon - slon;
                }
                else {
                    if (tlon < slon) {
                        tcoord.x = 360 - slon + tlon;
                    }
                    else {
                        tcoord.x = tlon - slon - 360;
                    }
                }

                if (!arc) {
                    debugger;
                }

                // Generate arc points in geographic coordinates (static)
                var cnt = Math.max(Math.round(Math.abs(tcoord.x / 4)), 10);
                var coords = arc(scoord, tcoord, cnt);

                // Calculate min/max latitudes for bounds
                for (var pair of coords) {
                    let [relX, absLat] = pair;
                    if (absLat < miny) {
                        miny = absLat;
                    }
                    if (absLat > maxy) {
                        maxy = absLat;
                    }
                }

                minlat = Math.min(minlat, miny);
                maxlat = Math.max(maxlat, maxy);

                // Create a path generator that projects coordinates on demand
                const pathGenerator = () => {
                    // Convert first point using MapLibre projection
                    const firstPixel = $state.mapctl.map.project([slon, scoord.y]);
                    var pathStr = 'M ' + Math.round(firstPixel.x) + ' ' + Math.round(firstPixel.y);

                    // Convert each arc point to screen coordinates using MapLibre
                    for (var pair of coords) {
                        let [relX, absLat] = pair;
                        // Convert relative longitude to absolute
                        const absLon = slon + relX;
                        const pixel = $state.mapctl.map.project([absLon, absLat]);
                        pathStr += ' L ' + Math.round(pixel.x) + ' ' + Math.round(pixel.y);
                    }
                    return pathStr;
                };

                var apath = new LinePath(pathGenerator, trow, weis[i]);
                apath.minLatitude = miny;
                apath.maxLatitude = maxy;
                paths[trow] = apath;
            }
            bound.margin.north = maxlat - slat;
            bound.margin.south = slat - minlat;

            return { paths, bound };
        } catch (err) {
            // Return safe fallback
            return {
                paths: {},
                bound: {
                    anchor: { longitude: 0, latitude: 0 },
                    margin: { north: 0, south: 0, west: 0, east: 0 },
                    rect: { x: 0, y: 0, width: 0, height: 0 }
                } as IBound
            };
        }
    }
}

export interface IShape {
    rewidth(): void;
    calc(weight: (row: number) => number): number[];
    transform(map: maplibregl.Map, pzoom: number): void;
    bound: IBound;
    source: ILocation;
    paths(): IPath[];
    usesScreenCoordinates(): boolean; // True if paths are in screen space, false if in zoom-20 space
}

export function build(type: 'straight' | 'flow' | 'arc', d3: ISelex, src: ILocation, tars: ILocation[], trows: number[], weis: number[]): IShape {
    $state.log(`shape.build: type=${type} src=(${src ? src.latitude.toFixed(2) + ',' + src.longitude.toFixed(2) : 'NULL'}) targets=${tars.length}`);
    switch (type) {
        case 'flow':
            return new FlowShape(d3, src, tars, trows, weis);
        case 'arc':
            const arc = helper.arc(src, tars, trows, weis);
            $state.log(`shape.build(arc): ${Object.keys(arc.paths).length} paths, bound=${arc.bound ? 'OK' : 'NULL'}`);
            return new LineShape(d3, src, arc.paths, arc.bound);
        case 'straight':
            const line = helper.line(src, tars, trows, weis);
            $state.log(`shape.build(straight): ${Object.keys(line.paths).length} paths, bound=${line.bound ? 'OK' : 'NULL'}`);
            return new LineShape(d3, src, line.paths, line.bound);
    }
}

class FlowShape implements IShape {
    public readonly d3: ISelex;
    public readonly bound: IBound;
    private _layout: ILayout;
    private _row2tar = {} as StringMap<ILocation>;
    public readonly source: ILocation;
    // Anchor's absolute zoom-20 pixel position (for inverse projection)
    private _anchorX20: number;
    private _anchorY20: number;

    constructor(d3: ISelex, src: ILocation, tars: ILocation[], trows: number[], weis?: number[]) {
        this.source = src;
        const area = map20.points([src].concat(tars));
        if (!area) {
            $state.log(`FlowShape: area is NULL!`);
        }
        const points = area.points;
        const nullPoints = points.filter(p => !p).length;
        $state.log(`FlowShape: ${points.length} pts (${nullPoints} null), anchor=(${area.anchor ? area.anchor.latitude.toFixed(2) + ',' + area.anchor.longitude.toFixed(2) : 'NULL'})`);

        // Store anchor's absolute zoom-20 position for the converter
        this._anchorX20 = map20.x(area.anchor.longitude);
        this._anchorY20 = map20.y(area.anchor.latitude);

        const source = points.shift() as IPoint;
        source.key = $state.config.source(trows[0]);
        for (let i = 0; i < points.length; i++){
            (points[i] as IPoint).key = trows[i];
            this._row2tar[trows[i]] = tars[i];
        }
        this._layout = layout(source, points, weis);
        $state.log(`FlowShape: layout ${this._layout.paths().length} paths`);
        helper.initPaths(d3, this);
        this.d3 = d3;
        this.bound = area;
    }

    paths(): IPath[] {
        return this._layout.paths();
    }

    calc(weight: (row: number) => number): number[] {
        weight && this._layout.build(weight);
        return extent(this._layout.paths().map(p => p.weight));
    }

    rewidth() {
        // Convert zoom-20 relative coords → geographic → screen via map.project().
        // This uses the exact same projection path as pies and LineShape,
        // guaranteeing consistent positioning.
        const map = $state.mapctl.map;
        const ax = this._anchorX20;
        const ay = this._anchorY20;

        const converter = (input: number[], output: number[]) => {
            // 1. Zoom-20 relative → absolute zoom-20
            const absX = ax + input[0];
            const absY = ay + input[1];
            // 2. Inverse Web Mercator: zoom-20 pixels → geographic
            const lon = (absX / MAP20_SIZE) * 360 - 180;
            const yNorm = 0.5 - absY / MAP20_SIZE;
            const lat = Math.atan(Math.exp(yNorm * 2 * Math.PI)) * 360 / Math.PI - 90;
            // 3. Geographic → screen via MapLibre (same as pies/LineShape)
            const pixel = map.project([lon, lat]);
            output[0] = pixel.x;
            output[1] = pixel.y;
        };

        let sampleWidth = NaN;
        let sampleD = '';

        this.d3.selectAll<IPath>('path')
            .att.stroke_width(p => {
                const w = p.width($state.width);
                if (isNaN(sampleWidth)) sampleWidth = w;
                return w;
            })
            .att.d(p => {
                const d = p.d(converter);
                if (!sampleD) sampleD = d;
                return d;
            });
        $state.log(`FlowShape.rewidth: sampleW=${isNaN(sampleWidth) ? 'NONE' : sampleWidth.toFixed(1)} d="${sampleD.substring(0, 80)}"`);
    }

    transform(map: maplibregl.Map, pzoom: number) {
        this.rewidth();
    }

    usesScreenCoordinates(): boolean {
        return true; // Converter projects to absolute screen coords via map.project()
    }
}

class LineShape implements IShape {
    public readonly d3: ISelex;
    public readonly bound: IBound;
    public readonly source: ILocation;

    private _row2Path = {} as StringMap<LinePath>;

    constructor(d3: ISelex, src: ILocation, row2Path: StringMap<LinePath>, bound: IBound) {
        this.source = src;
        this.d3 = d3;
        this._row2Path = row2Path;
        this.bound = bound;
        helper.initPaths(d3, this);
    }

    calc(weight: (row: number) => number): number[] {
        if (weight) {
            for (let r in this._row2Path) {
                let path = this._row2Path[r];
                path.weight = weight(+r);
            }
        }
        return extent(values(this._row2Path).map(p => p.weight));
    }

    rewidth() {
        // Update stroke widths based on current scale
        this.d3.selectAll<IPath>('path').att.stroke_width(p => p.width($state.width));
    }

    transform(map: maplibregl.Map, pzoom: number) {
        // Regenerate path coordinates using current map projection
        this.d3.selectAll<IPath>('.flow').att.d(p => p.d());
        this.rewidth();
    }

    paths(): IPath[] {
        return values(this._row2Path);
    }

    usesScreenCoordinates(): boolean {
        return true; // LineShape uses screen coordinates directly
    }
}