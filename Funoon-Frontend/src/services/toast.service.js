const MAX_TOASTS = 4;
const DEFAULT_DURATION = 5200;
const ERROR_DURATION = 5600;

let nextId = 0;
let toasts = [];
const listeners = new Set();
const timers = new Map();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const remove = (id) => {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);

  const nextToasts = toasts.filter((toast) => toast.id !== id);
  if (nextToasts.length === toasts.length) return;

  toasts = nextToasts;
  emit();
};

const scheduleRemoval = (id, duration) => {
  if (!Number.isFinite(duration) || duration <= 0) return;
  timers.set(
    id,
    setTimeout(() => remove(id), duration),
  );
};

const show = (message, options = {}) => {
  const normalizedMessage = String(message ?? "").trim();
  if (!normalizedMessage) return undefined;

  const type = options.type || "info";
  const duration =
    options.duration ?? (type === "error" ? ERROR_DURATION : DEFAULT_DURATION);
  const toast = {
    id: `toast-${++nextId}`,
    type,
    message: normalizedMessage,
    duration,
    action: options.action,
  };

  toasts = [...toasts, toast].slice(-MAX_TOASTS);
  emit();
  scheduleRemoval(toast.id, duration);
  return toast.id;
};

const toast = (message, options = {}) =>
  show(message, { ...options, type: options.type || "info" });

toast.success = (message, options = {}) =>
  show(message, { ...options, type: "success" });
toast.error = (message, options = {}) =>
  show(message, { ...options, type: "error" });
toast.info = (message, options = {}) =>
  show(message, { ...options, type: "info" });
toast.loading = (message, options = {}) =>
  show(message, {
    ...options,
    type: "loading",
    duration: options.duration ?? 0,
  });
toast.dismiss = (id) => {
  if (id) {
    remove(id);
    return;
  }

  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  if (toasts.length === 0) return;

  toasts = [];
  emit();
};
toast.promise = (promise, messages, options = {}) => {
  const loadingId = toast.loading(messages?.loading || "جاري التنفيذ", options);

  Promise.resolve(promise).then(
    (result) => {
      if (loadingId) remove(loadingId);
      toast.success(
        typeof messages?.success === "function"
          ? messages.success(result)
          : messages?.success || "تمت العملية بنجاح",
      );
      return result;
    },
    (error) => {
      if (loadingId) remove(loadingId);
      toast.error(
        typeof messages?.error === "function"
          ? messages.error(error)
          : messages?.error || "حدث خطأ أثناء التنفيذ",
      );
    },
  );

  return promise;
};

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSnapshot = () => toasts;
export { show };
export default toast;
