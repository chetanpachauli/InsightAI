"use client";

import { useEffect, useState } from "react";
import api, { getApiError } from "@/lib/api";
import { 
  Send, 
  Mail, 
  MessageSquare, 
  Loader2, 
  ShieldAlert, 
  History 
} from "lucide-react";

interface AuditLog {
  id: number;
  action: string;
  details: string;
  created_at?: string;
  timestamp?: string;
}

export default function NotificationHubPage() {
  const [channel, setChannel] = useState<string>("EMAIL");
  const [recipient, setRecipient] = useState<string>("");
  const [subject, setSubject] = useState<string>("System Alert: Urgent Update");
  const [message, setMessage] = useState<string>("");
  
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [history, setHistory] = useState<AuditLog[]>([]);

  const userRole = typeof window !== "undefined" ? localStorage.getItem("user_role") : "";

  const fetchNotificationHistory = async () => {
    try {
      // Fetch a wider set of recent logs so the dispatch history is complete
      const response = await api.get("/query/stats?limit=50");
      // Filter out manual notification events
      const logs = response.data.recent_logs.filter(
        (log: AuditLog) => log.action === "MANUAL_NOTIFICATION"
      );
      setHistory(logs);
    } catch {
      console.error("Failed to load dispatch history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotificationHistory();
  }, []);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !message.trim() || sending) return;

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/notifications/send", {
        recipient: recipient.trim(),
        channel,
        subject: channel === "EMAIL" ? subject.trim() : null,
        message: message.trim()
      });
      
      setSuccess(response.data.message);
      setMessage(""); // Clear message field
      fetchNotificationHistory(); // Refresh logs
    } catch (err) {
      setError(
        getApiError(err, "Failed to send notification. Verify SMTP or Twilio credentials.")
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
        {/* Header Section */}
        <div className="mb-8 border-b border-slate-900 pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Notification Dispatch Hub
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manually send transactional email alerts and custom WhatsApp messages directly from the executive console.
          </p>
        </div>

        {/* Action Banners */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl text-xs text-red-400 font-medium mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-2xl text-xs text-emerald-400 font-medium mb-6 animate-pulse">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Dispatch Panel (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center space-x-2">
                <Send className="w-5 h-5 text-indigo-400" />
                <span>Message Composer</span>
              </h2>

              {userRole !== "Admin" && userRole !== "MIS" && userRole !== "Manager" ? (
                <div className="p-6 border border-dashed border-red-900/50 bg-red-950/20 rounded-2xl flex items-center space-x-3 text-red-400 text-sm">
                  <ShieldAlert className="w-6 h-6 flex-shrink-0" />
                  <span>Access Restricted: Only Admin, MIS, or Manager roles can manually dispatch alerts.</span>
                </div>
              ) : (
                <form onSubmit={handleSendNotification} className="space-y-6">
                  
                  {/* Select Channel */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Dispatch Channel
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => { setChannel("EMAIL"); setRecipient(""); }}
                        className={`flex items-center justify-center space-x-2 py-3 rounded-xl border text-sm font-semibold transition cursor-pointer ${
                          channel === "EMAIL"
                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                            : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <Mail className="w-4.5 h-4.5" />
                        <span>Email Alert</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => { setChannel("WHATSAPP"); setRecipient(""); }}
                        className={`flex items-center justify-center space-x-2 py-3 rounded-xl border text-sm font-semibold transition cursor-pointer ${
                          channel === "WHATSAPP"
                            ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                            : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <MessageSquare className="w-4.5 h-4.5" />
                        <span>WhatsApp Message</span>
                      </button>
                    </div>
                  </div>

                  {/* Recipient Target */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      {channel === "EMAIL" ? "Recipient Email Address" : "Recipient Phone Number"}
                    </label>
                    <input
                      type={channel === "EMAIL" ? "email" : "text"}
                      required
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder={channel === "EMAIL" ? "manager@company.com" : "+919999999999"}
                      className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition"
                    />
                  </div>

                  {/* Subject Line (Email Only) */}
                  {channel === "EMAIL" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Email Subject
                      </label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Critical stock update alert"
                        className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition"
                      />
                    </div>
                  )}

                  {/* Message Body */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Message Content
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        channel === "EMAIL"
                          ? "Write your email message here... (HTML formatted paragraphs are supported)"
                          : "Type your WhatsApp message. Emojis and standard WhatsApp markdown *bold*, _italics_ are supported."
                      }
                      className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center space-x-2 transition shadow-lg cursor-pointer ${
                      channel === "EMAIL"
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500"
                        : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                    }`}
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch Notification</span>
                      </>
                    )}
                  </button>

                </form>
              )}
            </div>
          </div>

          {/* Right panel: History feed (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-4">
              <h2 className="text-base font-bold text-slate-200 flex items-center space-x-2 border-b border-slate-850 pb-3">
                <History className="w-5 h-5 text-indigo-400" />
                <span>Dispatch Log History</span>
              </h2>

              {loadingHistory ? (
                <div className="flex items-center space-x-2 text-xs text-slate-500 py-6 justify-center">
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  <span>Retrieving history logs...</span>
                </div>
              ) : history.length === 0 ? (
                <p className="text-slate-500 text-xs py-8 text-center border border-dashed border-slate-850 rounded-2xl">
                  No manual dispatches sent in this workspace session.
                </p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {history.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-2xl space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between items-center">
                        <span className="px-2 py-0.5 rounded bg-indigo-950/50 border border-indigo-900/50 text-[10px] text-indigo-400 font-bold uppercase">
                          Sent
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(log.created_at || log.timestamp || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="leading-relaxed text-slate-400 text-[11px]">{log.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
    </>
  );
}
