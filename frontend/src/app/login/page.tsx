"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  TrendingUp,
  Mail,
  Lock,
  Shield,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  CheckCircle2,
  ChevronDown
} from "lucide-react";
import axios from "axios";
import { getApiError, API_BASE_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  // Auth state toggles
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("Employee");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const baseUrl = API_BASE_URL;

    try {
      if (isRegister) {
        // Register API Call
        await axios.post(`${baseUrl}/auth/register`, {
          email,
          password,
          role,
        });
        // Auto toggle to login after registration
        setIsRegister(false);
        setPassword("");
        setError("Account created successfully! Please sign in now.");
      } else {
        // Login API Call
        const response = await axios.post(
          `${baseUrl}/auth/login`,
          { email, password },
          { withCredentials: true }
        );

        // Save items to local storage & cookie
        localStorage.setItem("access_token", response.data.access_token);
        localStorage.setItem("user_email", response.data.email);
        localStorage.setItem("user_role", response.data.role);
        document.cookie = `access_token=${response.data.access_token}; path=/; max-age=86400; SameSite=Lax`;
        window.dispatchEvent(new Event("insightai-storage"));

        // Redirect to main workspace
        router.push("/dashboard");
      }
    } catch (err) {
      setError(
        getApiError(err, "Something went wrong. Make sure backend is running.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden px-4 py-8">
      {/* Decorative background glow elements */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-600/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Futuristic Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      {/* Main Container: 2-Column Responsive Layout */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left Column: 3D Pixar Character & Interactive Tech Showcase */}
        <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left relative">
          
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-cyan-500/10 border border-indigo-500/30 backdrop-blur-md mb-6 shadow-lg shadow-indigo-500/10">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs font-semibold bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
              InsightAI Enterprise BI 2.0
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Next-Gen MIS & <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              AI Data Intelligence
            </span>
          </h1>
          <p className="text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
            Automate Excel pipelines, run Gemini-powered SQL chat, and monitor statistical anomalies in real-time.
          </p>

          {/* 3D Character Hero Card with Floating Highlights */}
          <div className="relative w-full max-w-md rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl p-4 group">
            <div className="relative w-full h-80 rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-indigo-950/40">
              <Image
                src="/images/pixar_guide.jpg"
                alt="3D Pixar Character Guide"
                fill
                priority
                className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
            </div>

            {/* Floating Glassmorphism Floating Metric Pill */}
            <div className="absolute bottom-6 left-6 right-6 p-3 rounded-2xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-md flex items-center justify-between shadow-xl">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-200">Live BI Engine</p>
                  <p className="text-[10px] text-emerald-400 font-medium">99.9% Cloud Uptime</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                <Zap className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] font-semibold text-indigo-300">Gemini 2.5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sleek Floating Drop-Down Auth Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl relative z-10 transition-all duration-300 hover:border-indigo-500/40">
            
            {/* Top Logo & Title */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-3">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                {isRegister ? "Create an account" : "Welcome back"}
              </h2>
              <p className="text-slate-400 text-xs mt-1 text-center">
                {isRegister
                  ? "Sign up to start automated analytics on InsightAI"
                  : "Sign in to manage your enterprise data and AI insights"}
              </p>
            </div>

            {/* Error/Notice Message banner */}
            {error && (
              <div
                className={`p-3.5 rounded-xl text-xs mb-5 font-medium flex items-center space-x-2 ${
                  error.includes("created") || error.includes("success")
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                    : "bg-red-950/60 text-red-300 border border-red-800/60"
                }`}
              >
                <span>{error}</span>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-100 text-sm placeholder-slate-500 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-100 text-sm placeholder-slate-500 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Role Dropdown (High Contrast & Visible Options) */}
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    System Access Role
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                      <Shield className="w-4 h-4" />
                    </span>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-slate-950/90 border border-slate-700/80 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-100 text-sm transition-all duration-200 appearance-none cursor-pointer"
                    >
                      <option value="Employee" className="bg-slate-900 text-slate-100 py-2">
                        Employee (View Only)
                      </option>
                      <option value="MIS" className="bg-slate-900 text-slate-100 py-2">
                        MIS (Upload & Create Rules)
                      </option>
                      <option value="Manager" className="bg-slate-900 text-slate-100 py-2">
                        Manager (Review Reports & Rules)
                      </option>
                      <option value="CEO" disabled className="bg-slate-950 text-slate-500 py-2">
                        CEO (Approve Final Data) - Contact Admin
                      </option>
                      <option value="Admin" disabled className="bg-slate-950 text-slate-500 py-2">
                        Admin (Full Control) - Contact Admin
                      </option>
                    </select>
                    <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 pointer-events-none">
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-500 text-white font-semibold text-sm py-3.5 rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all duration-200 flex items-center justify-center space-x-2 mt-6 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>
                  {loading ? "Processing..." : isRegister ? "Sign Up" : "Sign In"}
                </span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Toggle between Register/Login */}
            <div className="mt-6 pt-5 border-t border-slate-800 text-center">
              <p className="text-slate-400 text-xs">
                {isRegister ? "Already have an account?" : "New to the platform?"}{" "}
                <button
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError("");
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline underline-offset-4 ml-1"
                >
                  {isRegister ? "Sign In" : "Register a role"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
