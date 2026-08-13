"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import api from "@/lib/api";
import { Loader2, Table, SlidersHorizontal, Grid3X3, ArrowRight } from "lucide-react";

interface FileItem {
  id: number;
  filename: string;
  version: number;
  status: string;
  workflow_status: string;
  lineage_info?: { db_table?: string };
}

interface PivotRow {
  rowLabel: string;
  rowTotal: number;
  [key: string]: string | number;
}

export default function PivotPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState("");
  
  // Table schema & data
  const [columns, setColumns] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);

  // Pivot Configuration State
  const [rowField, setRowField] = useState<string>("");
  const [colField, setColField] = useState<string>("");
  const [valueField, setValueField] = useState<string>("");
  const [aggFunc, setAggFunc] = useState<string>("SUM");

  // Output Pivot Data
  const [pivotHeaders, setPivotHeaders] = useState<string[]>([]);
  const [pivotRows, setPivotRows] = useState<PivotRow[]>([]);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [columnTotals, setColumnTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchApprovedFiles = async () => {
      try {
        const response = await api.get("/files");
        // Only allow files that are processed and approved
        const approved = response.data.filter(
          (f: FileItem) => f.status === "COMPLETED" && f.workflow_status === "APPROVED"
        );
        setFiles(approved);
      } catch {
        setError("Failed to fetch tables registry.");
      } finally {
        setLoading(false);
      }
    };
    fetchApprovedFiles();
  }, []);

  const handleSelectTable = async (fileId: string) => {
    setSelectedFileId(fileId);
    if (!fileId) return;

    setFetchingData(true);
    setError("");
    setRawData([]);
    setColumns([]);
    
    // Reset configuration
    setRowField("");
    setColField("");
    setValueField("");
    setPivotRows([]);

    try {
      // Find the file name and version
      const file = files.find((f) => f.id === parseInt(fileId));
      if (!file || !file.lineage_info?.db_table) return;

      const tableName = file.lineage_info.db_table;
      
      // Execute SQL to fetch the raw table records
      // Safe read-only SELECT
      const response = await api.post("/query/chat", {
        question: `Select all records from table ${tableName}`
      });

      if (response.data.data && response.data.data.length > 0) {
        setRawData(response.data.data);
        
        // Extract headers from columns (ignore system columns starting with _)
        const headers = Object.keys(response.data.data[0]).filter(
          (k) => !k.startsWith("_")
        );
        setColumns(headers);
      } else {
        setError("No data records found in this table.");
      }
    } catch {
      setError("Failed to retrieve dataset records.");
    } finally {
      setFetchingData(false);
    }
  };

  const compilePivotTable = () => {
    if (!rowField || !valueField) {
      setError("Please select at least a Row Field and a Value Field.");
      return;
    }
    setError("");

    // 1. Gather all unique Row Labels
    const uniqueRows = Array.from(new Set(rawData.map(item => String(item[rowField] ?? "N/A"))));
    
    // 2. Gather all unique Column Labels (if selected, else default to valueField title)
    const uniqueCols = colField 
      ? Array.from(new Set(rawData.map(item => String(item[colField] ?? "N/A"))))
      : [valueField];

    setPivotHeaders(uniqueCols);

    const calculatedRows: PivotRow[] = [];
    const colSumAccumulator: Record<string, number> = {};
    let totalAccumulator = 0;

    // Initialize column totals
    uniqueCols.forEach(col => { colSumAccumulator[col] = 0; });

    // 3. Aggregate data points
    uniqueRows.forEach((rowVal) => {
      const rowItem: PivotRow = { rowLabel: rowVal, rowTotal: 0 };
      
      uniqueCols.forEach((colVal) => {
        // Filter raw data matching current Row and Column values
        const matchingRecords = rawData.filter(item => {
          const matchRow = String(item[rowField] ?? "N/A") === rowVal;
          const matchCol = colField 
            ? String(item[colField] ?? "N/A") === colVal
            : true;
          return matchRow && matchCol;
        });

        // Parse numerical value
        const values = matchingRecords.map(item => {
          const val = item[valueField];
          return typeof val === "number" ? val : parseFloat(String(val)) || 0;
        });

        // Compute Aggregation (SUM, AVG, COUNT)
        let result = 0;
        if (values.length > 0) {
          if (aggFunc === "SUM") {
            result = values.reduce((sum, val) => sum + val, 0);
          } else if (aggFunc === "AVG") {
            result = values.reduce((sum, val) => sum + val, 0) / values.length;
          } else if (aggFunc === "COUNT") {
            result = values.length;
          }
        }

        rowItem[colVal] = result;
        rowItem.rowTotal += result;
        colSumAccumulator[colVal] += result;
        totalAccumulator += result;
      });

      calculatedRows.push(rowItem);
    });

    setPivotRows(calculatedRows);
    setColumnTotals(colSumAccumulator);
    setGrandTotal(totalAccumulator);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Interactive Pivot Builder
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Re-aggregate and compile 2D matrix grids on the fly. Drag and pivot row groupings, columns, and sums.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl text-xs text-red-400 font-medium mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Configuration Panel (1/4 width) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-5">
              <h2 className="text-base font-bold text-slate-200 flex items-center space-x-2 border-b border-slate-850 pb-3">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                <span>Pivot Layout</span>
              </h2>

              {/* 1. Select Table */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Select Source Sheet
                </label>
                {loading ? (
                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Loading tables...</span>
                  </div>
                ) : files.length === 0 ? (
                  <span className="text-xs text-amber-500 font-semibold">No approved tables.</span>
                ) : (
                  <select
                    value={selectedFileId}
                    onChange={(e) => handleSelectTable(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-300 text-xs focus:border-indigo-500"
                  >
                    <option value="">-- Choose Approved File --</option>
                    {files.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.filename} (v{file.version})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Configure pivot fields (Disabled until data loaded) */}
              <div className={`space-y-4 pt-2 ${!selectedFileId || fetchingData ? "opacity-40 pointer-events-none" : ""}`}>
                {/* Row Axis */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Row Labels (Axis Y)
                  </label>
                  <select
                    value={rowField}
                    onChange={(e) => setRowField(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-300 text-xs focus:border-indigo-500"
                  >
                    <option value="">-- Select Row Axis --</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* Column Axis */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Column Labels (Axis X)
                  </label>
                  <select
                    value={colField}
                    onChange={(e) => setColField(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-300 text-xs focus:border-indigo-500"
                  >
                    <option value="">-- Single Field (None) --</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* Values Aggregator Field */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Values Calculator (Sum)
                  </label>
                  <select
                    value={valueField}
                    onChange={(e) => setValueField(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-300 text-xs focus:border-indigo-500"
                  >
                    <option value="">-- Select Numeric Field --</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* Function Selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Aggregate Method
                  </label>
                  <select
                    value={aggFunc}
                    onChange={(e) => setAggFunc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-300 text-xs focus:border-indigo-500"
                  >
                    <option value="SUM">SUM</option>
                    <option value="AVG">AVERAGE</option>
                    <option value="COUNT">RECORD COUNT</option>
                  </select>
                </div>

                <button
                  onClick={compilePivotTable}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center space-x-2 transition shadow-md"
                >
                  <span>Build Matrix</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>

          {/* Pivot Matrix Display Board (3/4 width) */}
          <div className="lg:col-span-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl h-full flex flex-col justify-between">
              
              {fetchingData ? (
                <div className="flex flex-col items-center justify-center py-40">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <p className="text-slate-500 text-xs">Caching data records into workspace memory...</p>
                </div>
              ) : pivotRows.length === 0 ? (
                <div className="text-center py-40 border border-dashed border-slate-850 rounded-2xl">
                  <Grid3X3 className="w-10 h-10 text-slate-700 mx-auto mb-3 animate-pulse" />
                  <p className="text-slate-400 text-sm font-semibold">Workspace Grid Empty</p>
                  <p className="text-slate-500 text-xs mt-1">Configure Row Labels and click Build Matrix to generate data grid.</p>
                </div>
              ) : (
                <div className="overflow-auto flex-1 max-h-[500px]">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center space-x-2">
                    <Table className="w-4.5 h-4.5 text-indigo-400" />
                    <span>Pivoted Matrix Grid ({aggFunc} of {valueField})</span>
                  </h3>
                  
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="p-3 border border-slate-800">{rowField}</th>
                        {pivotHeaders.map((header) => (
                          <th key={header} className="p-3 border border-slate-800 text-right">{header}</th>
                        ))}
                        <th className="p-3 border border-slate-800 text-right bg-indigo-950/20 text-indigo-400">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono text-slate-300">
                      {pivotRows.map((row, index) => (
                        <tr key={index} className="hover:bg-slate-800/10 transition">
                          <td className="p-3 border border-slate-800 font-sans font-bold text-slate-200">
                            {row.rowLabel}
                          </td>
                          {pivotHeaders.map((header) => (
                            <td key={header} className="p-3 border border-slate-800 text-right">
                              {typeof row[header] === "number" 
                                ? row[header].toLocaleString([], { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                                : row[header]}
                            </td>
                          ))}
                          <td className="p-3 border border-slate-800 text-right font-bold bg-indigo-950/10 text-indigo-300">
                            {row.rowTotal.toLocaleString([], { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Column Totals Row */}
                      <tr className="bg-slate-950/50 font-bold text-slate-200 border-t-2 border-slate-800">
                        <td className="p-3 border border-slate-800 font-sans">Grand Total</td>
                        {pivotHeaders.map((header) => (
                          <td key={header} className="p-3 border border-slate-800 text-right">
                            {columnTotals[header]?.toLocaleString([], { minimumFractionDigits: 0, maximumFractionDigits: 2 }) || 0}
                          </td>
                        ))}
                        <td className="p-3 border border-slate-800 text-right bg-indigo-950/30 text-indigo-200 text-sm font-black">
                          {grandTotal.toLocaleString([], { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
