"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import {
  FileText,
  CheckCircle2,
  Sliders,
  Bot,
  Activity,
  AlertCircle,
  Loader2,
  Sparkles,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  BarChart3,
  Database,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuditLog {
  id: number;
  action: string;
  details: string;
  timestamp: string;
}

interface DashboardStats {
  total_files: number;
  total_approved: number;
  total_rules: number;
  recent_logs: AuditLog[];
}

interface AIInsights {
  key_findings: string[];
  recommendations: string[];
}

interface InsightPill {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral" | "warning";
  color: string;
  icon: string;
  table: string;
  meta?: { avg: number; max: number; min: number; rows: number };
}

// ─── Helper: Trend icon ───────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up")      return <TrendingUp   className="w-4 h-4 text-emerald-400" />;
  if (trend === "down")    return <TrendingDown  className="w-4 h-4 text-red-400" />;
  if (trend === "warning") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

// ─── Pill color map ───────────────────────────────────────────────────────────
const PILL_STYLES: Record<string, { border: string; glow: string; badge: string; text: string }> = {
  green:  { border: "border-emerald-900/60", glow: "bg-emerald-500/10", badge: "bg-emerald-950/60 text-emerald-300 border-emerald-800/40", text: "text-emerald-300" },
  red:    { border: "border-red-900/60",     glow: "bg-red-500/10",     badge: "bg-red-950/60     text-red-300     border-red-800/40",     text: "text-red-300"     },
  orange: { border: "border-amber-900/60",   glow: "bg-amber-500/10",   badge: "bg-amber-950/60   text-amber-300   border-amber-800/40",   text: "text-amber-300"   },
  blue:   { border: "border-indigo-900/60",  glow: "bg-indigo-500/10",  badge: "bg-indigo-950/60  text-indigo-300  border-indigo-800/40",  text: "text-indigo-300"  },
};

