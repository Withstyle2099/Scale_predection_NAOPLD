# Scale Prediction & Water Stability Initiative — Reconciled Plan

**Status:** Reconciles the uploaded "revised plan" with what is actually built in
this repository. The revised plan is materially correct on chemistry and
methodology; it is wrong about the architecture and the build state it assumes.
This document says what changed, what shipped, and what's still open.

---

## 0. Reconciliation: the plan assumed a different app than this one

The revised plan states (§6, §8): *"Electron + React + TypeScript + SQLite +
Python sidecar is correct"* and *"Phases 1–3 (application scaffold, calculation
core, persistence, ML sidecar) are complete."*

Neither is true of this repository. What's actually here:

- A single static `index.html` (~400KB, HTML/CSS/vanilla JS, no build step,
  no framework) plus a vendored SheetJS build for Excel parsing.
- No Electron shell, no React, no TypeScript, no SQLite, no Python sidecar,
  no PHREEQC, no IPC contract.
- Persistence is `localStorage` for a remembered live-data URL — nothing more.
- A companion Power BI guide/theme for teams who want a native `.pbix` instead.

This is not a criticism of the plan's chemistry (§1–§4 of the original are
sound and are the basis for everything below) — it's a correction to §6–§8,
which described infrastructure that doesn't exist and a roadmap phased against
build milestones that were never reached in this codebase. Introducing a real
Electron/Python/PHREEQC stack is a legitimate architecture decision, but it's
a decision to make deliberately — not something to bolt onto a static page
silently. It is **not** done in this pass; see §6 below for what that would
actually take.

What this pass did instead: implemented as much of the plan's chemistry,
data-quality, forecasting-honesty, and dashboard-design corrections as are
achievable inside the existing static-JS architecture, and was explicit in the
UI and in code about the handful of things that genuinely require a backend
(full ion-activity speciation, ion balance across a full major-ion suite).

---

## 1. Index selection — what shipped

The demo dataset itself is a case in point for §1.1 of the original plan: it's
produced water at **~29,000 mg/L TDS** — 7× over the ~4,000 mg/L ceiling LSI's
empirical `A` term is calibrated for. The dashboard now runs a TDS-validity
check (`tdsValidityCheck()` in `index.html`) on every render and displays it
prominently in the **Data Quality & Index Validity** card, rather than quietly
reporting a number that looks precise but isn't defensible.

Shipped:
- **PSI (Puckorius)** alongside LSI — same inputs, equilibrium pH instead of
  measured pH, so it doesn't chase a CO₂-degassed sample the way LSI does.
- **Larson–Skold ratio**, a separate corrosivity panel, activated only when
  `Chloride_mg_L`/`Sulfate_mg_L` are present in the loaded data, never blended
  with the LSI/PSI gauge. Fixed the original mislabeling of `LSI < −0.5` as
  "High Corrosion Risk" — bands are now named for saturation state
  ("under-saturated"), and the footer/README state explicitly that LSI/PSI are
  not corrosion-rate indices.
- **Sulfate mineral saturation ratios** (CaSO₄, SrSO₄, BaSO₄) as SR =
  [cation][SO₄]/Ksp, activated when SO₄ (+ Ba/Sr) columns are present.

Not shipped, deliberately:
- **Stiff–Davis (SDI)** — a defensible SDI needs an ionic-strength-corrected
  `K` from a real nomograph/regression against full ion data. Hand-rolling one
  without a citable source would produce exactly the "reports green when it
  isn't" failure mode §1.1 warns about. The TDS-validity banner instead tells
  the user plainly that SDI or full speciation is the correct tool here and
  isn't implemented.
- **Oddo–Tomson** — needs total system pressure and CO₂ partial pressure,
  which this schema doesn't carry.

---

## 2. Chemistry engine — what shipped, what didn't

**Kept:** the empirical LSI/PSI formulas, now with an explicit validity check
and PSI as a second opinion.

**Not shipped:** PHREEQC/Pitzer speciation (§2.2 of the original). That's a
Python dependency with a real binary/library, which this static-JS app has no
way to invoke without a backend — see §6. The empirical formulas remain the
sole source of truth here, which is exactly why the TDS-validity gate matters:
it's the honesty mechanism standing in for speciation until/unless a backend
is actually built.

