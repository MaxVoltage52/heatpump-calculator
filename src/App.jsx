import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

// ---------- Helpers ----------
function toNumber(value: string, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePairs(text: string): Array<{ x: number; y: number }> {
  return text
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [a, b] = pair.split(":").map((t) => t.trim());
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
      gasHeatCost: Number(((heatMMBtu / 0.1 / afue) * gasAllIn).toFixed(0)),
      hpHeatCost: Number((hpKWh * allInEH).toFixed(0)),
      fuelSwitchSavings: Number((((heatMMBtu / 0.1 / afue) * gasAllIn) - (hpKWh * allInEH)).toFixed(0)),
      chart,
      crossoverTemp,
      crossoverNote,
      crossoverSeries,
      matrix,
    }: Array<{t:number, hp:number, gas:number}> = [];
    if (useCopTable) {
      const table = parsePairs(copText);
      if (table.length > 1) {
        const tMin = Math.min(-20, table[0].x);
        const tMax = Math.max(65, table[table.length - 1].x);
        const hpCost = (t: number) => (293.071 / interpCOP(table, t)) * allInEH;
        let prevT = tMin;
        let prevDiff = hpCost(prevT) - costGasPerMMBtu;
        for (let t = tMin; t <= tMax; t++) {
          const costHP = hpCost(t);
          crossoverSeries.push({t, hp: costHP, gas: costGasPerMMBtu});
          const diff = costHP - costGasPerMMBtu;
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
      gasHeatCost: Number(((heatMMBtu / 0.1 / afue) * gasAllIn).toFixed(0)),
      hpHeatCost: Number((hpKWh * allInEH).toFixed(0)),
      fuelSwitchSavings: Number((((heatMMBtu / 0.1 / afue) * gasAllIn) - (hpKWh * allInEH)).toFixed(0)),
      chart,
      crossoverTemp,
      crossoverNote,
      crossoverSeries
    };
  }, [inputs, useCopTable, copText, binsText]);

  const reset = () => {
    setInputs({
      kwhBase: '97300',
      supplyC: '3.331',
      txC: '1.767',
      dfcNon: '6.062',
      dfcEH: '2.924',
      gasSupply: '0.52',
      gasDist: '0.2134',
      afue: '0.95',
      heatMMBtu: '37.5',
      seasonalCOP: '2.2',
      gross: '10354',
      credits: '2600',
    });
    setUseCopTable(true);
    setCopText(`60:3.77
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
-10:1.65`);
    setBinsText(`60:0
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
-10:0.5`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Heat Pump Break‑Even & Payback Calculator</h1>
      <p className="text-muted-foreground">Enter your numbers or just hit Compute with the defaults (Chicago-style). Toggle COP Table for hybrid switching.</p>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Electricity</h2>
            <Label>Annual non‑heating kWh</Label>
            <Input value={(inputs as any).kwhBase || ''} onChange={(e)=>setInputs((s:any)=>({...s,kwhBase:e.target.value}))} />
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Supply (¢/kWh)</Label><Input value={(inputs as any).supplyC || ''} onChange={(e)=>setInputs((s:any)=>({...s,supplyC:e.target.value}))} /></div>
              <div><Label>TX (¢/kWh)</Label><Input value={(inputs as any).txC || ''} onChange={(e)=>setInputs((s:any)=>({...s,txC:e.target.value}))} /></div>
              <div><Label>DFC non‑elec (¢/kWh)</Label><Input value={(inputs as any).dfcNon || ''} onChange={(e)=>setInputs((s:any)=>({...s,dfcNon:e.target.value}))} /></div>
            </div>
            <div><Label>DFC electric‑heat (¢/kWh)</Label><Input value={(inputs as any).dfcEH || ''} onChange={(e)=>setInputs((s:any)=>({...s,dfcEH:e.target.value}))} /></div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Gas & Heating</h2>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Gas supply ($/therm)</Label><Input value={(inputs as any).gasSupply || ''} onChange={(e)=>setInputs((s:any)=>({...s,gasSupply:e.target.value}))} /></div>
              <div><Label>Gas delivery ($/therm)</Label><Input value={(inputs as any).gasDist || ''} onChange={(e)=>setInputs((s:any)=>({...s,gasDist:e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>AFUE (0–1)</Label><Input value={(inputs as any).afue || ''} onChange={(e)=>setInputs((s:any)=>({...s,afue:e.target.value}))} /></div>
              <div><Label>Heat load (MMBtu/yr)</Label><Input value={(inputs as any).heatMMBtu || ''} onChange={(e)=>setInputs((s:any)=>({...s,heatMMBtu:e.target.value}))} /></div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={useCopTable} onCheckedChange={setUseCopTable} id="copSwitch" />
              <Label htmlFor="copSwitch">Use COP table + hybrid switching + matrix</Label>
            </div>
            {!useCopTable && (
              <div>
                <Label>Seasonal COP</Label>
                <Input value={(inputs as any).seasonalCOP || ''} onChange={(e)=>setInputs((s:any)=>({...s,seasonalCOP:e.target.value}))} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Project Costs</h2>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Gross install ($)</Label><Input value={(inputs as any).gross || ''} onChange={(e)=>setInputs((s:any)=>({...s,gross:e.target.value}))} /></div>
              <div><Label>Tax credits ($)</Label><Input value={(inputs as any).credits || ''} onChange={(e)=>setInputs((s:any)=>({...s,credits:e.target.value}))} /></div>
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
      )

      <div className="grid md:grid-cols-2 gap-4 items-stretch">
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-lg">Results</h2>
            {/* ... existing results cards ... */}

            {calc.crossoverTemp !== null ? (
              <div className="text-sm text-muted-foreground pt-2">Optimal crossover temperature: <b>{calc.crossoverTemp}°F</b></div>
            ) : (
              <div className="text-sm text-muted-foreground pt-2">{calc.crossoverNote}</div>
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
                  <Tooltip formatter={(v: any)=>`$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <h2 className="font-semibold text-lg mb-2">Temperature-by-Bin Matrix</h2>
          {useCopTable ? (
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
                  {calc.matrix.map((r: any, i: number) => (
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
          ) : (
            <p className="text-sm text-muted-foreground">Enable "Use COP table" to see the matrix.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4 h-full">
          <h2 className="font-semibold text-lg mb-2">Crossover Cost Curve</h2>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <LineChart data={calc.crossoverSeries}>
                <XAxis dataKey="t" label={{ value: "Temperature (°F)", position: "insideBottom", offset: -5 }} />
                <YAxis label={{ value: "$ per MMBtu", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(v: any)=>`$${Number(v).toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="hp" name="HP $/MMBtu" dot={false} />
                <Line type="monotone" dataKey="gas" name="Gas $/MMBtu" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ... rest of UI unchanged ... */}
    </div>
  );
}
