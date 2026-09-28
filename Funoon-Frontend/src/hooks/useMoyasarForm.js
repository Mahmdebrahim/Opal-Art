import { useEffect, useRef, useState, useCallback } from "react";

const MOYASAR_JS = "https://cdn.moyasar.com/mpf/1.12.0/moyasar.js";
const MOYASAR_CSS = "https://cdn.moyasar.com/mpf/1.12.0/moyasar.css";
const POLL_INTERVAL = 100;
const POLL_MAX_ATTEMPTS = 100;
const RENDER_FALLBACK_MS = 8000;

function injectCss() {
  if (!document.getElementById("moyasar-css")) {
    const link = document.createElement("link");
    link.id = "moyasar-css";
    link.rel = "stylesheet";
    link.href = MOYASAR_CSS;
    document.head.appendChild(link);
  }
}

function loadMoyasarScript() {
  return new Promise((resolve, reject) => {
    if (window.Moyasar) return resolve();

    let script = document.querySelector(`script[src="${MOYASAR_JS}"]`);

    // ✅ لو محاولة سابقة فشلت، امسح السكربت وجرب من جديد
    if (script?.dataset.state === "error") {
      script.remove();
      script = null;
    }

    if (!script) {
      script = document.createElement("script");
      script.src = MOYASAR_JS;
      script.async = true;
      script.dataset.state = "loading";
      script.onload = () => {
        script.dataset.state = "loaded";
        resolve();
      };
      script.onerror = () => {
        script.dataset.state = "error";
        reject(new Error("Moyasar script failed to load"));
      };
      document.body.appendChild(script);
      return;
    }

    // السكربت موجود وبيتحمل دلوقتي → استنى
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Moyasar script failed")),
      { once: true },
    );
  });
}

// ═══ Main Hook ═══
export function useMoyasarForm({
  containerRef,
  invoiceId,
  amount,
  description = "Opal Art Payment",
  callbackPath = "/payment/success",
  enabled = true,
}) {
  const [isLoading, setIsLoading] = useState(() =>
    Boolean(enabled && invoiceId),
  );
  const [error, setError] = useState(false);

  const observerRef = useRef(null);
  const fallbackRef = useRef(null);
  const pollRef = useRef(null);
  const pollAttemptsRef = useRef(0);
  const initCountRef = useRef(0);
  const mountedRef = useRef(true);

  const clearAll = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const initForm = useCallback(() => {
    if (!mountedRef.current || !enabled || !invoiceId) return;

    const container = containerRef.current;

    if (!container || !window.Moyasar) {
      if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
        setError(true);
        setIsLoading(false);
        return;
      }
      pollAttemptsRef.current += 1;
      pollRef.current = setTimeout(initForm, POLL_INTERVAL);
      return;
    }
    pollAttemptsRef.current = 0;
    pollRef.current = null;

    clearAll();

    initCountRef.current += 1;
    const thisInitId = initCountRef.current;

    container.innerHTML = "";
    setError(false);
    setIsLoading(true);

    const checkForm = () =>
      container.querySelector("form") ||
      container.querySelector("input") ||
      container.querySelector(".mysr-form") ||
      container.childNodes.length > 0;

    const observer = new MutationObserver(() => {
      if (thisInitId !== initCountRef.current) {
        observer.disconnect();
        return;
      }
      if (checkForm()) {
        console.log("[Moyasar] form rendered ✅");
        setIsLoading(false);
        setError(false);
        observer.disconnect();
        observerRef.current = null;
        if (fallbackRef.current) {
          clearTimeout(fallbackRef.current);
          fallbackRef.current = null;
        }
      }
    });
    observerRef.current = observer;
    observer.observe(container, { childList: true, subtree: true });

    if (checkForm()) {
      setIsLoading(false);
      observer.disconnect();
      observerRef.current = null;
      return;
    }

    try {
      window.Moyasar.init({
        element: container,
        amount: Math.round(amount * 100),
        currency: "SAR",
        description,
        publishable_api_key: import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY,
        callback_url: `${window.location.origin}${callbackPath}`,
        invoice_id: invoiceId,
        methods: ["creditcard"],
      });
    } catch (err) {
      console.error("[Moyasar] init threw error:", err);
      observer.disconnect();
      observerRef.current = null;
      setError(true);
      setIsLoading(false);
      return;
    }

    fallbackRef.current = setTimeout(() => {
      if (thisInitId !== initCountRef.current || !mountedRef.current) return;
      if (!checkForm()) {
        console.warn("[Moyasar] fallback — form failed to render");
        setError(true);
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
      }
      setIsLoading(false); // ✅ مهما حصل، مفيش stuck loading
    }, RENDER_FALLBACK_MS);
  }, [
    enabled,
    invoiceId,
    amount,
    description,
    callbackPath,
    containerRef,
    clearAll,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    if (!enabled || !invoiceId) return;

    injectCss();
    pollAttemptsRef.current = 0;

    (async () => {
      try {
        await loadMoyasarScript();
        if (cancelled || !mountedRef.current) return;
        initForm();
      } catch {
        if (cancelled || !mountedRef.current) return;
        console.error("[Moyasar] script failed to load");
        setError(true);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearAll();
    };
  }, [enabled, invoiceId, initForm, clearAll]);

  // ═══ Unmount guard ═══
  useEffect(
    () => () => {
      mountedRef.current = false;
      clearAll();
    },
    [clearAll],
  );

  // ✅ Retry صحيح: بيعيد تحميل السكربت لو كان فاشل
  const retry = useCallback(() => {
    setError(false);
    setIsLoading(true);
    pollAttemptsRef.current = 0;
    clearAll();
    loadMoyasarScript()
      .then(() => {
        if (mountedRef.current) initForm();
      })
      .catch(() => {
        if (mountedRef.current) {
          setError(true);
          setIsLoading(false);
        }
      });
  }, [initForm, clearAll]);

  return { isLoading, error, retry };
}
