import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Search,
  Snowflake,
  Unlock,
  Eye,
  MapPin,
  Banknote,
  Loader2,
  Zap,
  XCircle, // ✅ جديد
} from "lucide-react";
import { adminService } from "../services/admin.service";
import { SharedModal, ModalActions } from "../../../components/SharedModal";
import { getCancellationMessage } from "../../../utils/cancellationReasons";
import RefundBadge from "../../../components/Ui/RefundBadge";
const fmt = (v) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v || 0);
// ═══ Mapping للأسباب بالعربي ═══
// const CANCELLATION_REASONS_AR = {
//   buyer_banned_during_checkout:
//     "أُلغي الطلب لحظر حساب المشتري أثناء إتمام الدفع",
//   artist_banned_during_checkout:
//     "أُلغي الطلب لحظر حساب الفنان أثناء إتمام الدفع",
//   artwork_sold_to_another_buyer: "اللوحة بِيعت لمشترٍ آخر قبل اكتمال الدفع",
//   expired_pending_order: "انتهت مهلة الدفع (15 دقيقة) دون إتمام",
//   expired_jit_cleanup: "أُلغي تلقائياً لتنظيف طلبات قديمة",
//   superseded_by_new_checkout: "أُنشئ طلب جديد لنفس اللوحات",
// };

// function getCancellationMessage(order) {
//   const reason = order.cancellationReason;
//   if (!reason) return null;

//   // Admin cancellation — السبب في adminOverrideReason
//   if (reason.startsWith("إلغاء بواسطة الإدارة")) {
//     return {
//       ar: `إلغاء بواسطة الإدارة: ${order.adminOverrideReason || "بدون سبب"}`,
//       showRefund: true,
//     };
//   }

//   // Auto cancellation with artwork name
//   if (reason.startsWith("auto_cancelled: artwork")) {
//     return {
//       ar: "اللوحة بِيعت لمشترٍ آخر — تم الاسترداد",
//       showRefund: true,
//     };
//   }

//   return {
//     ar: CANCELLATION_REASONS_AR[reason] || reason,
//     showRefund: order.payment?.paidAt || order.payment?.paymentId,
//   };
// }

// // ═══ Refund Badge Component ═══
// function RefundBadge({ order }) {
//   const wasPaid = order.payment?.paidAt || order.payment?.paymentId;
//   if (!wasPaid) return null; // مفيش دفع → مفيش badge

//   const status = order.refundStatus;

//   if (status === "REFUNDED" || status === "COMPLETED") {
//     return (
//       <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded">
//         <svg
//           className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
//           fill="none"
//           viewBox="0 0 24 24"
//           stroke="currentColor"
//           strokeWidth={2.5}
//         >
//           <path
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             d="M5 13l4 4L19 7"
//           />
//         </svg>
//         <div>
//           <p className="text-xs font-bold text-emerald-800">
//             تم استرداد المبلغ بالكامل
//           </p>
//           {order.refundedAmount && (
//             <p className="text-[10px] text-emerald-700 mt-0.5">
//               {fmt(order.refundedAmount)} ر.س
//               {order.refundedAt &&
//                 ` · ${new Date(order.refundedAt).toLocaleDateString("ar-SA")}`}
//             </p>
//           )}
//         </div>
//       </div>
//     );
//   }

//   if (status === "FAILED") {
//     return (
//       <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded">
//         <svg
//           className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
//           fill="none"
//           viewBox="0 0 24 24"
//           stroke="currentColor"
//           strokeWidth={2.5}
//         >
//           <path
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
//           />
//         </svg>
//         <div>
//           <p className="text-xs font-bold text-red-800">
//             فشل الاسترداد — يُعالج يدوياً
//           </p>
//           <p className="text-[10px] text-red-700 mt-0.5">
//             تواصل مع الدعم لإتمام الاسترداد
//           </p>
//         </div>
//       </div>
//     );
//   }

//   // PENDING or NONE (with payment)
//   return (
//     <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded">
//       <svg
//         className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse"
//         fill="none"
//         viewBox="0 0 24 24"
//         stroke="currentColor"
//         strokeWidth={2.5}
//       >
//         <path
//           strokeLinecap="round"
//           strokeLinejoin="round"
//           d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
//         />
//       </svg>
//       <div>
//         <p className="text-xs font-bold text-amber-800">جاري الاسترداد...</p>
//         <p className="text-[10px] text-amber-700 mt-0.5">
//           يظهر المبلغ خلال 5-10 أيام عمل
//         </p>
//       </div>
//     </div>
//   );
// }

