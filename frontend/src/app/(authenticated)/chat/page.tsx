"use client";

import { useState, useRef, useEffect } from "react";
import api, { getApiError } from "@/lib/api";
import {
  Send,
  Bot,
  User,
  Loader2,
  Terminal,
  Table as TableIcon,
  Mic,
  MicOff,
  Volume2,
  Download,
  Copy,
  Check,
  Sparkles,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  sql?: string;
  data?: Record<string, unknown>[];
  chartConfig?: {
    chart_type: string;
    x_axis: string;
    y_axis: string;
  };
}

const COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#3b82f6"  // blue
];

const SUGGESTIONS = [
  { label: "📊 Region-wise Sales Breakdown", query: "Show me total sales broken down by region" },
  { label: "📈 Pichhle 3 mahine ka revenue", query: "Pichhle 3 mahine ki total sales aur revenue dikhao" },
  { label: "🏆 Top 5 Performing Products", query: "Who are the top 5 highest selling products?" },
  { label: "⚠️ Anomaly & Expense Check", query: "Highest expenditure category kaunsi hai?" }
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Namaste! I am InsightAI's Bilingual Data Intelligence Engine. You can ask business questions in Hindi, Hinglish, or English — for example: 'Pichhle mahine ki total sales kitni thi?' or 'Show me top 5 products by revenue'."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSqlMap, setShowSqlMap] = useState<Record<string, boolean>>({});
  const [copiedSqlId, setCopiedSqlId] = useState<string | null>(null);
  
  // Voice Input States
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Audio Speech Synthesis
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Setup Web Speech API for voice recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setVoiceSupported(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "hi-IN"; // Supports Hindi and Hinglish/English natively

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!voiceSupported) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const speakText = (msgId: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Auto-detect Hindi vs English characters
    const hasHindi = /[\u0900-\u097F]/.test(text);
    utterance.lang = hasHindi ? "hi-IN" : "en-IN";
    utterance.rate = 1.0;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const copySql = (id: string, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSqlId(id);
    setTimeout(() => setCopiedSqlId(null), 2000);
  };

  const exportToCsv = (filename: string, rows: Record<string, unknown>[]) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...rows.map((row) =>
          headers
            .map((field) => {
              const val = row[field];
              return typeof val === "string" && val.includes(",")
                ? `"${val}"`
                : String(val ?? "");
            })
            .join(",")
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToSend = customQuery ?? input;
    if (!queryToSend.trim() || loading) return;

    setInput("");
    const userQuestion = queryToSend.trim();

    // 1. Add User Message
    const userMsgId = Date.now().toString();
    const newMessages = [
      ...messages,
      { id: userMsgId, sender: "user" as const, text: userQuestion }
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      // 2. Call backend /query/chat with conversational history
      const historyPayload = messages
        .filter((m) => m.id !== "welcome")
        .slice(-6)
        .map((m) => ({ sender: m.sender, text: m.text }));

      const response = await api.post("/query/chat", {
        question: userQuestion,
        history: historyPayload
      });

      const botMsgId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          sender: "bot",
          text: response.data.explanation,
          sql: response.data.generated_sql,
          data: response.data.data,
          chartConfig: response.data.chart_config
        }
      ]);
    } catch (err) {
      const errMsg = getApiError(
        err,
        "Error connecting to AI query engine. Please ensure files are approved."
      );
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: `⚠️ ${errMsg}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-6rem)] relative">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center space-x-2">
              <span>Bilingual AI SQL Chat</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                Gemini 2.0 Flash
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Ask questions in Hindi, Hinglish, or English. AI automatically writes safe SQL & renders charts.
            </p>
          </div>
        </div>

        {/* Suggestion hint */}
        <div className="hidden md:flex items-center space-x-1 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Conversational Memory Enabled</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-4 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-3.5 ${
              msg.sender === "user" ? "flex-row-reverse space-x-reverse" : ""
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.sender === "user"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-800 text-slate-200 border border-slate-700"
              }`}
            >
              {msg.sender === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4 text-indigo-400" />
              )}
            </div>

            {/* Bubble Container */}
            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-lg ${
                msg.sender === "user"
                  ? "bg-indigo-600 text-white rounded-tr-none font-medium text-sm"
                  : "bg-slate-900/90 border border-slate-800 text-slate-100 rounded-tl-none"
              }`}
            >
              {/* Bot Action Tools (TTS Speaker) */}
              {msg.sender === "bot" && (
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span>AI Insight</span>
                  </span>
                  <button
                    onClick={() => speakText(msg.id, msg.text)}
                    className={`p-1.5 rounded-lg text-xs transition cursor-pointer flex items-center space-x-1 ${
                      speakingId === msg.id
                        ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 animate-pulse"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                    title="Speak insight in Hindi/English"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="text-[10px]">
                      {speakingId === msg.id ? "Speaking..." : "Listen"}
                    </span>
                  </button>
                </div>
              )}

              {/* Message Text */}
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.text}
              </p>

              {/* Bot Generated Visualizations & SQL */}
              {msg.sender === "bot" && msg.data && msg.data.length > 0 && (
                <div className="mt-4 space-y-4">
                  
                  {/* Dynamic Recharts Visualization */}
                  {msg.chartConfig &&
                    msg.chartConfig.chart_type !== "none" &&
                    msg.chartConfig.chart_type !== "table" && (
                      <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                            {msg.chartConfig.chart_type === "bar" && <BarChart3 className="w-4 h-4 text-indigo-400" />}
                            {msg.chartConfig.chart_type === "line" && <LineChartIcon className="w-4 h-4 text-cyan-400" />}
                            {msg.chartConfig.chart_type === "pie" && <PieChartIcon className="w-4 h-4 text-pink-400" />}
                            <span className="capitalize">{msg.chartConfig.chart_type} Chart Analysis</span>
                          </span>
                          <button
                            onClick={() => exportToCsv("chart_data", msg.data!)}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20 transition cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Export CSV</span>
                          </button>
                        </div>

                        <div className="w-full h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            {msg.chartConfig.chart_type === "bar" ? (
                              <BarChart data={msg.data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis dataKey={msg.chartConfig.x_axis} stroke="#94a3b8" fontSize={12} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.75rem" }}
                                  itemStyle={{ color: "#f8fafc" }}
                                />
                                <Bar dataKey={msg.chartConfig.y_axis} fill="#6366f1" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            ) : msg.chartConfig.chart_type === "line" ? (
                              <LineChart data={msg.data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis dataKey={msg.chartConfig.x_axis} stroke="#94a3b8" fontSize={12} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.75rem" }}
                                  itemStyle={{ color: "#f8fafc" }}
                                />
                                <Line type="monotone" dataKey={msg.chartConfig.y_axis} stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} />
                              </LineChart>
                            ) : msg.chartConfig.chart_type === "pie" ? (
                              <PieChart>
                                <Tooltip
                                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.75rem" }}
                                  itemStyle={{ color: "#f8fafc" }}
                                />
                                <Pie
                                  data={msg.data}
                                  dataKey={msg.chartConfig.y_axis}
                                  nameKey={msg.chartConfig.x_axis}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={80}
                                  label
                                >
                                  {msg.data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Legend />
                              </PieChart>
                            ) : (
                              <div />
                            )}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                  {/* Data Table */}
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-slate-800/80">
                      <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                        <TableIcon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Query Results ({msg.data.length} records)</span>
                      </span>
                      <button
                        onClick={() => exportToCsv("table_results", msg.data!)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20 transition cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        <span>Download Excel</span>
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider sticky top-0">
                          <tr>
                            {Object.keys(msg.data[0]).map((col) => (
                              <th key={col} className="px-3 py-2 border-b border-slate-800">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {msg.data.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              {Object.values(row).map((val, cIdx) => (
                                <td key={cIdx} className="px-3 py-1.5 text-slate-300 font-mono text-[11px]">
                                  {String(val ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Collapsible Verified SQL Drawer */}
                  {msg.sql && (
                    <div>
                      <button
                        onClick={() =>
                          setShowSqlMap((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id]
                          }))
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>
                          {showSqlMap[msg.id] ? "Hide Generated SQL" : "View Safe PostgreSQL SQL"}
                        </span>
                      </button>

                      {showSqlMap[msg.id] && (
                        <div className="mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800 relative group">
                          <button
                            onClick={() => copySql(msg.id, msg.sql!)}
                            className="absolute top-2 right-2 p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition cursor-pointer flex items-center space-x-1"
                            title="Copy SQL"
                          >
                            {copiedSqlId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-[10px] text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>
                          <pre className="text-emerald-400 font-mono text-xs overflow-x-auto pr-16">
                            {msg.sql}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center space-x-3 text-slate-400 text-xs py-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Analyzing schema & writing safe SQL query...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions Chips */}
      <div className="mb-3 flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 flex items-center space-x-1">
          <HelpCircle className="w-3 h-3" />
          <span>Quick Prompts:</span>
        </span>
        {SUGGESTIONS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleSubmit(undefined as any, item.query)}
            disabled={loading}
            className="text-xs shrink-0 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Input Bar & Voice Recording Controls */}
      <form onSubmit={(e) => handleSubmit(e)} className="relative">
        <div className="relative flex items-center bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 shadow-2xl focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-200">
          
          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 ${
              isListening
                ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30"
                : "text-slate-400 hover:text-indigo-400 hover:bg-slate-800"
            }`}
            title={isListening ? "Stop Listening" : "Speak in Hindi or English (Voice Query)"}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isListening
                ? "Listening... Bolna shuru kijiye..."
                : "Ask anything in Hindi, Hinglish, or English (e.g. 'Last month sales kitni thi?')..."
            }
            disabled={loading}
            className="w-full bg-transparent px-3 py-2.5 outline-none text-slate-100 placeholder-slate-500 text-sm"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-3 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-xl hover:from-indigo-500 hover:to-violet-500 transition shadow-lg shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
