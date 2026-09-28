import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "../../services/toast.service";
import {
  Mail,
  MessageSquare,
  Clock,
  CheckCircle2,
  Send,
  Copy,
} from "lucide-react";
import Button from "../../components/Ui/Button";
import api from "../../services/api";
import { useAuthStore } from "../../features/auth/stores/authStore";

const TOPICS = [
  { value: "ORDER", label: "استفسار عن طلب" },
  { value: "PAYMENT", label: "مشكلة في الدفع" },
  { value: "ARTWORK", label: "استفسار عن لوحة" },
  { value: "ACCOUNT", label: "مشكلة في الحساب" },
  { value: "PARTNERSHIP", label: "شراكة / انضمام فنان" },
  { value: "OTHER", label: "موضوع آخر" },
];

export default function ContactPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    topic: "ORDER",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const [ticketId, setTicketId] = useState(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post("/support", payload);
      return data;
    },
    onSuccess: (data) => {
      const ticket = data?.data || data;
      setTicketId(ticket?._id || null);
      setSent(true);
      toast.success("تم إرسال رسالتك بنجاح");
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || "تعذر إرسال الرسالة، حاول لاحقاً",
      );
    },
  });

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 3) e.name = "الاسم مطلوب (3 حروف على الأقل)";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "بريد إلكتروني غير صالح";
    if (form.message.trim().length < 10)
      e.message = "الرسالة لازم تكون 10 حروف على الأقل";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    mutation.mutate(form);
  };

  const set = (key) => (ev) => setForm({ ...form, [key]: ev.target.value });

  const copyTicket = async () => {
    try {
      await navigator.clipboard.writeText(
        `#${ticketId.slice(-6).toUpperCase()}`,
      );
      setCopied(true);
      toast.success("تم نسخ رقم التذكرة");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] py-14 px-5">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-10">
        {/* ═══ معلومات التواصل ═══ */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <span className="text-xs font-semibold tracking-[0.2em] text-[#C5A880] block mb-2">
              تواصل معنا
            </span>
            <h1 className="font-display text-3xl font-bold text-[var(--color-on-surface)]">
              نسعد بخدمتك
            </h1>
            <p className="text-sm text-[var(--color-on-surface-variant)] mt-3 leading-relaxed">
              أي استفسار عن طلب أو لوحة أو حساب — فريقنا يرد خلال 24 ساعة عمل.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-[#C5A880]/10 text-[#C5A880] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-on-surface)]">
                  البريد الإلكتروني
                </p>
                <p
                  className="text-xs text-[var(--color-on-surface-variant)]"
                  dir="ltr"
                >
                  support@opalart.sa
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-[#C5A880]/10 text-[#C5A880] flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-on-surface)]">
                  واتساب
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  متاح عبر زر وتساب الظاهر في التطبيق
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-[#C5A880]/10 text-[#C5A880] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-on-surface)]">
                  ساعات الرد
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  يومياً 9 صباحاً – 9 مساءً
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ الفورم ═══ */}
        <div className="lg:col-span-3">
          {sent ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-2xl">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
                <CheckCircle2
                  className="w-8 h-8 text-emerald-600"
                  strokeWidth={1.5}
                />
              </div>
              <h2 className="font-display text-xl font-bold text-[var(--color-on-surface)] mb-2">
                وصلتنا رسالتك
              </h2>
              <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed mb-6 max-w-sm">
                شكراً لتواصلك مع أوبال جاليري — سيرد عليك الفريق خلال 24 ساعة
                عمل على بريدك الإلكتروني.
              </p>

              {ticketId && (
                <div className="mb-6 w-full max-w-xs">
                  <p className="text-[11px] font-semibold text-[var(--color-on-surface-variant)] mb-2">
                    رقم التذكرة — احتفظ به للمتابعة
                  </p>
                  <div className="flex items-center gap-2 bg-[var(--color-surface-container-low)] border border-[var(--color-primary)]/30 rounded-xl p-3">
                    <span
                      className="flex-1 text-center font-mono text-lg font-bold text-[var(--color-primary)] tracking-widest select-all"
                      dir="ltr"
                    >
                      #{ticketId.slice(-6).toUpperCase()}
                    </span>
                    <button
                      onClick={copyTicket}
                      className="p-2 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors shrink-0 cursor-pointer"
                      title="نسخ رقم التذكرة"
                    >
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--color-on-surface-variant)]/70 mt-2">
                    احتفظ بالرقم ده لمتابعة حالة رسالتك مع فريق الدعم
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSent(false);
                  setTicketId(null);
                  setForm({ ...form, message: "" });
                }}
              >
                إرسال رسالة أخرى
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="p-7 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-lg space-y-5"
            >
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-on-surface-variant)] mb-2">
                    الاسم
                  </label>
                  <input
                    value={form.name}
                    onChange={set("name")}
                    disabled={isAuthenticated}
                    className="w-full p-3 text-sm bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/60 rounded-lg focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-on-surface)] disabled:opacity-60"
                    placeholder="اسمك الكريم"
                  />
                  {errors.name && (
                    <p className="text-[11px] text-red-600 mt-1">
                      {errors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-on-surface-variant)] mb-2">
                    البريد الإلكتروني
                  </label>
                  <input
                    value={form.email}
                    onChange={set("email")}
                    disabled={isAuthenticated}
                    dir="ltr"
                    className="w-full p-3 text-sm bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/60 rounded-lg focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-on-surface)] text-right disabled:opacity-60"
                    placeholder="you@example.com"
                  />
                  {errors.email && (
                    <p className="text-[11px] text-red-600 mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-on-surface-variant)] mb-2">
                  الموضوع
                </label>
                <select
                  value={form.topic}
                  onChange={set("topic")}
                  className="w-full p-3 text-sm bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/60 rounded-lg focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-on-surface)]"
                >
                  {TOPICS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-[var(--color-on-surface-variant)]">
                    رسالتك
                  </label>
                  <span className="text-[11px] font-mono text-[var(--color-on-surface-variant)]">
                    {form.message.length}/2000
                  </span>
                </div>
                <textarea
                  rows={6}
                  maxLength={2000}
                  value={form.message}
                  onChange={set("message")}
                  className="w-full p-3 text-sm bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/60 rounded-lg focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-on-surface)] resize-none"
                  placeholder="اكتب تفاصيل استفسارك هنا..."
                />
                {errors.message && (
                  <p className="text-[11px] text-red-600 mt-1">
                    {errors.message}
                  </p>
                )}
              </div>

              <Button
                variant="primary"
                size="md"
                type="submit"
                icon={Send}
                iconPosition="end"
                disable={mutation.isPending}
                isLoading={mutation.isPending}
                className="w-full"
              >
                إرسال الرسالة
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
