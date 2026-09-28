import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Printer,
  Truck,
  Wallet,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  useRefreshTracking,
  useCreateShipment,
  useCreateOtoOrder,
} from "../hooks/useDashboard";

import { dashboardService } from "../services/dashboard.service";
import Button from "../../../components/Ui/Button";
import { getMediaUrl } from "../../../utils/media";
import { getCancellationMessage } from "../../../utils/cancellationReasons";
import RefundBadge from "../../../components/Ui/RefundBadge";
// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════
const STATUS_TABS = [
  { value: "all", label: "الكل" },
  { value: "PAID", label: "بانتظار الشحن" },
  { value: "PROCESSING", label: "جاري التجهيز" },
  { value: "SHIPPED", label: "تم الشحن" },
  { value: "DELIVERED", label: "تم التوصيل" },
  { value: "COMPLETED", label: "مكتمل" },
  { value: "CANCELLED", label: "ملغى" },
];

const STATUS_META = {
  PENDING_PAYMENT: {
    label: "بانتظار الدفع",
    cls: "bg-amber-500/10 text-amber-600",
  },
  PAID: { label: "بانتظار الشحن", cls: "bg-secondary/10 text-secondary" },
  PROCESSING: { label: "جاري التجهيز", cls: "bg-blue-500/10 text-blue-600" },
  SHIPPED: { label: "تم الشحن", cls: "bg-purple-500/10 text-purple-600" },
  DELIVERED: { label: "تم التوصيل", cls: "bg-teal-500/10 text-teal-600" },
  COMPLETED: { label: "مكتمل", cls: "bg-green-500/10 text-green-600" },
  CANCELLED: { label: "ملغي", cls: "bg-red-500/10 text-red-600" },
  REFUNDED: { label: "مسترد", cls: "bg-red-500/10 text-red-600" },
};

