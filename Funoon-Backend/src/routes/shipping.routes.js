//!ONE SHOT
// // src/routes/shipping.routes.js
// const express = require("express");
// const router = express.Router();

// const {
//   calculateShipping,
//   createShipment,
//   getAWBUrl,
//   trackShipment,
//   handleOTOWebhook,
// } = require("../controllers/shipping.controller");
// const { protect, restrictTo } = require("../middlewares/auth.middleware");

// // Public (OTO Webhook)
// router.post("/webhooks/oto", handleOTOWebhook);

// // Protected
// router.post("/calculate", protect, calculateShipping);
// router.post("/create", protect, restrictTo("artist", "admin"), createShipment);
// router.get("/:orderId/awb", protect, getAWBUrl);
// router.get("/:orderId/track", protect, trackShipment);

// module.exports = router;

//! TEST TWO SHOTS

const express = require("express");
const router = express.Router();

const {
  calculateShipping,
  createOtoOrder, // ✅ جديد
  createShipment, // ✅ جديد (endpoint 2)
  getAWBUrl,
  trackShipment,
  handleOTOWebhook,
} = require("../controllers/shipping.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const verifyOtoWebhook = require("../middlewares/verify-oto-webhook.middleware");

// ─── Public (Webhooks) ─────────────────────────────────────────
router.post("/webhooks/oto", verifyOtoWebhook, handleOTOWebhook);

// ─── Protected: Artist/Admin فقط ───────────────────────────────
router.post("/calculate", protect, calculateShipping);

// ✅ Step 1: Create OTO order
router.post(
  "/:orderId/create-oto-order",
  protect,
  restrictTo("artist", "admin"),
  createOtoOrder,
);

// ✅ Step 2: Create shipment
router.post(
  "/:orderId/create-shipment",
  protect,
  restrictTo("artist", "admin"),
  createShipment,
);

// ─── Protected: Buyer/Artist/Admin ─────────────────────────────
router.get("/:orderId/awb", protect, getAWBUrl);
router.get("/:orderId/track", protect, trackShipment);

module.exports = router;
