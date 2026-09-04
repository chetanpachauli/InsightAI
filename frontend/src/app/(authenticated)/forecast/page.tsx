"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
  BarChart3,
  Sparkles,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ForecastableTable {
  table: string;
  filename: string;
  version: number;
  columns: string[];
}

interface ForecastPoint {
  index: number;
  value: number;
  upper?: number;
  lower?: number;
  smoothed?: number;
}

interface ForecastResult {
  table: string;
  column: string;
  horizon_days: number;
  data_points: number;
  trend: "up" | "down" | "flat";
  confidence_pct: number;
  historical: ForecastPoint[];
  forecast: ForecastPoint[];
  summary: string;
  last_value: number;
  forecast_value: number;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">Index: {label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ForecastPage() {
  const [tables,     setTables]     = useState<ForecastableTable[]>([]);
  const [selTable,   setSelTable]   = useState("");
  const [selColumn,  setSelColumn]  = useState("");
  const [horizon,    setHorizon]    = useState(30);
  const [result,     setResult]     = useState<ForecastResult | null>(null);
  const [loadingTbls, setLoadingTbls] = useState(true);
  const [loadingFcst, setLoadingFcst] = useState(false);
  const [error,      setError]      = useState("");

  // Fetch available tables on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/analytics/forecastable");
        setTables(res.data.tables ?? []);
      } catch {
        setError("Could not load datasets. Please ensure approved files exist.");
      } finally {
        setLoadingTbls(false);
      }
    })();
  }, []);

  // Auto-select first column when table changes
  useEffect(() => {
    const tbl = tables.find(t => t.table === selTable);
    if (tbl?.columns?.length) setSelColumn(tbl.columns[0]);
    else setSelColumn("");
  }, [selTable, tables]);

  const currentTable = tables.find(t => t.table === selTable);

  // Run forecast
  const runForecast = async () => {
    if (!selTable || !selColumn) return;
    setLoadingFcst(true);
    setError("");
    setResult(null);
    try {
      const res = await api.get("/analytics/forecast", {
        params: { table_name: selTable, column_name: selColumn, horizon_days: horizon },
      });
      setResult(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Forecast failed. Not enough data points.");
    } finally {
      setLoadingFcst(false);
    }
  };

  // Merge historical + forecast for chart
  const chartData = result ? [
    ...result.historical.map(p => ({
      index: p.index,
      actual: p.value,
      smoothed: p.smoothed,
    })),
    ...result.forecast.map(p => ({
      index: p.index,
      forecast: p.value,
      upper: p.upper,
      lower: p.lower,
    })),
  ] : [];

  const splitIndex = result ? result.historical.length : 0;

  const trendColor = result?.trend === "up" ? "text-emerald-400"
    : result?.trend === "down" ? "text-red-400" : "text-slate-400";

  const TrendIconEl = result?.trend === "up" ? TrendingUp
    : result?.trend === "down" ? TrendingDown : Minus;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-900">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-indigo-400" />
            AI Predictive Forecasting
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Linear regression forecasting on your approved business datasets — no complex ML needed.
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl text-xs text-red-400 font-medium mb-6 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Config Panel */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 mb-8">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Configure Forecast
        </h2>

        {loadingTbls ? (
          <div className="flex items-center space-x-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading approved datasets…</span>
          </div>
        ) : tables.length === 0 ? (
          <p className="text-slate-500 text-sm">No approved datasets found. Upload and approve a file first.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">

            {/* Dataset selector */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                Dataset
              </label>
              <select
                value={selTable}
                onChange={e => setSelTable(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">— Select dataset —</option>
                {tables.map(t => (
                  <option key={t.table} value={t.table}>
                    {t.filename} (v{t.version})
                  </option>
                ))}
              </select>
            </div>

            {/* Column selector */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                Numeric Column
              </label>
              <select
                value={selColumn}
                onChange={e => setSelColumn(e.target.value)}
                disabled={!selTable}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-40"
              >
                <option value="">— Select column —</option>
                {currentTable?.columns.map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>

            {/* Horizon selector */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                Forecast Horizon
              </label>
              <select
                value={horizon}
                onChange={e => setHorizon(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>

            {/* Run button */}
            <button
              onClick={runForecast}
              disabled={!selTable || !selColumn || loadingFcst}
              className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loadingFcst
                ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Forecasting…</span></>
                : <><BarChart3 className="w-4 h-4" /><span>Run Forecast</span></>
              }
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Data Points",       value: result.data_points.toLocaleString(),  color: "text-slate-300" },
              { label: "Current Value",     value: result.last_value.toLocaleString(undefined, { maximumFractionDigits: 2 }), color: "text-slate-300" },
              { label: `${result.horizon_days}d Forecast`, value: result.forecast_value.toLocaleString(undefined, { maximumFractionDigits: 2 }), color: trendColor },
              { label: "Confidence Band",   value: `±${result.confidence_pct}%`,         color: "text-amber-400" },
            ].map(card => (
              <div key={card.label} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{card.label}</p>
                <p className={`text-xl font-extrabold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Summary Pill */}
          <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
            result.trend === "up"   ? "bg-emerald-950/30 border-emerald-900/50" :
            result.trend === "down" ? "bg-red-950/30 border-red-900/50" :
            "bg-slate-900/50 border-slate-800"
          }`}>
            <TrendIconEl className={`w-5 h-5 flex-shrink-0 ${trendColor}`} />
            <p className={`text-sm font-semibold ${trendColor}`}>{result.summary}</p>
          </div>

          {/* Chart */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-slate-200">
                {result.column.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} — Forecast Chart
              </h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-indigo-400 rounded" /> Actual</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-emerald-400 rounded" /> Smoothed</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-amber-400 rounded border-dashed border-b border-amber-400" /> Forecast</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="index" tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={splitIndex} stroke="#475569" strokeDasharray="4 4" label={{ value: "Today", fill: "#64748b", fontSize: 11 }} />

                {/* Confidence band */}
                <Area type="monotone" dataKey="upper"   stroke="none" fill="#f59e0b" fillOpacity={0.08} name="Upper Band" />
                <Area type="monotone" dataKey="lower"   stroke="none" fill="#f59e0b" fillOpacity={0.08} name="Lower Band" />

                {/* Actual */}
                <Area type="monotone" dataKey="actual"   stroke="#6366f1" strokeWidth={2} fill="url(#gradActual)"   dot={false} name="Actual" />
                {/* Smoothed */}
                <Line  type="monotone" dataKey="smoothed" stroke="#4ade80" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Smoothed" />
                {/* Forecast */}
                <Area type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gradForecast)" dot={false} strokeDasharray="6 3" name="Forecast" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      {/* Empty state before forecast runs */}
      {!result && !loadingFcst && !error && tables.length > 0 && (
        <div className="border border-dashed border-slate-800 rounded-3xl p-16 text-center">
          <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-base font-semibold">Select a dataset and column, then click Run Forecast</p>
          <p className="text-slate-600 text-sm mt-1">Uses linear regression + moving average smoothing</p>
        </div>
      )}
    </>
  );
}
