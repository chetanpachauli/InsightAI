"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Sparkles,
  Zap,
  Shield,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Building2,
  HelpCircle
} from "lucide-react";
import api, { getApiError } from "@/lib/api";

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  const handleCheckout = async (plan: string) => {
    if (plan === "FREE") {
      window.location.href = "/dashboard";
      return;
    }

    setLoadingPlan(plan);
    setCheckoutNotice(null);

    try {
      // 1. Create order
      const orderRes = await api.post("/billing/order", { plan });
      const { order_id } = orderRes.data;

      // 2. Simulate / execute Razorpay Verification
      const mockPaymentId = `pay_${Date.now()}`;
      const mockSignature = `sig_valid_${Date.now()}`;

      const verifyRes = await api.post("/billing/verify", {
        order_id,
        payment_id: mockPaymentId,
        signature: mockSignature,
        plan
      });

      setCheckoutNotice(`🎉 ${verifyRes.data.message}`);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch (err) {
      setCheckoutNotice(`⚠️ ${getApiError(err, "Payment initiation failed.")}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Navigation bar */}
        <div className="flex items-center justify-between pb-8 mb-8 border-b border-slate-800/80">
          <Link href="/dashboard" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white">InsightAI Enterprise</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 transition"
          >
            ← Back to Workspace
          </Link>
        </div>

        {/* Hero Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-cyan-500/10 border border-indigo-500/30 backdrop-blur-md mb-4">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300">
              🎁 14-Day Free Pro Trial on All New Organizations
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
            Predictable Plans for <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Fast-Growing Data Teams
            </span>
          </h1>
          <p className="text-slate-400 text-sm">
            Scale your business intelligence with bilingual AI SQL querying, automated WhatsApp digests, and enterprise multi-tenancy.
          </p>
        </div>

        {/* Notice alert */}
        {checkoutNotice && (
          <div className="max-w-md mx-auto mb-8 p-3 rounded-xl text-center text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 shadow-xl">
            {checkoutNotice}
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch mb-16">
          
          {/* Free Tier */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 flex flex-col justify-between backdrop-blur-xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Starter Free</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  Forever
                </span>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">₹0</span>
                <span className="text-slate-400 text-xs ml-1">/ month</span>
              </div>
              <p className="text-slate-400 text-xs mb-6">
                Essential data querying and reporting for individuals and trial projects.
              </p>
              <ul className="space-y-3 text-xs text-slate-300 mb-8">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>50 AI SQL Queries</strong> / month</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 5 File Uploads (Excel, CSV)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Standard Interactive Charts (Bar, Line, Pie)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Bilingual Natural Language Support</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout("FREE")}
              className="w-full py-3 rounded-xl font-semibold text-xs border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 transition cursor-pointer"
            >
              Current Active Plan
            </button>
          </div>

          {/* Pro Tier (Featured) */}
          <div className="rounded-3xl border-2 border-indigo-500/80 bg-gradient-to-b from-indigo-950/40 via-slate-900/80 to-slate-900/90 p-8 flex flex-col justify-between shadow-2xl shadow-indigo-600/20 backdrop-blur-xl relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-[10px] font-extrabold text-white tracking-wider uppercase shadow-lg shadow-indigo-500/30">
              Most Popular • 14 Days Free
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center space-x-1.5">
                  <span>Pro Intelligence</span>
                  <Zap className="w-4 h-4 text-indigo-400" />
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Razorpay UPI / Cards
                </span>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">₹799</span>
                <span className="text-slate-400 text-xs ml-1">/ month ($10 USD)</span>
              </div>
              <p className="text-slate-300 text-xs mb-6">
                Designed for high-performance managers and growing businesses requiring deep forecasts.
              </p>
              <ul className="space-y-3 text-xs text-slate-200 mb-8">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span><strong>500 AI SQL Queries</strong> / month</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Unlimited File Uploads</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Predictive Revenue & Sales Forecasting</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Weekly Executive PDF & WhatsApp Digests</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Opt-in Two-Factor Authentication (2FA)</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout("PRO")}
              disabled={loadingPlan === "PRO"}
              className="w-full py-3.5 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 text-white hover:opacity-95 transition shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loadingPlan === "PRO" ? "Processing..." : "Start 14-Day Free Pro Trial"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Enterprise Tier */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 flex flex-col justify-between backdrop-blur-xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <span>Enterprise</span>
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Custom Org
                </span>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">₹3,999</span>
                <span className="text-slate-400 text-xs ml-1">/ month ($50 USD)</span>
              </div>
              <p className="text-slate-400 text-xs mb-6">
                Dedicated infrastructure, white-label branding, and unlimited AI execution.
              </p>
              <ul className="space-y-3 text-xs text-slate-300 mb-8">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span><strong>Unlimited AI Queries</strong> & Conversations</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Full Multi-Tenant Organization Isolation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Custom White Labeling (Your Logo & Colors)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Dedicated 99.9% Uptime SLA & 24/7 Support</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout("ENTERPRISE")}
              disabled={loadingPlan === "ENTERPRISE"}
              className="w-full py-3 rounded-xl font-semibold text-xs border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition cursor-pointer disabled:opacity-50"
            >
              {loadingPlan === "ENTERPRISE" ? "Processing..." : "Upgrade to Enterprise"}
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}
