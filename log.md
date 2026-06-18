# Feature Log

- **Dynamic Peak Window**: Replaced static 2 AM - 6 AM text with a dynamic calculation of peak hours and percentages based on city-wide `/temporal` patterns.
- **Interactive Hotspot Map**: Created an interactive map view (`/map` tab) displaying BTP junctions and DBSCAN violation clusters using Leaflet.js.
- **Map Height Fix**: Fixed a CSS zero-height render issue on the Leaflet map container by forcing a static layout height of 550px.
- **Corporate Light Theme Overhaul**: Updated the typography (Inter), colors, borders, cards, and Recharts metrics to give the application a premium, solid corporate SaaS aesthetic.
- **Weighted Map Heatmap**: Integrated the `leaflet.heat` plugin dynamically to draw a beautiful, intensity-weighted gradient heatmap representing violation volumes.
