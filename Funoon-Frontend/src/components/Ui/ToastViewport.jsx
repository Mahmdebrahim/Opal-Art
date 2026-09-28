import { useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, X } from "lucide-react";
import { getSnapshot, subscribe } from "../../services/toast.service";
import toast from "../../services/toast.service";

const toastMeta = {
  success: {
    Icon: CheckCircle2,
    label: "تم بنجاح",
    role: "status",
  },
  error: {
    Icon: AlertCircle,
    label: "تنبيه",
    role: "alert",
  },
  info: {
    Icon: Info,
    label: "معلومة",
    role: "status",
  },
  loading: {
    Icon: LoaderCircle,
    label: "جاري التنفيذ",
    role: "status",
  },
};

function ToastItem({ item }) {
  const meta = toastMeta[item.type] || toastMeta.info;
  const Icon = meta.Icon;

  return (
    <article
      role={meta.role}
      aria-live={meta.role === "alert" ? "assertive" : "polite"}
      className="funoon-toast pointer-events-auto"
    >
      <span className="funoon-toast__accent" aria-hidden="true" />
      <div className="funoon-toast__icon" aria-hidden="true">
        <Icon
          className={item.type === "loading" ? "funoon-toast__spinner" : ""}
          size={19}
          strokeWidth={1.8}
        />
      </div>
      <div className="funoon-toast__body">
        <p className="funoon-toast__label">{meta.label}</p>
        <p className="funoon-toast__message">{item.message}</p>
        {item.action && (
          <button
            type="button"
            className="funoon-toast__action"
            onClick={item.action.onClick}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        className="funoon-toast__close"
        onClick={() => toast.dismiss(item.id)}
        aria-label="إغلاق الرسالة"
      >
        <X size={16} strokeWidth={1.8} />
      </button>
    </article>
  );
}

export default function ToastViewport() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <div className="funoon-toast-viewport" dir="rtl" aria-label="رسائل النظام">
      {items.map((item) => (
        <ToastItem key={item.id} item={item} />
      ))}
    </div>
  );
}
