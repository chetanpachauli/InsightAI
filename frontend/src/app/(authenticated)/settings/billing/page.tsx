"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  KeyRound,
  Lock,
  QrCode,
  Loader2
} from "lucide-react";
import api, { getApiError } from "@/lib/api";

interface UsageData {
  organization_name: string;
  plan_tier: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  ai_queries_used: number;
  query_limit: number;
  quota_exhausted: boolean;
  two_factor_enabled: boolean;
}

export default function BillingSettingsPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 2FA Setup state
  const [setup2FA, setSetup2FA] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [twoFANotice, setTwoFANotice] = useState("");

  const fetchUsage = async () => {
    try {
      const res = await api.get("/billing/usage");
      setUsage(res.data);
    } catch (err) {
      setError(getApiError(err, "Failed to load billing usage."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const handleStart2FA = async () => {
    setActionLoading(true);
    setTwoFANotice("");
    try {
      const res = await api.post("/billing/two-factor/setup");
      setSetup2FA(res.data);
    } catch (err) {
      setTwoFANotice(`⚠️ ${getApiError(err, "Could not initialize 2FA.")}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!setup2FA || twoFACode.length !== 6) return;
    setActionLoading(true);
    setTwoFANotice("");
    try {
      const res = await api.post("/billing/two-factor/verify", {
        secret: setup2FA.secret,
        code: twoFACode
      });
      setTwoFANotice(`✅ ${res.data.message}`);
      setSetup2FA(null);
      setTwoFACode("");
      fetchUsage();
    } catch (err) {
      setTwoFANotice(`⚠️ ${getApiError(err, "Invalid 6-digit code. Please check your authenticator app.")}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    const code = prompt("Please enter your current 6-digit Authenticator code to disable 2FA:");
    if (!code || code.trim().length !== 6) return;

    setActionLoading(true);
    setTwoFANotice("");
    try {
      const res = await api.post("/billing/two-factor/disable", { code: code.trim() });
      setTwoFANotice(`✅ ${res.data.message}`);
      fetchUsage();
    } catch (err) {
      setTwoFANotice(`⚠️ ${getApiError(err, "Invalid code. 2FA not disabled.")}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const percentUsed = usage
    ? Math.min(100, Math.round((usage.ai_queries_used / Math.max(1, usage.query_limit)) * 100))
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white flex items-center space-x-2.5">
          <CreditCard className="w-6 h-6 text-indigo-400" />
          <span>Organization Billing & Security</span>
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Manage your organization&apos;s subscription plan, AI query quotas, and opt-in two-factor authentication.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Subscription Quota Card */}
      {usage && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Organization Workspace
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5">
                {usage.organization_name}
              </h2>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Tier: {usage.plan_tier}</span>
              </span>
              {usage.is_trial && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  14-Day Free Pro Trial
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">Monthly AI SQL Queries Usage</span>
              <span className="text-slate-400">
                <strong>{usage.ai_queries_used}</strong> / {usage.query_limit} queries ({percentUsed}%)
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percentUsed >= 90
                    ? "bg-red-500"
                    : percentUsed >= 70
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-indigo-500 to-cyan-500"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            {usage.quota_exhausted && (
              <p className="text-xs text-red-400 mt-2 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>You have reached your monthly AI query limit. Upgrade to continue querying datasets.</span>
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Need higher query limits or dedicated support?
            </span>
            <Link
              href="/pricing"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-95 transition shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5"
            >
              <span>View Pricing & Upgrade</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Opt-In Two-Factor Authentication Card */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Opt-in Two-Factor Authentication (2FA)
              </h3>
              <p className="text-xs text-slate-400">
                Secure your account with Google Authenticator or Microsoft Authenticator (RFC 6238 TOTP).
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${
              usage?.two_factor_enabled
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            {usage?.two_factor_enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {twoFANotice && (
          <div className="p-3 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-200">
            {twoFANotice}
          </div>
        )}

        {/* 2FA Actions */}
        {!usage?.two_factor_enabled ? (
          <div>
            {!setup2FA ? (
              <button
                onClick={handleStart2FA}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{actionLoading ? "Generating..." : "Enable Two-Factor Authentication"}</span>
              </button>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Step 1: Add Secret to Authenticator</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Open your Google Authenticator or Microsoft Authenticator app and enter this key:
                    </p>
                  </div>
                  <QrCode className="w-5 h-5 text-indigo-400" />
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-indigo-300 select-all break-all">
                  {setup2FA.secret}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Step 2: Enter 6-Digit Code</h4>
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-36 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono text-base tracking-widest text-white outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleVerify2FA}
                      disabled={actionLoading || twoFACode.length !== 6}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? "Verifying..." : "Verify & Activate"}
                    </button>
                    <button
                      onClick={() => setSetup2FA(null)}
                      className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDisable2FA}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 transition cursor-pointer"
            >
              {actionLoading ? "Processing..." : "Disable 2FA"}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
