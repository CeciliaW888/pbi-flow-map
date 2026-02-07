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
    // Maximum concurrent requests - CRITICAL: Nominatim allows 1 req/sec
    MaxConcurrentRequests: 1,

    // Minimum time between requests in milliseconds (1000ms = 1 second for Nominatim)
    MinRequestInterval: 1000,

    // Maximum cache size of cached geocode data.
    MaxCacheSize: 3000,

    // Maximum cache overflow of cached geocode data to kick the cache reducing.
    MaxCacheSizeOverflow: 1000,

    // Geocoding service selection
    GeocodingService: 'photon' as 'nominatim' | 'photon',

    // API URLs
    NominatimURL: "https://nominatim.openstreetmap.org/search?",
    PhotonURL: "https://photon.komoot.io/api/?"
};

//private
interface IGeocodeQuery {
    query: string;
    longitude?: number;
    latitude?: number;
}

interface IGeocodeCache {
    query: GeocodeQuery;
    coordinate: ILocation;
}

interface IGeocodeQueueItem {
    query: GeocodeQuery;
    then: (v: ILocation) => void;
}

var geocodeCache: { [key: string]: IGeocodeCache; };
var geocodeQueue: IGeocodeQueueItem[];
var activeRequests: number;
var lastRequestTime: number = 0;

class GeocodeQuery implements IGeocodeQuery {
    public query      : string;
    public key        : string;
    private _cacheHits: number;

    constructor(query: string = "") {
        this.query      = query;
        this.key        = this.query.toLowerCase();
        this._cacheHits = 0;
    }

    public incrementCacheHit(): void {
        this._cacheHits++;
    }

    public getCacheHits(): number {
        return this._cacheHits;
    }

    public getGeocodingUrl(): string {
        const encodedQuery = encodeURIComponent(this.query);

        if (settings.GeocodingService === 'nominatim') {
            // Nominatim API
            return `${settings.NominatimURL}q=${encodedQuery}&format=json&limit=1`;
        } else {
            // Photon API (default - faster and no rate limit)
            return `${settings.PhotonURL}q=${encodedQuery}&limit=1`;
        }
    }
}

function findInCache(query: GeocodeQuery): ILocation {
    var pair = geocodeCache[query.key];
    if (pair) {
        pair.query.incrementCacheHit();
        return pair.coordinate;
    }
    return undefined;
}

function cacheQuery(query: GeocodeQuery, coordinate: ILocation): void {
    var keys = Object.keys(geocodeCache);
    var cacheSize = keys.length;

    if (Object.keys(geocodeCache).length > (settings.MaxCacheSize + settings.MaxCacheSizeOverflow)) {

        var sorted = keys.sort((a: string, b: string) => {
            var ca = geocodeCache[a].query.getCacheHits();
            var cb = geocodeCache[b].query.getCacheHits();
            return ca < cb ? -1 : (ca > cb ? 1 : 0);
        });

        for (var i = 0; i < (cacheSize - settings.MaxCacheSize); i++) {
            delete geocodeCache[sorted[i]];
        }
    }

    geocodeCache[query.key] = { query: query, coordinate: coordinate };
}

function geocodeCore(geocodeQuery: GeocodeQuery, then: (v: ILocation) => void): void {
    var result = findInCache(geocodeQuery);
    if (result) {
        result.address = geocodeQuery.query;
        then(result);
    } else {
        geocodeQueue.push({ query: geocodeQuery, then: then });
        releaseQuota();
    }
}

export function getCacheSize(): number {
    return Object.keys(geocodeCache).length;
}

/**
 * Rate limiting function - ensures minimum time between requests
 */
async function waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < settings.MinRequestInterval) {
        const waitTime = settings.MinRequestInterval - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastRequestTime = Date.now();
}

function releaseQuota(decrement: number = 0) {
    activeRequests -= decrement;
    while (activeRequests < settings.MaxConcurrentRequests) {
        if (geocodeQueue.length == 0) {
            break;
        }
        activeRequests++;
        makeRequest(geocodeQueue.shift());
    }
}

async function makeRequest(item: IGeocodeQueueItem) {
    // Check again if we already got the coordinate;
    var result = findInCache(item.query);
    if (result) {
        result.address = item.query.query;
        setTimeout(() => releaseQuota(1));
        item.then(result);
        return;
    }

    try {
        // Wait for rate limit before making request
        await waitForRateLimit();

        const url = item.query.getGeocodingUrl();
        const headers: HeadersInit = {};

        // Nominatim requires User-Agent header
        if (settings.GeocodingService === 'nominatim') {
            headers['User-Agent'] = 'PowerBI-FlowMap-Visual/2.0';
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Geocoding request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data || (Array.isArray(data) && data.length === 0)) {
            completeRequest(item, ERROR_EMPTY, null);
            return;
        }

        let coordinate: ILocation;

        if (settings.GeocodingService === 'nominatim') {
            // Nominatim response format
            const firstResult = data[0];
            coordinate = {
                latitude: parseFloat(firstResult.lat),
                longitude: parseFloat(firstResult.lon),
                type: firstResult.type,
                name: firstResult.display_name
            };
        } else {
            // Photon response format
            const features = data.features;
            if (!features || features.length === 0) {
                completeRequest(item, ERROR_EMPTY, null);
                return;
            }

            const firstFeature = features[0];
            const coords = firstFeature.geometry.coordinates;
            coordinate = {
                latitude: coords[1],  // Photon: [lon, lat]
                longitude: coords[0],
                type: firstFeature.properties.type,
                name: firstFeature.properties.name || firstFeature.properties.street
            };
        }

        completeRequest(item, null, coordinate);

    } catch (error) {
        console.error('Geocoding error:', error);
        completeRequest(item, error as Error, null);
    }
}

var ERROR_EMPTY = new Error("Geocode result is empty.");
var dequeueTimeoutId;

function completeRequest(item: IGeocodeQueueItem, error: Error, coordinate: ILocation = null) {
    dequeueTimeoutId = setTimeout(() => releaseQuota(1), 0);
    if (error) {
        item.then(undefined);
    }
    else {
        cacheQuery(item.query, coordinate);
        coordinate.address = item.query.query;
        item.then(coordinate);
    }
}

function reset(): void {
    geocodeCache = {};
    geocodeQueue = [];
    activeRequests = 0;
    lastRequestTime = 0;
    clearTimeout(dequeueTimeoutId);
    dequeueTimeoutId = null;
}

reset();
