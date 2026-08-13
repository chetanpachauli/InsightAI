"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import api, { getApiError } from "@/lib/api";
import { 
  Globe, 
  Search, 
  Download, 
  Database, 
  Loader2, 
  HelpCircle,
  Table,
  CheckCircle2,
  FileSpreadsheet
} from "lucide-react";

export default function ScraperPage() {
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scrapedData, setScrapedData] = useState<Record<string, unknown>[]>([]);
  const [filename, setFilename] = useState("");

  const handleScrapeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !goal.trim() || scraping) return;

    setScraping(true);
    setError("");
    setSuccess("");
    setScrapedData([]);
    setFilename("");

    try {
      const response = await api.post("/scraper/extract", {
        url: url.trim(),
        extraction_goal: goal.trim()
      });

      setSuccess(response.data.message);
      setScrapedData(response.data.data);
      setFilename(response.data.filename);
    } catch (err) {
      setError(
        getApiError(err, "Failed to scrape webpage. Make sure target site is accessible and Gemini API key is configured.")
      );
    } finally {
      setScraping(false);
    }
  };

  const handleDownloadCSV = () => {
    if (scrapedData.length === 0) return;

    try {
      // Create headers row
      const headers = Object.keys(scrapedData[0]);
      
      // Escape values and join with commas
      const csvRows = [
        headers.join(","), // Header row
        ...scrapedData.map(row => 
          headers.map(header => {
            const val = row[header] === null || row[header] === undefined ? "" : String(row[header]);
            // Escape double quotes
            return `"${val.replace(/"/g, '""')}"`;
          }).join(",")
        )
      ];

      const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM for excel utf-8 support
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      
      // Create client download link
      const link = document.createElement("a");
      const urlBlob = URL.createObjectURL(blob);
      link.setAttribute("href", urlBlob);
      link.setAttribute("download", filename || `scraped_dataset_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setError("Failed to generate download file.");
    }
  };

  // Extract dynamic headers for preview table
  const tableHeaders = scrapedData.length > 0 ? Object.keys(scrapedData[0]) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8 border-b border-slate-900 pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            AI Web Scraper Workspace
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Input a URL and describe what details to extract. The AI Web Scraper minifies the page layout and parses items into a structured CSV sheet.
          </p>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl text-xs text-red-400 font-medium mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-2xl text-xs text-emerald-400 font-medium mb-6 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Configuration Form (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-6">
              <h2 className="text-base font-bold text-slate-200 mb-2 flex items-center space-x-2 border-b border-slate-850 pb-3">
                <Globe className="w-5 h-5 text-indigo-400" />
                <span>Scraper Console</span>
              </h2>

              <form onSubmit={handleScrapeSubmit} className="space-y-4">
                
                {/* Target URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Target Website URL
                  </label>
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://news.ycombinator.com"
                    className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition"
                  />
                </div>

                {/* Extraction Goal */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Extraction Goal
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="e.g. Extract the top 30 news headlines, their links, and author points."
                    className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={scraping || !url.trim() || !goal.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center space-x-2 transition shadow-lg cursor-pointer"
                >
                  {scraping ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      <span>Extracting Data...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4.5 h-4.5" />
                      <span>Scrape Website</span>
                    </>
                  )}
                </button>

              </form>

              {/* Notice block */}
              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl text-[10px] text-slate-500 leading-relaxed">
                <HelpCircle className="w-4.5 h-4.5 text-slate-400 mb-1.5" />
                <p>
                  Scraping fetches raw text elements of the URL, minifies code segments to preserve tokens, and asks Gemini to arrange columns matching your goal instructions.
                </p>
              </div>

            </div>
          </div>

          {/* Scraped Results Display Grid (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl h-full flex flex-col justify-between">
              
              {scraping ? (
                <div className="flex flex-col items-center justify-center py-40">
                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                  <p className="text-slate-400 text-sm font-semibold">Minifying Website Content...</p>
                  <p className="text-slate-500 text-xs mt-1">Generating semantic JSON data mappings via Gemini</p>
                </div>
              ) : scrapedData.length === 0 ? (
                <div className="text-center py-40 border border-dashed border-slate-850 rounded-3xl bg-slate-900/10">
                  <FileSpreadsheet className="w-12 h-12 text-slate-700 mx-auto mb-4 animate-pulse" />
                  <p className="text-slate-400 text-sm font-semibold">Preview Screen Empty</p>
                  <p className="text-slate-500 text-xs mt-1">Enter a website and click Scrape Website to parse data listings.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="overflow-auto max-h-[500px]">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                        <Table className="w-4.5 h-4.5 text-indigo-400" />
                        <span>Parsed Sheet Preview ({scrapedData.length} Rows)</span>
                      </h3>
                      
                      {/* Action buttons */}
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={handleDownloadCSV}
                          className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-lg text-xs font-bold text-white shadow transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download CSV</span>
                        </button>
                      </div>
                    </div>

                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider bg-slate-950/40">
                          {tableHeaders.map((header) => (
                            <th key={header} className="p-3 border border-slate-850">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 font-sans text-slate-300">
                        {scrapedData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/10 transition">
                            {tableHeaders.map((header) => (
                              <td key={header} className="p-3 border border-slate-850 max-w-[200px] truncate" title={String(row[header])}>
                                {row[header] === null || row[header] === undefined ? "-" : String(row[header])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Repository Import Notice banner */}
                  <div className="mt-8 p-4 bg-indigo-950/20 border border-indigo-900/40 rounded-2xl flex items-start space-x-3 text-indigo-300 text-xs leading-relaxed">
                    <Database className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-indigo-200">Imported to File Registry</p>
                      <p className="mt-0.5 text-slate-400">
                        This scraped sheet has been automatically saved as a **DRAFT** in your central **Uploads** repository. Managers or Administrators can approve it to start querying via SQL and creating Pivot matrices.
                      </p>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