**Sensitivity (§2.3):** unchanged and confirmed by the new Decision Support
card, which computes real sensitivities from the shipped `calcLSI()` (not the
original's illustrative numbers) — e.g. "reduce alkalinity 30%" or "lower
surface temperature 8°C" against the currently loaded sample.

---

## 3. Data quality gate — what shipped, what's still open

Shipped, surfaced in the **Data Quality & Index Validity** card on every render:

- TDS validity (§1.1/§3 combined).
- pH basis (field/lab/reconstructed) — optional `pH_basis` column; unspecified
  is flagged, not hidden, with the 0.3–0.8-unit CO₂-degassing risk stated
  inline.
- Temperature basis (bulk/surface) — optional `Temp_basis` column; same
  honesty pattern.
- Unit basis — made explicit in the UI (previously only implicit in the
  README): Ca as Ca²⁺ mg/L, Alkalinity as mg/L CaCO₃.

Still open (schema doesn't carry the data; shown as "unavailable", not faked):

- **Ion balance** (§3.3) — needs a full major-ion suite (Na⁺, Mg²⁺, K⁺ beyond
  Ca²⁺/Cl⁻/SO₄²⁻/alkalinity). Not in this build's ingestion schema.
- **VFA correction** (§3.5) — no acetate/propionate column captured.
- **Detection-limit handling** (§3.6) — no LOD/substitution-rule tracking.

Any of these three are a schema + ingestion extension away (same pattern used
for `Chloride_mg_L`/`Sulfate_mg_L`/etc. this pass) — not a rewrite.

---

## 4. Forecasting — what shipped

The original app's OLS ensemble (mechanistic + statistical trend) already
existed. This pass added the part the original revised plan called for and
the app didn't have: **an honest baseline gate.**

`backtestForecastVsBaselines()` splits the series, trains the ensemble on the
front, backtests on a held-out tail, and compares its MAE against persistence
(last value) and seasonal-naive (value 365 days prior). The **Forecast vs.
Baselines** card states plainly whether the ensemble actually beats both — on
the shipped demo data it does (ensemble MAE 0.025 vs. 0.073 persistence / 0.344
seasonal-naive), which is expected given the dataset's strong, near-linear
drift; this will not hold on every real dataset, which is exactly why the
check runs live rather than being asserted once and forgotten.

Also shipped: a Monte Carlo measurement-uncertainty band on the *current*
reading (gauge), using assumed instrument uncertainty (pH ±0.10, T ±1°C,
Ca/Alk ±5%, TDS ±3%) — distinct from the existing forecast-projection band,
which is model uncertainty, not measurement uncertainty.

Not shipped: seasonal-naive/persistence/ETS as user-facing *alternative
forecast models* (only as backtest comparators), and no LSTM/GBT sidecar —
consistent with the original plan's own instruction not to ship a model that
doesn't beat the baseline, and there is no evidence yet (§9.4 below) that a
more complex model is needed.

---

## 5. Dashboard — what shipped, what didn't

Shipped:
- Data Quality & Index Validity card, Provenance strip (sample ID, pH/temp
  basis, index(es) computed, engine version, analyst, sample date).
- Gauge uncertainty band (§5.2).
- Colorblind-safe fix: `--good` was a saturated green sitting next to a red
  `--critical` — a textbook red-green pair. Changed to blue, consistent with
  the plan's blue→grey→amber→dark-red guidance. (The existing teal/amber
  diverging scale for the trend chart and gauge zones was already
  colorblind-safe; only the badge/status-dot green was wrong.)
- Sulfate Mineral Saturation Screening panel and Corrosivity (Larson–Skold)
  panel — the plan's replacement for a "rusting pipe" graphic (this build's
  gauge was already abstract, not a corrosion illustration, so there was no
  literal graphic to cut, but the same principle — don't visualize a claim the
  index doesn't make — motivated keeping LSI/PSI and Larson-Skold in
  physically separate cards).
- Decision Support card with computed sensitivity levers and general (non-
  prescriptive) treatment-category text.

Not shipped: LIMS linkage (no LIMS to link to), full uncertainty-budget
documentation (would need real instrument-uncertainty specs per site, not the
assumed values used here).

---

