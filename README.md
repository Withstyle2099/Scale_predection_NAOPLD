# LSI Scale Prediction & AI Forecasting Dashboard

A visual, chart-first dashboard for monitoring and forecasting **Langelier Saturation
Index (LSI)** scale/corrosion tendency in oil & gas produced-water pipeline systems.
Ships with a 731-day (Jan 2023 – Dec 2024) demo dataset and can be pointed at your own
Excel/CSV data — either a one-time import or a live, auto-refreshing spreadsheet link.

Open `index.html` directly in a browser — no build step, no install. Everything
(styles, charts, the demo dataset, and the Excel-parsing library) is inlined in the
single file, so it also works fully offline.

## What it shows

Styled as a navy/teal corporate BI template (sidebar navigation, pill-style slicers,
white KPI cards) with the same content and forecast engine as before:

- **Sidebar navigation** — Overview / Trend & Forecast / Driver Analysis / Data
  Source, with scroll-spy highlighting and smooth-scroll on click.
- **KPI card row** — Current LSI, 30-day trend, forecast at the selected horizon, the
  estimated date the system crosses your action threshold, and data coverage.
- **LSI trajectory chart** — historical trend (diverging area: teal below balance,
  amber above) with a dashed AI-forecast continuation and a 95% projection band.
- **Current scale-tendency gauge** — a radial gauge (teal → neutral → amber zones)
  showing where today's reading sits between corrosive and scale-forming.
- **Driver correlation chart** — ranks temperature, TDS, pH, calcium, alkalinity and
  flow by how strongly each moves with LSI.
- **Average LSI by month** — a labeled trend line across the full history, for
  spotting seasonal or long-run drift at a glance.
- **Days by scale-tendency classification** — a vertical bar chart of how many days
  fell into each corrosive/balanced/scale-forming band.
- **Temperature vs. LSI scatter** — every reading plotted and colored on the same
  corrosive→scale-forming scale as the other charts.
- **Driver sparklines** — compact trend + forecast strip for every input parameter.

All charts share one set of controls (historical range, forecast horizon, regression
lookback, action threshold) and re-render together.

## Also available: a native Power BI version

Everything above is a self-contained webpage — no Power BI required. If you want a
real `.pbix` report instead (or in addition), see **`POWERBI_GUIDE.md`**: it walks
through importing `data/lsi_historical_data.xlsx`, applying `powerbi_theme.json`
(the same navy/teal palette, as a real importable Power BI theme), and building each
visual with the exact DAX measures — including a from-scratch DAX implementation of
the Pearson correlation and linear-trend forecast used in the web version, since
neither has a native Power BI equivalent.

## Live data

The **data source bar** at the top replaces the embedded demo dataset with your own:

- **Import Excel/CSV** — pick a local `.xlsx`, `.xls`, or `.csv` file. Parsed entirely
  in the browser (via a vendored SheetJS build); nothing is uploaded anywhere.
- **Connect live** — paste a URL to a CSV or Excel file and pick a refresh interval
  (30s to 15 min, or manual). The dashboard fetches and re-renders on that schedule,
  shows a "live" status dot with the last-synced time, and remembers the connection
  (via `localStorage`) so it reconnects automatically next time you open the page.
  The most reliable source is a spreadsheet published to the web as CSV (Google
  Sheets: File → Share → Publish to web → CSV) — that gives a public, CORS-friendly
  URL that updates whenever the sheet changes.
- **Export CSV** — download whatever dataset is currently loaded (demo, imported, or
  live).

Expected columns (header names are matched flexibly, case/punctuation-insensitive):
`Date`, `Temperature_C`, `pH`, `Calcium_mg_L`, `Alkalinity_mg_L`, `TDS_mg_L`, and
optionally `Flow_m3_h` and `LSI`. If no LSI column is present it's computed
automatically from the other five via the standard Langelier equation. At least 5
valid rows are required.

**Honest limits:** this is a static, client-side page — "live" here means *polling a
reachable file URL*, not a persistent database connection. A true SCADA/historian/SQL
integration needs a backend to proxy the query and would replace `fetchAndParse()` in
the inline script; the rest of the dashboard (forecast engine, charts, KPIs) is
already decoupled from where `DATA` comes from and needs no changes to work with one.

## LSI methodology

```
LSI = pH − pHs
pHs = (9.3 + A + B) − (C + D)
A = (log10(TDS) − 1) / 10
B = −13.12·log10(T°C + 273) + 34.55
C = log10(Ca_mgL × 2.497) − 0.4      (Ca converted to CaCO3 equivalent)
D = log10(Alkalinity_mgCaCO3)
```

This is the standard Langelier Saturation Index formula used industry-wide for CaCO3
scale/corrosion screening. It powers the live LSI recomputation and the mechanistic
half of the forecast ensemble.

Scale-tendency bands (tune the in-app action threshold to your site's risk tolerance):

| LSI range | Tendency |
|---|---|
| < −2.0 | Severe corrosion |
| −2.0 to −0.5 | Corrosive |
| −0.5 to 0 | Mildly corrosive / near-balanced |
| 0 to 0.5 | Near-balanced, slightly scale-forming |
| 0.5 to 1.0 | Moderate scale-forming |
| 1.0 to 2.0 | High scale-forming |
| > 2.0 | Severe scale-forming |

## Forecast engine

Each driver (temperature, pH, calcium, alkalinity, TDS) is fit with OLS linear
regression over a selectable lookback window and extrapolated to a selectable horizon.
The forecast LSI is an ensemble of a *mechanistic* reconstruction (projected drivers
run back through the Langelier equation) and a *statistical* direct trend fit on
observed LSI, with a 95% band that widens with forecast distance. The demo dataset
shows a strong, near-linear multi-month drift (R² > 0.95 for temperature, TDS and pH),
so a transparent linear ensemble is the right, defensible model for it. Real
operating data with seasonality or regime shifts would warrant swapping in a
seasonal/ARIMA or sequence model instead — see `buildForecast()` / `findCrossing()` in
the inline script.

## Files

- `index.html` — the entire dashboard (HTML, CSS, JS, demo dataset, and the vendored
  Excel parser).
- `data/lsi_historical_data.json` / `data/lsi_historical_data.xlsx` — the demo
  dataset as standalone JSON and Excel, for reuse outside the dashboard (including
  as the Power BI data source).
- `vendor/xlsx.mini.min.js` — [SheetJS](https://sheetjs.com) Community Edition
  (Apache-2.0), used for `.xlsx`/`.xls` parsing.
- `powerbi_theme.json` — importable Power BI report theme matching this dashboard's
  navy/teal/amber palette.
- `POWERBI_GUIDE.md` — step-by-step guide (with DAX) to rebuild this dashboard as a
  native Power BI report.

## Disclaimer

Built for engineering screening and trend awareness. Validate against lab QA/QC and
site-specific scaling history before acting on any single reading.
