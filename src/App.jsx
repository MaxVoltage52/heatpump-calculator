import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, ReferenceLine, Legend} from "recharts";

// ---------- Helpers ----------
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePairs(text) {
  // Accept lines or comma-separated like: 60:3.77, 35:2.75
  return text
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [a, b] = pair.split(":").map((t) => t.trim());
      return { x: Number(a), y: Number(b) };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
}

function interpCOP(copTable, tF) {
  if (!copTable || copTable.length === 0) return 2.2;
  if (tF <= copTable[0].x) return copTable[0].y; // cold extrapolate flat
  if (tF >= copTable[copTable.length - 1].x) return copTable[copTable.length - 1].y; // warm flat
  for (let i = 0; i < copTable.length - 1; i++) {
    const a = copTable[i];
    const b = copTable[i + 1];
    if (tF >= a.x && tF <= b.x) {
      const frac = (tF - a.x) / (b.x - a.x || 1);
      return a.y + frac * (b.y - a.y);
    }
  }
  return copTable[copTable.length - 1].y;
}

function normalizeBins(bins) {
  const total = bins.reduce((s, r) => s + r.y, 0) || 1;
  return bins.map((r) => ({ x: r.x, y: (r.y * 100) / total }));
}

// ---------- Default Data ----------
const DEFAULTS = {
  kwhBase: 97300,
  supplyC: 3.331,
  txC: 1.767,
  dfcNon: 6.062,
  dfcEH: 2.924,
  gasSupply: 0.52,
  gasDist: 0.2134,
  afue: 0.95,
  heatMMBtu: 37.5,
  seasonalCOP: 2.2,
  gross: 10354,
  credits: 2600,
};

const DEFAULT_COP = `60:3.77
55:3.56
50:3.39
45:3.24
40:3.12
35:2.75
30:2.62
25:2.50
20:2.37
15:2.24
10:2.11
5:2.00
0:1.87
-5:1.74
-10:1.65`;

const DEFAULT_BINS = `60:0
55:2
50:4
45:6
40:8
35:11
30:13
25:14
20:13
15:10
10:8
5:6
0:3
-5:1.5
-10:0.5`;

