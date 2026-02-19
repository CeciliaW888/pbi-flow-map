# Privacy Policy — Flow Map for Power BI

**Last updated:** February 2026

## Overview

Flow Map for Power BI ("the Visual") is a custom visual developed by Cecilia Wang. This privacy policy explains what data the Visual processes, how it is used, and what third-party services it contacts.

## Data Processed by the Visual

The Visual processes the following data fields that you map in Power BI:

- **Origin** — location names or IDs (e.g. "Sydney, Australia")
- **Destination** — location names or IDs (e.g. "Tokyo, Japan")
- **Values** — numeric flow quantities
- **Optional fields** — colour categories, tooltip data, pre-supplied latitude/longitude coordinates, labels

This data comes entirely from your Power BI data source. The Visual does not collect, store, or transmit any personal data on its own.

## Third-Party Services

The Visual connects to the following external services to render the map:

### 1. Photon Geocoding API (photon.komoot.io)
- **Purpose:** Converts text-based location names (Origin / Destination fields) into geographic coordinates (latitude/longitude) so they can be plotted on the map.
- **Data sent:** The text values you enter in the Origin and Destination fields are sent as search queries to `https://photon.komoot.io`.
- **Data stored:** Photon does not store personal data. It is a stateless, open-source geocoding service built on OpenStreetMap data. See [Komoot's Privacy Policy](https://www.komoot.com/privacy) for details.
- **When triggered:** Only when location names are provided without pre-supplied coordinates. If you supply Latitude/Longitude columns directly, no geocoding requests are made.

### 2. OpenStreetMap / Carto Map Tiles
- **Purpose:** Renders the background map (roads, country outlines, labels).
- **Data sent:** Standard HTTP tile requests including your IP address, as with any map application.
- **Privacy:** See [OpenStreetMap Privacy Policy](https://wiki.osmfoundation.org/wiki/Privacy_Policy) and [Carto Privacy Policy](https://carto.com/privacy/).

### 3. MapLibre GL JS
- **Purpose:** Open-source JavaScript library used to render the interactive map canvas. Runs entirely client-side — no data is sent to MapLibre servers.

## Data Storage

The Visual does not store, log, or transmit any of your data beyond what is described above for real-time rendering purposes. All data processing happens within Power BI's rendering environment.

## Geocoding Cache

To reduce API calls, the Visual caches geocoding results in the browser's session memory. This cache is temporary and cleared when the Power BI session ends. No data is persisted to disk or external servers.

## Who to Contact

If you have questions about this privacy policy, please open an issue at:
**https://github.com/CeciliaW888/pbi-flow-map/issues**

Or email: **ceciliawang621@gmail.com**

---

*This visual is free and open-source. Source code is available at https://github.com/CeciliaW888/pbi-flow-map*
