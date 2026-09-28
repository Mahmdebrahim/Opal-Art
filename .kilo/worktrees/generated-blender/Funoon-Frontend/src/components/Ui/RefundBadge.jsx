import { CheckCircle2, AlertCircle, Clock, ExternalLink } from 'lucide-react';

/**
 * @param {object} order
 * @param {"buyer"|"artist"|"admin"} viewer
 * @param {function} onManualRefund - callback للأدمن (اختياري)
 */
export default function RefundBadge({ order, viewer = "buyer", onManualRefund }) {
  const wasPaid = order.payment?.paidAt || order.payment?.paymentId;
  if (!wasPaid) return null;

  const status = order.refundStatus;

  // ═══ REFUNDED / COMPLETED ═══
  if (status === "REFUNDED" || status === "COMPLETED") {
    const messages = {
      buyer: {
        title: "تم استرداد المبلغ بالكامل",
        subtitle: order.refundedAmount
          ? `${order.refundedAmount} ر.س${order.refundedAt ? ` · ${new Date(order.refundedAt).toLocaleDateString("ar-SA")}` : ""}`
          : "سيظهر خلال 5-10 أيام عمل حسب بنكك",
      },
      artist: {
        title: "تم استرداد المبلغ للمشتري",
        subtitle: "الطلب مُلغى وتم رد المبلغ كاملاً",
      },
      admin: {
        title: "تم الاسترداد بنجاح",
        subtitle: order.refundedAmount
          ? `${order.refundedAmount} ر.س${order.refundedAt ? ` · ${new Date(order.refundedAt).toLocaleDateString("ar-SA")}` : ""}`
          : "تم رد المبلغ للمشتري",
      },
    };
    const msg = messages[viewer];

    return (
      <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-emerald-800">{msg.title}</p>
          {msg.subtitle && (
            <p className="text-[10px] text-emerald-700 mt-0.5">{msg.subtitle}</p>
          )}
        </div>
      </div>
    );
  }

  // ═══ PENDING (جاري الاسترداد — بانتظار webhook) ═══
  if (status === "PENDING") {
    const messages = {
      buyer: {
        title: "جاري الاسترداد...",
        subtitle: "تم إرسال طلب الاسترداد ويظهر المبلغ خلال 5-10 أيام عمل",
      },
      artist: {
        title: "جاري استرداد المبلغ للمشتري",
        subtitle: "العملية قيد التنفيذ — ستكتمل تلقائياً",
      },
      admin: {
        title: "جاري الاسترداد (بانتظار تأكيد Moyasar)",
        subtitle: "إذا تأخر أكثر من ساعة، تحقق من داشبورد Moyasar",
      },
    };
    const msg = messages[viewer];

    return (
      <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded">
        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
        <div>
          <p className="text-xs font-bold text-amber-800">{msg.title}</p>
          {msg.subtitle && (
            <p className="text-[10px] text-amber-700 mt-0.5">{msg.subtitle}</p>
          )}
        </div>
      </div>
    );
  }

  // ═══ FAILED ═══
  if (status === "FAILED") {
    // الأدمن: رسالة عملية (هو اللي هينفذ)
    if (viewer === "admin") {
      return (
        <div className="bg-red-50 border border-red-200 rounded p-2.5 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-800">
                فشل الاسترداد التلقائي
              </p>
              <p className="text-[10px] text-red-700 mt-0.5">
                مطلوب تنفيذ الاسترداد يدوياً من داشبورد Moyasar
              </p>
              {order.payment?.paymentId && (
                <p className="text-[10px] font-mono text-red-800 mt-1" dir="ltr">
                  Payment ID: {order.payment.paymentId}
                </p>
              )}
            </div>
          </div>
          {order.payment?.paymentId && (
            <a
              href="https://dashboard.moyasar.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              فتح داشبورد Moyasar
            </a>
          )}
        </div>
      );
    }

    // المشتري: رسالة طمأنة
    if (viewer === "buyer") {
      return (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-800">
              جاري معالجة الاسترداد يدوياً
            </p>
            <p className="text-[10px] text-red-700 mt-0.5">
              فريق الدعم يُعالج الاسترداد وسيتم إتمامه خلال 24-48 ساعة
            </p>
          </div>
        </div>
      );
    }

    // الفنان: معلومة فقط (مش مشكلته)
    return (
      <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-800">
            تم استرداد المبلغ للمشتري
          </p>
          <p className="text-[10px] text-amber-700 mt-0.5">
            الطلب مُلغى وتم رد المبلغ للمشتري
          </p>
        </div>
      </div>
    );
  }

  // ═══ NONE أو أي حالة تانية ═══
  return null;
}