## 6. Architecture — what a real backend would take, if it's ever wanted

If PHREEQC/Pitzer speciation, SQLite persistence, or a trained forecasting
sidecar become real requirements, the honest scope is: a Python service
(FastAPI or similar) wrapping `phreeqpython`, called over HTTP from this same
`index.html` (or its logical successor) instead of the current pure-client
`fetchAndParse()` data path. That is a genuine new component with its own
deployment story — not a checkbox in this pass. The original plan's instinct
to defer the Electron-vs-web question is still right: nothing in this pass
forecloses it, since the chemistry/rendering logic here is already isolated in
plain functions with no framework coupling.

---

## 7. Validation & QA — what shipped

- `tests/chemistry.test.js` — extracts the real `calcLSI`/`calcPSI`/
  `calcLarsonSkold`/`calcMineralSR`/`tdsValidityCheck` functions out of
  `index.html` between marker comments (zero duplication, so the test can't
  silently drift from the shipped code) and checks them against oracle values
  computed independently in Python. Run: `node tests/chemistry.test.js`.
- This is **not** yet the "published worked examples" corpus the original plan
  asked for (§7) — these are cross-implementation correctness checks (JS
  matches the documented formula, verified independently in Python), not
  externally-published reference cases. Sourcing genuine published worked
  examples (NACE/ASTM or vendor handbooks) remains open work.
- No PHREEQC cross-validation (no PHREEQC in this build — see §2, §6).
- No round-trip against real lab data (no such dataset available to this
  repo — see §9 below, unchanged from the original plan's open question).
- No immutable audit log — this is a stateless static page; an audit log needs
  a persistence layer (see §6).

---

## 8. Roadmap — reframed again against what this pass actually did

**Done this pass** (superseding the original Phase 4/5/7 items that were
achievable without a backend):
- Index-selection validity gate (TDS check) and PSI as a second index.
- Larson-Skold and sulfate mineral SR panels (schema-gated, no fabricated data).
- pH/temperature basis provenance, unit-basis clarity, ion-balance/VFA/LOD
  honestly marked unavailable rather than silently assumed.
- Forecast baseline gate and gauge measurement-uncertainty band.
- Decision support sensitivity levers; colorblind palette fix.
- Formula regression test corpus (cross-checked against independent Python
  computation).

**Still open, and does require new infrastructure (not done here):**
- PHREEQC/Pitzer speciation and Stiff-Davis (needs a Python backend — §6).
- Full ion balance, VFA correction, LOD-substitution tracking (needs Na/Mg/K/
  VFA/LOD columns in the schema — straightforward extension, not done this
  pass because no real data exercises it yet).
- LIMS linkage, immutable audit log, uncertainty-budget documentation (need a
  real LIMS and real per-site instrument specs to be meaningful, not
  fabricatable).
- Externally-published worked-example test corpus (needs sourcing actual
  published references).

---

## 9. Open questions — answered where this repo has evidence, still open where it doesn't

1. **Are the target waters within LSI's validity range?** No — the demo
   dataset is ~29,000 mg/L TDS, 7× over the ceiling. The app now says so on
   every load. If real target assets are similarly high-TDS, replacing the
   calculation core (Stiff-Davis or PHREEQC) is genuinely the next priority,
   not a nice-to-have.
2. **Is sulfate scale in scope?** Unknown from this repo — the shipped demo
   dataset carries no Cl/SO₄/Ba/Sr data. The capability now exists
   (Larson-Skold, mineral SR panels) and activates the moment real data with
   those columns is loaded; it's inert until then. This is the one place this
   pass deliberately left a real gap rather than fabricate an answer.
3. **Can field pH be obtained?** Unknown — no `pH_basis` values exist in the
   demo data either (shown as "unspecified" throughout). This is an
   operational question for whoever owns sampling, not something the app can
   answer for you.
4. **What is the ground truth?** Still completely open — no historical
   scale-outcome dataset exists in this repo. Nothing in this pass creates
   one; the round-trip validation in §7 remains blocked on this until such a
   dataset is provided.
5. **Who owns the mitigation decision?** Unchanged from the original: the
   Decision Support card states levers and general treatment categories only,
   never a dosing prescription — but the organizational agreement the original
   plan asked for still needs to happen outside this codebase.
