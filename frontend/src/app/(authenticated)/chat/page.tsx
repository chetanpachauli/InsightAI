"use client";

import { useState, useRef, useEffect } from "react";
import api, { getApiError } from "@/lib/api";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Terminal, 
  Table 
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

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#eab308", "#10b981", "#06b6d4"];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Hello! I am InsightAI Chat engine. You can ask me questions about your approved spreadsheets in natural language. For example: 'Show me total sales by region' or 'What is our current product stock inventory?'"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSqlMap, setShowSqlMap] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuestion = input.trim();
    setInput("");
    
    // 1. Add User Message
    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", text: userQuestion }
    ]);
    
    setLoading(true);

    try {
      // 2. Call backend /query/chat
      const response = await api.post("/query/chat", { question: userQuestion });
      
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
      const errMsg = getApiError(err, "Error connecting to AI query engine. Please check database logs.");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "bot",
          text: `Failed to query: ${errMsg}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSql = (msgId: string) => {
    setShowSqlMap((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Helper to render Recharts dynamically
  const renderChart = (data: Record<string, unknown>[], config: Message["chartConfig"]) => {
    if (!data || data.length === 0 || !config || config.chart_type === "none" || config.chart_type === "table") {
      return null;
    }

    const { chart_type, x_axis, y_axis } = config;
    if (!x_axis || !y_axis) return null;

    // Format clean labels and keys
    // Sometimes SQL names are like "sum(amount)" or "SUM(amount)"
    // We search the data object keys to match ignoring casing
    const dataKeys = Object.keys(data[0] || {});
    const xKey = dataKeys.find((k) => k.toLowerCase() === x_axis.toLowerCase()) || x_axis;
    const yKey = dataKeys.find((k) => k.toLowerCase() === y_axis.toLowerCase()) || y_axis;

    // Convert string numeric values to actual numbers for Recharts plotting
    const chartData = data.map((item) => ({
      ...item,
      [yKey]: typeof item[yKey] === "string" ? parseFloat(item[yKey] as string) : item[yKey],
    }));

    return (
      <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart_type === "bar" ? (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey={xKey} stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px" }} 
                labelClassName="text-slate-400 font-bold"
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey={yKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chart_type === "line" ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey={xKey} stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px" }}
                labelClassName="text-slate-400 font-bold"
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey={yKey} stroke="#8b5cf6" strokeWidth={2} activeDot={{ r: 6 }} />
            </LineChart>
          ) : chart_type === "pie" ? (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={yKey}
                nameKey={xKey}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px" }}
              />
            </PieChart>
          ) : null}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="-m-8 flex flex-col h-[calc(100vh)]">
        {/* Chat Header */}
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/80 backdrop-blur-md z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">AI SQL Analytics Chat</h2>
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping" />
              Gemini-3.5-Flash Active
            </span>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950/20">
          {messages.map((msg) => {
            const isBot = msg.sender === "bot";
            return (
              <div 
                key={msg.id}
                className={`flex items-start space-x-4 max-w-3xl ${
                  isBot ? "mr-auto" : "ml-auto flex-row-reverse space-x-reverse"
                }`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isBot 
                    ? "bg-slate-900 border border-slate-800 text-indigo-400"
                    : "bg-indigo-600 text-white"
                }`}>
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className="space-y-2">
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    isBot 
                      ? "bg-slate-900 border border-slate-800 text-slate-200"
                      : "bg-indigo-600 text-white"
                  }`}>
                    {msg.text}
                  </div>

                  {/* Bot code block toggle & Recharts rendering */}
                  {isBot && msg.sql && (
                    <div className="space-y-3 w-full">
                      {/* Controls */}
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => toggleSql(msg.id)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-300 flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span>{showSqlMap[msg.id] ? "Hide SQL Query" : "View SQL Query"}</span>
                        </button>
                      </div>

                      {/* Code Block */}
                      {showSqlMap[msg.id] && (
                        <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl font-mono text-[11px] text-emerald-400 overflow-x-auto">
                          {msg.sql}
                        </div>
                      )}

                      {/* Chart rendering */}
                      {msg.data && msg.chartConfig && renderChart(msg.data, msg.chartConfig)}

                      {/* Raw table preview */}
                      {msg.data && msg.data.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-hidden">
                          <h4 className="text-xs font-bold text-slate-400 flex items-center space-x-1.5 mb-3">
                            <Table className="w-3.5 h-3.5" />
                            <span>Query Result Dataset</span>
                          </h4>
                          <div className="overflow-x-auto max-h-48 text-[11px]">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase">
                                  {Object.keys(msg.data[0] || {}).map((key) => (
                                    <th key={key} className="pb-2 pr-4">{key}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                                {msg.data.slice(0, 10).map((row, idx) => (
                                  <tr key={idx}>
                                    {Object.values(row).map((val, vIdx) => (
                                      <td key={vIdx} className="py-2 pr-4 font-mono">
                                        {val === null || val === undefined ? "NULL" : String(val)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {msg.data.length > 10 && (
                              <p className="text-[10px] text-slate-500 mt-2 italic">
                                * Showing top 10 records of {msg.data.length} total rows.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              </div>
            );
          })}

          {/* Loading bubble */}
          {loading && (
            <div className="flex items-start space-x-4 max-w-xl mr-auto">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center space-x-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>InsightAI is writing SQL query and parsing results...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Form Input Box */}
        <div className="p-6 border-t border-slate-800 bg-slate-950">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3 max-w-4xl mx-auto">
            <input
              type="text"
              required
              disabled={loading}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Draw a bar chart showing sales of last month grouped by region"
              className="flex-1 px-5 py-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl outline-none text-slate-100 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

    </div>
  );
}
