import api from "../../../services/api";

export const ordersService = {
  getMyOrders: async (params = {}) => {
    try {
      const { data } = await api.get("/orders/my-orders", { params });
      if (data?.data?.orders) {
        return data.data;
      } else if (data?.orders) {
        return data;
      } else if (Array.isArray(data?.data)) {
        return { orders: data.data, pagination: { total: data.data.length } };
      } else {
        return { orders: [], pagination: { total: 0 } };
      }
    } catch (error) {
      return { orders: [], pagination: { total: 0 } };
    }
  },

  getOrderById: async (orderId) => {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      return data?.data || data;
    } catch (error) {
      throw error;
    }
  },

  getOrderByPaymentId: async (paymentId) => {
    const response = await api.get(`/orders/by-payment/${paymentId}`);
    return response?.data ?? response;
  },

  getCheckoutInvoiceStatus: async (invoiceId) => {
    const { data } = await api.get(`/orders/checkout/${invoiceId}/status`);
    return data?.data ?? data;
  },

  checkout: async (paymentMethod = "creditcard") => {
    try {
      const { data } = await api.post(
        "/orders/checkout",
        { paymentMethod },
        { timeout: 40000 },
      );
      return data?.data || data;
    } catch (error) {
      throw error;
    }
  },

  cancelOrder: async (orderId, reason) => {
    const { data } = await api.patch(`/orders/${orderId}/cancel`, { reason });
    return data.data;
  },

  confirmDelivery: async (orderId) => {
    const response = await api.patch(`/orders/${orderId}/confirm-delivery`);
    return response?.data?.data ?? response?.data ?? response;
  },
};
