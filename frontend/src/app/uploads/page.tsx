"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import api from "@/lib/api";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Eye, 
  CheckSquare, 
  Activity, 
  ShieldAlert, 
  RefreshCw 
} from "lucide-react";

interface FileItem {
  id: number;
  filename: string;
  version: number;
  status: string;
  workflow_status: string;
  created_at: string;
}

interface LineageLog {
  id: number;
  action: string;
  details: string;
  step: string;
  timestamp: string;
}

export default function UploadsPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Lineage modal state
  const [selectedLineageFile, setSelectedLineageFile] = useState<any>(null);
  const [lineageTrail, setLineageTrail] = useState<LineageLog[]>([]);
  const [loadingLineage, setLoadingLineage] = useState(false);

  const userRole = typeof window !== "undefined" ? localStorage.getItem("user_role") : "";

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await api.get("/files");
      setFiles(response.data);
    } catch (e: any) {
      setError("Failed to fetch files. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await api.post("/files/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setSuccess(`File "${response.data.filename}" (v${response.data.version}) uploaded successfully! Processing started.`);
      fetchFiles();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed. Please ensure file type is valid (.csv/.xlsx).");
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (fileId: number) => {
    setError("");
    setSuccess("");
    try {
      const response = await api.post(`/files/${fileId}/approve`);
      setSuccess(`File updated successfully! State is now: ${response.data.workflow_status}`);
      fetchFiles();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Approval action failed.");
    }
  };

  const handleViewLineage = async (fileId: number) => {
    setLoadingLineage(true);
    setSelectedLineageFile(null);
    try {
      const response = await api.get(`/files/${fileId}/lineage`);
      setSelectedLineageFile(response.data.file_details);
      setLineageTrail(response.data.audit_trail);
    } catch (e: any) {
      setError("Failed to fetch data lineage details.");
    } finally {
      setLoadingLineage(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Enterprise Excel Uploads
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Upload spreadsheets, trace versions, verify data cleaning audits, and execute approval workflows.
            </p>
          </div>
          <button 
            onClick={fetchFiles}
            className="flex items-center space-x-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sync Status</span>
          </button>
        </div>

        {/* Notices */}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Upload Dropzone Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-slate-200 mb-2">Upload Data Sheet</h2>
              <p className="text-slate-500 text-xs mb-6">
                Only CSV, XLSX, or XLS formats. File versions will be auto-managed on collision.
              </p>

              {userRole !== "MIS" && userRole !== "Admin" ? (
                <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl flex items-start space-x-3 text-amber-500 text-xs">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Upload Blocked</strong>: Only accounts with the <strong>MIS</strong> or <strong>Admin</strong> role can upload source files to the database.
                  </p>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/10 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group relative">
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <>
                      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                      <span className="text-sm font-semibold text-slate-300">Processing file...</span>
                      <span className="text-[10px] text-slate-500 mt-1">Executing Polars ETL parser</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 transition-colors mb-4 group-hover:scale-110 duration-200" />
                      <span className="text-sm font-semibold text-slate-300 group-hover:text-slate-200">
                        Choose local sheet
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">CSV, XLSX up to 50MB</span>
                    </>
                  )}
                </label>
              )}
            </div>
          </div>

          {/* Right Column: Files Management Table */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-slate-200 mb-6">Database Sheets Registry</h2>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <p className="text-slate-500 text-xs">Fetching registered assets...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-16 border border-slate-800/50 rounded-2xl bg-slate-950/20">
                  <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-semibold">No files registered</p>
                  <p className="text-slate-500 text-xs mt-1">Uploaded Excel sheets will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="pb-3">Filename</th>
                        <th className="pb-3">Version</th>
                        <th className="pb-3">Parser Status</th>
                        <th className="pb-3">Approval Gate</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-sm">
                      {files.map((file) => (
                        <tr key={file.id} className="group hover:bg-slate-800/20 transition-all">
                          <td className="py-4 font-semibold text-slate-200">
                            {file.filename}
                          </td>
                          <td className="py-4 text-xs font-semibold text-indigo-400">
                            v{file.version}
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              file.status === "COMPLETED" 
                                ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                                : file.status === "FAILED"
                                ? "bg-red-950/40 text-red-400 border border-red-900/30"
                                : "bg-blue-950/40 text-blue-400 border border-blue-900/30"
                            }`}>
                              {file.status === "COMPLETED" ? (
                                <CheckCircle className="w-3.5 h-3.5" />
                              ) : file.status === "FAILED" ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              )}
                              <span>{file.status}</span>
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              file.workflow_status === "APPROVED"
                                ? "bg-gradient-to-r from-emerald-950/30 to-teal-950/30 text-teal-400 border border-teal-900/40"
                                : file.workflow_status === "REVIEWED"
                                ? "bg-blue-950/30 text-blue-400 border border-blue-900/40"
                                : "bg-slate-950/40 text-slate-400 border border-slate-800"
                            }`}>
                              {file.workflow_status}
                            </span>
                          </td>
                          <td className="py-4 text-right space-x-2">
                            {/* Lineage Button */}
                            <button
                              onClick={() => handleViewLineage(file.id)}
                              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                              title="Trace Data Lineage"
                            >
                              <Activity className="w-4 h-4" />
                            </button>

                            {/* Manager Review Button */}
                            {userRole === "Manager" && file.workflow_status === "DRAFT" && file.status === "COMPLETED" && (
                              <button
                                onClick={() => handleApprove(file.id)}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold inline-flex items-center space-x-1"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>Mark Reviewed</span>
                              </button>
                            )}

                            {/* CEO/Admin Final Approval Button */}
                            {(userRole === "CEO" || userRole === "Admin") && 
                             (file.workflow_status === "DRAFT" || file.workflow_status === "REVIEWED") && 
                             file.status === "COMPLETED" && (
                              <button
                                onClick={() => handleApprove(file.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold inline-flex items-center space-x-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Approve Table</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Lineage Trace Log Display Box */}
            {selectedLineageFile && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl mt-6 relative overflow-hidden animate-fade-in">
                <div className="absolute top-0 right-0 p-4">
                  <button 
                    onClick={() => setSelectedLineageFile(null)}
                    className="text-slate-500 hover:text-slate-200 text-sm font-bold"
                  >
                    Close Log
                  </button>
                </div>
                
                <h3 className="text-base font-bold text-slate-200 mb-4 flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <span>Data Lineage Report: {selectedLineageFile.filename} (v{selectedLineageFile.version})</span>
                </h3>

                <div className="relative border-l-2 border-slate-800 ml-4 space-y-6">
                  {lineageTrail.map((log) => (
                    <div key={log.id} className="relative pl-6">
                      {/* Lineage Bullet point */}
                      <span className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-slate-900 bg-indigo-500 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                            {log.step}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-200 mt-1">{log.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {loadingLineage && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 text-center">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Loading lineage map...</p>
              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  );
}
