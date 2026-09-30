import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "../../../services/toast.service";
import {
  Image as ImageIcon,
  Search,
  CheckCircle2,
  Eye,
  Trash2,
  ShieldAlert,
  Clock,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { adminService } from "../services/admin.service";
import { getMediaUrl } from "../../../utils/media";
import { SharedModal, ModalActions } from "../../../components/SharedModal";

const fmt = (v) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v || 0);

// ═══ Status Meta ═══
const STATUS_META = {
  pending: {
    label: "قيد المراجعة",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  approved: {
    label: "منشورة",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  inactive: {
    label: "موقوفة (بالفنان)",
    color: "bg-stone-50 text-stone-700 border-stone-200",
    icon: XCircle,
  },
  rejected: {
    label: "مرفوضة",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
  suspended: {
    label: "موقوفة (بالأدمن)",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    icon: ShieldAlert,
  },
  sold: {
    label: "مباعة",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: CheckCircle2,
  },
};

const getDisplayStatus = (a) => {
  if (a.approvalStatus === "PENDING_APPROVAL") return "pending";
  if (a.isSold) return "sold";
  if (a.approvalStatus === "REJECTED") return "rejected";
  if (a.approvalStatus === "SUSPENDED") return "suspended";
  if (a.approvalStatus === "APPROVED")
    return a.isActive ? "approved" : "inactive";
  return "inactive";
};

// ═══ Tabs ═══
const TABS = [
  { value: "all", label: "الكل", apiStatus: "all", icon: ImageIcon },
  {
    value: "pending",
    label: "قيد المراجعة",
    apiStatus: "pending",
    icon: Clock,
    highlight: true,
  },
  {
    value: "approved",
    label: "منشورة",
    apiStatus: "active",
    icon: CheckCircle2,
  },
  {
    value: "inactive",
    label: "غير نشطة",
    apiStatus: "inactive",
    icon: XCircle,
  },
  { value: "rejected", label: "مرفوضة", apiStatus: "rejected", icon: XCircle },
  {
    value: "suspended",
    label: "موقوفة",
    apiStatus: "suspended",
    icon: ShieldAlert,
  },
];

export default function AdminArtworksPage() {
  const [tab, setTab] = useState("pending"); 
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ type: null, artwork: null });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const activeTab = TABS.find((t) => t.value === tab) || TABS[1];

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ["adminArtworks", tab, debouncedSearch, page],
    queryFn: () =>
      adminService.getAdminArtworks({
        status: activeTab.apiStatus,
        search: debouncedSearch,
        page,
        limit: 20,
      }),
  });

  const artworks = data?.artworks || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  // Pending count (badge على تاب المراجعة)
  const { data: pendingData } = useQuery({
    queryKey: ["pendingArtworksCount"],
    queryFn: () =>
      adminService.getAdminArtworks({ status: "pending", limit: 1 }),
  });
  const pendingCount = pendingData?.pagination?.total || 0;

  if (isLoading && artworks.length === 0) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="h-8 w-48 bg-surface-container-low rounded animate-pulse" />
          <div className="h-4 w-96 bg-surface-container-low rounded mt-2 animate-pulse" />
        </div>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-on-surface">إدارة اللوحات</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          راجع اللوحات الجديدة، اعتمدها، أو أوقف المخالف منها — أي تعديل جوهري
          من الفنان يعيدها للمراجعة تلقائياً
        </p>
      </div>

      {/* ═══ Tabs + Search ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            const showBadge = t.value === "pending" && pendingCount > 0;
            return (
              <button
                key={t.value}
                onClick={() => {
                  setTab(t.value);
                  setPage(1);
                }}
                className={`px-4 py-1.5 cursor-pointer text-xs font-body font-semibold border transition-premium flex items-center gap-1.5 ${
                  tab === t.value
                    ? t.value === "pending"
                      ? "bg-amber-600 text-white border-amber-600"
                      : t.value === "rejected" || t.value === "suspended"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-primary text-white border-primary"
                    : "bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant hover:border-primary"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {showBadge && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/25 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالعنوان أو اسم الفنان..."
            className="pr-9 pl-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant/40 focus:border-primary focus:outline-none w-64"
          />
        </div>
      </div>

      {/* ═══ Table ═══ */}
      <div className="bg-surface-container-lowest border rounded-lg border-outline-variant/40 overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="text-right text-[10px] font-body font-semibold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/30 bg-surface-container-low/50">
              <th className="p-3">اللوحة</th>
              <th className="p-3">الفنان</th>
              <th className="p-3">السعر</th>
              <th className="p-3">الإحصائيات</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isError ? (
              <tr>
                <td colSpan={6} className="p-16 text-center">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-600" />
                  <p className="text-sm text-red-600">
                    حدث خطأ أثناء جلب اللوحات
                  </p>
                </td>
              </tr>
            ) : (
              !isLoading &&
              artworks.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <ImageIcon className="w-10 h-10 mx-auto mb-3 text-on-surface-variant/30" />
                    <p className="text-sm text-on-surface-variant">
                      {tab === "pending"
                        ? "لا توجد لوحات بانتظار المراجعة"
                        : "لا توجد لوحات في هذا التصنيف"}
                    </p>
                  </td>
                </tr>
              )
            )}

            {!isLoading &&
              artworks.map((a) => {
                const statusKey = getDisplayStatus(a);
                const meta = STATUS_META[statusKey];
                const StatusIcon = meta.icon;
                return (
                  <tr
                    key={a._id}
                    className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low/30"
                  >
                    {/* Artwork */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getMediaUrl(a.coverImage)}
                          alt={a.title}
                          className="w-14 h-14 object-cover border border-outline-variant/40"
                          crossOrigin="anonymous"
                        />
                        <div className="min-w-0 max-w-[220px]">
                          <p className="font-medium text-on-surface truncate">
                            {a.title}
                          </p>
                          <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">
                            {a.category}
                          </p>
                          <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
                            {new Date(a.createdAt).toLocaleDateString("ar-EG")}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Artist */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            a.artist?.avatar
                              ? getMediaUrl(a.artist.avatar)
                              : `https://ui-avatars.com/api/?name=${encodeURIComponent(a.artist?.name || "?")}&background=eee&color=666`
                          }
                          className="w-8 h-8 rounded-full object-cover"
                          crossOrigin="anonymous"
                        />
                        <div>
                          <p className="text-xs font-medium text-on-surface">
                            {a.artist?.name || "غير معروف"}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">
                            {a.artist?.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="p-3">
                      <span className="font-semibold text-on-surface">
                        {fmt(a.price)}
                      </span>
                      <span className="text-[10px] text-on-surface-variant mr-1">
                        ر.س
                      </span>
                    </td>

                    {/* Stats */}
                    <td className="p-3">
                      <div className="text-xs space-y-0.5">
                        <p className="text-on-surface-variant">
                          مشاهدات:{" "}
                          <strong className="text-on-surface">
                            {fmt(a.viewsCount)}
                          </strong>
                        </p>
                        <button className="text-on-surface-variant">
                          طلبات ناجحه :{" "}
                          <strong className="text-on-surface">
                            {a.stats?.ordersCount || 0}
                          </strong>
                        </button>
                        <button
                          onClick={() =>
                            setModal({ type: "orderHistory", artwork: a })
                          }
                          className="mr-2 cursor-pointer text-on-surface-variant hover:text-primary underline decoration-dotted"
                        >
                          تاريخ الطلبات كامله
                        </button>
                        {a.stats?.totalRevenue > 0 && (
                          <p className="text-emerald-600 font-semibold">
                            {fmt(a.stats.totalRevenue)} ر.س
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border ${meta.color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        {a.adminNote &&
                          (statusKey === "rejected" ||
                            statusKey === "suspended") && (
                            <p
                              className="text-[10px] text-red-600 mt-1 max-w-[140px] truncate"
                              title={a.adminNote}
                            >
                              {a.adminNote}
                            </p>
                          )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setModal({ type: "view", artwork: a })}
                          title="عرض التفاصيل"
                          className="p-1.5 text-on-surface-variant hover:text-primary border border-outline-variant/40 hover:border-primary transition-premium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {statusKey === "pending" && (
                          <>
                            <button
                              onClick={() =>
                                setModal({ type: "approve", artwork: a })
                              }
                              title="اعتماد"
                              className="p-1.5 text-emerald-600 border border-emerald-200 hover:bg-emerald-50 transition-premium"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                setModal({ type: "reject", artwork: a })
                              }
                              title="رفض"
                              className="p-1.5 text-red-600 border border-red-200 hover:bg-red-50 transition-premium"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {statusKey === "approved" && (
                          <button
                            onClick={() =>
                              setModal({ type: "suspend", artwork: a })
                            }
                            title="إيقاف"
                            className="p-1.5 text-rose-600 border border-rose-200 hover:bg-rose-50 transition-premium"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {statusKey === "suspended" && (
                          <button
                            onClick={() =>
                              setModal({ type: "unsuspend", artwork: a })
                            }
                            title="فك الإيقاف"
                            className="p-1.5 text-emerald-600 border border-emerald-200 hover:bg-emerald-50 transition-premium"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {statusKey === "rejected" && (
                          <button
                            onClick={() =>
                              setModal({ type: "approve", artwork: a })
                            }
                            title="إعادة اعتماد"
                            className="p-1.5 text-emerald-600 border border-emerald-200 hover:bg-emerald-50 transition-premium"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() =>
                            setModal({ type: "delete", artwork: a })
                          }
                          title={
                            a.canHardDelete ? "حذف نهائي" : "إيقاف (لها طلبات)"
                          }
                          className="p-1.5 text-red-600 border border-red-200 hover:bg-red-50 transition-premium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* ═══ Pagination ═══ */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-3">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-xs border border-outline-variant/40 disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-sm self-center text-on-surface-variant">
            {page} / {pagination.pages}
          </span>
          <button
            disabled={page === pagination.pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-xs border border-outline-variant/40 disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}

      {/* ═══ Modals ═══ */}
      <ActionModal
        modal={modal}
        onClose={() => setModal({ type: null, artwork: null })}
        onSuccess={() => {
          refetch();
          setModal({ type: null, artwork: null });
        }}
      />
    </div>
  );
}

// ═══ Loading Skeleton ═══
function LoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* ═══ Tabs + Search ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 6 Tabs */}
        <div className="flex gap-1 flex-wrap">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-surface-container-lowest border border-outline-variant/40 rounded"
            >
              <div className="w-3.5 h-3.5 bg-surface-container-low rounded" />
              <div className="h-4 w-16 bg-surface-container-low rounded" />
            </div>
          ))}
        </div>
        {/* Search Input */}
        <div className="relative">
          <div className="pr-9 pl-3 py-2 w-64 bg-surface-container-lowest border border-outline-variant/40 rounded">
            <div className="h-4 w-40 bg-surface-container-low rounded" />
          </div>
        </div>
      </div>

      {/* ═══ Table ═══ */}
      <div className="bg-surface-container-lowest border rounded-lg border-outline-variant/40 overflow-x-auto">
        <div className="w-full min-w-[960px]">
          {/* Table Header */}
          <div className="flex border-b border-outline-variant/30 bg-surface-container-low/50">
            {[
              "اللوحة",
              "الفنان",
              "السعر",
              "الإحصائيات",
              "الحالة",
              "إجراءات",
            ].map((label, i) => (
              <div key={i} className="flex-1 p-3">
                <div className="h-3 w-16 bg-surface-container-low rounded" />
              </div>
            ))}
          </div>
          {/* Table Rows */}
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex border-b border-outline-variant/20 last:border-0"
            >
              {/* اللوحة: صورة + معلومات */}
              <div className="flex-1 p-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-surface-container-low rounded shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-4 w-40 bg-surface-container-low rounded" />
                    <div className="h-2.5 w-24 bg-surface-container-low rounded" />
                    <div className="h-2.5 w-20 bg-surface-container-low rounded" />
                  </div>
                </div>
              </div>
              {/* الفنان: avatar + معلومات */}
              <div className="flex-1 p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-surface-container-low rounded-full shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 bg-surface-container-low rounded" />
                    <div className="h-2.5 w-36 bg-surface-container-low rounded" />
                  </div>
                </div>
              </div>
              {/* السعر */}
              <div className="flex-1 p-3">
                <div className="h-4 w-16 bg-surface-container-low rounded" />
              </div>
              {/* الإحصائيات: 3 سطور */}
              <div className="flex-1 p-3 space-y-1">
                <div className="h-3 w-24 bg-surface-container-low rounded" />
                <div className="h-3 w-20 bg-surface-container-low rounded" />
                <div className="h-3 w-24 bg-surface-container-low rounded" />
              </div>
              {/* الحالة: badge */}
              <div className="flex-1 p-3">
                <div className="h-5 w-24 bg-surface-container-low rounded" />
              </div>
              {/* إجراءات: 3 أزرار */}
              <div className="flex-1 p-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 bg-surface-container-low rounded" />
                  <div className="w-7 h-7 bg-surface-container-low rounded" />
                  <div className="w-7 h-7 bg-surface-container-low rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Pagination ═══ */}
      <div className="flex justify-center gap-3">
        <div className="px-4 py-2">
          <div className="h-4 w-12 bg-surface-container-low rounded" />
        </div>
        <div className="self-center">
          <div className="h-4 w-16 bg-surface-container-low rounded" />
        </div>
        <div className="px-4 py-2">
          <div className="h-4 w-12 bg-surface-container-low rounded" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Action Modal (handles all action types)
// ═══════════════════════════════════════════════════
function ActionModal({ modal, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  // Reset reason when modal closes/changes
  useEffect(() => {
    setReason("");
  }, [modal.artwork?._id, modal.type]);

  const approve = useMutation({
    mutationFn: () => adminService.approveArtwork(modal.artwork._id),
    onSuccess: () => {
      toast.success(`تم اعتماد "${modal.artwork.title}"`);
      queryClient.invalidateQueries({ queryKey: ["adminArtworks"] });
      queryClient.invalidateQueries({ queryKey: ["pendingArtworksCount"] });
      onSuccess();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const reject = useMutation({
    mutationFn: () => adminService.rejectArtwork(modal.artwork._id, reason),
    onSuccess: () => {
      toast.success(` تم رفض "${modal.artwork.title}"`);
      queryClient.invalidateQueries({ queryKey: ["adminArtworks"] });
      queryClient.invalidateQueries({ queryKey: ["pendingArtworksCount"] });
      onSuccess();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const suspend = useMutation({
    mutationFn: () => adminService.suspendArtwork(modal.artwork._id, reason),
    onSuccess: () => {
      toast.success(`تم إيقاف "${modal.artwork.title}"`);
      queryClient.invalidateQueries({ queryKey: ["adminArtworks"] });
      onSuccess();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const unsuspend = useMutation({
    mutationFn: () => adminService.unsuspendArtwork(modal.artwork._id),
    onSuccess: () => {
      toast.success(` تم إعادة تفعيل "${modal.artwork.title}"`);
      queryClient.invalidateQueries({ queryKey: ["adminArtworks"] });
      onSuccess();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminService.deleteArtwork(modal.artwork._id),
    onSuccess: (res) => {
      toast.success(
        res?.deactivated
          ? `تم إيقاف "${modal.artwork.title}" — لها طلبات مرتبطة`
          : `🗑 تم حذف "${modal.artwork.title}" نهائياً`,
      );
      queryClient.invalidateQueries({ queryKey: ["adminArtworks"] });
      onSuccess();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const isOpen = !!modal.artwork;
  const artwork = modal.artwork;

  // ═══ Dynamic Config حسب الـ type ═══
  const getModalConfig = () => {
    if (!modal.type || !artwork) return {};

    switch (modal.type) {
      case "view":
        return {
          title: "تفاصيل اللوحة",
          icon: Eye,
          iconColor: "text-primary",
          size: "xl",
        };
      case "approve":
        return {
          title: "اعتماد اللوحة",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
          size: "md",
        };
      case "reject":
        return {
          title: "رفض اللوحة",
          icon: XCircle,
          iconColor: "text-red-600",
          size: "md",
        };
      case "suspend":
        return {
          title: "إيقاف اللوحة",
          icon: ShieldAlert,
          iconColor: "text-rose-600",
          size: "md",
        };
      case "unsuspend":
        return {
          title: "فك إيقاف اللوحة",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
          size: "md",
        };
      case "delete":
        return {
          title: artwork.canHardDelete ? "حذف اللوحة نهائياً" : "إيقاف اللوحة",
          icon: Trash2,
          iconColor: "text-red-600",
          size: "md",
        };
      case "orderHistory":
        return {
          title: "سجل الطلبات",
          icon: Clock,
          iconColor: "text-primary",
          size: "lg",
        };
      default:
        return { title: "عملية", size: "md" };
    }
  };

  const config = getModalConfig();

  return (
    <SharedModal
      open={isOpen}
      onClose={onClose}
      title={config.title}
      icon={config.icon}
      iconColor={config.iconColor}
      size={config.size}
    >
      {/* ─── VIEW MODE ─── */}
      {modal.type === "view" && artwork && (
        <ViewContent artwork={artwork} onClose={onClose} />
      )}

      {modal.type === "orderHistory" && artwork && (
        <OrderHistoryContent artwork={artwork} onClose={onClose} />
      )}

      {/* ─── APPROVE MODE ─── */}
      {modal.type === "approve" && artwork && (
        <>
          <ArtworkSummary artwork={artwork} />
          <p className="text-sm text-on-surface-variant mt-4">
            بتأكيدك، اللوحة هتظهر فوراً في المعرض لكل الزوار.
          </p>
          <ModalActions
            onClose={onClose}
            onConfirm={() => approve.mutate()}
            confirmLabel="اعتماد ونشر"
            confirmVariant="success"
            isLoading={approve.isPending}
          />
        </>
      )}

      {/* ─── REJECT MODE ─── */}
      {modal.type === "reject" && artwork && (
        <>
          <ArtworkSummary artwork={artwork} />
          <label className="text-xs font-semibold text-on-surface-variant block mt-4 mb-1">
            سبب الرفض *{" "}
            <span className="text-on-surface-variant/60">(هيظهر للفنان)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: الصورة غير واضحة، اللوحة منسوخة، مخالف للسياسات..."
            rows={3}
            className="w-full p-3 text-sm bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:outline-none resize-none"
          />
          <ModalActions
            onClose={onClose}
            onConfirm={() => reject.mutate()}
            confirmLabel="تأكيد الرفض"
            confirmVariant="danger"
            isLoading={reject.isPending}
            disabled={!reason.trim()}
          />
        </>
      )}

      {/* ─── SUSPEND MODE ─── */}
      {modal.type === "suspend" && artwork && (
        <>
          <ArtworkSummary artwork={artwork} />
          <label className="text-xs font-semibold text-on-surface-variant block mt-4 mb-1">
            سبب الإيقاف *{" "}
            <span className="text-on-surface-variant/60">(هيظهر للفنان)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: بلاغ من مشترى، مخالفة حقوق ملكية..."
            rows={3}
            className="w-full p-3 text-sm bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:outline-none resize-none"
          />
          {artwork.stats?.ordersCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-2.5 mt-3 text-xs text-amber-800">
              اللوحة عليها <strong>{artwork.stats.ordersCount}</strong> طلب —
              الإيقاف هيخفيها من المعرض بس الطلبات القائمة مش هتتأثر
            </div>
          )}
          <ModalActions
            onClose={onClose}
            onConfirm={() => suspend.mutate()}
            confirmLabel="تأكيد الإيقاف"
            confirmVariant="danger"
            isLoading={suspend.isPending}
            disabled={!reason.trim()}
          />
        </>
      )}

      {/* ─── UNSUSPEND MODE ─── */}
      {modal.type === "unsuspend" && artwork && (
        <>
          <ArtworkSummary artwork={artwork} />
          {artwork.adminNote && (
            <div className="bg-rose-50 border border-rose-200 p-2.5 mt-4 text-xs">
              <p className="font-semibold text-rose-700 mb-1">
                سبب الإيقاف السابق:
              </p>
              <p className="text-rose-800">{artwork.adminNote}</p>
            </div>
          )}
          <p className="text-sm text-on-surface-variant mt-4">
            بتأكيدك، اللوحة هترجع تظهر في المعرض فوراً.
          </p>
          <ModalActions
            onClose={onClose}
            onConfirm={() => unsuspend.mutate()}
            confirmLabel=" فك الإيقاف"
            confirmVariant="success"
            isLoading={unsuspend.isPending}
          />
        </>
      )}

      {/* ─── DELETE MODE ─── */}
      {modal.type === "delete" && artwork && (
        <>
          <ArtworkSummary artwork={artwork} />
          {artwork.canHardDelete ? (
            <div className="bg-red-50 border border-red-200 p-3 mt-4 text-xs text-red-800 space-y-1">
              <p className="font-semibold">⚠️ تحذير:</p>
              <p>الحذف نهائي ومش قابل للتراجع.</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-3 mt-4 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">
                ⚠️ اللوحة عليها {artwork.stats?.ordersCount || 0} طلب:
              </p>
              <p>الحذف النهائي مش متاح — هتتوقف فقط من المعرض.</p>
              <p>تفاصيل الطلبات التاريخية هتفضل محفوظة.</p>
            </div>
          )}
          <ModalActions
            onClose={onClose}
            onConfirm={() => deleteMutation.mutate()}
            confirmLabel={artwork.canHardDelete ? "حذف نهائي" : "إيقاف"}
            confirmVariant="danger"
            isLoading={deleteMutation.isPending}
          />
        </>
      )}
    </SharedModal>
  );
}

// ═══ Artwork Summary Card (في كل الـ modals) ═══
function ArtworkSummary({ artwork }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/40 p-3 flex gap-3">
      <img
        src={getMediaUrl(artwork.coverImage)}
        alt={artwork.title}
        className="w-16 h-16 object-cover border border-outline-variant/40 shrink-0"
        crossOrigin="anonymous"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-on-surface truncate">
          {artwork.title}
        </p>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {artwork.artist?.name}
        </p>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {fmt(artwork.price)} ر.س · {artwork.category}
        </p>
      </div>
    </div>
  );
}

// ═══ View Content (التفاصيل الكاملة) ═══
function ViewContent({ artwork, onClose }) {
  return (
    <>
      {/* Images gallery */}
      <div className="space-y-3">
        <div className="h-56 bg-surface-container-low border border-outline-variant/40 overflow-hidden">
          <img
            src={getMediaUrl(artwork.coverImage)}
            alt={artwork.title}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
        </div>

        {artwork.images?.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {artwork.images.slice(1).map((img, i) => (
              <img
                key={i}
                src={getMediaUrl(img.url)}
                alt=""
                className="aspect-square object-cover border border-outline-variant/40"
                crossOrigin="anonymous"
              />
            ))}
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <InfoRow label="العنوان" value={artwork.title} />
        <InfoRow label="الفنان" value={artwork.artist?.name} />
        <InfoRow label="السعر" value={`${fmt(artwork.price)} ر.س`} />
        <InfoRow label="التصنيف" value={artwork.category} />
        <InfoRow
          label="الأبعاد"
          value={`${artwork.dimensions?.width}×${artwork.dimensions?.height} سم`}
        />
        <InfoRow label="الوزن" value={`${artwork.weight} كجم`} />
        <InfoRow
          label="نوع الشحن"
          value={artwork.shippingType === "giant" ? "كبير" : "عادي"}
        />
        <InfoRow label="المشاهدات" value={fmt(artwork.viewsCount)} />
        <InfoRow label="المفضلات" value={fmt(artwork.favoritesCount)} />
        <InfoRow label="الطلبات" value={artwork.stats?.ordersCount || 0} />
        <InfoRow
          label="الإيرادات"
          value={`${fmt(artwork.stats?.totalRevenue || 0)} ر.س`}
          highlight
        />
        <InfoRow
          label="تاريخ النشر"
          value={new Date(artwork.createdAt).toLocaleDateString("ar-EG")}
        />
      </div>

      {artwork.description && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-on-surface-variant mb-1">
            الوصف
          </p>
          <p className="text-sm text-on-surface bg-surface-container-low p-3 border border-outline-variant/40 leading-relaxed">
            {artwork.description}
          </p>
        </div>
      )}

      {artwork.adminNote && (
        <div className="mt-4 bg-rose-50 border border-rose-200 p-3">
          <p className="text-xs font-semibold text-rose-700 mb-1">
            ملاحظة الأدمن:
          </p>
          <p className="text-sm text-rose-800">{artwork.adminNote}</p>
        </div>
      )}

      <button
        onClick={onClose}
        className="mt-5 w-full py-2.5 text-sm font-semibold border border-outline-variant/40 hover:bg-surface-container-low"
      >
        إغلاق
      </button>
    </>
  );
}

// ═══ Order History Content ═══
const ORDER_STATUS_META = {
  PENDING_PAYMENT: {
    label: "بانتظار الدفع",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PAID: { label: "مدفوع", color: "bg-blue-50 text-blue-700 border-blue-200" },
  PROCESSING: {
    label: "قيد التجهيز",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  SHIPPED: {
    label: "تم الشحن",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  DELIVERED: {
    label: "تم التوصيل",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  COMPLETED: {
    label: "مكتمل",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  CANCELLED: {
    label: "ملغي",
    color: "bg-stone-50 text-stone-700 border-stone-200",
  },
  DISPUTED: { label: "نزاع", color: "bg-red-50 text-red-700 border-red-200" },
  RETURNED: {
    label: "مرتجع",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  REFUNDED: { label: "مسترجع", color: "bg-red-50 text-red-700 border-red-200" },
};

function OrderHistoryContent({ artwork, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["artworkOrderHistory", artwork._id],
    queryFn: () => adminService.getArtworkOrderHistory(artwork._id),
  });

  const orders = data?.orders || [];

  return (
    <>
      <ArtworkSummary artwork={artwork} />

      <div className="mt-4 max-h-96 overflow-y-auto space-y-2">
        {isLoading && (
          <p className="text-sm text-on-surface-variant text-center py-8">
            جاري التحميل...
          </p>
        )}

        {!isLoading && orders.length === 0 && (
          <p className="text-sm text-on-surface-variant text-center py-8">
            لا توجد طلبات لهذه اللوحة
          </p>
        )}

        {!isLoading &&
          orders.map((o) => {
            const meta = ORDER_STATUS_META[o.status] || {
              label: o.status,
              color: "bg-stone-50 text-stone-700 border-stone-200",
            };
            return (
              <div
                key={o._id}
                className="border border-outline-variant/40 p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex px-2 py-0.5 font-semibold border ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-on-surface-variant">
                    {new Date(o.createdAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>
                <p className="text-on-surface-variant">
                  المشتري:{" "}
                  <strong className="text-on-surface">
                    {o.buyer?.name || "—"}
                  </strong>
                </p>
                <p className="text-on-surface-variant">
                  الإجمالي:{" "}
                  <strong className="text-on-surface">
                    {fmt(o.totalAmount)} ر.س
                  </strong>
                </p>
                {o.cancellationReason && (
                  <p className="text-red-600">
                    سبب الإلغاء:{" "}
                    {o.cancellationReason === "expired_pending_order"
                      ? "انتهت صلاحية الفاتورة قبل الدفع"
                      : o.cancellationReason}
                  </p>
                )}
              </div>
            );
          })}
      </div>

      <button
        onClick={onClose}
        className="mt-5 w-full py-2.5 text-sm font-semibold border border-outline-variant/40 hover:bg-surface-container-low"
      >
        إغلاق
      </button>
    </>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="bg-surface-container-low/50 p-2.5 border border-outline-variant/30">
      <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`text-sm mt-0.5 ${
          highlight ? "font-bold text-primary" : "font-medium text-on-surface"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}
