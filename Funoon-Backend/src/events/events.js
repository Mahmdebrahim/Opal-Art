const EVENTS = {
  // Auth
  USER_REGISTERED: "user:registered",
  PASSWORD_RESET: "user:password_reset",
  USER_BANNED: "user:banned",
  USER_UNBANNED: "user:unbanned",

  // Artworks
  ARTWORK_SUBMITTED: "artwork:submitted",
  ARTWORK_UPDATED_NEEDS_REVIEW: "artwork:updated_needs_review",
  ARTWORK_APPROVED: "artwork:approved",
  ARTWORK_REJECTED: "artwork:rejected",
  ARTWORK_SUSPENDED: "artwork:suspended",

  // Orders
  ORDER_CREATED: "order:created",
  ORDER_PAID: "order:paid",
  ORDER_SHIPPED: "order:shipped",
  ORDER_DELIVERED: "order:delivered",
  ORDER_CANCELLED: "order:cancelled",
  ORDER_FUNDS_RELEASED: "order:funds_released",
  ORDER_HELD: "order:held",
  ORDER_UNHELD: "order:unheld",
  REFUND_FAILED: "refund:failed",
  REFUND_MANUALLY_COMPLETED: "refund:manually_completed",

  // Withdrawals
  WITHDRAWAL_REQUESTED: "withdrawal:requested",
  WITHDRAWAL_APPROVED: "withdrawal:approved",
  WITHDRAWAL_REJECTED: "withdrawal:rejected",
  WITHDRAWAL_PAID: "withdrawal:paid",

  // Subscriptions
  SUBSCRIPTION_EXPIRING: "subscription:expiring",
  SUBSCRIPTION_EXPIRED: "subscription:expired", 
  SUBSCRIPTION_PURCHASED: "subscription:purchased",
  SUBSCRIPTION_ACTIVATED: "subscription:activated",

  // Support
  SUPPORT_MESSAGE_RECEIVED: "support:message_received",
};

module.exports = EVENTS;
