import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "../stores/cartStore";
import { ordersService } from "../../orders/services/orders.service";
import { ROUTES } from "../../../config/routes";
import Button from "../../../components/Ui/Button";
import {
  CheckCircle2,
  XCircle,
  ShoppingBag,
  ShieldCheck,
  FileText,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

const translateMoyasarMessage = (msg) => {
  if (!msg) return null;
  const lower = msg.toLowerCase();

  if (lower.includes("rejected by the issuer") || lower.includes("issuer"))
    return "البنك رفض العملية — تأكد من رصيدك أو جرب بطاقة أخرى";
  if (lower.includes("3ds") && lower.includes("service error"))
    return "خطأ مؤقت في خدمة التحقق من البنك — حاول مرة أخرى";
  if (lower.includes("3ds") && lower.includes("authentication"))
    return "فشل التحقق من هويتك";
  if (lower.includes("insufficient") || lower.includes("funds"))
    return "الرصيد غير كافي";
  if (lower.includes("expired")) return "البطاقة منتهية الصلاحية";
  if (lower.includes("invalid card")) return "رقم البطاقة غير صحيح";
  if (lower.includes("cancelled by customer"))
    return "تم إلغاء العملية بواسطتك";
  return null;
};

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("id") || searchParams.get("payment_id");
  const urlStatus = (searchParams.get("status") || "").toLowerCase();
  const rawMessage = searchParams.get("message") || "";
  const message = rawMessage ? decodeURIComponent(rawMessage) : "";

  const [pollTimedOut, setPollTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPollTimedOut(true), 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, []);

  const { data: rawData } = useQuery({
    queryKey: ["orderStatusByPayment", paymentId],
    queryFn: () => ordersService.getOrderByPaymentId(paymentId),
    enabled: !!paymentId,
    refetchInterval: (query) => {
      const d = query.state.data?.data ?? query.state.data;
      if (d?.outcome && d.outcome !== "pending") return false;
      const st = d?.order?.status;
      if (st === "PAID" || st === "CANCELLED" || st === "COMPLETED") return false;
      return 2000;
    },
    staleTime: 0,
    retry: 2,
  });

  const responseData = rawData?.data ?? rawData;
  const order = useMemo(() => {
    if (!responseData) return null;
    return responseData?.order ?? rawData?.order ?? rawData;
  }, [responseData, rawData]);

  const allOrders = responseData?.orders ?? (order ? [order] : null);
  const serverOutcome = responseData?.outcome;
  const backendStatus = order?.status;

  const outcome = useMemo(() => {
     if (serverOutcome === "cancelled") return "failed";
    // الأولوية للـ server outcome (الأدق، لأنه بيشوف كل الـ orders)
    if (serverOutcome && serverOutcome !== "pending") return serverOutcome;
    
    if (backendStatus === "PAID" || backendStatus === "COMPLETED") return "paid";
    if (backendStatus === "CANCELLED") return "failed";

    if (
      ["failed", "declined", "canceled", "cancelled", "expired"].includes(urlStatus)
    ) {
      return "failed";
    }

    if (urlStatus === "paid") return "pending";
    return "pending";
  }, [serverOutcome, backendStatus, urlStatus]);

  useEffect(() => {
    if (outcome === "paid" || outcome === "partial") {
      useCartStore.getState().syncAfterPayment();
    }
  }, [outcome]);

  const translatedMessage = useMemo(
    () => translateMoyasarMessage(message),
    [message],
  );

  const cancelledOrders = (allOrders || []).filter(
    (o) => o.status === "CANCELLED",
  );
  const paidOrders = (allOrders || []).filter((o) =>
    ["PAID", "COMPLETED"].includes(o.status),
  );

  return (
    <div
      className="min-h-[95vh] flex items-center justify-center px-4 bg-[var(--color-surface)] font-body"
      dir="rtl"
    >
      <div className="max-w-md w-full p-8 text-center space-y-6">
        {/* ═══ حالة نجاح كامل ═══ */}
        {outcome === "paid" && (
          <>
            <div className="flex justify-center">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping [animation-duration:2s]" />
                <div className="relative w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-12 h-12" strokeWidth={1.5} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display text-[var(--color-primary)]">
                تمت عملية الشراء بنجاح!
              </h2>
              <p className="text-stone-500 text-sm leading-relaxed">
                شكراً لثقتكم ودعمكم للفن السعودي. تم استلام دفعتك وسيتم إخطار
                الفنان لتجهيز طلبك.
              </p>
            </div>
          </>
        )}

        {/* ═══ حالة نجاح جزئي (بانر تحذيري) ═══ */}
        {outcome === "partial" && (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                <AlertCircle className="w-12 h-12" strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display text-[var(--color-primary)]">
                تم تأكيد جزء من طلبك
              </h2>
              <p className="text-stone-500 text-sm leading-relaxed">
                بعض اللوحات لم تعد متاحة عند تأكيد الدفع، فتم إلغاؤها واسترداد
                مبلغها. الأجزاء الأخرى من طلبك تم تأكيدها بنجاح.
              </p>
            </div>

            {/* الأجزاء المؤكدة */}
            {paidOrders.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-right space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <p className="font-semibold text-xs text-emerald-800">
                    تم تأكيده ({paidOrders.length} طلب):
                  </p>
                </div>
                {paidOrders.map((o) => (
                  <div
                    key={String(o._id)}
                    className="text-xs text-emerald-700 pr-6"
                  >
                    طلب #{String(o._id).slice(-6).toUpperCase()} —{" "}
                    {o.financials?.totalAmount} ر.س
                  </div>
                ))}
              </div>
            )}

            {/* الأجزاء الملغية */}
            {cancelledOrders.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-right space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-amber-600" />
                  <p className="font-semibold text-xs text-amber-800">
                    تم إلغاؤه واسترداد مبلغه ({cancelledOrders.length} طلب):
                  </p>
                </div>
                {cancelledOrders.map((o) => (
                  <div
                    key={String(o._id)}
                    className="text-xs text-amber-700 pr-6"
                  >
                    طلب #{String(o._id).slice(-6).toUpperCase()} —{" "}
                    {o.financials?.totalAmount} ر.س
                  </div>
                ))}
                <p className="text-[11px] text-amber-600 pt-1 border-t border-amber-200">
                  المبلغ المسترد هيرجع لبطاقتك خلال ٥-١٠ أيام عمل حسب بنكك.
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══ حالة الفشل ═══ */}
        {outcome === "failed" && (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                <XCircle className="w-12 h-12" strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display text-[var(--color-primary)]">
                لم تتم عملية الدفع
              </h2>
              {backendStatus === "CANCELLED" && order?.payment?.paidAt ? (
                <p className="text-xs text-red-700">
                  تم خصم المبلغ ثم إلغاء الطلب (اللوحات لم تعد متاحة)، وتم إصدار
                  استرداد كامل لبطاقتك — هيظهر خلال ٥-١٠ أيام عمل حسب بنكك.
                </p>
              ) : (
                <p className="text-stone-500 text-sm leading-relaxed">
                  تم رفض أو إلغاء العملية. لم يتم خصم أي مبلغ، واللوحات لسه
                  محفوظة في سلتك. تقدر تحاول تاني في أي وقت.
                </p>
              )}
            </div>

            {message && backendStatus !== "CANCELLED" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-right">
                <div className="flex items-start gap-2 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="font-semibold text-xs text-red-800">سبب الرفض:</p>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  {translatedMessage || message}
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══ حالة معلّقة ═══ */}
        {outcome === "pending" && (
          <>
            <div className="flex justify-center py-2">
              <div className="relative w-24 h-24">
                <span className="absolute inset-0 rounded-full bg-[var(--color-primary)]/10 animate-ping [animation-duration:2.4s]" />
                <span className="absolute inset-2 rounded-full bg-[var(--color-primary)]/10 animate-ping [animation-duration:2.4s] [animation-delay:0.6s]" />
                <div className="absolute inset-3 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 flex items-center justify-center text-[var(--color-primary)]">
                  <ShoppingBag className="w-9 h-9" strokeWidth={1.5} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display text-[var(--color-primary)]">
                جاري تأكيد العملية
              </h2>
              <p className="text-stone-500 text-sm leading-relaxed">
                بنؤكد حالة دفعتك دلوقتي. لو اتخصم المبلغ، هتلاقي طلبك في صفحة
                "طلباتي" خلال لحظات.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <ProcessingStep state="done" label="تم استلام الدفع" />
              <ProcessingStep state="active" label="جاري التحقق مع البنك" />
              <ProcessingStep state="pending" label="تأكيد الطلب" />
            </div>

            {pollTimedOut && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-right">
                <p className="text-xs text-amber-800 leading-relaxed">
                  التأكيد بياخد وقت أطول من المعتاد. تقدر تتابع حالة طلبك من
                  صفحة "طلباتي" — لو المبلغ اتخصم، طلبك هيظهر هناك تلقائياً
                  خلال دقائق.
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══ تفاصيل العملية ═══ */}
        {paymentId && (
          <div className="bg-stone-50 border border-stone-150 p-4 rounded-sm text-right space-y-2 text-xs text-stone-600">
            <div className="flex justify-between">
              <span className="font-semibold">رقم العملية:</span>
              <span className="font-mono text-stone-800 select-all">
                {paymentId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">الحالة:</span>
              <span
                className={`font-semibold ${
                  outcome === "paid"
                    ? "text-emerald-700"
                    : outcome === "partial"
                      ? "text-amber-700"
                      : outcome === "failed"
                        ? "text-red-600"
                        : "text-amber-700"
                }`}
              >
                {outcome === "paid"
                  ? "مقبول / ناجح"
                  : outcome === "partial"
                    ? "تم جزئياً"
                    : outcome === "failed"
                      ? "مرفوض / فاشل"
                      : "قيد التحقق"}
              </span>
            </div>
            {order && (outcome === "paid" || outcome === "partial") && (
              <div className="flex justify-between pt-1 border-t border-stone-200">
                <span className="font-semibold">رقم الطلب:</span>
                <span className="font-mono text-stone-800">
                  #{String(order._id).slice(-6).toUpperCase()}
                  {allOrders && allOrders.length > 1 && ` +${allOrders.length - 1}`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ═══ ملاحظة الأمان ═══ */}
        {(outcome === "paid" || outcome === "partial") && (
          <div className="bg-[var(--color-surface-container-low)] p-4 rounded-sm text-right flex gap-3 items-start">
            <ShieldCheck className="w-5 h-5 text-[var(--color-secondary)] shrink-0 mt-0.5" />
            <p className="text-xs text-stone-600 leading-relaxed">
              تم إخطار الفنانين بطلبك لتجهيز اللوحات. ستتلقى تحديثات الشحن عبر
              بريدك الإلكتروني وصفحة طلباتي.
            </p>
          </div>
        )}

        {/* ═══ الأزرار ═══ */}
        <div className="flex flex-col gap-3 pt-4">
          {outcome === "failed" ? (
            <>
              <Link to={ROUTES.CART}>
                <Button variant="primary" fullWidth icon={RefreshCw}>
                  حاول الدفع مرة أخرى
                </Button>
              </Link>
              <Link to={ROUTES.ARTWORKS}>
                <Button variant="outline" fullWidth icon={ShoppingBag}>
                  مواصلة التسوق
                </Button>
              </Link>
            </>
          ) : outcome === "pending" ? (
            <Link to={ROUTES.MY_ORDERS}>
              <Button variant="outline" fullWidth icon={FileText}>
                استعراض طلباتي
              </Button>
            </Link>
          ) : (
            <>
              <Link to={ROUTES.MY_ORDERS}>
                <Button variant="primary" fullWidth icon={FileText}>
                  استعراض طلباتي
                </Button>
              </Link>
              <Link to={ROUTES.ARTWORKS}>
                <Button variant="outline" fullWidth icon={ShoppingBag}>
                  مواصلة التسوق
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProcessingStep({ state, label }) {
  return (
    <div className="flex items-center gap-3 text-right">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
          state === "done"
            ? "bg-emerald-500/10 text-emerald-600"
            : state === "active"
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "bg-stone-100 text-stone-400"
        }`}
      >
        {state === "done" ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : state === "active" ? (
          <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-stone-300" />
        )}
      </div>
      <span
        className={`text-xs font-medium ${
          state === "pending" ? "text-stone-400" : "text-stone-700"
        }`}
      >
        {label}
      </span>
    </div>
  );
}