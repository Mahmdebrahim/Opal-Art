const express = require("express");
const router = express.Router();

const {
  getAllWithdrawals,
  approveWithdrawal,
  markWithdrawalAsPaid,
  rejectWithdrawal,
  getWithdrawalsSummary,
  holdOrderFunds,
  unholdOrderFunds,
  releaseOrderFunds,
  getAdminStats,
  getFinancialStats,
  getAdminOrders,
  forceCancelOrder,
  getAdminArtists,
  getPendingBankAccounts,
  verifyBankAccount,
  rejectBankAccount,
  getAdminUsers,
  banUser,
  unbanUser,
  getAdminArtworks,
  getPendingArtworks,
  getArtworkOrderHistory,
  approveArtwork,
  rejectArtwork,
  suspendArtwork,
  unsuspendArtwork,
  deleteArtworkAdmin,
  getAuditLogs,
} = require("../controllers/admin.controller");

const {
  getSupportTickets,
  updateTicketStatus,
} = require("../controllers/support.controller");

const { protect, restrictTo } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validation.middleware");
const {
  approveWithdrawalValidator,
  markPaidWithdrawalValidator,
  rejectWithdrawalValidator,
} = require("../validators/admin.validator");

const { unfeatureArtwork } = require("../controllers/artwork.controller");

router.use(protect);
router.use(restrictTo("admin"));

// ═══ Stats ═══
router.get("/stats", getAdminStats);
router.get("/stats/financial", getFinancialStats);

// ═══ Withdrawals ═══
router.get("/withdrawals", getAllWithdrawals);
router.put(
  "/withdrawals/:id/approve",
  approveWithdrawalValidator,
  validate,
  approveWithdrawal,
);
router.put(
  "/withdrawals/:id/mark-paid",
  markPaidWithdrawalValidator,
  validate,
  markWithdrawalAsPaid,
);
router.put(
  "/withdrawals/:id/reject",
  rejectWithdrawalValidator,
  validate,
  rejectWithdrawal,
);
router.get("/withdrawals/summary", getWithdrawalsSummary);

// ═══ Orders ═══
router.get("/orders", getAdminOrders);
router.post("/orders/:orderId/force-cancel", forceCancelOrder);
router.patch("/orders/:orderId/hold", holdOrderFunds);
router.patch("/orders/:orderId/unhold", unholdOrderFunds);
router.patch("/orders/:orderId/release", releaseOrderFunds);

router.get("/artists", getAdminArtists);
router.get("/bank-accounts/pending", getPendingBankAccounts);
router.patch("/bank-accounts/:id/verify", verifyBankAccount);
router.patch("/bank-accounts/:id/reject", rejectBankAccount);

router.get("/users", getAdminUsers);
router.patch("/users/:id/ban", banUser);
router.patch("/users/:id/unban", unbanUser);

// ═══ Artworks Management ═══
router.get("/artworks", getAdminArtworks);
router.get("/artworks/pending", getPendingArtworks);
router.get("/artworks/:id/orders", getArtworkOrderHistory);
router.patch("/artworks/:id/approve", approveArtwork);
router.patch("/artworks/:id/reject", rejectArtwork);
router.patch("/artworks/:id/suspend", suspendArtwork);
router.patch("/artworks/:id/unsuspend", unsuspendArtwork);
router.delete("/artworks/:id", deleteArtworkAdmin);

// ✅ Admin can unfeature any artwork
router.patch("/artworks/:id/unfeature", unfeatureArtwork);

router.get("/support", getSupportTickets);
router.patch("/support/:id", updateTicketStatus);

router.get("/audit-logs", getAuditLogs);

module.exports = router;