// ─── Smart Insight Card ───────────────────────────────────────────────────────
function InsightCard({ pill }: { pill: InsightPill }) {
  const style = PILL_STYLES[pill.color] ?? PILL_STYLES.blue;
  const trendLabel: Record<string, string> = {
    up: "↑ Rising", down: "↓ Falling", warning: "⚠ Anomaly", neutral: "→ Stable",
  };

  return (
    <div className={`relative bg-slate-900/70 border ${style.border} rounded-2xl p-4 hover:border-opacity-80 transition-all duration-200 overflow-hidden group`}>
      {/* Glow */}
      <div className={`absolute top-0 right-0 w-20 h-20 ${style.glow} rounded-full blur-xl pointer-events-none group-hover:opacity-70 transition-opacity`} />

      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-tight pr-2 line-clamp-2">
          {pill.label}
        </p>
        <TrendIcon trend={pill.trend} />
      </div>

      <p className={`text-2xl font-extrabold ${style.text} mb-2`}>{pill.value}</p>

      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.badge}`}>
        {trendLabel[pill.trend] ?? "→ Stable"}
      </span>

      {pill.meta && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-1 text-[10px] text-slate-500">
          <span>Avg: <b className="text-slate-400">{pill.meta.avg.toLocaleString()}</b></span>
          <span>Max: <b className="text-slate-400">{pill.meta.max.toLocaleString()}</b></span>
          <span>Rows: <b className="text-slate-400">{pill.meta.rows.toLocaleString()}</b></span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats,    setStats]    = useState<DashboardStats | null>(null);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [pills,    setPills]    = useState<InsightPill[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [pillsLoading, setPillsLoading] = useState(true);
  const [error,    setError]    = useState("");
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const userEmail = typeof window !== "undefined" ? localStorage.getItem("user_email") ?? "" : "";
  const userRole  = typeof window !== "undefined" ? localStorage.getItem("user_role")  ?? "" : "";

  // ── Fetch all dashboard data ────────────────────────────────────────────────
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [statsRes, insightsRes] = await Promise.all([
        api.get("/query/stats"),
        api.get("/query/insights"),
      ]);
      setStats(statsRes.data);
      setInsights(insightsRes.data);
    } catch {
      setError("Failed to fetch dashboard metrics. Please ensure the backend is running.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Smart pills fetched separately (can be slow)
  const fetchPills = useCallback(async () => {
    setPillsLoading(true);
    try {
      const res = await api.get("/analytics/insights");
      setPills(res.data.insights ?? []);
    } catch {
      setPills([]);
    } finally {
      setPillsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchPills();
  }, [fetchData, fetchPills]);

  // ── Excel export (new professional report) ─────────────────────────────────
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get("/analytics/export/excel", { responseType: "blob" });
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href     = url;
      link.download = `InsightAI_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback to client-side CSV
      handleExportCSV();
    } finally {
      setExporting(false);
    }
  };

  // ── CSV fallback export ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!stats) return;
    const rows = [
      ["INSIGHTAI EXECUTIVE REPORT"],
      [`Generated By: ${userEmail} (${userRole})`],
      [`Generated At: ${new Date().toLocaleString()}`],
      [],
      ["=== KPI SUMMARY ==="],
      ["Metric", "Value"],
      ["Total Files", stats.total_files],
      ["Approved Datasets", stats.total_approved],
      ["Active Rules", stats.total_rules],
      [],
      ["=== AI INSIGHTS ==="],
      ...(insights?.key_findings?.map((f, i) => [`Finding ${i+1}`, `"${f.replace(/"/g,'""')}"`]) ?? []),
      [],
      ["=== AUDIT LOG ==="],
      ["Timestamp", "Action", "Details"],
      ...(stats.recent_logs?.map(l => [
        new Date(l.timestamp).toLocaleString(), l.action, `"${l.details.replace(/"/g,'""')}"`
      ]) ?? []),
    ];
    const csv  = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = `InsightAI_Report_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Assembling analytics workspace...</p>
        <p className="text-slate-500 text-xs mt-1">Running aggregations & Gemini AI reports</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-900">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            MIS Executive Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time monitoring · Smart insights · AI diagnostics
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3 no-print">
          {/* Refresh */}
          <button
            onClick={() => { fetchData(true); fetchPills(); }}
            disabled={refreshing}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4 py-3 rounded-2xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {/* Excel export */}
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            {exporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileSpreadsheet className="w-4 h-4" />
            }
            <span>{exporting ? "Generating..." : "Export Excel"}</span>
          </button>

          {/* PDF print */}
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-md transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>

          {/* User badge */}
          <div className="flex items-center space-x-3 bg-slate-900/50 border border-slate-800/80 px-4 py-3 rounded-2xl">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300">
              Welcome, <span className="text-indigo-400 font-bold">{userEmail.split("@")[0] || "User"}</span>
              <span className="text-slate-500"> ({userRole || "Employee"})</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl text-xs text-red-400 font-medium mb-8 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-8">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Spreadsheets Loaded",  value: stats?.total_files    ?? 0, icon: FileText,    color: "text-indigo-400",  glow: "bg-indigo-500/5",  desc: "Total file versions in registry" },
            { label: "Approved Datasets",     value: stats?.total_approved ?? 0, icon: CheckCircle2,color: "text-emerald-400", glow: "bg-emerald-500/5", desc: "Available for AI Chat & Queries" },
            { label: "Active Alert Rules",    value: stats?.total_rules    ?? 0, icon: Sliders,     color: "text-violet-400",  glow: "bg-violet-500/5",  desc: "Rules Engine triggers configured" },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 hover:border-slate-700/80 transition-all duration-200 shadow-lg relative overflow-hidden group">
                <div className={`absolute top-0 right-0 w-24 h-24 ${card.glow} rounded-full blur-xl group-hover:opacity-150 transition-opacity`} />
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.label}</span>
                  <div className={`w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center ${card.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-3xl font-extrabold text-white">{card.value}</h3>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">{card.desc}</p>
              </div>
            );
          })}
        </div>

        {/* ── Smart Insights Widgets ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-200 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <span>Smart Analytics Signals</span>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest border border-slate-800/80 px-2 py-0.5 rounded ml-2">
                Auto-Detected
              </span>
            </h2>
            {!pillsLoading && pills.length > 0 && (
              <span className="text-xs text-slate-500">{pills.length} signals detected</span>
            )}
          </div>

          {pillsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-slate-900/40 border border-slate-800/40 rounded-2xl p-4 animate-pulse">
                  <div className="h-3 bg-slate-800 rounded w-3/4 mb-3" />
                  <div className="h-7 bg-slate-800 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-slate-800 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : pills.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pills.map((pill, idx) => <InsightCard key={idx} pill={pill} />)}
            </div>
          ) : (
            <div className="border border-dashed border-slate-800 rounded-2xl p-8 text-center">
              <Database className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-semibold">No smart signals yet</p>
              <p className="text-slate-500 text-xs mt-1">Upload and approve datasets to generate automatic insights.</p>
            </div>
          )}
        </div>

        {/* ── Main Grid: AI Insights + Audit Trail ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* AI Insights Panel */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden shadow-xl h-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-200 flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <span>Gemini Business Intelligence</span>
                </h2>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest border border-slate-800/80 px-2 py-0.5 rounded">
                  AI Report
                </span>
              </div>

              {insights ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/50 pb-2 flex items-center space-x-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Key Diagnostics</span>
                    </h4>
                    <ul className="space-y-3">
                      {insights.key_findings?.length > 0 ? insights.key_findings.map((item, idx) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-start space-x-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      )) : <li className="text-sm text-slate-500 italic">No findings yet — approve a dataset.</li>}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/50 pb-2 flex items-center space-x-1">
                      <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Action Recommendations</span>
                    </h4>
                    <ul className="space-y-3">
                      {insights.recommendations?.length > 0 ? insights.recommendations.map((item, idx) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-start space-x-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      )) : <li className="text-sm text-slate-500 italic">No recommendations available.</li>}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed border-slate-850 rounded-2xl">
                  <Bot className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs font-semibold">No insights generated</p>
                  <p className="text-slate-500 text-[10px] mt-0.5">Approve files to let Gemini compile metrics.</p>
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl h-full flex flex-col">
              <h2 className="text-base font-bold text-slate-200 mb-6 flex items-center space-x-2 border-b border-slate-850 pb-4">
                <Activity className="w-5 h-5 text-indigo-400" />
                <span>Real-time Audit Trail</span>
              </h2>

              {stats?.recent_logs?.length ? (
                <div className="flex-1 space-y-3 overflow-y-auto max-h-96">
                  {stats.recent_logs.map((log) => {
                    const isUpload  = log.action.includes("UPLOAD");
                    const isApprove = log.action.includes("APPROV");
                    const isQuery   = log.action.includes("QUERY");
                    const isAI      = log.action.includes("AI");

                    const badgeClass = isUpload  ? "bg-blue-950/40   text-blue-400   border-blue-900/30"
                      : isApprove ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/30"
                      : isAI     ? "bg-purple-950/40  text-purple-400  border-purple-900/30"
                      : isQuery  ? "bg-violet-950/40  text-violet-400  border-violet-900/30"
                      :            "bg-slate-900      text-slate-400";

                    return (
                      <div key={log.id} className="p-3 bg-slate-950/40 border border-slate-850/80 rounded-xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                            {log.action}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-slate-300 font-medium leading-relaxed line-clamp-2">{log.details}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-850 rounded-2xl">
                  <Activity className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-slate-400 text-xs font-semibold">No recent logs</p>
                  <p className="text-slate-500 text-[10px] mt-0.5">Actions will stream here live.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
