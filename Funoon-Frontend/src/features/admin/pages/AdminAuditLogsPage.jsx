import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  Search,
  Eye,
  Calendar,
  ArrowLeft,
  UserX,
  UserCheck,
  CircleCheck,
  CircleX,
  Banknote,
  ShieldCheck,
  ShieldX,
  Pause,
  Play,
  ArrowUpCircle,
  ImagePlus,
  ImageOff,
  PauseCircle,
  PlayCircle,
  Trash2,
  XCircle,
  User,
  ShoppingCart,
  Wallet,
  Landmark,
  Palette,
  ToggleLeft,
  AlertTriangle,
} from "lucide-react";
import { adminService } from "../services/admin.service";
import { SharedModal } from "../../../components/SharedModal";

// ═══ Action metadata مع Lucide icons ═══
const ACTION_META = {
  BAN_USER: {
    label: "حظر مستخدم",
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: UserX,
  },
  UNBAN_USER: {
    label: "فك حظر",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: UserCheck,
  },
  CHANGE_USER_ROLE: {
    label: "تغيير دور مستخدم",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: ShieldCheck,
  },

  APPROVE_WITHDRAWAL: {
    label: "موافقة سحب",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: CircleCheck,
  },
  REJECT_WITHDRAWAL: {
    label: "رفض سحب",
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: CircleX,
  },
  MARK_WITHDRAWAL_PAID: {
    label: "تسجيل تحويل",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Banknote,
  },

  VERIFY_BANK: {
    label: "توثيق بنك",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: ShieldCheck,
  },
  REJECT_BANK: {
    label: "رفض بنك",
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: ShieldX,
  },

  HOLD_ORDER: {
    label: "تجميد طلب",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Pause,
  },
  UNHOLD_ORDER: {
    label: "فك تجميد",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Play,
  },
  RELEASE_FUNDS: {
    label: "إطلاق أموال",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: ArrowUpCircle,
  },
  FORCE_CANCEL_ORDER: {
    label: "إلغاء إداري",
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },

  APPROVE_ARTWORK: {
    label: "قبول لوحة",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: ImagePlus,
  },
  REJECT_ARTWORK: {
    label: "رفض لوحة",
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: ImageOff,
  },
  SUSPEND_ARTWORK: {
    label: "تعليق لوحة",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: PauseCircle,
  },
  UNSUSPEND_ARTWORK: {
    label: "فك تعليق لوحة",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: PlayCircle,
  },
  HARD_DELETE_ARTWORK: {
    label: "حذف نهائي",
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: Trash2,
  },
  CREATE_COUPON: {
    label: "إنشاء كوبون",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CircleCheck,
  },
  TOGGLE_COUPON: {
    label: "تفعيل/تعطيل كوبون",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: ToggleLeft,
  },
};

// ═══ Target type colors (للـ badge الجديد) ═══
const TARGET_TYPE_STYLES = {
  user: {
    label: "مستخدم",
    cls: "bg-sky-50 text-sky-700 border-sky-200",
    icon: User,
  },
  order: {
    label: "طلب",
    cls: "bg-violet-50 text-violet-700 border-violet-200",
    icon: ShoppingCart,
  },
  withdrawal: {
    label: "سحب",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Wallet,
  },
  bankAccount: {
    label: "حساب بنكي",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Landmark,
  },
  artwork: {
    label: "لوحة",
    cls: "bg-pink-50 text-pink-700 border-pink-200",
    icon: Palette,
  },
  coupon: {
    label: "كوبون خصم",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CircleCheck,
  },
};

const CATEGORY_TABS = [
  { value: "all", label: "الكل" },
  { value: "ban", label: "الحظر" },
  { value: "roles", label: "الأدوار" },
  { value: "withdrawals", label: "السحوبات" },
  { value: "banks", label: "البنوك" },
  { value: "orders", label: "الطلبات" },
  { value: "artworks", label: "اللوحات" },
  { value: "coupons", label: "الكوبونات" },
];

