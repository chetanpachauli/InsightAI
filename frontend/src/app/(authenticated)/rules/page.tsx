"use client";

import { useEffect, useState } from "react";
import api, { getApiError } from "@/lib/api";
import { 
  Sliders, 
  Plus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Mail, 
  Bell, 
  Loader2, 
  ShieldAlert,
  MessageSquare 
} from "lucide-react";

interface RuleItem {
  id: number;
  name: string;
  rule_type: string;
  condition_col: string;
  operator: string;
  value: string;
  action_type: string;
  recipient?: string;
  webhook_url?: string;
  is_active: boolean;
  created_at: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New Rule form fields
  const [name, setName] = useState("");
  const [ruleType, setRuleType] = useState("SALES");
  const [col, setCol] = useState("");
  const [operator, setOperator] = useState("<");
  const [val, setVal] = useState("");
  const [action, setAction] = useState("ALERT");
  const [recipient, setRecipient] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [testingRules, setTestingRules] = useState(false);

  const userRole = typeof window !== "undefined" ? localStorage.getItem("user_role") : "";

  const fetchRules = async () => {
    try {
      const response = await api.get("/rules");
      setRules(response.data);
    } catch {
      setError("Failed to load rules engine. Is backend online?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRules();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await api.post("/rules", {
        name,
        rule_type: ruleType,
        condition_col: col,
        operator,
        value: val,
        action_type: action,
        recipient: (action === "EMAIL" || action === "WHATSAPP") ? recipient : null,
        webhook_url: action === "WEBHOOK" ? webhookUrl : null,
      });

      setSuccess(`Rule "${response.data.name}" created successfully!`);
      // Clear form
      setName("");
      setCol("");
      setVal("");
      setRecipient("");
      setWebhookUrl("");
      
      fetchRules();
    } catch (err) {
      setError(getApiError(err, "Failed to create rule."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (ruleId: number) => {
    setError("");
    setSuccess("");
    try {
      const response = await api.post(`/rules/${ruleId}/toggle`);
      setSuccess(`Rule "${response.data.name}" status updated.`);
      fetchRules();
    } catch {
      setError("Failed to toggle rule state.");
    }
  };

  const handleDelete = async (ruleId: number) => {
    setError("");
    setSuccess("");
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      await api.delete(`/rules/${ruleId}`);
      setSuccess("Rule deleted successfully.");
      fetchRules();
    } catch {
      setError("Failed to delete rule.");
    }
  };

  const handleTestAllRules = async () => {
    setError("");
    setSuccess("");
    setTestingRules(true);

    try {
      const response = await api.post("/rules/test-all");
      setSuccess(
        `✅ ${response.data.message}. Tested ${response.data.active_rules_count} rule(s) on ${response.data.tables_tested.length} table(s). Check Dashboard for triggered alerts!`
      );
    } catch (err) {
      setError(getApiError(err, "Failed to test rules. Make sure you have approved files uploaded."));
    } finally {
      setTestingRules(false);
    }
  };

  return (
    <>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Automated Alert & Rule Engine
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Establish data triggers. The engine monitors database changes and automatically dispatches alert logs or email notifications.
          </p>
        </div>

        {/* Status Banners */}
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
          
          {/* Left Form: Add Rule (Only for MIS, Manager, Admin) */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <span>Create New Trigger</span>
              </h2>

              {userRole !== "Admin" && userRole !== "Manager" && userRole !== "MIS" ? (
                <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl flex items-start space-x-3 text-amber-500 text-xs">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Access Restrained</strong>: Creating rules is restricted to <strong>MIS</strong>, <strong>Manager</strong>, or <strong>Admin</strong> credentials.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCreateRule} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Rule Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sales Drop Alert"
                      className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Category
                      </label>
                      <select
                        value={ruleType}
                        onChange={(e) => setRuleType(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-300 text-sm focus:border-indigo-500 transition"
                      >
                        <option value="SALES">Sales</option>
                        <option value="INVENTORY">Inventory</option>
                        <option value="FINANCE">Finance</option>
                        <option value="ANOMALY">Statistical Anomaly (AI Outlier)</option>
                        <option value="CUSTOM">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Column Name
                      </label>
                      <input
                        type="text"
                        required
                        value={col}
                        onChange={(e) => setCol(e.target.value)}
                        placeholder="e.g. amount, stock"
                        className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Operator
                      </label>
                      <select
                        value={operator}
                        onChange={(e) => setOperator(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-300 text-sm focus:border-indigo-500 transition"
                      >
                        <option value="<">&lt;</option>
                        <option value=">">&gt;</option>
                        <option value="==">==</option>
                        <option value="<=">&lt;=</option>
                        <option value=">=">&gt;=</option>
                        <option value="ANOMALY">Z-Score (&ge;)</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        {operator === "ANOMALY" ? "Z-Score Threshold (σ)" : "Threshold Value"}
                      </label>
                      <input
                        type="text"
                        required
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={operator === "ANOMALY" ? "e.g. 3.0 (99.7% confidence)" : "e.g. 50000, 20"}
                        className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Action Trigger
                    </label>
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-300 text-sm focus:border-indigo-500 transition"
                    >
                      <option value="ALERT">Dashboard Alert Notification</option>
                      <option value="EMAIL">Send Direct Email Alert</option>
                      <option value="WEBHOOK">Send Webhook (Slack/Discord)</option>
                      <option value="WHATSAPP">Send WhatsApp Alert</option>
                    </select>
                  </div>

                  {action === "WEBHOOK" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Slack/Discord Webhook URL
                      </label>
                      <input
                        type="url"
                        required
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://hooks.slack.com/services/..."
                        className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition"
                      />
                    </div>
                  )}

                  {(action === "EMAIL" || action === "WHATSAPP") && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        {action === "EMAIL" ? "Recipient Email" : "Recipient Phone (+91...)"}
                      </label>
                      <input
                        type="text"
                        required
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder={action === "EMAIL" ? "manager@company.com" : "+919999999999"}
                        className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm py-3 rounded-xl flex items-center justify-center space-x-2 transition shadow-md shadow-indigo-600/10 disabled:opacity-50 mt-6"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>Create Alert Rule</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Panel: List Rules */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-200">Registered Rules Dashboard</h2>
                
                {/* Test All Rules Button */}
                {(userRole === "Admin" || userRole === "Manager" || userRole === "MIS") && rules.length > 0 && (
                  <button
                    onClick={handleTestAllRules}
                    disabled={testingRules}
                    className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingRules ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing Rules...</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5" />
                        <span>Test All Rules Now</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <p className="text-slate-500 text-xs">Loading alert conditions...</p>
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-16 border border-slate-800/50 rounded-2xl bg-slate-950/20">
                  <Sliders className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-semibold">No rules established</p>
                  <p className="text-slate-500 text-xs mt-1">Newly created triggers will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rules.map((rule) => (
                    <div 
                      key={rule.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        rule.is_active 
                          ? "bg-slate-900/80 border-slate-800" 
                          : "bg-slate-950/40 border-slate-900 opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-800 rounded text-slate-400">
                            {rule.rule_type}
                          </span>
                          <h3 className="text-sm font-bold text-slate-200 mt-2 truncate w-40">{rule.name}</h3>
                        </div>
                        
                        {/* Toggle state */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleToggle(rule.id)}
                            disabled={userRole !== "Admin" && userRole !== "Manager" && userRole !== "MIS"}
                            className="text-slate-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {rule.is_active ? (
                              <ToggleRight className="w-6 h-6 text-indigo-500" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-slate-600" />
                            )}
                          </button>
                          
                          {/* Delete rule */}
                          <button
                            onClick={() => handleDelete(rule.id)}
                            disabled={userRole !== "Admin" && userRole !== "Manager" && userRole !== "MIS"}
                            className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Rule details box */}
                      <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs space-y-2 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Condition:</span>
                          <span className="font-mono text-indigo-400 font-semibold">
                            {rule.operator === "ANOMALY" || rule.rule_type === "ANOMALY"
                              ? `Z-Score(${rule.condition_col}) >= ${rule.value}σ`
                              : `IF ${rule.condition_col} ${rule.operator} ${rule.value}`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Response:</span>
                          <span className="flex items-center space-x-1 font-semibold text-slate-200">
                            {rule.action_type === "EMAIL" ? (
                              <>
                                <Mail className="w-3.5 h-3.5 text-blue-400" />
                                <span>Email</span>
                              </>
                            ) : rule.action_type === "WEBHOOK" ? (
                              <>
                                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                                <span>Webhook</span>
                              </>
                            ) : rule.action_type === "WHATSAPP" ? (
                              <>
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                <span>WhatsApp</span>
                              </>
                            ) : (
                              <>
                                <Bell className="w-3.5 h-3.5 text-amber-400" />
                                <span>Alert Logs</span>
                              </>
                            )}
                          </span>
                        </div>
                        {rule.recipient && (
                          <div className="flex justify-between overflow-hidden">
                            <span className="text-slate-500 font-medium">To:</span>
                            <span className="text-slate-400 truncate w-32 text-right">{rule.recipient}</span>
                          </div>
                        )}
                        {rule.webhook_url && (
                          <div className="flex justify-between overflow-hidden">
                            <span className="text-slate-500 font-medium">URL:</span>
                            <span className="text-slate-400 truncate w-32 text-right font-mono" title={rule.webhook_url}>
                              {rule.webhook_url}
                            </span>
                          </div>
                        )}
                      </div>
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
