import axios from "axios";
import { useSyncExternalStore } from "react";

// Default to local dev; production (Vercel) sets NEXT_PUBLIC_API_URL at build time
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Crucial for receiving and sending the HTTP-Only Refresh Token Cookie
});

// Request Interceptor: Attach Access Token if available
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto Refresh Token on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 (Unauthorized) and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Attempt to call the refresh endpoint to obtain a new access token
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        const newAccessToken = refreshResponse.data.access_token;
        if (newAccessToken) {
          localStorage.setItem("access_token", newAccessToken);
          
          // Re-attempt original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch {
        // If refresh fails, clear token and redirect to login
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_email");
          localStorage.removeItem("user_role");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export function getApiError(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "response" in err) {
    const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string" && detail) return detail;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const subscribeNoop = () => () => {};

export function useLocalStorage(key: string): string {
  return useSyncExternalStore(
    subscribeNoop,
    () => localStorage.getItem(key) ?? "",
    () => ""
  );
}

export default api;
