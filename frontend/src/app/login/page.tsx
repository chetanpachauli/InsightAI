"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Mail, Lock, Shield, ArrowRight } from "lucide-react";
import axios from "axios";
import { getApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  
  // Auth state toggles
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Employee");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const baseUrl = "http://localhost:8000/api";

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
        setError("Account created! Please login now.");
      } else {
        // Login API Call
        const response = await axios.post(
          `${baseUrl}/auth/login`,
          { email, password },
          { withCredentials: true } // Handles cookie storage
        );
        
        // Save items to local storage
        localStorage.setItem("access_token", response.data.access_token);
        localStorage.setItem("user_email", response.data.email);
        localStorage.setItem("user_role", response.data.role);

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
    <main className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden px-4">
      {/* Decorative background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      
      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />

      <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
        
        {/* Top Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {isRegister ? "Create an account" : "Welcome back"}
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {isRegister 
              ? "Sign up to start automated analytics on InsightAI" 
              : "Sign in to manage your enterprise data and AI insights"}
          </p>
        </div>

        {/* Error/Notice Message banner */}
        {error && (
          <div className={`p-4 rounded-xl text-xs mb-6 font-medium ${
            error.includes("created") || error.includes("Please login")
              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50"
              : "bg-red-950/40 text-red-400 border border-red-900/50"
          }`}>
            {error}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-100 text-sm placeholder-slate-600 transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-100 text-sm placeholder-slate-600 transition-all duration-200"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                System Access Role
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Shield className="w-4 h-4" />
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-400 text-sm transition-all duration-200"
                >
                  <option value="Employee">Employee (View Only)</option>
                  <option value="MIS">MIS (Upload & Create Rules)</option>
                  <option value="Manager">Manager (Review Reports & Rules)</option>
                  <option value="CEO">CEO (Approve Final Data & View)</option>
                  <option value="Admin">Admin (Full Control)</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm py-3 rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all duration-200 flex items-center justify-center space-x-2 mt-6 shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{loading ? "Processing..." : isRegister ? "Sign Up" : "Sign In"}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Toggle between Register/Login */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-xs">
            {isRegister ? "Already have an account?" : "New to the platform?"}{" "}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline underline-offset-4"
            >
              {isRegister ? "Sign In" : "Register a role"}
            </button>
          </p>
        </div>

      </div>
    </main>
  );
}
