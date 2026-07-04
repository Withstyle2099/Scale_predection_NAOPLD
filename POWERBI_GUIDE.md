# Building this dashboard natively in Power BI Desktop

This guide recreates the web dashboard (`index.html`) as a real `.pbix` report, using
the same data, the same classification logic, and a DAX equivalent of the forecast
engine. Follow it top to bottom in Power BI Desktop.

**Files you need from this repo:**
- `data/lsi_historical_data.xlsx` — the dataset
- `powerbi_theme.json` — the navy/teal color theme sampled from your reference design

---

## 1. Import the data

1. **Home → Get Data → Excel Workbook** → select `data/lsi_historical_data.xlsx`.
2. Load the `LSI_Data` sheet. Columns: `Date`, `Temperature_C`, `Flow_m3_h`, `pH`,
   `Calcium_mg_L`, `Alkalinity_mg_L`, `TDS_mg_L`, `LSI`.
3. In Power Query, confirm `Date` is typed as **Date** (not Date/Time) and the numeric
   columns are **Decimal Number**. Close & Apply.
4. **View → Themes → Browse for themes…** → select `powerbi_theme.json`. This applies
   the navy/teal/amber palette to every visual by default.

## 2. Calculated columns

Add these on the `LSI_Data` table (**Table tools → New column**):

```DAX
Scale Band =
SWITCH(
    TRUE(),
    LSI_Data[LSI] <= -2,   "Severe corrosion",
    LSI_Data[LSI] <= -0.5, "Corrosive",
    LSI_Data[LSI] <= 0,    "Mildly corrosive",
    LSI_Data[LSI] <= 0.5,  "Near-balanced",
    LSI_Data[LSI] <= 1,    "Scale-forming",
    LSI_Data[LSI] <= 2,    "High scale-forming",
    "Severe scale-forming"
)
```

```DAX
Band Sort Order =
SWITCH(
    LSI_Data[Scale Band],
    "Severe corrosion", 1, "Corrosive", 2, "Mildly corrosive", 3,
    "Near-balanced", 4, "Scale-forming", 5, "High scale-forming", 6,
    "Severe scale-forming", 7
)
```

Then: select the `Scale Band` column → **Column tools → Sort by column** → `Band Sort
Order`. This makes the band bar chart sort corrosive → scale-forming instead of
alphabetically.

## 3. What-if parameter (the "action threshold" slicer)

**Modeling → New parameter → Numeric range**: name it `Action Threshold`, data type
Decimal, min `-1`, max `3`, increment `0.1`, default `0.5`. This creates an
`Action Threshold` slicer and an `Action Threshold Value` measure automatically —
drop the slicer into your top filter row next to the built-in Date slicer.

## 4. Core measures

```DAX
Latest Date = MAX(LSI_Data[Date])

Current LSI = CALCULATE(SUM(LSI_Data[LSI]), LSI_Data[Date] = [Latest Date])

LSI 30 Days Ago = CALCULATE(SUM(LSI_Data[LSI]), LSI_Data[Date] = [Latest Date] - 30)

30-Day Trend = [Current LSI] - [LSI 30 Days Ago]

Days Covered = COUNTROWS(LSI_Data)
```

### Trend / forecast measures (DAX equivalent of the web app's statistical model)

The web dashboard ensembles a mechanistic (chemistry-based) and a statistical
(direct trend) forecast. The statistical half — ordinary least-squares regression on
LSI vs. time — is the practical one to reproduce natively in DAX; it's what these
measures do:

```DAX
Trend Slope =
VAR t = ADDCOLUMNS(LSI_Data, "@x", LSI_Data[Date] - MIN(LSI_Data[Date]))
VAR n = COUNTROWS(t)
VAR sumX = SUMX(t, [@x])
VAR sumY = SUMX(t, LSI_Data[LSI])
VAR sumXY = SUMX(t, [@x] * LSI_Data[LSI])
VAR sumX2 = SUMX(t, [@x] ^ 2)
RETURN DIVIDE(n * sumXY - sumX * sumY, n * sumX2 - sumX ^ 2)

Trend Intercept =
VAR t = ADDCOLUMNS(LSI_Data, "@x", LSI_Data[Date] - MIN(LSI_Data[Date]))
VAR n = COUNTROWS(t)
VAR sumX = SUMX(t, [@x])
VAR sumY = SUMX(t, LSI_Data[LSI])
RETURN DIVIDE(sumY - [Trend Slope] * sumX, n)

Forecast Horizon Days = 90   -- replace with a second What-if parameter if you want it slicer-driven

Forecast LSI at Horizon =
VAR minDate = MIN(LSI_Data[Date])
VAR xAtHorizon = (MAX(LSI_Data[Date]) - minDate) + [Forecast Horizon Days]
RETURN [Trend Intercept] + [Trend Slope] * xAtHorizon

Days To Threshold =
VAR xAtThreshold = DIVIDE([Action Threshold Value] - [Trend Intercept], [Trend Slope])
VAR daysFromStart = xAtThreshold - (MAX(LSI_Data[Date]) - MIN(LSI_Data[Date]))
RETURN IF([Trend Slope] = 0, BLANK(), ROUND(daysFromStart, 0))

Threshold Crossing Date = MAX(LSI_Data[Date]) + [Days To Threshold]
```

