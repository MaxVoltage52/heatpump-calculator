import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from "recharts";

// ---------- Helpers ----------
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function parsePairs(text) {
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
function interpCOP(table, t) {
  if (!table || table.length === 0) return 2.2;
  if (t <= table[0].x) return table[0].y;
  if (t >= table[table.length - 1].x) return table[table.length - 1].y;
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i], b = table[i + 1];
    if (t >= a.x && t <= b.x) {
      const frac = (t - a.x) / (b.x - a.x || 1);
      return a.y + frac * (b.y - a.y);
    }
  }
  return table[table.length - 1].y;
}
function normalizeBins(bins) {
  const total = bins.reduce((s, r) => s + r.y, 0) || 1;
  return bins.map((r) => ({ x: r.x, y: (r.y * 100) / total }));
}

// ---------- Defaults (Chicago profile you used) ----------
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

// ---------- Component ----------
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

  const upd = (k, v) => setInputs((s) => ({ ...s, [k]: v }));

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

    const gasAllIn = gasSupply + gasDist;            // $/therm
    const allInNon = (supplyC + txC + dfcNon) / 100; // $/kWh
    const allInEH  = (supplyC + txC + dfcEH) / 100;  // $/kWh

    // Baseline (Gas + AC)
    const baselineElec = kWhBase * allInNon;
    const baselineGas  = (heatMMBtu / 0.1 / afue) * gasAllIn;
    const baseline     = baselineElec + baselineGas;

    // All-electric HP and Hybrid by bins (if COP table provided)
    let hpKWh = (heatMMBtu * 293.071) / seasonalCOP; // fallback if not using table
    let hybrid = null, hybridGasMMBtu = 0, hybridHPkWh = 0;

    let matrix = []; // per-bin matrix rows
    if (useCopTable) {
      const table = parsePairs(copText);
      const bins  = normalizeBins(parsePairs(binsText));
      hpKWh = 0;

      const costGasPerMMBtu = (1 / 0.1 / afue) * gasAllIn; // $/MMBtu delivered
      let costHPsum = 0, costGASsum = 0;

      for (const b of bins) {
        const t = b.x;
        const share = b.y / 100;
        const mmbtu = heatMMBtu * share;
        const cop = interpCOP(table, t);
        const kwhPerMMBtu = 293.071 / cop;
        const costHPperMMBtu = kwhPerMMBtu * allInEH;

        // accumulate for all-electric
        hpKWh += mmbtu * kwhPerMMBtu;

        // hybrid choose cheaper
        let cheaper = "HP";
        if (costHPperMMBtu <= costGasPerMMBtu) {
          costHPsum += mmbtu * costHPperMMBtu;
        } else {
          cheaper = "Gas";
          costGASsum += mmbtu * costGasPerMMBtu;
          hybridGasMMBtu += mmbtu;
        }
        // matrix row
        matrix.push({
          t,
          pct: +b.y.toFixed(2),
          cop: +cop.toFixed(2),
          hpCost: +costHPperMMBtu.toFixed(2),
          gasCost: +costGasPerMMBtu.toFixed(2),
          cheaper
        });
      }
      hybrid = kWhBase * allInEH + costHPsum + costGASsum;
    }

    const allElectric = (kWhBase + hpKWh) * allInEH;
    const savingsAll = baseline - allElectric;
    const savingsHybrid = hybrid != null ? baseline - hybrid : null;

    const net = gross - credits;
    const paybackAll = savingsAll > 0 ? net / savingsAll : null;
    const paybackHybrid = savingsHybrid && savingsHybrid > 0 ? net / savingsHybrid : null;

    const dfcSavings = kWhBase * ((dfcNon - dfcEH) / 100);

    // crossover temp + series for chart
    const costGasPerMMBtu = (1 / 0.1 / afue) * gasAllIn;
    let crossoverTemp = null;
    let crossoverNote = "";
    let crossoverSeries = [];
    if (useCopTable) {
      const table = parsePairs(copText);
      if (table.length > 1) {
        const tMin = Math.min(-20, table[0].x);
        const tMax = Math.max(65, table[table.length - 1].x);
        const hpCost = (t) => (293.071 / interpCOP(table, t)) * allInEH;
        let prevT = tMin;
        let prevDiff = hpCost(prevT) - costGasPerMMBtu;
        for (let t = tMin; t <= tMax; t++) {
          const cHP = hpCost(t);
          crossoverSeries.push({ t, hp: cHP, gas: costGasPerMMBtu });
          const diff = cHP - costGasPerMMBtu;
          if ((prevDiff <= 0 && diff >= 0) || (prevDiff >= 0 && diff <= 0)) {
            const frac = Math.abs(diff - prevDiff) < 1e-9 ? 0 : (0 - prevDiff) / (diff - prevDiff);
            crossoverTemp = +(prevT + frac * (t - prevT)).toFixed(1);
            break;
          }
          prevT = t; prevDiff = diff;
        }
        if (crossoverTemp === null) {
          const diffAtMin = hpCost(tMin) - costGasPerMMBtu;
          const diffAtMax = hpCost(tMax) - costGasPerMMBtu;
          if (diffAtMin < 0 && diffAtMax < 0) crossoverNote = "HP cheaper at all temps";
          else if (diffAtMin > 0 && diffAtMax > 0) crossoverNote = "Gas cheaper at all temps";
          else crossoverNote = "Crossover outside modeled range";
        }
      }
    } else {
      crossoverNote = "Provide a COP table to compute a precise crossover temperature";
    }

    const chart = [
      { name: "Baseline (Gas+AC)", cost: Math.round(baseline) },
      { name: "All-Electric HP",   cost: Math.round(allElectric) },
      ...(hybrid != null ? [{ name: "Hybrid (cheapest)", cost: Math.round(hybrid) }] : []),
    ];

    return {
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
      gasHeatCost: Math.round((heatMMBtu / 0.1 / afue) * gasAllIn),
      hpHeatCost: Math.round(hpKWh * allInEH),
      fuelSwitchSavings: Math.round(((heatMMBtu / 0.1 / afue) * gasAllIn) - (hpKWh * allInEH)),
      chart,
      crossoverTemp,
      crossoverNote,
      crossoverSeries,
      matrix, // <-- temperature-by-bin matrix data
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
        Enter your numbers or use the Chicago defaults. Toggle COP Table for hybrid switching and matrix output.
      </p>

      {/* ---- Input Forms ---- */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Electricity</h2>
            <Label>Annual non-heating kWh</Label>
            <Input value={inputs.kwhBase} onChange={(e)=>upd("kwhBase", e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Supply (¢/kWh)</Label><Input value={inputs.supplyC} onChange={(e)=>upd("supplyC", e.target.value)} /></div>
              <div><Label>TX (¢/kWh)</Label><Input value={inputs.txC} onChange={(e)=>upd("txC", e.target.value)} /></div>
              <div><Label>DFC non-elec (¢/kWh)</Label><Input value={inputs.dfcNon} onChange={(e)=>upd("dfcNon", e.target.value)} /></div>
            </div>
            <div><Label>DFC electric-heat (¢/kWh)</Label><Input value={inputs.dfcEH} onChange={(e)=>upd("dfcEH", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Gas & Heating</h2>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Gas supply ($/therm)</Label><Input value={inputs.gasSupply} onChange={(e)=>upd("gasSupply", e.target.value)} /></div>
              <div><Label>Gas delivery ($/therm)</Label><Input value={inputs.gasDist} onChange={(e)=>upd("gasDist", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>AFUE (0–1)</Label><Input value={inputs.afue} onChange={(e)=>upd("afue", e.target.value)} /></div>
              <div><Label>Heat load (MMBtu/yr)</Label><Input value={inputs.heatMMBtu} onChange={(e)=>upd("heatMMBtu", e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={useCopTable} onCheckedChange={setUseCopTable} id="copSwitch" />
              <Label htmlFor="copSwitch">Use COP table + hybrid switching + matrix</Label>
            </div>
            {!useCopTable && (
              <div>
                <Label>Seasonal COP</Label>
                <Input value={inputs.seasonalCOP} onChange={(e)=>upd("seasonalCOP", e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Project Costs</h2>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Gross install ($)</Label><Input value={inputs.gross} onChange={(e)=>upd("gross", e.target.value)} /></div>
              <div><Label>Tax credits ($)</Label><Input value={inputs.credits} onChange={(e)=>upd("credits", e.target.value)} /></div>
            </div>
            <div className="pt-2 flex gap-2">
              <Button onClick={reset} variant="secondary">Reset Defaults</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {useCopTable && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">COP Table (°F:COP)</h3>
              <Textarea value={copText} onChange={(e)=>setCopText(e.target.value)} className="min-h-[180px]" />
              <p className="text-sm text-muted-foreground">One pair per line or comma-separated. We linearly interpolate.</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">Weather Bins (°F:% of heating)</h3>
              <Textarea value={binsText} onChange={(e)=>setBinsText(e.target.value)} className="min-h-[180px]" />
              <p className="text-sm text-muted-foreground">We normalize to 100%. Defaults approximate Chicago.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- Results & Charts ---- */}
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
                <div className="text-xl font-bold">${calc.savingsAll.toLocaleString()}</div>
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

            <div className="text-sm text-muted-foreground pt-2">
              Optimal crossover temperature:&nbsp;
              {calc.crossoverTemp !== null ? <b>{calc.crossoverTemp}°F</b> : <em>{calc.crossoverNote || "—"}</em>}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 h-full">
            <h2 className="font-semibold text-lg mb-2">Cost Comparison</h2>
            <div className="w-full h-64">
              <ResponsiveContainer>
                <BarChart data={calc.chart}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v)=>`$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Matrix Output (per bin) ---- */}
      {useCopTable && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-semibold text-lg mb-2">Temperature-by-Bin Matrix</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 pr-4">Temp (°F)</th>
                    <th className="py-2 pr-4">% of Heat</th>
                    <th className="py-2 pr-4">COP</th>
                    <th className="py-2 pr-4">HP $/MMBtu</th>
                    <th className="py-2 pr-4">Gas $/MMBtu</th>
                    <th className="py-2 pr-4">Cheaper</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.matrix.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1 pr-4">{r.t}</td>
                      <td className="py-1 pr-4">{r.pct}%</td>
                      <td className="py-1 pr-4">{r.cop}</td>
                      <td className="py-1 pr-4">${r.hpCost.toFixed(2)}</td>
                      <td className="py-1 pr-4">${r.gasCost.toFixed(2)}</td>
                      <td className="py-1 pr-4">{r.cheaper}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Matrix shows cost per delivered MMBtu by temperature bin using your COP curve and electric-heat rate.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ---- Crossover Chart ---- */}
      <Card className="shadow-sm">
        <CardContent className="p-4 h-full">
          <h2 className="font-semibold text-lg mb-2">Crossover Cost Curve</h2>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <LineChart data={calc.crossoverSeries}>
                <XAxis dataKey="t" label={{ value: "Temperature (°F)", position: "insideBottom", offset: -5 }} />
                <YAxis label={{ value: "$ per MMBtu", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(v)=>`$${Number(v).toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="hp" name="HP $/MMBtu" dot={false} />
                <Line type="monotone" dataKey="gas" name="Gas $/MMBtu" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
