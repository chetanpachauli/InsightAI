"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import api, { getApiError } from "@/lib/api";
import { 
  TrendingUp, 
  DollarSign, 
  UploadCloud, 
  Loader2, 
  Table, 
  PieChart as PieIcon, 
  ArrowDownCircle, 
  ArrowUpCircle,
  FolderSync
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from "recharts";

interface Transaction {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  category: string;
}

interface CategorySummary {
  category: string;
  spent: number;
}

interface FinanceStats {
  total_debit: number;
  total_credit: number;
  categories: CategorySummary[];
  transactions: Transaction[];
}

const CATEGORY_COLORS = {
  "Food & Dining": "#f43f5e",        // rose-500
  "Rent & Utilities": "#3b82f6",     // blue-500
  "Shopping & Lifestyle": "#eab308",  // amber-500
  "Travel & Fuel": "#10b981",        // emerald-500
  "Salary & Income": "#8b5cf6",       // violet-500
  "Entertainment": "#ec4899",        // pink-500
  "Miscellaneous": "#64748b"         // slate-500
};

const CATEGORIES_LIST = [
  "Food & Dining",
  "Rent & Utilities",
  "Shopping & Lifestyle",
  "Travel & Fuel",
  "Salary & Income",
  "Entertainment",
  "Miscellaneous"
];

export default function FinancePage() {
  const [uploading, setUploading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [activeTable, setActiveTable] = useState<string>("");
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploading(true);
    setError("");
    setSuccess("");
    setStats(null);
    setActiveTable("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await api.post("/finance/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      
      setSuccess(response.data.message);
      setActiveTable(response.data.table_name);
      fetchStats(response.data.table_name);
    } catch (err) {
      setError(
        getApiError(err, "Failed to index bank statement. Verify structure and ensure Date and Description are column headers.")
      );
    } finally {
      setUploading(false);
    }
  };

  const fetchStats = async (tableName: string) => {
    if (!tableName) return;
    setLoadingStats(true);
    setError("");
    try {
      const response = await api.get(`/finance/stats?table_name=${tableName}`);
      setStats(response.data);
    } catch {
      setError("Failed to fetch categorized transactions statistics.");
    } finally {
      setLoadingStats(false);
    }
  };

  const handleCategoryOverride = async (txId: number, newCategory: string) => {
    if (!activeTable) return;
    try {
      await api.post("/finance/reclassify", {
        table_name: activeTable,
        row_id: txId,
        new_category: newCategory
      });
      setEditingTxId(null);
      // Refresh statistics locally
      fetchStats(activeTable);
    } catch {
      setError("Failed to update transaction category.");
    }
  };

  // Compute Cashflow Ratio for Bar Chart
  const cashflowData = stats ? [
    { name: "Income Flow", Amount: stats.total_credit, fill: "#8b5cf6" },
    { name: "Expenses Out", Amount: stats.total_debit, fill: "#f43f5e" }
  ] : [];

  const netSavings = stats ? (stats.total_credit - stats.total_debit) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8 border-b border-slate-900 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Personal Finance AI Tracker
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Analyze bank statements. Automatically categorize transactions and visualize cash flows.
            </p>
          </div>

          {/* Statement File Picker */}
          <label className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl cursor-pointer text-xs font-bold text-white shadow-md transition duration-200">
            <UploadCloud className="w-4.5 h-4.5" />
            <span>{uploading ? "Parsing Statement..." : "Upload Bank CSV"}</span>
            <input 
              type="file" 
              accept=".csv,.xlsx" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={uploading} 
            />
          </label>
        </div>

        {/* Feedback Banners */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl text-xs text-red-400 font-medium mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-2xl text-xs text-emerald-400 font-medium mb-6">
            {success}
          </div>
        )}

        {/* Dashboard Display */}
        {uploading || loadingStats ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-slate-400 text-sm font-medium">Auto-Categorizing Transactions...</p>
            <p className="text-slate-500 text-xs mt-1">Calling Gemini models and classifying expenditures</p>
          </div>
        ) : !stats ? (
          <div className="text-center py-40 border border-dashed border-slate-850 rounded-3xl bg-slate-900/10">
            <FolderSync className="w-12 h-12 text-slate-700 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-400 text-sm font-semibold">No Statement Loaded</p>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              Upload a bank statement CSV containing Date, Description, and Debit columns to visualize expense categorization charts.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Total Income */}
              <div className="bg-slate-900/50 border border-slate-850 p-5 rounded-3xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Total Income
                  </span>
                  <h3 className="text-2xl font-bold text-slate-100 font-mono mt-1">
                    ₹{stats.total_credit.toLocaleString([], { minimumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-violet-950/40 border border-violet-900/40 flex items-center justify-center text-violet-400">
                  <ArrowUpCircle className="w-5 h-5" />
                </div>
              </div>

              {/* Total Spent */}
              <div className="bg-slate-900/50 border border-slate-850 p-5 rounded-3xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Total Expenses
                  </span>
                  <h3 className="text-2xl font-bold text-slate-100 font-mono mt-1">
                    ₹{stats.total_debit.toLocaleString([], { minimumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-950/40 border border-rose-900/40 flex items-center justify-center text-rose-400">
                  <ArrowDownCircle className="w-5 h-5" />
                </div>
              </div>

              {/* Net Savings */}
              <div className="bg-slate-900/50 border border-slate-850 p-5 rounded-3xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Net Savings
                  </span>
                  <h3 className={`text-2xl font-bold font-mono mt-1 ${netSavings >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    ₹{netSavings.toLocaleString([], { minimumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  netSavings >= 0 
                    ? "bg-emerald-950/40 border-emerald-900/40 text-emerald-400" 
                    : "bg-rose-950/40 border-rose-900/40 text-rose-400"
                }`}>
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

            </div>

            {/* Visual Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Pie Chart: Expense breakdown (2/3 width) */}
              <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center space-x-2">
                  <PieIcon className="w-4.5 h-4.5 text-indigo-400" />
                  <span>Expense Breakdown by Category</span>
                </h3>
                
                <div className="flex-1 min-h-[300px] flex flex-col md:flex-row items-center justify-around gap-6">
                  {stats.categories.length === 0 ? (
                    <p className="text-slate-500 text-xs py-20">No expenditure transactions found.</p>
                  ) : (
                    <>
                      {/* Pie Graph canvas */}
                      <div className="w-64 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.categories}
                              nameKey="category"
                              dataKey="spent"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={4}
                            >
                              {stats.categories.map((entry, idx) => (
                                <Cell 
                                  key={idx} 
                                  fill={CATEGORY_COLORS[entry.category as keyof typeof CATEGORY_COLORS] || "#64748b"} 
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value) => `₹${Number(value).toFixed(2)}`}
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Customized Color Indicators Legend */}
                      <div className="space-y-3">
                        {stats.categories.map((c) => (
                          <div key={c.category} className="flex items-center justify-between space-x-8 text-xs">
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: CATEGORY_COLORS[c.category as keyof typeof CATEGORY_COLORS] || "#64748b" }} 
                              />
                              <span className="text-slate-300 font-medium">{c.category}</span>
                            </div>
                            <span className="font-mono text-slate-400 font-bold">
                              ₹{c.spent.toLocaleString([], { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Bar Chart: Cash Flow Income vs Expense */}
              <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center space-x-2">
                  <TrendingUp className="w-4.5 h-4.5 text-indigo-400" />
                  <span>Monthly Cash Flow Ratio</span>
                </h3>
                
                <div className="flex-1 min-h-[300px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={cashflowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip 
                        formatter={(value) => `₹${Number(value).toFixed(2)}`}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px' }}
                      />
                      <Bar dataKey="Amount" radius={[8, 8, 0, 0]}>
                        {cashflowData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Transactions Feed Grid */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center space-x-2">
                <Table className="w-4.5 h-4.5 text-indigo-400" />
                <span>Auto-Categorized Transactions Registry</span>
              </h3>

              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider bg-slate-950/40">
                      <th className="p-3">Date</th>
                      <th className="p-3">Narrative Description</th>
                      <th className="p-3 text-right">Debit (Spent)</th>
                      <th className="p-3 text-right">Credit (Received)</th>
                      <th className="p-3">Category (Click to Override)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 font-mono text-slate-300">
                    {stats.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/10 transition">
                        <td className="p-3 text-slate-400 whitespace-nowrap">{tx.date}</td>
                        <td className="p-3 font-sans text-slate-200">{tx.description}</td>
                        <td className="p-3 text-right text-rose-400 font-bold">
                          {tx.debit > 0 ? `₹${tx.debit.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-3 text-right text-emerald-400 font-bold">
                          {tx.credit > 0 ? `₹${tx.credit.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-3 font-sans relative">
                          {editingTxId === tx.id ? (
                            <select
                              value={tx.category}
                              onChange={(e) => handleCategoryOverride(tx.id, e.target.value)}
                              onBlur={() => setEditingTxId(null)}
                              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg outline-none text-slate-300 text-xs focus:border-indigo-500 cursor-pointer"
                              autoFocus
                            >
                              {CATEGORIES_LIST.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingTxId(tx.id)}
                              className="px-2.5 py-1 rounded-full border text-[10px] font-semibold transition hover:bg-slate-800 cursor-pointer flex items-center space-x-1.5"
                              style={{
                                borderColor: `${CATEGORY_COLORS[tx.category as keyof typeof CATEGORY_COLORS] || "#64748b"}60`,
                                color: CATEGORY_COLORS[tx.category as keyof typeof CATEGORY_COLORS] || "#64748b",
                                backgroundColor: `${CATEGORY_COLORS[tx.category as keyof typeof CATEGORY_COLORS] || "#64748b"}10`
                              }}
                            >
                              <span>{tx.category}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