// ---------- UI ----------
export default function App() {
  const [inputs, setInputs] = useState({
    kwhBase: String(DEFAULTS.kwhBase),
    supplyC: String(DEFAULTS.supplyC),
    txC: String(DEFAULTS.txC),
    dfcNon: String(DEFAULTS.dfcNon),
    dfcEH: String(DEFAULTS.dfcEH),
    gasSupply: String(DEFAULTS.gasSupply),
    gasDist: String(DEFAULTS.gasDist),
    afue: String(DEFAULTS.afue),
    heatMMBtu: String(DEFAULTS.heatMMBtu),
    seasonalCOP: String(DEFAULTS.seasonalCOP),
    gross: String(DEFAULTS.gross),
    credits: String(DEFAULTS.credits),
  });

  const [useCopTable, setUseCopTable] = useState(true);
  const [copText, setCopText] = useState(DEFAULT_COP);
  const [binsText, setBinsText] = useState(DEFAULT_BINS);

  function upd(name, value) {
    setInputs((s) => ({ ...s, [name]: value }));
  }

  const calc = useMemo(() => {
    const kWhBase = toNumber(inputs.kwhBase, DEFAULTS.kwhBase);
    const supplyC = toNumber(inputs.supplyC, DEFAULTS.supplyC);
    const txC = toNumber(inputs.txC, DEFAULTS.txC);
    const dfcNon = toNumber(inputs.dfcNon, DEFAULTS.dfcNon);
    const dfcEH = toNumber(inputs.dfcEH, DEFAULTS.dfcEH);
    const gasSupply = toNumber(inputs.gasSupply, DEFAULTS.gasSupply);
    const gasDist = toNumber(inputs.gasDist, DEFAULTS.gasDist);
    const afue = toNumber(inputs.afue, DEFAULTS.afue);
    const heatMMBtu = toNumber(inputs.heatMMBtu, DEFAULTS.heatMMBtu);
    const seasonalCOP = toNumber(inputs.seasonalCOP, DEFAULTS.seasonalCOP);
    const gross = toNumber(inputs.gross, DEFAULTS.gross);
    const credits = toNumber(inputs.credits, DEFAULTS.credits);

    const gasAllIn = gasSupply + gasDist; // $/therm
    const allInNon = (supplyC + txC + dfcNon) / 100; // $/kWh
    const allInEH = (supplyC + txC + dfcEH) / 100; // $/kWh

    // Baseline (Gas + AC)
    const baselineElec = kWhBase * allInNon;
    const baselineGas = (heatMMBtu / 0.1 / afue) * gasAllIn;
    const baseline = baselineElec + baselineGas;

    // All-electric HP
    let hpKWh = 0;
    let hybrid = null;
    let hybridGasMMBtu = 0;
    let hybridHPkWh = 0;

    const costGasPerMMBtu = (1 / 0.1 / afue) * gasAllIn; // delivered $/MMBtu
    let crossoverTemp = null;
    let crossoverNote = "";

    if (useCopTable) {
      const table = parsePairs(copText);
      const bins = normalizeBins(parsePairs(binsText));

      // All-electric kWh from bins
      let kwhSum = 0;
      for (const b of bins) {
        const cop = interpCOP(table, b.x);
        const mmbtu = heatMMBtu * (b.y / 100);
        kwhSum += (mmbtu * 293.071) / cop;
      }
      hpKWh = kwhSum;

      // Hybrid: choose cheaper per bin
      let costHPsum = 0;
      let costGASsum = 0;
      for (const b of bins) {
        const cop = interpCOP(table, b.x);
        const mmbtu = heatMMBtu * (b.y / 100);
        const kwhPerMMBtu = 293.071 / cop;
        const costHPperMMBtu = kwhPerMMBtu * allInEH;
        if (costHPperMMBtu <= costGasPerMMBtu) {
          costHPsum += mmbtu * costHPperMMBtu;
          hybridHPkWh += mmbtu * kwhPerMMBtu;
        } else {
          costGASsum += mmbtu * costGasPerMMBtu;
          hybridGasMMBtu += mmbtu;
        }
      }
      hybrid = kWhBase * allInEH + costHPsum + costGASsum;

      // --- Crossover temperature: solve hpCost(T) = gasCost ---
      // hpCost per delivered MMBtu = (293.071 / COP(T)) * allInEH
      const hpCost = (t) => (293.071 / interpCOP(table, t)) * allInEH;
      const tMin = Math.min(-20, table[0]?.x ?? -20);
      const tMax = Math.max(65, table[table.length - 1]?.x ?? 65);

      let prevT = tMin;
      let prevDiff = hpCost(prevT) - costGasPerMMBtu;
      for (let t = tMin + 1; t <= tMax; t += 1) {
        const diff = hpCost(t) - costGasPerMMBtu;
        if ((prevDiff <= 0 && diff >= 0) || (prevDiff >= 0 && diff <= 0)) {
          const frac = Math.abs(diff - prevDiff) < 1e-9 ? 0 : (0 - prevDiff) / (diff - prevDiff);
          crossoverTemp = +(prevT + frac * (t - prevT)).toFixed(1);
          break;
        }
        prevT = t;
        prevDiff = diff;
      }
      if (crossoverTemp === null) {
        const diffAtMin = hpCost(tMin) - costGasPerMMBtu;
        const diffAtMax = hpCost(tMax) - costGasPerMMBtu;
        if (diffAtMin < 0 && diffAtMax < 0) crossoverNote = "HP cheaper at all temperatures in range";
        else if (diffAtMin > 0 && diffAtMax > 0) crossoverNote = "Gas cheaper at all temperatures in range";
        else crossoverNote = "Crossover outside modeled temperature range";
      }
    } else {
      // No table: we can’t compute a precise crossover temperature
      crossoverNote = "Provide a COP table to compute a precise crossover temperature";
      hpKWh = (heatMMBtu * 293.071) / seasonalCOP;
    }

    const allElectric = (kWhBase + hpKWh) * allInEH;

    const savingsAll = baseline - allElectric;
    const savingsHybrid = hybrid != null ? baseline - hybrid : null;

    const net = gross - credits;
    const paybackAll = savingsAll > 0 ? net / savingsAll : null;
    const paybackHybrid = savingsHybrid && savingsHybrid > 0 ? net / savingsHybrid : null;

    const dfcSavings = kWhBase * ((dfcNon - dfcEH) / 100);

    const gasHeatCost = (heatMMBtu / 0.1 / afue) * gasAllIn;
    const hpHeatCost = hpKWh * allInEH;
    const fuelSwitchSavings = gasHeatCost - hpHeatCost;

// Build cost curve for plotting HP vs Gas cost across temperature
let costCurve = [];
if (useCopTable) {
  const table = parsePairs(copText);
  if (table.length > 1) {
    const tMin = Math.min(-20, table[0].x);
    const tMax = Math.max(65, table[table.length - 1].x);
    const hpCostAt = (t) => (293.071 / interpCOP(table, t)) * allInEH; // $/MMBtu delivered
    for (let t = tMin; t <= tMax; t += 1) {
      costCurve.push({
        t,
        hpCost: +hpCostAt(t).toFixed(2),
        gasCost: +costGasPerMMBtu.toFixed(2),
      });
    }
  }
}


    const chart = [
      { name: "Baseline (Gas+AC)", cost: Math.round(baseline) },
      { name: "All-Electric HP", cost: Math.round(allElectric) },
      ...(hybrid != null ? [{ name: "Hybrid (cheapest)", cost: Math.round(hybrid) }] : []),
    ];

    return {
      kWhBase,
      baseline: Math.round(baseline),
      allElectric: Math.round(allElectric),
      hybrid: hybrid != null ? Math.round(hybrid) : null,
      hybridGasMMBtu: Number(hybridGasMMBtu.toFixed(1)),
      hybridHPkWh: Math.round(hybridHPkWh),
      savingsAll: Math.round(savingsAll),
      savingsHybrid: savingsHybrid != null ? Math.round(savingsHybrid) : null,
      paybackAll: paybackAll ? Number(paybackAll.toFixed(1)) : null,
      paybackHybrid: paybackHybrid ? Number(paybackHybrid.toFixed(1)) : null,
      dfcSavings: Math.round(dfcSavings),
      gasHeatCost: Math.round(gasHeatCost),
      hpHeatCost: Math.round(hpHeatCost),
      fuelSwitchSavings: Math.round(fuelSwitchSavings),
      chart,
      crossoverTemp,
      crossoverNote,
      costCurve,
    };
  }, [inputs, useCopTable, copText, binsText]);

  const reset = () => {
    setInputs({
      kwhBase: String(DEFAULTS.kwhBase),
      supplyC: String(DEFAULTS.supplyC),
      txC: String(DEFAULTS.txC),
      dfcNon: String(DEFAULTS.dfcNon),
      dfcEH: String(DEFAULTS.dfcEH),
      gasSupply: String(DEFAULTS.gasSupply),
      gasDist: String(DEFAULTS.gasDist),
      afue: String(DEFAULTS.afue),
      heatMMBtu: String(DEFAULTS.heatMMBtu),
      seasonalCOP: String(DEFAULTS.seasonalCOP),
      gross: String(DEFAULTS.gross),
      credits: String(DEFAULTS.credits),
    });
    setUseCopTable(true);
    setCopText(DEFAULT_COP);
    setBinsText(DEFAULT_BINS);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Heat Pump Break-Even & Payback Calculator</h1>
      <p className="text-muted-foreground">
        Enter your numbers or just hit Compute with the defaults (Chicago-style). Toggle COP Table for hybrid switching.
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Electricity</h2>
            <Label>Annual non-heating kWh</Label>
            <Input value={inputs.kwhBase} onChange={(e) => upd("kwhBase", e.target.value)} />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Supply (¢/kWh)</Label>
                <Input value={inputs.supplyC} onChange={(e) => upd("supplyC", e.target.value)} />
              </div>
              <div>
                <Label>TX (¢/kWh)</Label>
                <Input value={inputs.txC} onChange={(e) => upd("txC", e.target.value)} />
              </div>
              <div>
                <Label>DFC non-elec (¢/kWh)</Label>
                <Input value={inputs.dfcNon} onChange={(e) => upd("dfcNon", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>DFC electric-heat (¢/kWh)</Label>
              <Input value={inputs.dfcEH} onChange={(e) => upd("dfcEH", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Gas & Heating</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Gas supply ($/therm)</Label>
                <Input value={inputs.gasSupply} onChange={(e) => upd("gasSupply", e.target.value)} />
              </div>
              <div>
                <Label>Gas delivery ($/therm)</Label>
                <Input value={inputs.gasDist} onChange={(e) => upd("gasDist", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>AFUE (0–1)</Label>
                <Input value={inputs.afue} onChange={(e) => upd("afue", e.target.value)} />
              </div>
              <div>
                <Label>Heat load (MMBtu/yr)</Label>
                <Input value={inputs.heatMMBtu} onChange={(e) => upd("heatMMBtu", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={useCopTable} onCheckedChange={setUseCopTable} id="copSwitch" />
              <Label htmlFor="copSwitch">Use COP table + hybrid switching</Label>
            </div>
            {!useCopTable && (
              <div>
                <Label>Seasonal COP</Label>
                <Input value={inputs.seasonalCOP} onChange={(e) => upd("seasonalCOP", e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Project Costs</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Gross install ($)</Label>
                <Input value={inputs.gross} onChange={(e) => upd("gross", e.target.value)} />
              </div>
              <div>
                <Label>Tax credits ($)</Label>
                <Input value={inputs.credits} onChange={(e) => upd("credits", e.target.value)} />
              </div>
            </div>
            <div className="pt-2 flex gap-2">
              <Button onClick={reset} variant="secondary">
                Reset Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {useCopTable && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">COP Table (°F:COP)</h3>
              <Textarea value={copText} onChange={(e) => setCopText(e.target.value)} className="min-h-[180px]" />
              <p className="text-sm text-muted-foreground">
                Tip: one pair per line or comma-separated. Values will be sorted and linearly interpolated.
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">Weather Bins (°F:% of heating)</h3>
              <Textarea value={binsText} onChange={(e) => setBinsText(e.target.value)} className="min-h-[180px]" />
              <p className="text-sm text-muted-foreground">
                We normalize to 100%. Defaults approximate Chicago heating distribution.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 items-stretch">
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Results</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-muted">
                <div className="text-xs text-muted-foreground">Baseline (Gas+AC)</div>
                <div className="text-xl font-bold">${calc.baseline.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-2xl bg-muted">
                <div className="text-xs text-muted-foreground">All-Electric HP</div>
                <div className="text-xl font-bold">${calc.allElectric.toLocaleString()}</div>
              </div>
              {calc.hybrid !== null && (
                <div className="p-3 rounded-2xl bg-muted col-span-2">
                  <div className="text-xs text-muted-foreground">Hybrid (cheapest by bin)</div>
                  <div className="text-xl font-bold">${calc.hybrid.toLocaleString()}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="p-3 rounded-2xl bg-green-50">
                <div className="text-xs text-muted-foreground">Annual Savings vs Baseline</div>
                <div className="text-xl font-bold">
                  ${calc.savingsAll.toLocaleString()} {calc.hybrid !== null ? " (HP)" : ""}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-blue-50">
                <div className="text-xs text-muted-foreground">DFC Savings on Base kWh</div>
                <div className="text-xl font-bold">${calc.dfcSavings.toLocaleString()}/yr</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="p-3 rounded-2xl bg-amber-50">
                <div className="text-xs text-muted-foreground">Simple Payback (All-Electric)</div>
                <div className="text-xl font-bold">{calc.paybackAll ? `${calc.paybackAll} yrs` : "—"}</div>
              </div>
              {calc.hybrid !== null && (
                <div className="p-3 rounded-2xl bg-amber-50">
                  <div className="text-xs text-muted-foreground">Simple Payback (Hybrid)</div>
                  <div className="text-xl font-bold">{calc.paybackHybrid ? `${calc.paybackHybrid} yrs` : "—"}</div>
                </div>
              )}
            </div>

            {calc.hybrid !== null && (
              <div className="text-sm text-muted-foreground pt-1">
                Hybrid split: Gas {calc.hybridGasMMBtu} MMBtu | HP {calc.hybridHPkWh.toLocaleString()} kWh
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 h-full">
            <h2 className="font-semibold text-lg mb-2">Cost Comparison</h2>
            <div className="w-full h-64">
              <ResponsiveContainer>
                <BarChart data={calc.chart}>
                  <XAxis dataKey="name" hide={false} />
                  <YAxis />
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

{useCopTable && calc.costCurve && calc.costCurve.length > 0 && (
  <Card className="shadow-sm">
    <CardContent className="p-4 h-full">
      <h2 className="font-semibold text-lg mb-2">Cost vs Temperature</h2>
      <div className="w-full h-72">
        <ResponsiveContainer>
          <LineChart data={calc.costCurve}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" unit="°F" />
            <YAxis
              label={{ value: "$/MMBtu (delivered)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="hpCost" name="HP cost" dot={false} />
            <Line type="monotone" dataKey="gasCost" name="Gas cost" dot={false} />
            {calc.crossoverTemp !== null && (
              <ReferenceLine
                x={calc.crossoverTemp}
                label={{ value: `Crossover ${calc.crossoverTemp}°F`, position: "top" }}
                strokeDasharray="4 4"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-sm text-muted-foreground mt-2">
        {calc.crossoverTemp !== null
          ? <>Optimal crossover temperature: <b>{calc.crossoverTemp}°F</b></>
          : <>{calc.crossoverNote || "Provide a COP table to compute a precise crossover temperature."}</>}
      </div>
    </CardContent>
  </Card>
)}


      </div>

      {/* Savings Breakdown Card */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-2">
          <h2 className="font-semibold text-lg">Savings Breakdown</h2>
          <div className="grid md:grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-green-50">
              <div className="text-xs text-muted-foreground">DFC savings on base kWh</div>
              <div className="text-xl font-bold">${calc.dfcSavings.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-2xl bg-green-50">
              <div className="text-xs text-muted-foreground">Fuel-switch savings (gas → HP)</div>
              <div className="text-xl font-bold">${Math.max(0, calc.fuelSwitchSavings).toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-2xl bg-muted">
              <div className="text-xs text-muted-foreground">Heating costs (baseline vs HP)</div>
              <div className="text-sm">
                Gas: ${calc.gasHeatCost.toLocaleString()} / HP: ${calc.hpHeatCost.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Optimal crossover temperature:&nbsp;
            {calc.crossoverTemp !== null ? <b>{calc.crossoverTemp}°F</b> : <em>{calc.crossoverNote || "—"}</em>}
          </div>

          <p className="text-sm text-muted-foreground">
            Note: DFC savings shown here apply to your existing/base kWh only. Heating energy costs are shown separately
            to isolate the gas→HP fuel effect.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Button onClick={reset} variant="secondary">
              Use Defaults
            </Button>
            <span className="text-sm text-muted-foreground">
              Tip: paste your COP table and click around — results update instantly.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