export default function AdminAuditLogsPage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["auditLogs", category, debouncedSearch, from, to, page],
    queryFn: () =>
      adminService.getAuditLogs({
        category,
        search: debouncedSearch,
        from,
        to,
        page,
        limit: 20,
      }),
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  if (isLoading && logs.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-surface-container-low rounded animate-pulse" />
            <div className="h-8 w-48 bg-surface-container-low rounded animate-pulse" />
          </div>
          <div className="h-4 w-96 bg-surface-container-low rounded mt-2 animate-pulse" />
        </div>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl text-on-surface flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-secondary" />
          سجل العمليات
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          توثيق كامل لكل عملية حساسة: مين عملها، إمتى، على مين، وليه
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setCategory(t.value);
                setPage(1);
              }}
              className={`cursor-pointer px-4 py-2 text-center text-xs font-body font-semibold border transition-premium ${
                category === t.value
                  ? "bg-primary text-white border-primary"
                  : "bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant hover:border-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الأدمن..."
            className="pr-9 pl-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant/40 focus:border-primary focus:outline-none w-48"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Calendar className="w-4 h-4" />
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="px-2 py-2 text-xs bg-surface-container-lowest border border-outline-variant/40 focus:outline-none"
          />
          <ArrowLeft className="w-3 h-3" />
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="px-2 py-2 text-xs bg-surface-container-lowest border border-outline-variant/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest border rounded-lg border-outline-variant/40 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-right text-[11px] font-body font-semibold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/30 bg-surface-container-low/50">
              <th className="p-3 w-[130px]">الوقت</th>
              <th className="p-3">الأدمن</th>
              <th className="p-3">العملية</th>
              <th className="p-3">الهدف</th>
              <th className="p-3 w-[60px] text-center">عرض</th>
            </tr>
          </thead>
          <tbody>
            {isError ? (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-600" />
                  <p className="text-sm text-red-600">
                    حدث خطأ أثناء جلب سجلات التدقيق
                  </p>
                </td>
              </tr>
            ) : !isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center">
                  <ScrollText className="w-8 h-8 mx-auto mb-2 text-on-surface-variant/40" />
                  <p className="text-sm text-on-surface-variant">
                    لا توجد عمليات مسجلة
                  </p>
                </td>
              </tr>
            )}

            {logs.map((log) => {
              const actionMeta = ACTION_META[log.action] || {
                label: log.action,
                cls: "bg-stone-100 text-stone-700 border-stone-300",
                icon: ScrollText,
              };
              const ActionIcon = actionMeta.icon;

              const typeStyle = TARGET_TYPE_STYLES[log.targetType] || {
                label: log.targetTypeAr || log.targetType || "—",
                cls: "bg-stone-100 text-stone-700 border-stone-300",
                icon: ScrollText,
              };
              const TypeIcon = typeStyle.icon;

              return (
                <tr
                  key={log._id}
                  className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low/30 transition-colors"
                >
                  {/* الوقت */}
                  <td className="p-3 text-xs text-on-surface-variant whitespace-nowrap tabular-nums">
                    {new Date(log.createdAt).toLocaleString("ar-EG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>

                  {/* الأدمن */}
                  <td className="p-3">
                    <p className="text-on-surface font-medium text-xs truncate max-w-[140px]">
                      {log.admin?.name || "—"}
                    </p>
                  </td>

                  {/* العملية */}
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold border ${actionMeta.cls}`}
                    >
                      <ActionIcon className="w-3 h-3" />
                      {actionMeta.label}
                    </span>
                  </td>

                  {/* الهدف: badge type + label */}
                  {/* الهدف: badge type + سطرين (label + meta) */}
                  <td className="p-3" dir="rtl">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold border shrink-0 ${typeStyle.cls}`}
                      >
                        <TypeIcon className="w-2.5 h-2.5" />
                        {typeStyle.label}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-on-surface font-medium truncate max-w-[180px]">
                          {log.targetLabel}
                        </span>
                        {log.targetMeta && (
                          <span
                            dir="auto"
                            className="text-[11px] text-on-surface-variant truncate max-w-[180px]"
                          >
                            {log.targetMeta}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* عرض */}
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSelected(log)}
                      title="التفاصيل"
                      className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-xs border border-outline-variant/40 disabled:opacity-40 hover:bg-surface-container-low transition-colors"
          >
            السابق
          </button>
          <span className="text-sm text-on-surface-variant tabular-nums">
            {page} / {pagination.pages}
          </span>
          <button
            disabled={page === pagination.pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-xs border border-outline-variant/40 disabled:opacity-40 hover:bg-surface-container-low transition-colors"
          >
            التالي
          </button>
        </div>
      )}

      <DetailsModal log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// ═══ Loading Skeleton ═══
function LoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="px-4 py-2.5 bg-surface-container-lowest border rounded-lg border-outline-variant/40"
            >
              <div className="h-4 w-20 bg-surface-container-low" />
            </div>
          ))}
        </div>

        <div className="pr-9 pl-3 py-2 w-48 bg-surface-container-lowest border border-outline-variant/40">
          <div className="h-4 w-28 bg-surface-container-low" />
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/40 overflow-x-auto">
        <div className="w-full min-w-[820px]">
          <div className="flex border-b border-outline-variant/30 bg-surface-container-low/50">
            {["الوقت", "الأدمن", "العملية", "الهدف", "عرض"].map((label, i) => (
              <div key={i} className="flex-1 p-3">
                <div className="h-3 w-14 bg-surface-container-low" />
              </div>
            ))}
          </div>
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex border-b border-outline-variant/20 last:border-0"
            >
              <div className="flex-1 p-3">
                <div className="h-3 w-32 bg-surface-container-low" />
              </div>
              <div className="flex-1 p-3">
                <div className="h-3 w-24 bg-surface-container-low" />
              </div>
              <div className="flex-1 p-3">
                <div className="h-6 w-24 bg-surface-container-low" />
              </div>
              <div className="flex-1 p-3">
                <div className="h-3 w-40 bg-surface-container-low" />
              </div>
              <div className="flex-1 p-3">
                <div className="w-7 h-7 bg-surface-container-low" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <div className="px-4 py-2">
          <div className="h-4 w-12 bg-surface-container-low" />
        </div>
        <div className="self-center">
          <div className="h-4 w-16 bg-surface-container-low" />
        </div>
        <div className="px-4 py-2">
          <div className="h-4 w-12 bg-surface-container-low" />
        </div>
      </div>
    </div>
  );
}

// ═══ Details Modal ═══
function DetailsModal({ log, onClose }) {
  if (!log) return null;

  const actionMeta = ACTION_META[log.action] || {
    label: log.action,
    cls: "bg-stone-100 text-stone-700 border-stone-300",
    icon: ScrollText,
  };
  const ActionIcon = actionMeta.icon;

  const typeStyle = TARGET_TYPE_STYLES[log.targetType] || {
    label: log.targetTypeAr || log.targetType || "—",
    cls: "bg-stone-100 text-stone-700 border-stone-300",
    icon: ScrollText,
  };
  const TypeIcon = typeStyle.icon;

  return (
    <SharedModal
      open={!!log}
      onClose={onClose}
      title="تفاصيل العملية"
      icon={ScrollText}
      iconColor="text-secondary"
      size="md"
    >
      <div className="space-y-4 text-sm">
        {/* العملية */}
        <div className="flex justify-between items-center">
          <span className="text-on-surface-variant text-xs">العملية</span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold border ${actionMeta.cls}`}
          >
            <ActionIcon className="w-3.5 h-3.5" />
            {actionMeta.label}
          </span>
        </div>

        {/* الأدمن */}
        <div className="flex justify-between items-center">
          <span className="text-on-surface-variant text-xs">الأدمن</span>
          <span className="font-semibold text-on-surface">
            {log.admin?.name || "—"}
          </span>
        </div>

        {/* الهدف */}
        {/* الهدف */}
        <div className="flex justify-between items-start gap-3">
          <span className="text-on-surface-variant text-xs shrink-0">
            الهدف
          </span>
          <div className="flex flex-col items-end gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold border shrink-0 ${typeStyle.cls}`}
              >
                <TypeIcon className="w-2.5 h-2.5" />
                {typeStyle.label}
              </span>
              <span dir="auto" className="text-on-surface font-medium">
                {log.targetLabel}
              </span>
            </div>
            {log.targetMeta && (
              <span dir="auto" className="text-xs text-on-surface-variant">
                {log.targetMeta}
              </span>
            )}
          </div>
        </div>
        {/* الوقت */}
        <div className="flex justify-between items-center">
          <span className="text-on-surface-variant text-xs">الوقت</span>
          <span className="text-on-surface tabular-nums">
            {new Date(log.createdAt).toLocaleString("ar-EG")}
          </span>
        </div>

        {/* IP */}
        {log.ip && (
          <div className="flex justify-between items-center">
            <span className="text-on-surface-variant text-xs">IP</span>
            <span
              className="font-mono text-xs text-on-surface-variant"
              dir="ltr"
            >
              {log.ip}
            </span>
          </div>
        )}

        {/* التفاصيل */}
        {log.details && Object.keys(log.details).length > 0 && (
          <div className="bg-surface-container-low/50 border border-outline-variant/30 p-3 mt-2">
            <p className="text-xs font-semibold text-on-surface-variant mb-2">
              التفاصيل
            </p>
            <div className="space-y-1.5">
              {Object.entries(log.details).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 text-xs">
                  <span className="text-on-surface-variant shrink-0">
                    {key}
                  </span>
                  <span
                    className="text-on-surface font-medium text-left break-all"
                    dir="auto"
                  >
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full mt-4 py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low transition-premium"
      >
        إغلاق
      </button>
    </SharedModal>
  );
}