*(For the confidence band shown on the web chart, add a line chart trendline via the
Analytics pane — see step 6 — Power BI's built-in forecast already computes and
plots its own confidence interval, so you don't need to hand-roll one in DAX.)*

### Correlation measures (for the driver-ranking bar chart)

DAX has no built-in `CORREL`, so build it once per driver from the raw-score
Pearson formula. Repeat for `Temperature_C`, `TDS_mg_L`, `Calcium_mg_L`,
`Alkalinity_mg_L`, `pH`, `Flow_m3_h`:

```DAX
Corr Temperature =
VAR n = COUNTROWS(LSI_Data)
VAR sumX = SUM(LSI_Data[Temperature_C])
VAR sumY = SUM(LSI_Data[LSI])
VAR sumXY = SUMX(LSI_Data, LSI_Data[Temperature_C] * LSI_Data[LSI])
VAR sumX2 = SUMX(LSI_Data, LSI_Data[Temperature_C] ^ 2)
VAR sumY2 = SUMX(LSI_Data, LSI_Data[LSI] ^ 2)
VAR num = n * sumXY - sumX * sumY
VAR den = SQRT((n * sumX2 - sumX ^ 2) * (n * sumY2 - sumY ^ 2))
RETURN DIVIDE(num, den)
```

Build a small disconnected table (**Enter data**) named `Drivers` with one column
`Driver` listing the six names, then a measure that switches on the selected driver
if you want a single dynamic bar chart; otherwise the simplest path is one measure
per driver plotted as six bars on a manually-built table/matrix visual.

## 5. KPI cards

Five **Card** visuals, matching the web dashboard's KPI row:

| Card | Measure |
|---|---|
| Current LSI | `Current LSI` (format: `+0.000;-0.000`) |
| 30-Day Trend | `30-Day Trend` |
| Forecast @ Horizon | `Forecast LSI at Horizon` |
| Threshold ETA | `Days To Threshold` or `Threshold Crossing Date` |
| Data Coverage | `Days Covered` |

## 6. Main chart — LSI trajectory & forecast

1. **Line chart**: Axis = `Date`, Values = `LSI` (or `Current LSI` won't work here —
   use the raw `LSI` column, not the measure, so every day plots).
2. Select the visual → **Analytics pane → Forecast → Add**. Set forecast length to
   match your horizon (e.g. 90 points/days) and confidence interval to 95%. This is
   Power BI's native exponential-smoothing forecast — visually it plays the same
   role as the web app's dashed projection + shaded band, though the underlying
   method differs (native Power BI forecasting uses exponential smoothing, not the
   mechanistic+statistical ensemble in the web version).
3. **Analytics pane → Constant line** bound to 0 (labeled "Balanced") and another
   bound to the `Action Threshold Value` measure (labeled "Action threshold").

## 7. Driver correlation bar chart

**Clustered bar chart** (horizontal): if you built one measure per driver, put them
on a matrix/table visual instead and use **Conditional formatting → Data bars**, or
build a small bar chart from the disconnected `Drivers` table with a switching
measure. Either way, sort descending by absolute correlation to match the ranking in
the web version.

## 8. Gauge — current scale tendency

**Gauge visual**: Value = `Current LSI`, Minimum = `-1.5`, Maximum = `1.5`, Target =
`0`. Native Power BI gauges only support a single fill color (no 3-zone
corrosive/balanced/scale-forming banding like the web version) — if you need that,
install the **"Multi-target Gauge"** or a similar AppSource custom visual, or accept
the single-color gauge and let the KPI card's classification text carry that detail
instead.

## 9. Monthly average LSI trend

**Line and area chart**: Axis = `Date` (drill to Month), Values = Average of `LSI`.
Add data labels for a couple of extreme points to match the callout style, or leave
labels on for all points if you're filtered to under ~8 months.

## 10. Days by scale-tendency (bar chart)

**Clustered column chart**: Axis = `Scale Band` (sorted by `Band Sort Order`, set in
step 2), Values = Count of `Date`. Apply conditional formatting on bar color: teal
shades for Severe corrosion/Corrosive/Mildly corrosive, amber shades for
Near-balanced/Scale-forming/High/Severe scale-forming, to mirror the diverging color
logic from the web chart.

## 11. Temperature vs. LSI scatter

**Scatter chart**: X = `Temperature_C`, Y = `LSI`. Set **Color saturation** = `LSI`
for a gradient effect approximating the web version's continuous diverging color.

## 12. Driver sparklines

Six small **Line chart** visuals (Temperature, TDS, Calcium, Alkalinity, pH, Flow),
axis = `Date`, minimal formatting (no axis labels, thin line) — arrange in a row,
same as the web dashboard's driver-trend strip.

## 13. Sidebar navigation

Power BI reports are fixed pages, not a scrolling single page, so the closest native
equivalent to the web dashboard's sidebar is: create **four report pages** —
*Overview*, *Trend & Forecast*, *Driver Analysis*, *Data Source* — matching the four
sections in the web version, then **Insert → Buttons → Navigator → Page navigator**.
Set its orientation to vertical, resize it into a left-hand rail, and format it with
the theme's navy background / light-cyan text to visually match the sidebar. Power BI
builds and maintains the button list and active-page highlighting for you.

## 14. Data refresh (the "live data" equivalent)

Point the query at a **published Google Sheet CSV link** or a SharePoint/OneDrive
Excel file instead of a local file, then use **scheduled refresh** in the Power BI
Service (Settings → Datasets → Scheduled refresh) for automatic updates — this is
the Power BI equivalent of the web dashboard's live-URL polling feature.

---

Once built, the report will look and behave like the web dashboard's design
language (navy sidebar, white KPI cards, teal/amber diverging charts) while being a
fully native Power BI artifact you can publish to the Power BI Service, schedule
refreshes for, and share via row-level security if needed.