// ═══════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════
export default function ArtistOrdersPage() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["artistSales", status, page],
    queryFn: () => dashboardService.getMySales({ status, page, limit: 10 }),
  });

  const orders = data?.orders || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  return (
    <div className="min-h-screen bg-surface py-8">
      <div className="max-w-[1100px] mx-auto px-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-on-surface">مبيعاتي</h1>
          <span className="text-sm text-on-surface-variant">
            {pagination.total} طلب
          </span>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`px-4 py-2 cursor-pointer text-sm font-body border transition-premium ${
                status === tab.value
                  ? "bg-primary text-white border-primary"
                  : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {isLoading ? (
          <LoadingState />
        ) : orders.length === 0 ? (
          <div className="py-20 text-center">
            <Package
              className="w-10 h-10 mx-auto mb-3 text-on-surface-variant"
              strokeWidth={1.5}
            />
            <p className="text-sm text-on-surface-variant">
              لا توجد طلبات في هذه الحالة
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-center gap-3 pt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              السابق
            </Button>
            <span className="text-sm self-center text-on-surface-variant">
              {page} / {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Order Card
// ═══════════════════════════════════════════════════
function OrderCard({ order }) {
  const meta = STATUS_META[order.status] || {
    label: order.status,
    cls: "bg-surface-container text-on-surface-variant",
  };
  console.log("order", order);

  return (
    <div className="bg-surface-container-lowest border rounded-lg border-outline-variant/40 p-5">
      {order.status === "CANCELLED" &&
        order.cancellationReason &&
        (() => {
          const cancelMsg = getCancellationMessage(order, "artist");
          return (
            <div className="mb-3 space-y-2">
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 p-3 rounded">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800 text-[11px] uppercase tracking-wider mb-1">
                    سبب الإلغاء
                  </p>
                  <p className="text-red-900 text-sm leading-relaxed">
                    {cancelMsg?.ar || order.cancellationReason}
                  </p>
                  {order.cancelledAt && (
                    <p className="text-[10px] text-red-700 mt-1.5 tabular-nums">
                      أُلغي في{" "}
                      {new Date(order.cancelledAt).toLocaleString("ar-SA")}
                    </p>
                  )}
                </div>
              </div>
              {cancelMsg?.showRefund && <RefundBadge order={order} viewer="artist" />}
            </div>
          );
        })()}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Items */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex -space-x-2">
            {order.items?.slice(0, 3).map((item, i) => (
              <img
                key={i}
                src={getMediaUrl(item.coverImage)}
                alt={item.title}
                className="w-12 h-12 object-cover border-2 border-surface-container-lowest"
              />
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">
              {order.items?.[0]?.title}
              {order.items?.length > 1 && ` +${order.items.length - 1} أخرى`}
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              المشتري: {order.buyer?.name} •{" "}
              {new Date(order.createdAt).toLocaleDateString("ar-SA")}
            </p>
          </div>
        </div>

        {/* Amounts */}
        <div className="text-sm">
          <p className="text-on-surface font-semibold">
            {order.totalAmount?.toLocaleString()} ر.س
          </p>
          <p className="text-xs text-on-surface-variant">
            ربحك: {order.artistEarning?.toLocaleString()} ر.س
          </p>
        </div>

        {/* Status Badge */}
        <span className={`px-3 py-1 text-xs font-semibold ${meta.cls}`}>
          {meta.label}
        </span>

        {/* Actions */}
        <OrderActions order={order} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Actions per status
// ═══════════════════════════════════════════════════
function OrderActions({ order }) {
  const [overlayMsg, setOverlayMsg] = useState("");
  console.log(order);

  const createOtoOrder = useCreateOtoOrder();
  const createShipment = useCreateShipment();
  const refreshTracking = useRefreshTracking();

  const handleCreateOtoOrder = () => {
    setOverlayMsg("جاري إنشاء طلب الشحن...");
    createOtoOrder.mutate(order._id, {
      onSettled: () => setTimeout(() => setOverlayMsg(""), 500),
    });
  };

  const handleCreateShipment = () => {
    setOverlayMsg("جاري إنشاء الشحنة مع شركة الشحن...");
    createShipment.mutate(order._id, {
      onSuccess: () => {
        setTimeout(() => refreshTracking.mutate(order._id), 8000);
        setTimeout(() => setOverlayMsg(""), 500);
      },
      onError: () => setTimeout(() => setOverlayMsg(""), 500),
    });
  };

  const handleRefresh = () => refreshTracking.mutate(order._id);

  const isPending =
    createOtoOrder.isPending ||
    createShipment.isPending ||
    refreshTracking.isPending;

  // ═══ حقائق الطلب ═══
  const shipmentCreated = !!order.shipping?.shipmentCreatedAt;
  const trackingNumber = order.shipping?.trackingNumber || "";
  const trackingUrl = order.shipping?.trackingUrl || "";
  const awbUrl = order.shipping?.awbUrl || "";
  const hasShipmentData = !!(trackingNumber || awbUrl);

  return (
    <>
      {/* ═══ Overlay ═══ */}
      {overlayMsg && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-surface-container-lowest border border-outline-variant/40 shadow-2xl p-8 max-w-sm w-[90%] text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Truck className="w-7 h-7 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
            <h3 className="font-display text-lg text-on-surface mb-2">
              {overlayMsg}
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              العملية بتاخد ثواني قليلة...
              <br />
              <span className="text-xs">لا تغلق الصفحة من فضلك</span>
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col items-end gap-1.5 min-w-[200px]">
        <div className="flex gap-2 flex-wrap items-center justify-end">
          {/* ═══ PAID → Step 1 ═══ */}
          {order.status === "PAID" && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateOtoOrder}
              disabled={isPending}
              icon={Package}
            >
              {createOtoOrder.isPending ? "جاري الإنشاء..." : "إنشاء طلب الشحن"}
            </Button>
          )}

          {/* ═══ PROCESSING ═══ */}
          {order.status === "PROCESSING" && (
            <>
              {!shipmentCreated ? (
                // لسه مفيش شحنة في OTO
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateShipment}
                  disabled={isPending}
                  icon={Truck}
                >
                  {createShipment.isPending
                    ? "جاري الإنشاء..."
                    : "إنشاء الشحنة"}
                </Button>
              ) : hasShipmentData ? (
                // شحنة موجودة بس الشركة لسه ما استلمتهاش
                <>
                  {awbUrl && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => window.open(awbUrl, "_blank")}
                      icon={Printer}
                    >
                      طباعة البوليصة
                    </Button>
                  )}
                  {trackingUrl && (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-secondary flex items-center gap-1 hover:underline px-2 py-1"
                    >
                      <ExternalLink className="w-3 h-3" /> تتبع
                    </a>
                  )}
                  <span className="text-[10px] text-on-surface-variant h-fit  bg-surface-container px-2 py-1 rounded">
                    بانتظار استلام شركة الشحن
                  </span>
                </>
              ) : (
                // الشحنة اتطلب بس بياناتها لسه
                <span className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                  <Loader2 className="w-3 h-3 animate-spin" /> بيانات التتبع
                  خلال دقائق
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={isPending}
                className="text-xs text-on-surface-variant hover:text-primary flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3 h-3 ${refreshTracking.isPending ? "animate-spin" : ""}`}
                />
                تحديث
              </button>
            </>
          )}

          {/* ═══ SHIPPED → الشركة استلمت ═══ */}
          {order.status === "SHIPPED" && (
            <>
              {awbUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(awbUrl, "_blank")}
                  icon={Printer}
                >
                  طباعة البوليصة
                </Button>
              )}
              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-secondary flex items-center gap-1 hover:underline px-2 py-1"
                >
                  <ExternalLink className="w-4 h-4" /> تتبع الشحنة
                </a>
              )}
              <button
                onClick={handleRefresh}
                disabled={isPending}
                className="text-xs text-on-surface-variant hover:text-primary flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3 h-3 ${refreshTracking.isPending ? "animate-spin" : ""}`}
                />
                تحديث
              </button>
            </>
          )}

          {/* ═══ DELIVERED ═══ */}
          {order.status === "DELIVERED" && (
            <span className="text-xs text-teal-600 flex items-center gap-1 bg-teal-50 px-2 py-1 rounded">
              <Wallet className="w-3.5 h-3.5" /> بانتظار تأكيد المشتري
            </span>
          )}

          {/* ═══ COMPLETED ═══ */}
          {order.status === "COMPLETED" && (
            <span className="text-xs text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
              <Wallet className="w-3.5 h-3.5" /> تمت إضافة الربح لمحفظتك
            </span>
          )}
        </div>

        {/* ═══ رقم التتبع ═══ */}
        {trackingNumber && order.status !== "PAID" && (
          <p
            className="text-[10px] text-on-surface-variant font-mono"
            dir="ltr"
          >
            #{trackingNumber}
          </p>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════
function LoadingState() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-surface-container-low rounded" />
        <div className="h-4 w-20 bg-surface-container-low rounded" />
      </div>

      {/* ═══ Status Tabs (6 تابز) ═══ */}
      <div className="flex gap-2 flex-wrap">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="px-4 py-2 bg-surface-container-lowest rounded-lg border border-outline-variant"
          >
            <div className="h-4 w-20 bg-surface-container-low rounded" />
          </div>
        ))}
      </div>

      {/* ═══ Order Cards (5 كروت) ═══ */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-surface-container-lowest border border-outline-variant/40 p-5"
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Items Section */}
              <div className="flex items-center gap-3 flex-1">
                {/* 3 صور متداخلة */}
                <div className="flex -space-x-2">
                  <div className="w-12 h-12 bg-surface-container-low rounded" />
                  <div className="w-12 h-12 bg-surface-container-low rounded" />
                  <div className="w-12 h-12 bg-surface-container-low rounded" />
                </div>
                {/* معلومات */}
                <div className="space-y-2">
                  <div className="h-4 w-48 bg-surface-container-low rounded" />
                  <div className="h-3 w-40 bg-surface-container-low rounded" />
                </div>
              </div>

              {/* Amounts */}
              <div className="space-y-1.5">
                <div className="h-4 w-24 bg-surface-container-low rounded" />
                <div className="h-3 w-28 bg-surface-container-low rounded" />
              </div>

              {/* Status Badge */}
              <div className="h-6 w-24 bg-surface-container-low rounded" />

              {/* Actions */}
              <div className="flex flex-col items-end gap-1 min-w-[180px]">
                <div className="flex gap-2">
                  <div className="h-8 w-28 bg-surface-container-low rounded" />
                  <div className="h-8 w-8 bg-surface-container-low rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Pagination ═══ */}
      <div className="flex justify-center gap-3 pt-8">
        <div className="h-8 w-16 bg-surface-container-low rounded" />
        <div className="self-center">
          <div className="h-4 w-12 bg-surface-container-low rounded" />
        </div>
        <div className="h-8 w-16 bg-surface-container-low rounded" />
      </div>
    </div>
  );
}