const STATUS_META = {
  PENDING_PAYMENT: { label: "بانتظار الدفع", color: "#f59e0b" },
  PAID: { label: "مدفوع", color: "#3b82f6" },
  PROCESSING: { label: "قيد التجهيز", color: "#f97316" },
  SHIPPED: { label: "تم الشحن", color: "#8b5cf6" },
  DELIVERED: { label: "تم التوصيل", color: "#10b981" },
  COMPLETED: { label: "مكتمل", color: "#059669" },
  CANCELLED: { label: "ملغي", color: "#ef4444" },
  REFUNDED: { label: "مسترد", color: "#dc2626" },
};

const STATUS_TABS = [
  { value: "all", label: "الكل" },
  { value: "PAID", label: "مدفوع" },
  { value: "PROCESSING", label: "تجهيز" },
  { value: "SHIPPED", label: "مشحون" },
  { value: "DELIVERED", label: "مُوصّل" },
  { value: "COMPLETED", label: "مكتمل" },
  { value: "CANCELLED", label: "ملغي" },
];

// ✅ منطق "حالة الأموال" الصحيح
function getFundsStatus(o) {
  if (o.fundsReleased)
    return { label: "أُطلقت للفنان", cls: "text-emerald-600" };
  if (o.status === "CANCELLED" || o.status === "REFUNDED")
    return { label: "لا توجد — ملغي", cls: "text-on-surface-variant" };
  if (o.status === "PENDING_PAYMENT")
    return { label: "لم يُدفع بعد", cls: "text-amber-600" };
  if (o.onHold)
    return {
      label: "مجمّدة — تحت مراجعة الدعم قبل اطلاق الاموال",
      cls: "text-red-600",
    };
  return { label: "معلقة — ضمان 72ساعة", cls: "text-amber-600" };
}

