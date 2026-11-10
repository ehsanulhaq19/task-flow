import axios from "axios";
import Cookies from "js-cookie";
import { AUTH_COOKIE } from "@/services/storage";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api",
});

api.interceptors.request.use((config) => {
  const token = Cookies.get(AUTH_COOKIE);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      Cookies.remove(AUTH_COOKIE);
      const loginPath = `${basePath}/login`;
      if (!window.location.pathname.startsWith(loginPath)) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

export function apiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const message = detail.find((item) => item && typeof item.msg === "string")?.msg;
      if (message) return String(message);
    }
    if (!error.response) return "Cannot reach the server";
  }
  return fallback;
}

export default api;
