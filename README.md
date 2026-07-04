# LSI Scale Prediction & AI Forecasting Dashboard

An interactive, offline-capable dashboard for monitoring and forecasting **Langelier
Saturation Index (LSI)** scale/corrosion tendency in oil & gas produced-water pipeline
systems, built around a 731-day (Jan 2023 – Dec 2024) historical dataset of temperature,
flow, pH, calcium, alkalinity and TDS.

Open `index.html` directly in a browser — no build step, no server, no external
dependencies (fonts, charts and data are all inlined in the single file).

## What it does

- **Historical LSI trend** with a diverging area chart (corrosive tendency below the
  balance line, scale-forming tendency above it) and a crosshair tooltip.
- **AI-assisted forecasting**: each water-chemistry driver (temperature, pH, Ca,
  alkalinity, TDS) is fit with OLS linear regression over a selectable lookback window
  and extrapolated to a selectable horizon (30–365 days). The forecast LSI is an
  ensemble of a *mechanistic* reconstruction (projected drivers run back through the
  Langelier equation) and a *statistical* direct trend fit on observed LSI, with a
  95% projection band that widens with forecast distance.
- **Threshold-crossing estimates**: projected date the system crosses the balance
  point (LSI = 0) or a configurable action threshold, so mitigation can be scheduled
  proactively instead of reactively.
- **Driver diagnostics**: a correlation chart ranking which parameters move most
  strongly with LSI, plus small-multiple trend charts for every driver.
- **What-if simulator**: live sliders to test mitigation scenarios (pH adjustment,
  softening, blending) against the standard Langelier equation.
- **Rule-based engineering recommendations** driven by the current classification and
  forecast trajectory.
- **Data explorer**: sortable, searchable, paginated table with CSV export.
- Light/dark theme, fully responsive, no horizontal overflow at any breakpoint.

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
scale/corrosion screening. It powers the what-if calculator and the mechanistic half
of the forecast ensemble. The dataset's own "observed" LSI column (lab/field-reported)
tracks this formula closely — Pearson r > 0.99 against pH alone, with residual
variance consistent with normal hardness/alkalinity titration tolerance.

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

The historical data shows a strong, near-linear multi-month drift (R² > 0.95 for
temperature, TDS and pH — temperature and TDS rise steadily across the full 24
months, pushing LSI from about −0.44 toward +0.31). A transparent linear-regression
ensemble is the right, defensible model for that signal. If live operating data later
shows seasonality or regime shifts the synthetic demo data doesn't have, swap in a
seasonal/ARIMA or sequence model — the forecast module (`buildForecast` /
`findCrossing` in the inline script) is the place to do it.

## Files

- `index.html` — the entire dashboard (HTML, CSS, JS, and the embedded dataset).
- `data/lsi_historical_data.json` — the same historical dataset as standalone JSON,
  for reuse outside the dashboard (analysis notebooks, other tooling).

## Disclaimer

Built for engineering screening and trend awareness. Validate against lab QA/QC and
site-specific scaling history before acting on any single reading.
