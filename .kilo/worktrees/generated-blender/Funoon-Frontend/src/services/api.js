import axios from "axios";
import { useAuthStore } from "../features/auth/stores/authStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  timeout: 20000,
  withCredentials: true,
});

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
    // ✅ تحقق من حالة النت الفعلية في الجهاز
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
      return { userMessage: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.", errorType: "auth" };
    case 403:
      return { userMessage: "ليس لديك صلاحية لتنفيذ هذا الإجراء.", errorType: "auth" };
    case 404:
      return { userMessage: "المحتوى المطلوب غير موجود.", errorType: "not_found" };
    case 409:
      return { userMessage: serverMessage || "تعارض في البيانات. يرجى تحديث الصفحة.", errorType: "conflict" };
    case 429:
      return { userMessage: "طلبات كثيرة جداً. يرجى الانتظار قليلاً.", errorType: "rate_limit" };
    case 500:
      return { userMessage: "حدث خطأ في الخادم. يرجى المحاولة لاحقاً.", errorType: "server" };
    case 502:
    case 503:
    case 504:
      return { userMessage: "الخدمة غير متاحة مؤقتاً. حاول بعد دقائق.", errorType: "service_unavailable" };
    default:
      return { userMessage: serverMessage || "حدث خطأ غير متوقع.", errorType: "unknown" };
  }
};

// Request interceptor
api.interceptors.request.use((config) => {
  const token =
    useAuthStore.getState().accessToken || localStorage.getItem("accessToken");
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
  (response) => response.data,
  async (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const originalRequest = error.config;

    const parsed = parseError(error);

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
      localStorage.removeItem("accessToken");
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
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
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
        const refreshResponse = await api.post("/auth/refresh-token");
        const accessToken = refreshResponse?.data?.accessToken;

        if (!accessToken) {
          throw new Error("Refresh token response missing access token");
        }

        useAuthStore.getState().setToken(accessToken);
        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // ✅ Check if refresh failed due to ban
        if (refreshError?.data?.banned || refreshError?.banned) {
          localStorage.removeItem("accessToken");
          useAuthStore.setState({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });
          return Promise.reject(refreshError);
        }

        if (
          refreshError?.status === 429 ||
          refreshError?.response?.status === 429
        ) {
          return Promise.reject({
            status: 429,
            message: "انتظر قليلاً ثم حاول مجدداً",
            userMessage: "انتظر قليلاً ثم حاول مجدداً",
            errorType: "rate_limit",
          });
        }

        useAuthStore.getState().logout();

        const protectedPaths = [
          "/dashboard",
          "/admin",
          "/profile",
          "/checkout",
          "/wallet",
          "/subscription",
          "/orders",
          "/artist",
        ];
        const currentPath = window.location.pathname;
        const isProtected = protectedPaths.some((path) =>
          currentPath.startsWith(path),
        );
        if (isProtected) {
          window.location.href = "/login";
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
