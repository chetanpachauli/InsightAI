"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import api, { getApiError } from "@/lib/api";
import { 
  BookOpen, 
  UploadCloud, 
  MessageSquare, 
  Bot, 
  Loader2, 
  ShieldAlert 
} from "lucide-react";

interface SearchSource {
  filename: string;
  chunk: number;
  relevance_score: number;
}

interface QueryResponse {
  answer: string;
  sources: SearchSource[];
}

export default function DocumentHubPage() {
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Search state
  const [question, setQuestion] = useState("");
  const [searchResult, setSearchResult] = useState<QueryResponse | null>(null);

  const userRole = typeof window !== "undefined" ? localStorage.getItem("user_role") : "";

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await api.post("/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setSuccess(response.data.message);
    } catch (err) {
      setError(
        getApiError(err, "Failed to index document. Verify format is .txt or .md.")
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || searching) return;

    setSearching(true);
    setError("");
    setSearchResult(null);

    try {
      const response = await api.post("/documents/query", {
        question: question.trim()
      });
      setSearchResult(response.data);
    } catch {
      setError("Semantic query search failed. Make sure your Gemini API key is configured.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Top Header */}
        <div className="mb-8 border-b border-slate-900 pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            AI Document Hub & RAG Engine
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload text guidelines or company policies. Query documents semantically using vector embeddings and Gemini.
          </p>
        </div>

        {/* Action Banners */}
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
          
          {/* Left panel: Upload manuals */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-200 mb-2 flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <span>Manual Indexer</span>
                </h2>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Upload text manuals, corporate policies, or standard guidelines. The RAG engine chunks content and saves mathematical vector embeddings.
                </p>
              </div>

              {userRole !== "MIS" && userRole !== "Admin" ? (
                <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl flex items-start space-x-3 text-amber-500 text-xs leading-relaxed">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Upload Restrained</strong>: Uploading documents is restricted to <strong>MIS</strong> or <strong>Admin</strong> role configurations.
                  </p>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/10 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group relative">
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".txt,.md"
                    onChange={handleDocumentUpload}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <>
                      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                      <span className="text-sm font-semibold text-slate-300">Chunking & Embedding...</span>
                      <span className="text-[10px] text-slate-500 mt-1">Generating vectors via text-embedding-004</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 transition-colors mb-4 group-hover:scale-110 duration-200" />
                      <span className="text-sm font-semibold text-slate-300 group-hover:text-slate-200">
                        Select Text Document
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">Plain Text (.txt, .md) up to 10MB</span>
                    </>
                  )}
                </label>
              )}
            </div>
          </div>

          {/* Right panel: Semantic Q&A */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                <span>Knowledge Base Search</span>
              </h2>

              {/* Search form */}
              <form onSubmit={handleSearchSubmit} className="flex items-center space-x-3 mb-8">
                <input
                  type="text"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. What is the policy for expense refunds?"
                  className="flex-1 px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition"
                />
                <button
                  type="submit"
                  disabled={searching || !question.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {searching ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  ) : (
                    <span>Search</span>
                  )}
                </button>
              </form>

              {/* RAG Search Results */}
              {searchResult && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* AI Response Bubble */}
                  <div className="flex items-start space-x-4 max-w-2xl bg-slate-950/40 border border-slate-850 p-5 rounded-2xl">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4.5 h-4.5" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                        Document Hub AI Response
                      </span>
                      <p className="text-sm leading-relaxed text-slate-200">
                        {searchResult.answer}
                      </p>
                    </div>
                  </div>

                  {/* Sources List */}
                  {searchResult.sources.length > 0 && (
                    <div className="pt-4 border-t border-slate-800/80">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        Referenced Sources (Vector Lineage)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResult.sources.map((src, index) => (
                          <div key={index} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <p className="font-semibold text-slate-300 truncate w-36">{src.filename}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">Chunk index: {src.chunk}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-emerald-400 font-bold">
                                {Math.round(src.relevance_score * 100)}%
                              </span>
                              <p className="text-[9px] text-slate-500 mt-0.5">Relevance</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
