import axios from "axios";
import { useAuthStore } from "../features/auth/stores/authStore.js";
import {
  isAccessTokenExpiredResponse,
  isDefinitiveSessionError,
  isTemporarySessionError,
} from "../features/auth/utils/sessionErrors.js";
import toast from "./toast.service.js";

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || "http://localhost:5000/api/v1",
  timeout: 20000,
  withCredentials: true,
});

let databaseUnavailableToastId = null;

// ═══════════════════════════════════════════════════
// 🛡️ Error Parser — رسائل عربية مفهومة
// ═══════════════════════════════════════════════════
const parseError = (error) => {
  // ═══ 1. Timeout ═══
  if (
    error.code === "ECONNABORTED" ||
    error.message?.includes("timeout") ||
    error.message?.includes("Timeout")
  ) {
    return {
      userMessage: "العملية استغرقت وقتاً طويلاً. يرجى المحاولة مرة أخرى.",
      errorType: "timeout",
    };
  }

  // ═══ 2. Network Error — هنا التفريق بين النت فاصل والسيرفر واقع ═══
  const isNetworkError =
    error.message === "Network Error" ||
    error.code === "ERR_NETWORK" ||
    error.code === "ERR_CONNECTION_REFUSED" ||
    error.code === "ECONNREFUSED" ||
    !error.response;

  if (isNetworkError) {
    const isOffline =
      typeof window !== "undefined" && navigator.onLine === false;

    if (isOffline) {
      return {
        userMessage: "أنت غير متصل بالإنترنت حالياً",
        errorType: "offline",
      };
    }

    // النت شغال بس السيرفر واقع / CORS / DNS failure
    return {
      userMessage: "الخادم غير متاح حالياً. يرجى المحاولة بعد قليل.",
      errorType: "server_down",
    };
  }

  const status = error.response?.status;
  const data = error.response?.data;
  const serverMessage = data?.message;

  if (data?.code === "DATABASE_UNAVAILABLE") {
    return {
      userMessage:
        serverMessage ||
        "قاعدة البيانات غير متاحة مؤقتاً. يرجى المحاولة بعد قليل.",
      errorType: "database_unavailable",
    };
  }

  // ═══ Backend message ═══
  if (serverMessage && status >= 400 && status < 500) {
    return {
      userMessage: serverMessage,
      errorType: "server",
    };
  }

  // ═══ Status-based fallbacks ═══
  switch (status) {
    case 401:
      return {
        userMessage: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.",
        errorType: "auth",
      };
    case 403:
      return {
        userMessage: "ليس لديك صلاحية لتنفيذ هذا الإجراء.",
        errorType: "auth",
      };
    case 404:
      return {
        userMessage: "المحتوى المطلوب غير موجود.",
        errorType: "not_found",
      };
    case 409:
      return {
        userMessage: serverMessage || "تعارض في البيانات. يرجى تحديث الصفحة.",
        errorType: "conflict",
      };
    case 429:
      return {
        userMessage: "طلبات كثيرة جداً. يرجى الانتظار قليلاً.",
        errorType: "rate_limit",
      };
    case 500:
      return {
        userMessage: "حدث خطأ في الخادم. يرجى المحاولة لاحقاً.",
        errorType: "server",
      };
    case 502:
    case 503:
    case 504:
      return {
        userMessage: "الخدمة غير متاحة مؤقتاً. حاول بعد دقائق.",
        errorType: "service_unavailable",
      };
    default:
      return {
        userMessage: serverMessage || "حدث خطأ غير متوقع.",
        errorType: "unknown",
      };
  }
};

// Request interceptor
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

const AUTH_ENDPOINTS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh-token",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/auth/resend-otp",
  "/auth/verify-status",
];

const isAuthEndpoint = (url) => {
  return AUTH_ENDPOINTS.some((endpoint) => url?.includes(endpoint));
};

api.interceptors.response.use(
  (response) => {
    if (databaseUnavailableToastId) {
      toast.dismiss(databaseUnavailableToastId);
      databaseUnavailableToastId = null;
    }
    return response.data;
  },
  async (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const originalRequest = error.config;

    const parsed = parseError(error);

    if (
      parsed.errorType === "database_unavailable" &&
      !databaseUnavailableToastId
    ) {
      databaseUnavailableToastId = toast.error(parsed.userMessage, {
        duration: 0,
        action: {
          label: "إعادة تحميل",
          onClick: () => window.location.reload(),
        },
      });
    }

    // ═══ 1) Timeout / Network Error ═══
    if (parsed.errorType === "timeout" || parsed.errorType === "network") {
      return Promise.reject({
        status: parsed.errorType === "timeout" ? 408 : 0,
        message: parsed.userMessage,
        userMessage: parsed.userMessage,
        errorType: parsed.errorType,
      });
    }

    // ═══ 2) 429 ═══
    if (status === 429) {
      return Promise.reject({
        status: 429,
        message: parsed.userMessage,
        userMessage: parsed.userMessage,
        errorType: "rate_limit",
      });
    }

    // ═══ 3) BANNED USER — Immediate logout without refresh attempt ═══
    if (status === 401 && data?.data?.banned) {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
      });

      const bannedMessage = data?.message || "حسابك محظور من المنصة";

      return Promise.reject({
        status: 401,
        message: bannedMessage,
        userMessage: bannedMessage,
        errorType: "banned",
        banned: true,
      });
    }

    // ═══ 4) Auth endpoints ═══
    if (isAuthEndpoint(originalRequest?.url)) {
      return Promise.reject({
        ...(typeof data === "object" && data !== null ? data : {}),
        status,
        message: parsed.userMessage,
        userMessage: parsed.userMessage,
        errorType: parsed.errorType,
      });
    }

    // ═══ 5) 401 — refresh (only if NOT banned) ═══
    if (
      status === 401 &&
      isAccessTokenExpiredResponse(data) &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        originalRequest._retry = true;
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const accessToken = await useAuthStore.getState().refreshAccessToken();

        if (!accessToken) {
          throw new Error("Refresh token response missing access token");
        }

        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        const refreshData =
          refreshError?.response?.data ?? refreshError?.data ?? {};
        if (refreshData?.data?.banned || refreshData?.banned) {
          const bannedMessage =
            refreshData.message || "حسابك محظور من المنصة";
          useAuthStore.setState({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });
          return Promise.reject({
            status: 401,
            message: bannedMessage,
            userMessage: bannedMessage,
            errorType: "banned",
            banned: true,
          });
        }

        if (isTemporarySessionError(refreshError)) {
          return Promise.reject({
            status: refreshError?.response?.status ?? refreshError?.status ?? 0,
            message: "تعذر التحقق من الجلسة مؤقتاً. حاول مرة أخرى.",
            userMessage: "تعذر التحقق من الجلسة مؤقتاً. حاول مرة أخرى.",
            errorType: "session_unavailable",
          });
        }

        if (isDefinitiveSessionError(refreshError)) {
          return Promise.reject({
            status: refreshError?.response?.status ?? refreshError?.status,
            message: parsed.userMessage,
            userMessage: parsed.userMessage,
            errorType: "auth",
          });
        }

        return Promise.reject({
          ...refreshError,
          userMessage: refreshError.userMessage || parsed.userMessage,
          errorType: refreshError.errorType || parsed.errorType,
        });
      } finally {
        isRefreshing = false;
      }
    }

    // ═══ 6) أي error تاني ═══
    return Promise.reject({
      ...(typeof data === "object" && data !== null ? data : {}),
      status,
      message: parsed.userMessage,
      userMessage: parsed.userMessage,
      errorType: parsed.errorType,
    });
  },
);

export default api;
