import api from "../../../services/api";

/**
 * يتعامل مع 3 أشكال response محتملة:
 *  1) axios raw        → { data: { success, data: PAYLOAD, message } }
 *  2) interceptor unwrap → { success, data: PAYLOAD, message }
 *  3) payload مباشر     → PAYLOAD
 * في كل الحالات بيرجع الـ PAYLOAD الفعلي.
 */
const unwrap = (res) => {
  const body = res?.data ?? res;
  return body?.data ?? body;
};

export const subscriptionsService = {
  // الـ backend بيرجع { subscription: {...} } → نرجع الـ inner object
  // عشان الـ page تستخدم subscription.isActive / .plan / .endDate مباشرة
  getMySubscription: async () => {
    const payload = unwrap(await api.get("/subscriptions/my"));
    return payload?.subscription ?? payload;
  },
  getQuote: async (planId) => {
    const response = await api.get(`/subscriptions/quote/${planId}`);
    return response.data;
  },
  getCheckoutDetails: async (invoiceId) => {
    const response = await api.get(
      `/subscriptions/checkout-details/${invoiceId}`,
    );
    return response.data;
  },
  validateCoupon: async (code) =>
    unwrap(await api.post("/subscriptions/coupons/validate", { code })),
  purchase: async (planId, couponCode = "") =>
    unwrap(await api.post("/subscriptions/purchase", { planId, couponCode })),

  getMyPayments: async () =>
    unwrap(await api.get("/subscriptions/my/payments")),
};
