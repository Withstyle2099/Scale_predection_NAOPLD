#!/usr/bin/env node
// Regression/oracle test for the chemistry engine embedded in index.html.
//
// This does NOT re-implement the formulas — it extracts the real, shipped
// calcLSI/calcPSI/calcLarsonSkold/calcMineralSR/tdsValidityCheck functions
// from index.html (between the CHEMISTRY-ENGINE:START/END markers) and runs
// them, so there is zero drift between what ships and what's tested.
//
// Expected values were computed independently in Python (see PR/commit
// description), not copy-pasted from this JS, so this is a genuine
// cross-implementation check of the documented formulas — not yet a
// corpus of externally published worked examples (that remains open work,
// see plan doc / open questions).
//
// Run: node tests/chemistry.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('// CHEMISTRY-ENGINE:START');
const end = html.indexOf('// CHEMISTRY-ENGINE:END');
if (start === -1 || end === -1) {
  console.error('FAIL: could not find CHEMISTRY-ENGINE markers in index.html');
  process.exit(1);
}
const engineSrc = html.slice(start, end);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);

let failures = 0;
function approx(actual, expected, tol, label) {
  const ok = Math.abs(actual - expected) <= tol;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + '  actual=' + actual.toFixed(4) + '  expected=' + expected.toFixed(4));
  if (!ok) failures++;
}

// --- LSI / PSI: independently computed in Python (math.log10, same formula) ---
const lsiCases = [
  { p: { tds: 1000, temp: 25, ca: 80.10, alk: 100, ph: 8.0 }, lsi: 0.3128, psi: 7.9045 },
  { p: { tds: 500,  temp: 20, ca: 120,   alk: 180, ph: 7.5 }, lsi: 0.1773, psi: 6.8015 },
  { p: { tds: 3000, temp: 60, ca: 400,   alk: 250, ph: 7.8 }, lsi: 1.7942, psi: 3.9587 },
];
lsiCases.forEach(function(c, i) {
  approx(sandbox.calcLSI(c.p), c.lsi, 0.001, 'calcLSI case ' + (i + 1));
  approx(sandbox.calcPSI(c.p), c.psi, 0.001, 'calcPSI case ' + (i + 1));
});

// --- TDS validity gate ---
(function () {
  const under = sandbox.tdsValidityCheck(2000);
  const over = sandbox.tdsValidityCheck(29440);
  console.log((under.valid === true ? 'PASS' : 'FAIL') + '  tdsValidityCheck(2000).valid === true');
  if (under.valid !== true) failures++;
  console.log((over.valid === false ? 'PASS' : 'FAIL') + '  tdsValidityCheck(29440).valid === false');
  if (over.valid !== false) failures++;
})();

// --- Larson-Skold: hand-computed, epm = mg/L / equivalent weight ---
// Cl 1200mg/L / 35.45 = 33.85 epm; SO4 900mg/L / 48.03 = 18.74 epm; Alk 150mg/L as CaCO3 / 50.04 = 3.00 epm
// LS = (33.85 + 18.74) / 3.00 = 17.53
(function () {
  const ls = sandbox.calcLarsonSkold(1200, 900, 150);
  approx(ls.value, 17.53, 0.05, 'calcLarsonSkold(1200, 900, 150)');
  console.log((ls.band.severity === 'critical' ? 'PASS' : 'FAIL') + '  Larson-Skold classified critical (>1.2)');
  if (ls.band.severity !== 'critical') failures++;
})();

// --- Mineral saturation ratio: barite (BaSO4), Ksp = 1.08e-10 ---
// Ba 15mg/L -> 15/1000/137.33 = 1.0922e-4 M ; SO4 900mg/L -> 900/1000/96.06 = 9.3692e-3 M
// IP = 1.0233e-6 ; SR = IP / 1.08e-10 = 9475
(function () {
  const sr = sandbox.calcMineralSR(15, 137.33, 900, 'baso4');
  approx(sr, 9475, 50, 'calcMineralSR barite(Ba=15, SO4=900)');
})();

console.log('');
if (failures > 0) {
  console.error(failures + ' test(s) FAILED');
  process.exit(1);
} else {
  console.log('All chemistry-engine tests passed.');
}
