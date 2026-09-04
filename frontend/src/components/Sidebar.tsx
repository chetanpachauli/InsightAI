"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  UploadCloud, 
  MessageSquareCode, 
  Sliders, 
  LogOut, 
  TrendingUp, 
  ShieldCheck,
  Grid3X3,
  BookOpen,
  Send,
  DollarSign,
  Globe,
  BarChart3,
  Mic,
  CreditCard
} from "lucide-react";
import api, { useLocalStorage } from "@/lib/api";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { name: "Dashboard",          path: "/dashboard",        icon: LayoutDashboard },
    { name: "Uploads",            path: "/uploads",          icon: UploadCloud },
    { name: "AI Analytics Chat",  path: "/chat",             icon: MessageSquareCode },
    { name: "Forecast",           path: "/forecast",         icon: BarChart3 },
    { name: "Rules Engine",       path: "/rules",            icon: Sliders },
    { name: "Pivot Builder",      path: "/pivot",            icon: Grid3X3 },
    { name: "Document Hub",       path: "/documents",        icon: BookOpen },
    { name: "Notifications",      path: "/notifications",    icon: Send },
    { name: "Finance AI",         path: "/finance",          icon: DollarSign },
    { name: "Web Scraper",        path: "/scraper",          icon: Globe },
    { name: "Voice Assistant",    path: "/voice",            icon: Mic },
    { name: "Billing & 2FA",      path: "/settings/billing", icon: CreditCard },
  ];

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      console.error("Logout failed on server, clearing client anyway.");
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_role");
    window.dispatchEvent(new Event("insightai-storage"));
    router.push("/login");
  };

  const userRole = useLocalStorage("user_role");
  const userEmail = useLocalStorage("user_email");

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-100 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            InsightAI
          </h1>
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            MIS Analytics
          </span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                isActive ? "text-white" : "text-slate-400 group-hover:text-white"
              }`} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col space-y-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-400 uppercase">
            {userEmail ? userEmail[0] : "U"}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-200 truncate">{userEmail ? userEmail : "User Account"}</p>
            <div className="flex items-center space-x-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                {userRole ? userRole : "Employee"}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-slate-800 hover:border-red-900/50 hover:bg-red-950/20 hover:text-red-400 text-slate-400 transition-all duration-200 text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
