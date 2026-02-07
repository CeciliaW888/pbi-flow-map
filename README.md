# Flow Map - Power BI Custom Visual

A powerful custom visual for Microsoft Power BI that creates beautiful origin-destination flow visualizations with curved lines between geographic locations on an interactive map.


---

## 🆓 100% Free!

✅ **No API keys required**
✅ **No usage limits**
✅ **No costs - ever**
✅ **Commercial use fully allowed**
✅ **Free geocoding included**

---

## 🗺️ Features

- **Interactive Flow Visualization**: Display movement patterns between locations with curved flow lines
- **Multiple Map Styles**: Road, Grayscale, Dark, Light, or Hidden
- **Free Mapping**: Powered by OpenStreetMap and MapLibre GL JS
- **Free Geocoding**: Automatic location lookup using Photon API (no rate limits)
- **Customizable Flows**: Control colors, widths, and bundling
- **Bubble Charts**: Display aggregated data at origin/destination points
- **Interactive Tooltips**: Rich data display on hover
- **Legend Support**: Automatic legend generation
- **High Performance**: Handles 50+ flows smoothly

---

## 📦 Quick Start

### Installation

1. **Download the Visual**
   - Get the `.pbiviz` file from `/dist/` folder
   - Or build from source (see Development section)

2. **Import into Power BI Desktop**
   - Open Power BI Desktop
   - Go to **File → Options → Security**
   - Enable: ☑ *Allow any custom visual to be imported*
   - In your report, click **...** in Visualizations panel
   - Select **Import a visual from a file**
   - Choose the `.pbiviz` file

3. **Add Data**
   - Drag the Flow Map icon to your canvas
   - Add fields:
     - **Origin**: Location names (e.g., "New York, USA")
     - **Destination**: Location names (e.g., "London, UK")
     - **Values**: Flow quantities (numeric)
     - **Color** (optional): Categories for color coding
     - **Coordinates** (optional): Lat/Lon to skip geocoding

4. **Configure**
   - Open Format panel (paint roller icon)
   - Choose map style, flow appearance, legend options
   - **No API key needed!** Just start using it.

---

## 📊 Sample Data Structure

| Origin | Destination | Flow Value | Category |
|--------|-------------|------------|----------|
| New York, USA | London, UK | 1500 | Trade |
| San Francisco, USA | Tokyo, Japan | 2200 | Trade |
| Paris, France | Berlin, Germany | 800 | Tourism |
| Sydney, Australia | Singapore | 1200 | Trade |

---

## 🛠️ Development

### Prerequisites

- Node.js 18+ (LTS version recommended)
- Power BI Custom Visuals Tools: `npm install -g powerbi-visuals-tools`

### Build from Source

```bash
# Clone or navigate to the repository
cd code

# Install dependencies
npm install

# Start development mode (with auto-reload)
npm start

# Build and package for production
npx pbiviz package

# Output: dist/*.pbiviz file
```

### Project Structure

```
pbi-flow-map/
├── code/
├── src/
│   ├── lava/
│   │   ├── maplibre/      # MapLibre GL JS integration
│   │   ├── flowmap/       # Flow visualization logic
│   │   └── d3.ts          # D3.js utilities
│   ├── flowmap/
│   │   └── visual.ts      # Main visual implementation
│   ├── pbi/               # Power BI integration
│   └── visual.ts          # Entry point
├── dist/                  # Built .pbiviz files
├── package.json
├── pbiviz.json
├── capabilities.json      # Visual metadata
└── tsconfig.json
├── README.md                  # This file
└── CLAUDE.md                  # AI assistant instructions
```

---

## 🔧 Configuration Options

### Data Mapping

