// ═══ Mapping أساسي ═══
export const CANCELLATION_REASONS_AR = {
  buyer_banned_during_checkout: "أُلغي الطلب لحظر حساب المشتري أثناء الدفع",
  artist_banned_during_checkout: "أُلغي الطلب لحظر حساب الفنان أثناء الدفع",

  buyer_banned_before_payment: "أُلغي الطلب لحظر حساب المشتري أثناء الدفع",
  artist_banned_before_payment: "أُلغي الطلب لحظر حساب الفنان أثناء الدفع",

  artwork_sold_to_another_buyer: "اللوحة بِيعت لمشترٍ آخر قبل اكتمال الدفع",
  expired_pending_order: "انتهت مهلة الدفع (15 دقيقة) دون إتمام",
  expired_jit_cleanup: "أُلغي تلقائياً لتنظيف طلبات قديمة",
  superseded_by_new_checkout: "أُنشئ طلب جديد لنفس اللوحات",

  oto_shipment_returned: "الشحنة ارتجعت إلى الفنان من شركة الشحن",
  oto_shipment_cancelled: "شركة الشحن ألغت الشحنة",
};

const BUYER_MESSAGES = {
  buyer_banned_during_checkout: "أُلغي الطلب لحظر حسابك أثناء إتمام الدفع",
  buyer_banned_before_payment: "أُلغي الطلب لحظر حسابك أثناء إتمام الدفع",
  artist_banned_during_checkout: "أُلغي الطلب لحظر حساب الفنان أثناء إتمام الدفع",
  artist_banned_before_payment: "أُلغي الطلب لحظر حساب الفنان أثناء إتمام الدفع",
  oto_shipment_returned: "ارتجعت الشحنة إلى الفنان — تم استرداد المبلغ لك",
  oto_shipment_cancelled: "ألغت شركة الشحن الشحنة — تم استرداد المبلغ لك",
};

const ARTIST_MESSAGES = {
  buyer_banned_during_checkout: "أُلغي الطلب لحظر حساب المشتري — تم استرداد المبلغ له",
  buyer_banned_before_payment: "أُلغي الطلب لحظر حساب المشتري — تم استرداد المبلغ له",
  artist_banned_during_checkout: "أُلغي الطلب لحظر حسابك — تم استرداد المبلغ للمشتري",
  artist_banned_before_payment: "أُلغي الطلب لحظر حسابك — تم استرداد المبلغ للمشتري",
  oto_shipment_returned: "ارتجعت الشحنة إليك من شركة الشحن — تم استرداد المبلغ للمشتري",
  oto_shipment_cancelled: "ألغت شركة الشحن الشحنة — تم استرداد المبلغ للمشتري",
};

const ADMIN_MESSAGES = {
  buyer_banned_during_checkout: "أُلغي لحظر المشتري أثناء الدفع — تم الاسترداد",
  buyer_banned_before_payment: "أُلغي لحظر المشتري أثناء الدفع — تم الاسترداد",
  artist_banned_during_checkout: "أُلغي لحظر الفنان أثناء الدفع — تم الاسترداد",
  artist_banned_before_payment: "أُلغي لحظر الفنان أثناء الدفع — تم الاسترداد",
  oto_shipment_returned: "الشحنة ارتجعت — تم الاسترداد للمشتري",
  oto_shipment_cancelled: "شركة الشحن ألغت — تم الاسترداد للمشتري",
};

/**
 * @param {object} order
 * @param {"buyer"|"artist"|"admin"} viewer
 */
export function getCancellationMessage(order, viewer = "buyer") {
  const reason = order.cancellationReason;
  if (!reason) return null;

  // Admin cancellation
  if (reason.startsWith("إلغاء بواسطة الإدارة")) {
    return {
      ar: `إلغاء بواسطة الإدارة: ${order.adminOverrideReason || "بدون سبب"}`,
      showRefund: true,
    };
  }

  // Auto cancellation with artwork name
  if (reason.startsWith("auto_cancelled: artwork")) {
    return {
      ar: viewer === "artist"
        ? "أحد أعمالك بِيع لمشترٍ آخر قبل اكتمال دفع هذا الطلب — تم الاسترداد"
        : viewer === "admin"
          ? "اللوحة بِيعت لمشترٍ آخر — تم الاسترداد للمشتري"
          : "اللوحة بِيعت لمشترٍ آخر — تم الاسترداد",
      showRefund: true,
    };
  }

  //  OTO shipment issues 
  if (reason === "oto_shipment_returned" || reason === "oto_shipment_cancelled") {
    const viewerMessages = {
      buyer: BUYER_MESSAGES, artist: ARTIST_MESSAGES, admin: ADMIN_MESSAGES,
    }[viewer] || BUYER_MESSAGES;
    const baseMsg = viewerMessages[reason] || CANCELLATION_REASONS_AR[reason];
    const suffix = viewer === "admin" && order.adminOverrideReason
      ? ` — ${order.adminOverrideReason}`
      : "";
    return { ar: baseMsg + suffix, showRefund: true };
  }

  // Buyer custom cancellation
  if (order.cancelledBy === "buyer" && !CANCELLATION_REASONS_AR[reason]) {
    return {
      ar: `إلغاء بواسطة المشتري: ${reason}`,
      showRefund: Boolean(order.payment?.paidAt || order.payment?.paymentId),
    };
  }

  const viewerMessages = {
    buyer: BUYER_MESSAGES, artist: ARTIST_MESSAGES, admin: ADMIN_MESSAGES,
  }[viewer] || BUYER_MESSAGES;

  return {
    ar: viewerMessages[reason] || CANCELLATION_REASONS_AR[reason] || reason,
    showRefund: Boolean(order.payment?.paidAt || order.payment?.paymentId),
  };
}