export default function AdminOrdersPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [holdOnly, setHoldOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [holdTarget, setHoldTarget] = useState(null);
  const [unholdTarget, setUnholdTarget] = useState(null);
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null); // ✅ جديد

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 450);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["adminOrders", status, debouncedSearch, holdOnly, page],
    queryFn: () =>
      adminService.getOrders({
        status,
        search: debouncedSearch,
        hold: holdOnly,
        page,
        limit: 15,
      }),
  });

  const orders = data?.orders || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      {/* Header + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-on-surface">
            إدارة الطلبات
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {pagination.total} طلب
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-on-surface-variant" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالـ ID أو الاسم..."
              className="pr-9 pl-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant/40 focus:border-primary focus:outline-none w-56"
            />
            {search && search !== debouncedSearch && (
              <Loader2 className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 left-3 text-on-surface-variant animate-spin" />
            )}
          </div>
          <button
            onClick={() => {
              setHoldOnly((v) => !v);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border transition-premium ${
              holdOnly
                ? "bg-red-600 text-white border-red-600"
                : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:border-red-400"
            }`}
          >
            <Snowflake className="w-3.5 h-3.5" />
            المجمّدة
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setStatus(t.value);
              setPage(1);
            }}
            className={`px-4 py-1.5 cursor-pointer text-xs font-body font-semibold border transition-premium ${
              status === t.value
                ? "bg-primary text-white border-primary"
                : "bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant hover:border-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/40 overflow-x-auto">
        <table className="w-full text-sm  min-w-[800px]">
          <thead>
            <tr className="text-right text-[10px] font-body font-semibold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/30 bg-surface-container-low/50">
              <th className="p-3">الطلب</th>
              <th className="p-3">المشتري</th>
              <th className="p-3">الفنان</th>
              <th className="p-3">المبلغ</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">الأموال</th>
              <th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && orders.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-on-surface-variant"
                >
                  لا توجد طلبات مطابقة
                </td>
              </tr>
            )}
            {orders.map((o) => {
              const fs = getFundsStatus(o);
              const canHold =
                o.status === "DELIVERED" && !o.fundsReleased && !o.onHold;
              const canRelease = o.onHold && !o.fundsReleased;
              const canForceCancel =
                ["PAID", "PROCESSING"].includes(o.status) &&
                o.refundStatus !== "REFUNDED"; // ✅ جديد

              return (
                <tr
                  key={o._id}
                  className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low/30"
                >
                  <td className="p-3 font-mono text-xs text-on-surface-variant">
                    #{o._id.slice(-6).toUpperCase()}
                  </td>
                  {/* ✅ المشتري مع badge محظور */}
                  <td className="p-3 text-on-surface">
                    <div className="flex items-center gap-1.5">
                      <span>{o.buyer?.name}</span>
                      {o.buyer?.isBanned && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-600 rounded">
                          محظور
                        </span>
                      )}
                    </div>
                  </td>
                  {/* ✅ الفنان مع badge محظور */}
                  <td className="p-3 text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <span>{o.artist?.name}</span>
                      {o.artist?.isBanned && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-600 rounded">
                          محظور
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-on-surface">
                    {fmt(o.financials?.totalAmount)}
                  </td>
                  <td className="p-3">
                    <span
                      className="px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ background: STATUS_META[o.status]?.color }}
                    >
                      {STATUS_META[o.status]?.label}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] font-semibold ${fs.cls}`}>
                      {fs.label}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelected(o)}
                        title="التفاصيل"
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* ✅ زرار الإلغاء الإداري */}
                      {canForceCancel && (
                        <button
                          onClick={() => setCancelTarget(o)}
                          title="إلغاء إداري + استرداد المبلغ"
                          className="p-1.5 text-on-surface-variant hover:text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}

                      {canRelease ? (
                        <>
                          <button
                            onClick={() => setUnholdTarget(o)}
                            title="فك التجميد (استئناف المسار الطبيعي)"
                            className="p-1.5 text-on-surface-variant hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setReleaseTarget(o)}
                            title="إطلاق فوري للأموال"
                            className="p-1.5 text-on-surface-variant hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        canHold && (
                          <>
                            <button
                              onClick={() => setHoldTarget(o)}
                              title="تجميد (بلاغ/مشكلة)"
                              className="p-1.5 text-on-surface-variant hover:text-red-600 hover:bg-red-50"
                            >
                              <Snowflake className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setReleaseTarget(o)}
                              title="إطلاق فوري للأموال"
                              className="p-1.5 text-on-surface-variant hover:text-emerald-600 hover:bg-emerald-50"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

      <OrderDetailsModal order={selected} onClose={() => setSelected(null)} />
      <HoldModal order={holdTarget} onClose={() => setHoldTarget(null)} />
      <UnholdModal order={unholdTarget} onClose={() => setUnholdTarget(null)} />
      <ReleaseModal
        order={releaseTarget}
        onClose={() => setReleaseTarget(null)}
      />
      {/* ✅ جديد */}
      <CancelOrderModal
        order={cancelTarget}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}

// ═══ Hold Modal ═══
function HoldModal({ order, onClose }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const hold = useMutation({
    mutationFn: () => adminService.holdOrder(order._id, reason),
    onSuccess: () => {
      toast.success("تم تجميد الطلب — لن يُطلق تلقائياً");
      queryClient.invalidateQueries({ queryKey: ["adminOrders"] });
      setReason("");
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  return (
    <SharedModal
      open={!!order}
      onClose={onClose}
      title="تجميد أموال الطلب"
      icon={Snowflake}
      iconColor="text-red-600"
      size="md"
    >
      {/* ملخص الطلب */}
      <p className="text-sm text-on-surface-variant mb-3">
        طلب #{order?._id?.slice(-6)?.toUpperCase()} — {order?.buyer?.name} ·{" "}
        {fmt(order?.financials?.totalAmount)} ر.س
      </p>

      {/* سبب التجميد */}
      <label className="text-xs font-semibold text-on-surface-variant block mb-1">
        سبب التجميد *{" "}
        <span className="text-on-surface-variant/60">(سيُحفظ للمراجعة)</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="مثال: بلاغ من العميل عن تلف المنتج، طلب استرداد، نزاع على الجودة..."
        rows={3}
        className="w-full p-3 text-sm bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:outline-none resize-none"
      />

      {/* تحذير */}
      <div className="bg-amber-50 border border-amber-200 p-2.5 mt-3 text-xs text-amber-800">
        ⚠️ الطلب لن يُطلق تلقائياً بعد التجميد — لازم تفك التجميد أو تطلق الفلوس
        يدوياً.
      </div>

      {/* الأزرار */}
      <ModalActions
        onClose={onClose}
        onConfirm={() => hold.mutate()}
        confirmLabel="تجميد الأموال"
        confirmVariant="danger"
        isLoading={hold.isPending}
        disabled={!reason.trim()}
      />
    </SharedModal>
  );
}

// ═══ Unhold Modal ═══
function UnholdModal({ order, onClose }) {
  const queryClient = useQueryClient();

  const unhold = useMutation({
    mutationFn: () => adminService.unholdOrder(order._id),
    onSuccess: () => {
      toast.success("تم فك التجميد — عاد للمسار الطبيعي");
      queryClient.invalidateQueries({ queryKey: ["adminOrders"] });
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  return (
    <SharedModal
      open={!!order}
      onClose={onClose}
      title="فك تجميد الطلب"
      icon={Unlock}
      iconColor="text-blue-600"
      size="md"
    >
      {/* ملخص الطلب */}
      <div className="bg-blue-50 border border-blue-200 p-4 mb-4">
        <p className="text-sm font-semibold text-blue-900 mb-1">
          طلب #{order?._id?.slice(-6)?.toUpperCase()}
        </p>
        <p className="text-xs text-blue-700">
          المشتري: {order?.buyer?.name} · المبلغ:{" "}
          {fmt(order?.financials?.totalAmount)} ر.س
        </p>
      </div>

      {/* سبب التجميد الحالي */}
      {order?.holdReason && (
        <div className="bg-amber-50 border border-amber-200 p-3 mb-4">
          <p className="text-xs font-semibold text-amber-800 mb-1">
            سبب التجميد الحالي:
          </p>
          <p className="text-sm text-amber-900">{order.holdReason}</p>
        </div>
      )}

      {/* شرح الإجراء */}
      <div className="bg-surface-container-low p-4 text-sm text-on-surface-variant leading-relaxed">
        <p className="font-semibold text-on-surface mb-2">ماذا سيحدث؟</p>
        <ul className="space-y-1.5 pr-4">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>الطلب سيعود للمسار الطبيعي للإطلاق التلقائي</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>
              سيتم إطلاق الأموال بعد انتهاء مهلة الـ 72 ساعة من التوصيل
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>سيُشعر الفنان بفك التجميد</span>
          </li>
        </ul>
      </div>

      <ModalActions
        onClose={onClose}
        onConfirm={() => unhold.mutate()}
        confirmLabel="فك التجميد"
        confirmVariant="primary"
        isLoading={unhold.isPending}
      />
    </SharedModal>
  );
}

// ═══ Release Modal ═══
function ReleaseModal({ order, onClose }) {
  const queryClient = useQueryClient();

  const release = useMutation({
    mutationFn: () => adminService.releaseOrder(order._id),
    onSuccess: () => {
      toast.success("تم إطلاق الأموال فوراً للفنان");
      queryClient.invalidateQueries({ queryKey: ["adminOrders"] });
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  return (
    <SharedModal
      open={!!order}
      onClose={onClose}
      title="إطلاق فوري للأموال"
      icon={Zap}
      iconColor="text-emerald-600"
      size="md"
    >
      {/* ملخص الطلب */}
      <div className="bg-emerald-50 border border-emerald-200 p-4 mb-4">
        <p className="text-sm font-semibold text-emerald-900 mb-1">
          طلب #{order?._id?.slice(-6)?.toUpperCase()}
        </p>
        <p className="text-xs text-emerald-700">
          المشتري: {order?.buyer?.name} · الفنان: {order?.artist?.name}
        </p>
      </div>

      {/* المبلغ */}
      <div className="bg-surface-container-low p-4 mb-4 text-center">
        <p className="text-xs text-on-surface-variant mb-1">
          المبلغ الذي سيُطلق للفنان
        </p>
        <p className="text-3xl font-bold text-emerald-600">
          {fmt(order?.financials?.totalArtistEarning)}{" "}
          <span className="text-lg">ر.س</span>
        </p>
        <p className="text-[10px] text-on-surface-variant mt-1">
          (بعد خصم عمولة المنصة: {fmt(order?.financials?.totalCommission)} ر.س)
        </p>
      </div>

      {/* تحذير */}
      <div className="bg-amber-50 border border-amber-200 p-3 mb-4">
        <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ تنبيه:</p>
        <p className="text-xs text-amber-900 leading-relaxed">
          هذا الإجراء <strong>لا يمكن التراجع عنه</strong>. سيتم تحويل الأموال
          فوراً إلى محفظة الفنان وتخطي مهلة الـ 72 ساعة.
        </p>
      </div>

      {/* شرح الإجراء */}
      <div className="bg-surface-container-low p-4 text-sm text-on-surface-variant leading-relaxed">
        <p className="font-semibold text-on-surface mb-2">النتيجة:</p>
        <ul className="space-y-1.5 pr-4">
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5">✓</span>
            <span>الأموال ستتاح فوراً في محفظة الفنان</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5">✓</span>
            <span>حالة الطلب ستتحول إلى "مكتمل"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5">✓</span>
            <span>سيُشعر الفنان بتحويل الأموال</span>
          </li>
        </ul>
      </div>

      <ModalActions
        onClose={onClose}
        onConfirm={() => release.mutate()}
        confirmLabel="إطلاق الأموال الآن"
        confirmVariant="primary"
        isLoading={release.isPending}
      />
    </SharedModal>
  );
}

// ═══ Cancel Order Modal (جديد) ═══
function CancelOrderModal({ order, onClose }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const cancel = useMutation({
    mutationFn: () => adminService.forceCancelOrder(order._id, reason),
    onSuccess: (res) => {
      toast.success(res?.message || "تم إلغاء الطلب وبدء الاسترداد");
      queryClient.invalidateQueries({ queryKey: ["adminOrders"] });
      setReason("");
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  return (
    <SharedModal
      open={!!order}
      onClose={onClose}
      title="إلغاء إداري + استرداد المبلغ"
      icon={XCircle}
      iconColor="text-red-600"
      size="md"
    >
      {/* ملخص الطلب */}
      <p className="text-sm text-on-surface-variant mb-3">
        طلب #{order?._id?.slice(-6)?.toUpperCase()} — {order?.buyer?.name} ·{" "}
        {fmt(order?.financials?.totalAmount)} ر.س
      </p>

      {/* تحذير لو PROCESSING */}
      {order?.status === "PROCESSING" && (
        <div className="bg-amber-50 border border-amber-200 p-2.5 mb-3 text-xs text-amber-800">
          ⚠️ الطلب في حالة تجهيز — لو اتعملت شحنة فعلية لدى OTO، ألغها يدوياً من
          داشبورد OTO بعد الإلغاء هنا.
        </div>
      )}

      {/* سبب الإلغاء */}
      <label className="text-xs font-semibold text-on-surface-variant block mb-1">
        سبب الإلغاء *
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="مثال: حظر البائع وعدم قدرته على شحن الطلب..."
        rows={3}
        className="w-full p-3 text-sm bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:outline-none resize-none"
      />

      {/* شرح الإجراء */}
      <div className="bg-red-50 border border-red-200 p-2.5 mt-3 text-xs text-red-800 leading-relaxed">
        سيتم: إلغاء الطلب + رجوع اللوحات للسوق + بدء استرداد المبلغ كامل للمشتري
        (يظهر خلال 3-14 يوم عمل حسب البنك) + إيميل تلقائي للمشتري.
      </div>

      {/* الأزرار */}
      <ModalActions
        onClose={onClose}
        onConfirm={() => cancel.mutate()}
        confirmLabel="إلغاء + استرداد"
        confirmVariant="danger"
        isLoading={cancel.isPending}
        disabled={!reason.trim()}
      />
    </SharedModal>
  );
}

// ═══ Details Modal ═══
function OrderDetailsModal({ order, onClose }) {
  if (!order) return null;
  const fs = getFundsStatus(order);

  return (
    <SharedModal
      open={!!order}
      onClose={onClose}
      title={`طلب #${order?._id?.slice(-6)?.toUpperCase()}`}
      size="xl"
    >
      {/* Status badges */}
      <div className="flex gap-2 flex-wrap mb-5">
        <span
          className="px-2 py-1 text-xs font-semibold text-white"
          style={{ background: STATUS_META[order.status]?.color }}
        >
          {STATUS_META[order.status]?.label}
        </span>
        <span
          className={`px-2 py-1 text-xs font-semibold border ${
            fs.cls.includes("emerald")
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : fs.cls.includes("red")
                ? "bg-red-50 text-red-700 border-red-200"
                : fs.cls.includes("amber")
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-surface-container-low text-on-surface-variant border-outline-variant/40"
          }`}
        >
          {fs.label}
        </span>
      </div>

      {/* سبب الإلغاء */}
      {order.status === "CANCELLED" &&
        order.cancellationReason &&
        (() => {
          const cancelMsg = getCancellationMessage(order, "admin");
          return (
            <div className="mb-4 space-y-2.5">
              {/* سبب الإلغاء */}
              <div className="bg-red-50 border border-red-200 p-3 rounded">
                <p className="text-[10px] font-bold text-red-800 uppercase tracking-wider mb-1">
                  سبب الإلغاء
                </p>
                <p className="text-sm text-red-900 leading-relaxed">
                  {cancelMsg?.ar || order.cancellationReason}
                </p>
                {order.cancelledAt && (
                  <p className="text-[10px] text-red-700 mt-1.5 tabular-nums">
                    أُلغي في{" "}
                    {new Date(order.cancelledAt).toLocaleString("ar-SA")}
                  </p>
                )}
              </div>

              {/* Refund Badge — للأدمن */}
              {cancelMsg?.showRefund && (
                <RefundBadge order={order} viewer="admin" />
              )}

              {/* معلومات إضافية للأدمن (payment + refund metadata) */}
              {cancelMsg?.showRefund && (
                <div className="bg-surface-container-low p-3 rounded text-xs space-y-1.5">
                  <p className="font-semibold text-on-surface-variant uppercase tracking-wider text-[10px] mb-1">
                    تفاصيل الاسترداد
                  </p>
                  {order.payment?.paymentId && (
                    <div className="flex justify-between gap-2">
                      <span className="text-on-surface-variant">
                        Payment ID:
                      </span>
                      <span
                        className="font-mono text-[10px] text-on-surface"
                        dir="ltr"
                      >
                        {order.payment.paymentId}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-on-surface-variant">
                      حالة الاسترداد:
                    </span>
                    <span className="font-semibold text-on-surface">
                      {order.refundStatus || "NONE"}
                    </span>
                  </div>
                  {order.refundedAmount && (
                    <div className="flex justify-between gap-2">
                      <span className="text-on-surface-variant">
                        المبلغ المسترد:
                      </span>
                      <span className="font-semibold text-on-surface">
                        {order.refundedAmount} ر.س
                      </span>
                    </div>
                  )}
                  {order.refundedAt && (
                    <div className="flex justify-between gap-2">
                      <span className="text-on-surface-variant">
                        تاريخ الاسترداد:
                      </span>
                      <span className="text-on-surface tabular-nums">
                        {new Date(order.refundedAt).toLocaleString("ar-SA")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      {/* سبب التجميد */}
      {order.onHold && order.holdReason && (
        <div className="bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 mb-4">
          <strong>سبب التجميد:</strong> {order.holdReason}
        </div>
      )}

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-5">
        <div className="bg-surface-container-low p-4">
          <p className="text-xs text-on-surface-variant mb-1">المشتري</p>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="font-semibold text-on-surface">{order.buyer?.name}</p>
            {order.buyer?.isBanned && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-600 rounded">
                محظور
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">
            {order.buyer?.email}
          </p>
          <p className="text-xs text-on-surface-variant" dir="ltr">
            {order.buyer?.phone}
          </p>
        </div>
        <div className="bg-surface-container-low p-4">
          <p className="text-xs text-on-surface-variant mb-1">الفنان</p>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="font-semibold text-on-surface">
              {order.artist?.name}
            </p>
            {order.artist?.isBanned && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-600 rounded">
                محظور
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">
            {order.artist?.email}
          </p>
        </div>
      </div>

      {/* Financial breakdown */}
      <div className="bg-surface-container-low p-4 text-sm space-y-1.5 mb-5">
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Banknote className="w-3.5 h-3.5" /> التوزيع المالي
        </p>
        <Row l="المجموع الفرعي" v={`${fmt(order.financials?.subtotal)} ر.س`} />
        <Row l="الشحن" v={`${fmt(order.financials?.shippingCost)} ر.س`} />
        <div className="border-t border-outline-variant/20 pt-1.5 mt-1.5">
          <Row
            l="الإجمالي"
            v={`${fmt(order.financials?.totalAmount)} ر.س`}
            bold
          />
        </div>
        <div className="border-t border-outline-variant/20 pt-1.5 mt-1.5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-on-surface-variant">عمولة المنصة</p>
            <p className="text-sm font-semibold text-secondary">
              {fmt(order.financials?.totalCommission)} ر.س
            </p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant">ربح الفنان</p>
            <p className="text-sm font-semibold text-emerald-600">
              {fmt(order.financials?.totalArtistEarning)} ر.س
            </p>
          </div>
        </div>
      </div>

      {/* Shipping */}
      {order.shipping?.buyerAddress && (
        <div className="bg-surface-container-low p-4 text-sm mb-5">
          <p className="text-xs text-on-surface-variant mb-2 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> عنوان التوصيل
          </p>
          <p className="text-on-surface font-semibold">
            {order.shipping.buyerAddress.name}
          </p>
          <p className="text-xs text-on-surface-variant">
            {order.shipping.buyerAddress.street}،{" "}
            {order.shipping.buyerAddress.district}،{" "}
            {order.shipping.buyerAddress.city}
            {order.shipping.buyerAddress.zipCode &&
              ` ${order.shipping.buyerAddress.zipCode}`}
          </p>
          {order.shipping.trackingNumber && (
            <p className="text-xs text-on-surface-variant mt-2">
              تتبع:{" "}
              <span className="font-mono">{order.shipping.trackingNumber}</span>{" "}
              · {order.shipping.deliveryCompanyName}
            </p>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-surface-container-low p-4 text-xs space-y-1 text-on-surface-variant mb-5">
        <p>تاريخ الطلب: {new Date(order.createdAt).toLocaleString("ar-SA")}</p>
        {order.completedAt && (
          <p>اكتمل: {new Date(order.completedAt).toLocaleString("ar-SA")}</p>
        )}
      </div>

      {/* زرار الإغلاق (مش ModalActions عشان ده مودال عرض بس) */}
      <button
        onClick={onClose}
        className="w-full py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low transition-premium"
      >
        إغلاق
      </button>
    </SharedModal>
  );
}

function Row({ l, v, bold }) {
  return (
    <div className="flex justify-between">
      <span
        className={
          bold ? "font-semibold text-on-surface" : "text-on-surface-variant"
        }
      >
        {l}
      </span>
      <span className={bold ? "font-semibold text-primary" : "text-on-surface"}>
        {v}
      </span>
    </div>
  );
}

// ═══ Loading Skeleton ═══
function LoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* ═══ Header + Filters ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="h-8 w-40 bg-surface-container-low rounded" />
          <div className="h-4 w-24 bg-surface-container-low rounded mt-2" />
        </div>
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <div className="pr-9 pl-3 py-2 w-56 bg-surface-container-lowest border border-outline-variant/40 rounded">
              <div className="h-4 w-40 bg-surface-container-low rounded" />
            </div>
          </div>
          {/* Snowflake Button */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-lowest border border-outline-variant/40 rounded">
            <div className="w-3.5 h-3.5 bg-surface-container-low rounded" />
            <div className="h-4 w-12 bg-surface-container-low rounded" />
          </div>
        </div>
      </div>

      {/* ═══ Status Tabs (7 تابز) ═══ */}
      <div className="flex gap-1 flex-wrap">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="px-4 py-1.5">
            <div className="h-4 w-16 bg-surface-container-low rounded" />
          </div>
        ))}
      </div>

      {/* ═══ Table ═══ */}
      <div className="bg-surface-container-lowest border rounded-lg border-outline-variant/40 overflow-x-auto">
        <div className="w-full min-w-[800px]">
          {/* Table Header */}
          <div className="flex border-b border-outline-variant/30 bg-surface-container-low/50">
            {[...Array(7)].map((_, i) => (
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
              {/* الطلب */}
              <div className="flex-1 p-3">
                <div className="h-3 w-12 bg-surface-container-low rounded" />
              </div>
              {/* المشتري */}
              <div className="flex-1 p-3">
                <div className="h-4 w-28 bg-surface-container-low rounded" />
              </div>
              {/* الفنان */}
              <div className="flex-1 p-3">
                <div className="h-4 w-24 bg-surface-container-low rounded" />
              </div>
              {/* المبلغ */}
              <div className="flex-1 p-3">
                <div className="h-4 w-16 bg-surface-container-low rounded" />
              </div>
              {/* الحالة */}
              <div className="flex-1 p-3">
                <div className="h-5 w-16 bg-surface-container-low rounded" />
              </div>
              {/* الأموال */}
              <div className="flex-1 p-3">
                <div className="h-3 w-24 bg-surface-container-low rounded" />
              </div>
              {/* إجراءات */}
              <div className="flex-1 p-3">
                <div className="flex items-center gap-1.5">
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