| Field | Required | Description |
|-------|----------|-------------|
| Origin | ✅ Yes | Starting location names or IDs |
| Destination | ✅ Yes | Ending location names or IDs |
| Values | Recommended | Flow quantities (affects line width) |
| Color | Optional | Categories for color coding |
| Origin Latitude | Optional | Skip geocoding with coordinates |
| Origin Longitude | Optional | Skip geocoding with coordinates |
| Destination Latitude | Optional | Skip geocoding with coordinates |
| Destination Longitude | Optional | Skip geocoding with coordinates |
| Tooltips | Optional | Additional data for tooltips |
| Labels | Optional | Custom labels for popups |

### Format Options

**Map Settings:**
- Map Style: Road (OSM), Grayscale, Dark, Light, Hidden
- Geocoding Service: Photon (default, fast), Nominatim (slower)
- Pan/Zoom: Enable/disable interaction
- Language: 18 language options

**Flow Settings:**
- Style: Straight, Arc, or Bundled flows
- Direction: Outbound or Inbound
- Width: Min/max line width, scaling method
- Color: Single color or category-based coloring

**Bubble Settings:**
- Show bubbles at: Origin, Destination, Both, or None
- Slice by category: Enable pie chart segments
- Size: Scale factor
- Labels: Show/hide location labels

**Legend Settings:**
- Position: Top or Bottom
- Show/hide color/width legends
- Custom labels

---

## 🐛 Troubleshooting

### Visual doesn't load
- Enable custom visuals in Power BI settings (File → Options → Security)
- Check that you're using Power BI Desktop (not Power BI Service)
- Try reimporting the .pbiviz file

### Map not displaying
- Check internet connection (map tiles load from OpenStreetMap)
- Verify browser/Power BI has internet access
- Check browser console for errors (F12)

### Locations not found
- Use specific location names: "New York, USA" instead of just "New York"
- Try adding state/country: "Paris, France"
- Use coordinates (Lat/Lon fields) for precise control
- Check spelling of location names

### Performance issues
- Limit to 100-200 flows for best performance
- Enable flow bundling to reduce visual complexity
- Filter data before loading into visual
- Consider aggregating similar flows

---

## 📚 Additional Resources

- **MapLibre GL JS**: [Documentation](https://maplibre.org/maplibre-gl-js/docs/)
- **Power BI Visuals**: [Developer Guide](https://learn.microsoft.com/power-bi/developer/visuals/)
- **OpenStreetMap**: [Website](https://www.openstreetmap.org/)
- **Photon Geocoding**: [API Documentation](https://photon.komoot.io/)

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Build and test: `npm install && npx pbiviz package`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- Follow existing code style (TypeScript, ESLint)
- Test with sample data before submitting
- Update documentation for new features
- Keep dependencies minimal and free

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

### Third-Party Licenses

- **MapLibre GL JS**: BSD 3-Clause License
- **OpenStreetMap**: ODbL License (data)
- **D3.js**: BSD 3-Clause License
- **Power BI Visuals API**: Microsoft

---

### Built With
- [MapLibre GL JS](https://maplibre.org/) - Free map rendering
- [OpenStreetMap](https://www.openstreetmap.org/) - Free map data
- [Photon](https://photon.komoot.io/) - Free geocoding API
- [D3.js](https://d3js.org/) - Data visualization
- [Power BI Visuals API](https://github.com/Microsoft/PowerBI-visuals) - Microsoft

---

## 🎯 Use Cases

- **Supply Chain**: Visualize goods movement between warehouses
- **Trade Analysis**: Show import/export flows between countries
- **Migration Patterns**: Display population movement
- **Transportation**: Map flight routes, shipping lanes, logistics
- **Telecommunications**: Show data flow between regions
- **Tourism**: Visualize tourist movements between cities
- **Epidemiology**: Track disease spread patterns
- **Social Networks**: Map connections between locations
- **Business Intelligence**: Show customer/supplier relationships

---

## ⭐ Support This Project

If you find this visual useful:

- ⭐ Star the repository
- 📢 Share with colleagues
- 🐛 Report bugs
- 💡 Suggest features
- 🤝 Contribute code

---

**Version**: 1.0.0.0
**Last Updated**: February 2026
**Status**: ✅ Production Ready
**Cost**: 🆓 Free Forever
