// src/controllers/shipping.controller.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Artwork = require("../models/Artwork");
const Wallet = require("../models/Wallet");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const OTOService = require("../services/shipping/oto.service");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../utils/api-error");
const ApiResponse = require("../utils/api-response");
const catchAsync = require("../utils/catch-async");
const logger = require("../utils/logger");
const eventEmitter = require("../events/event-emitter");
const EVENTS = require("../events/events");
const MoyasarService = require("../services/payment/moyasar.service");
const otoService = OTOService;
const M = require("../utils/messages");

// ✅ Helper: فلترة خيارات الشحن
const filterShippingOptions = (deliveryOptions = [], artworkPrice = null) => {
  return (deliveryOptions || []).filter((opt) => {
    if (opt.deliveryType === "pickupByCustomer") return false;
    if (opt.pickupDropoff === "dropoffOnly") return false;
    if (opt.deliveryType !== "toCustomerDoorstep") return false;
    if (
      opt.pickupDropoff !== "freePickup" &&
      opt.pickupDropoff !== "freePickupDropoff"
    ) {
      return false;
    }

    if (
      artworkPrice != null &&
      opt.maxOrderValue &&
      artworkPrice > opt.maxOrderValue
    ) {
      logger.info(
        `🚫 Excluding ${opt.deliveryCompanyName}: maxOrderValue ${opt.maxOrderValue} < artworkPrice ${artworkPrice}`,
      );
      return false;
    }

    return true;
  });
};

// @desc    Calculate shipping cost (للـ Frontend قبل الـ Checkout)
// @route   POST /api/v1/shipping/calculate

const calculateShipping = catchAsync(async (req, res, next) => {
  const { artworkId, destinationCity } = req.body;

  const artwork = await Artwork.findById(artworkId).populate("artist");
  if (!artwork) throw new NotFoundError(M.artworks.notFound);

  const artist = artwork.artist;
  const originCity = artist.address?.city || "Riyadh";

  const response = await otoService.checkOTODeliveryFee({
    originCity,
    destinationCity: destinationCity || req.user.address?.city || "Riyadh",
    weight: artwork.weight || 2,
    width: artwork.dimensions?.width || 60,
    height: artwork.dimensions?.height || 80,
    length: artwork.dimensions?.depth || 3,
    shippingType: artwork.shippingType || "standard",
  });

  const allOptions = response.deliveryCompany || [];
  const validOptions = filterShippingOptions(allOptions, artwork.price);

  logger.info(
    `📦 calculateShipping: ${allOptions.length} total, ${validOptions.length} valid after filtering`,
  );

  const optionsToShow = validOptions.length > 0 ? validOptions : allOptions;

  const cheapestOption = optionsToShow.reduce(
    (min, opt) => (opt.price < min.price ? opt : min),
    optionsToShow[0] || { price: Infinity },
  );

  return ApiResponse.success(
    res,
    {
      originCity,
      destinationCity: destinationCity || req.user.address?.city,
      options: optionsToShow.map((option) => ({
        deliveryOptionId: option.deliveryOptionId,
        carrier: option.deliveryCompanyName,
        deliveryOptionName: option.deliveryOptionName,
        price: option.price,
        avgDeliveryTime: option.avgDeliveryTime,
        pickupCutOffTime: option.pickupCutOffTime,
        maxFreeWeight: option.maxFreeWeight,
        extraWeightPerKg: option.extraWeightPerKg,
        serviceType: option.serviceType,
        deliveryType: option.deliveryType,
        pickupDropoff: option.pickupDropoff,
        logo: option.logo,
      })),
      recommended: cheapestOption
        ? {
            deliveryOptionId: cheapestOption.deliveryOptionId,
            carrier: cheapestOption.deliveryCompanyName,
            price: cheapestOption.price,
          }
        : null,
      hasValidOptions: validOptions.length > 0,
    },
    "Shipping cost calculated",
  );
});

//! ONE SHOT

// @desc    Create shipment for order
// @route   POST /api/v1/shipping/create
// const createShipment = catchAsync(async (req, res, next) => {
//   const { orderId } = req.body;

//   const order = await Order.findById(orderId);

//   if (!order) throw new NotFoundError(M.orders.notFound);

//   if (order.artist.toString() !== req.user._id.toString()) {
//     throw new UnauthorizedError(M.shipping.notAuthorizedToShip);
//   }

//   if (order.status !== "PAID") {
//     throw new BadRequestError(
//       `Cannot create shipment for order with status: ${order.status}`,
//     );
//   }

//   if (order.shipping?.otoListId) {
//     throw new BadRequestError(
//       "Shipment already created for this order. Use tracking endpoint.",
//     );
//   }

//   const deliveryOptionId = order.shipping?.deliveryOptionId;

//   if (!deliveryOptionId) {
//     throw new BadRequestError(
//       "No delivery option found for this order. Please contact support.",
//     );
//   }

//   const artistAddress = order.shipping?.artistAddress || {};
//   const buyerAddress = order.shipping?.buyerAddress || {};

//   console.log("🏠 Artist Address:", JSON.stringify(artistAddress));
//   console.log("🏠 Buyer Address:", JSON.stringify(buyerAddress));

//   if (!artistAddress.city || !buyerAddress.city) {
//     throw new BadRequestError(
//       "Missing address information in order. Please contact support.",
//     );
//   }

//   const funoonOrderId = `FUNOON-${order._id}`;

//   // ═══════════════════════════════════════════════════════════════
//   // ✅ الخطوة 1: Create Order (بدون createShipment)
//   // ═══════════════════════════════════════════════════════════════
//   const dims = order.items.reduce(
//     (acc, item) => {
//       const d = item.artworkSnapshot?.dimensions || {};
//       return {
//         width: Math.max(acc.width, d.width || 60),
//         length: Math.max(acc.length, d.height || 80),
//         height: acc.height + (d.depth || 3),
//         weight: acc.weight + (d.weight || 2),
//       };
//     },
//     { width: 0, length: 0, height: 0, weight: 0 },
//   );

//   const orderData = {
//     orderId: funoonOrderId,
//     deliveryOptionId: deliveryOptionId,
//     paymentMethod: "paid",
//     amount: order.financials.subtotal,
//     currency: order.financials.currency || "SAR",
//     packageCount: order.items.length,
//     packageWeight: dims.weight,
//     boxWidth: dims.width,
//     boxLength: dims.length,
//     boxHeight: dims.height,
//     senderInformation: {
//       senderFullName: artistAddress.name || "Artist",
//       senderMobile: artistAddress.phone?.replace(/[^0-9]/g, "") || "0500000000",
//       senderCountry: artistAddress.country || "SA",
//       senderCity: artistAddress.city,
//       senderDistrict: artistAddress.district || "",
//       senderStreet: artistAddress.street || "",
//       senderAddressLine:
//         `${artistAddress.buildingNo || ""}, ${artistAddress.street || ""}, ${artistAddress.district || ""}, ${artistAddress.city}, Saudi Arabia`.trim(),
//       senderBuildingNo: artistAddress.buildingNo || "",
//       senderPostcode: artistAddress.zipCode || "",
//       senderShortAddressCode: artistAddress.shortAddressCode || "",
//       lat: artistAddress.lat || undefined,
//       lon: artistAddress.lon || undefined,
//     },
//     customer: {
//       name: buyerAddress.name || "Customer",
//       mobile: buyerAddress.phone?.replace(/[^0-9]/g, "") || "0500000000",
//       address:
//         `${buyerAddress.buildingNo || ""}, ${buyerAddress.street || ""}, ${buyerAddress.district || ""}, ${buyerAddress.city}, Saudi Arabia`.trim(),
//       city: buyerAddress.city,
//       district: buyerAddress.district || "",
//       country: buyerAddress.country || "SA",
//       postcode: buyerAddress.zipCode || "",
//       buildingNo: buyerAddress.buildingNo || "",
//       street: buyerAddress.street || "",
//       shortAddressCode: buyerAddress.shortAddressCode || "",
//       lat: buyerAddress.lat || undefined,
//       lon: buyerAddress.lon || undefined,
//     },
//     items: order.items.map((item) => ({
//       name: item.artworkSnapshot?.title || "Artwork",
//       quantity: 1,
//       price: item.artworkSnapshot?.price || 0,
//       sku: `ART-${item.artwork}`,
//     })),
//   };

//   logger.info(`📦 [Step 1/4] Creating OTO order for ${order._id}...`);

//   let otoOrderResponse;
//   try {
//     otoOrderResponse = await otoService.createOrder(orderData);
//   } catch (err) {
//     logger.error("❌ createOrder failed:", err);
//     throw new BadRequestError(
//       err.otoErrorMessage || "Failed to create order in OTO",
//     );
//   }

//   if (otoOrderResponse.success === false) {
//     logger.error(
//       "❌ OTO createOrder failed:",
//       JSON.stringify(otoOrderResponse, null, 2),
//     );
//     throw new BadRequestError(
//       otoOrderResponse.otoErrorMessage || "Failed to create order in OTO",
//     );
//   }

//   logger.info("✅ [Step 1/4] OTO order created successfully");
//   logger.info(`   🔑 OTO ID: ${otoOrderResponse.otoId || "(not returned)"}`);

//   // ═══════════════════════════════════════════════════════════════
//   // ✅ الخطوة 2: Create Shipment (endpoint منفصل)
//   // ═══════════════════════════════════════════════════════════════
//   logger.info(`📦 [Step 2/4] Creating shipment for: ${funoonOrderId}...`);

//   let shipmentResponse = null;
//   try {
//     await new Promise((resolve) => setTimeout(resolve, 1000));

//     shipmentResponse = await otoService.createShipment(
//       funoonOrderId,
//       deliveryOptionId,
//     );
//     logger.info("✅ [Step 2/4] OTO shipment created successfully");
//     logger.info(
//       "📥 createShipment response:",
//       JSON.stringify(shipmentResponse, null, 2),
//     );
//   } catch (err) {
//     logger.error("❌ createShipment failed:", err.message || err);
//   }

//   // ═══════════════════════════════════════════════════════════════
//   // ✅ الخطوة 3: Print AWB (للحصول على رابط الطباعة)
//   // ═══════════════════════════════════════════════════════════════
//   let awbResponse = null;
//   try {
//     await new Promise((resolve) => setTimeout(resolve, 500));
//     awbResponse = await otoService.printAWB(funoonOrderId);
//     logger.info("✅ [Step 3/4] AWB retrieved successfully");
//     logger.info("📥 printAWB response:", JSON.stringify(awbResponse, null, 2));
//   } catch (err) {
//     logger.warn(
//       "⚠️ [Step 3/4] Could not retrieve AWB yet (may come via webhook later):",
//       err.otoErrorMessage || err.message,
//     );
//   }

//   // ═══════════════════════════════════════════════════════════════
//   // ✅ الخطوة 4: جلب البيانات الكاملة من orderStatus (مع Retry Logic)
//   // ═══════════════════════════════════════════════════════════════
//   let orderStatus = null;
//   let trackingNumber = "";
//   let trackingUrl = "";
//   let awbUrl = "";
//   let carrier = "";

//   const maxRetries = 2;
//   const retryDelay = 1500;

//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     try {
//       const waitTime = attempt === 1 ? 2000 : retryDelay;
//       logger.info(
//         `⏳ [Step 4/4] Attempt ${attempt}/${maxRetries} - waiting ${waitTime / 1000}s before fetching orderStatus...`,
//       );
//       await new Promise((resolve) => setTimeout(resolve, waitTime));

//       orderStatus = await otoService.getOrderStatus(funoonOrderId);

//       if (orderStatus?.success) {
//         logger.info(
//           `✅ [Step 4/4] Attempt ${attempt} - orderStatus retrieved`,
//         );

//         // استخراج البيانات
//         trackingNumber =
//           orderStatus?.shipmentId || orderStatus?.trackingNumber || "";
//         trackingUrl = orderStatus?.trackingUrl || "";
//         awbUrl = orderStatus?.printAWBURL || "";
//         carrier = orderStatus?.deliveryCompany || "";

//         // لو لقينا trackingNumber، كده كفاية
//         if (trackingNumber) {
//           logger.info(`🎯 Got tracking data on attempt ${attempt}`);
//           break;
//         } else {
//           logger.info(
//             `⚠️ Attempt ${attempt} - trackingNumber still empty, will retry...`,
//           );
//         }
//       }
//     } catch (err) {
//       logger.warn(`⚠️ Attempt ${attempt} failed:`, err.message);
//     }
//   }

//   // ═══════════════════════════════════════════════════════════════
//   // ✅ Fallback: لو لسه مفيش بيانات، هنعتمد على الـ webhook اللي هيجي
//   // ═══════════════════════════════════════════════════════════════
//   if (!trackingNumber) {
//     logger.warn(
//       `⚠️ Could not get tracking data after ${maxRetries} attempts - will rely on webhook`,
//     );
//   }

//   logger.info(`📊 Final shipping info:`);
//   logger.info(
//     `   📦 Tracking Number: ${trackingNumber || "(waiting for webhook)"}`,
//   );
//   logger.info(
//     `   🔗 Tracking URL: ${trackingUrl || "(waiting for webhook)"}`,
//   );
//   logger.info(`   📄 AWB URL: ${awbUrl || "(waiting for webhook)"}`);
//   logger.info(
//     `   🚚 Carrier: ${carrier || order.shipping?.deliveryCompanyName || "OTO"}`,
//   );

//   // ═══════════════════════════════════════════════════════════════
//   // ✅ تحديث الأوردر في الـ DB
//   // ═══════════════════════════════════════════════════════════════
//   const updateData = {
//     status: "PROCESSING",
//     "shipping.carrier":
//       carrier || order.shipping?.deliveryCompanyName || "OTO",
//     "shipping.trackingNumber": trackingNumber,
//     "shipping.trackingUrl": trackingUrl,
//     "shipping.awbUrl": awbUrl,
//     "shipping.otoListId": funoonOrderId,
//     "shipping.otoShipmentId":
//       orderStatus?.shipmentId ||
//       orderStatus?.dcTrackingNumber ||
//       shipmentResponse?.shipmentId ||
//       (otoOrderResponse?.otoId ? String(otoOrderResponse.otoId) : ""),
//     "shipping.shippedAt": new Date(),
//   };

//   const updatedOrder = await Order.findByIdAndUpdate(
//     order._id,
//     { $set: updateData },
//     { new: true, runValidators: false },
//   );

//   if (!updatedOrder) {
//     throw new NotFoundError(M.orders.notFoundDuringUpdate);
//   }

//   logger.info(`✅ Order ${order._id} updated to PROCESSING`);

//   // ═══════════════════════════════════════════════════════════════
//   // ✅ Response للـ Frontend
//   // ═══════════════════════════════════════════════════════════════
//   const responseData = {
//     order: {
//       _id: updatedOrder._id,
//       status: updatedOrder.status,
//       funoonOrderId: funoonOrderId,
//     },
//     shipping: {
//       carrier: updatedOrder.shipping?.carrier,
//       trackingNumber: updatedOrder.shipping?.trackingNumber,
//       trackingUrl: updatedOrder.shipping?.trackingUrl,
//       awbUrl: updatedOrder.shipping?.awbUrl,
//       deliveryCompanyName: updatedOrder.shipping?.deliveryCompanyName,
//       estimatedDeliveryDate: updatedOrder.shipping?.estimatedDeliveryDate,
//     },
//   };

//   // لو البيانات لسه فاضية، نبعت message واضح
//   if (!trackingNumber) {
//     responseData.message =
//       "تم إنشاء الشحنة بنجاح. بيانات التتبع والبولصة ستصل خلال دقائق قليلة.";
//   }

//   return ApiResponse.success(
//     res,
//     responseData,
//     "Shipment created successfully",
//   );
// });

// @desc    Handle OTO Webhook
// @route   POST /api/v1/webhooks/oto

// const handleOTOWebhook = catchAsync(async (req, res, next) => {
//   let payload = req.body;

//   logger.info("📥 OTO Webhook received");
//   logger.info("   Body type:", typeof payload);
//   logger.info("   Is Buffer:", Buffer.isBuffer(payload));

//   if (Buffer.isBuffer(payload)) {
//     try {
//       payload = JSON.parse(payload.toString("utf8"));
//     } catch (e) {
//       logger.error("❌ Could not parse Buffer as JSON");
//       return res.status(400).json({ error: "Invalid JSON" });
//     }
//   } else if (typeof payload === "string") {
//     try {
//       payload = JSON.parse(payload);
//     } catch (e) {
//       logger.error("❌ Could not parse string as JSON");
//       return res.status(400).json({ error: "Invalid JSON" });
//     }
//   } else if (typeof payload === "object" && payload !== null) {
//     const keys = Object.keys(payload);
//     if (keys.length > 0 && keys.every((k) => !isNaN(parseInt(k)))) {
//       try {
//         const stringValue = Object.values(payload).join("");
//         payload = JSON.parse(stringValue);
//         logger.info("✅ Recovered from character-spread object");
//       } catch (e) {
//         logger.error("❌ Could not recover from character-spread object");
//         return res.status(400).json({ error: "Invalid JSON" });
//       }
//     }
//   }

//   if (!payload || typeof payload !== "object") {
//     logger.error("❌ OTO Webhook: Invalid body after parsing");
//     return res.status(400).json({ error: "Invalid body" });
//   }

//   logger.info("📦 Parsed webhook payload:", JSON.stringify(payload, null, 2));

//   const {
//     orderId,
//     otoId,
//     status,
//     trackingNumber,
//     trackingUrl,
//     trackingURL,
//     brandedTrackingURL,
//     printAWBURL,
//     dcTrackingNumber,
//     shipmentNumber,
//   } = payload;

//   if (!orderId && !otoId) {
//     logger.warn("⚠️ OTO Webhook: No orderId or otoId in payload");
//     return res.status(200).json({ received: true });
//   }

//   let funoonOrderId;
//   if (orderId) {
//     funoonOrderId = orderId.replace("FUNOON-", "");
//   } else if (otoId) {
//     const foundOrder = await Order.findOne({
//       "shipping.otoShipmentId": String(otoId),
//     });
//     if (!foundOrder) {
//       logger.warn(`⚠️ Order not found for otoId: ${otoId}`);
//       return res.status(200).json({ received: true });
//     }
//     funoonOrderId = foundOrder._id.toString();
//   }

//   const statusMap = {
//     new: "PROCESSING",
//     branchAssigned: "PROCESSING",
//     assignedToWarehouse: "PROCESSING",
//     searchingDriver: "PROCESSING",
//     shipmentCreated: "PROCESSING",
//     pickedUp: "SHIPPED",
//     inTransit: "SHIPPED",
//     outForDelivery: "SHIPPED",
//     delivered: "DELIVERED",
//     returned: "RETURNED",
//     cancelled: "CANCELLED",
//   };

//   const newStatus = statusMap[status];

//   if (!newStatus) {
//     logger.warn(`⚠️ OTO Webhook: Unknown status "${status}"`);
//     return res.status(200).json({ received: true });
//   }

//   const updateData = { status: newStatus };

//   if (trackingNumber) updateData["shipping.trackingNumber"] = trackingNumber;
//   if (shipmentNumber) updateData["shipping.trackingNumber"] = shipmentNumber;
//   if (dcTrackingNumber) updateData["shipping.otoShipmentId"] = dcTrackingNumber;
//   if (otoId) updateData["shipping.otoShipmentId"] = String(otoId);

//   const finalTrackingUrl = brandedTrackingURL || trackingURL || trackingUrl;
//   if (finalTrackingUrl) updateData["shipping.trackingUrl"] = finalTrackingUrl;
//   if (printAWBURL) updateData["shipping.awbUrl"] = printAWBURL;

//   if (newStatus === "DELIVERED") {
//     updateData["shipping.deliveredAt"] = new Date();
//   }

//   try {
//     const existingOrder = await Order.findById(funoonOrderId);
//     const previousStatus = existingOrder?.status;

//     const updatedOrder = await Order.findByIdAndUpdate(
//       funoonOrderId,
//       { $set: updateData },
//       { new: true, runValidators: false },
//     );

//     if (!updatedOrder) {
//       logger.warn(`⚠️ Order not found: ${funoonOrderId}`);
//       return res.status(200).json({ received: true });
//     }

//     logger.info(
//       `✅ Order ${funoonOrderId} updated via webhook: status=${newStatus}, tracking=${trackingNumber || shipmentNumber || "(none)"}`,
//     );

//     if (newStatus === "SHIPPED" && previousStatus !== "SHIPPED") {
//       eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
//         buyerId: updatedOrder.buyer,
//         orderId: updatedOrder._id,
//         orderNumber: updatedOrder._id.toString().slice(-6).toUpperCase(),
//         carrier: updatedOrder.shipping?.deliveryCompanyName || updatedOrder.shipping?.carrier || "شركة الشحن",
//       });
//     } else if (newStatus === "DELIVERED" && previousStatus !== "DELIVERED") {
//       eventEmitter.safeEmit(EVENTS.ORDER_DELIVERED, {
//         buyerId: updatedOrder.buyer,
//         orderId: updatedOrder._id,
//         orderNumber: updatedOrder._id.toString().slice(-6).toUpperCase(),
//       });
//     }
//   } catch (err) {
//     logger.error("❌ Error updating order from webhook:", err.message);
//   }

//   return res.status(200).json({ received: true });
// });

//! TWO SHOTS
// ═══════════════════════════════════════════════════════════════
// ✅ Endpoint 1: Create OTO Order فقط (بدون shipment)
// ═══════════════════════════════════════════════════════════════
// const createOtoOrder = catchAsync(async (req, res, next) => {
//   const { orderId } = req.params;
//   const order = await Order.findById(orderId);

//   if (!order) throw new NotFoundError(M.orders.notFound);
//   if (order.artist.toString() !== req.user._id.toString()) {
//     throw new UnauthorizedError(M.shipping.notAuthorizedToShip);
//   }
//   if (order.status !== "PAID") {
//     throw new BadRequestError(M.shipping.notPaidStatus(order.status));
//   }
//   if (order.shipping?.otoListId) {
//     throw new BadRequestError(M.shipping.alreadyCreated);
//   }

//   // ✅ Validation: لازم deliveryOptionId (لكن هنستخدمه في create-shipment بس)
//   const deliveryOptionId = order.shipping?.deliveryOptionId;
//   if (!deliveryOptionId) {
//     throw new BadRequestError(M.shipping.noDeliveryOption);
//   }

//   const artistAddress = order.shipping?.artistAddress || {};
//   const buyerAddress = order.shipping?.buyerAddress || {};
//   if (!artistAddress.city || !buyerAddress.city) {
//     throw new BadRequestError(M.shipping.missingAddressInfo);
//   }

//   const funoonOrderId = `FUNOON-${order._id}`;

//   const dims = order.items.reduce(
//     (acc, item) => {
//       const d = item.artworkSnapshot?.dimensions || {};
//       return {
//         width: Math.max(acc.width, d.width || 60),
//         length: Math.max(acc.length, d.height || 80),
//         height: acc.height + (d.depth || 3),
//         weight: acc.weight + (d.weight || 2),
//       };
//     },
//     { width: 0, length: 0, height: 0, weight: 0 },
//   );

//   // ✅ التعديل المهم: نحذف deliveryOptionId ونضيف createShipment: false
//   const orderData = {
//     orderId: funoonOrderId,
//     createShipment: false,
//     // ❌ deliveryOptionId: deliveryOptionId,  // ← محذوف!
//     paymentMethod: "paid",
//     amount: order.financials.subtotal,
//     currency: order.financials.currency || "SAR",
//     packageCount: order.items.length,
//     packageWeight: dims.weight,
//     boxWidth: dims.width,
//     boxLength: dims.length,
//     boxHeight: dims.height,
//     senderInformation: {
//       senderFullName: artistAddress.name || "Artist",
//       senderMobile: artistAddress.phone?.replace(/[^0-9]/g, "") || "0500000000",
//       senderCountry: artistAddress.country || "SA",
//       senderCity: artistAddress.city,
//       senderDistrict: artistAddress.district || "",
//       senderStreet: artistAddress.street || "",
//       senderAddressLine:
//         `${artistAddress.buildingNo || ""}, ${artistAddress.street || ""}, ${artistAddress.district || ""}, ${artistAddress.city}, Saudi Arabia`.trim(),
//       senderBuildingNo: artistAddress.buildingNo || "",
//       senderPostcode: artistAddress.zipCode || "",
//       senderShortAddressCode: artistAddress.shortAddressCode || "",
//       lat: artistAddress.lat || undefined,
//       lon: artistAddress.lon || undefined,
//     },
//     customer: {
//       name: buyerAddress.name || "Customer",
//       mobile: buyerAddress.phone?.replace(/[^0-9]/g, "") || "0500000000",
//       address:
//         `${buyerAddress.buildingNo || ""}, ${buyerAddress.street || ""}, ${buyerAddress.district || ""}, ${buyerAddress.city}, Saudi Arabia`.trim(),
//       city: buyerAddress.city,
//       district: buyerAddress.district || "",
//       country: buyerAddress.country || "SA",
//       postcode: buyerAddress.zipCode || "",
//       buildingNo: buyerAddress.buildingNo || "",
//       street: buyerAddress.street || "",
//       shortAddressCode: buyerAddress.shortAddressCode || "",
//       lat: buyerAddress.lat || undefined,
//       lon: buyerAddress.lon || undefined,
//     },
//     items: order.items.map((item) => ({
//       name: item.artworkSnapshot?.title || "Artwork",
//       quantity: 1,
//       price: item.artworkSnapshot?.price || 0,
//       sku: `ART-${item.artwork}`,
//     })),
//   };

//   logger.info(`📦 Creating OTO order (no shipment) for ${order._id}...`);
//   let otoOrderResponse;
//   try {
//     otoOrderResponse = await otoService.createOrder(orderData);
//   } catch (err) {
//     logger.error(
//       `❌ createOrder failed: ${err.otoErrorMessage || err.message}`,
//     );
//     throw new BadRequestError(
//       err.otoErrorMessage || M.shipping.otoCreateFailed,
//     );
//   }

//   if (otoOrderResponse.success === false) {
//     logger.error(
//       `❌ OTO createOrder failed: ${otoOrderResponse.otoErrorMessage}`,
//     );
//     throw new BadRequestError(
//       otoOrderResponse.otoErrorMessage || M.shipping.otoCreateFailed,
//     );
//   }

//   const otoId = otoOrderResponse.otoId || otoOrderResponse.id;
//   logger.info(
//     `✅ OTO order created (no shipment): funoonId=${funoonOrderId}, otoId=${otoId}`,
//   );

//   const updatedOrder = await Order.findByIdAndUpdate(
//     order._id,
//     {
//       $set: {
//         status: "PROCESSING",
//         "shipping.otoListId": funoonOrderId,
//         "shipping.otoShipmentId": otoId ? String(otoId) : null,
//         "shipping.carrier": order.shipping?.deliveryCompanyName || "OTO",
//       },
//     },
//     { new: true, runValidators: false },
//   );

//   return ApiResponse.success(
//     res,
//     {
//       orderId: updatedOrder._id,
//       status: updatedOrder.status,
//       funoonOrderId,
//       otoId: otoId ? String(otoId) : null,
//       message: "تم إنشاء طلب الشحن بنجاح — يمكنك الآن إنشاء الشحنة",
//     },
//     M.shipping.created,
//   );
// });

const createOtoOrder = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId);

  if (!order) throw new NotFoundError(M.orders.notFound);
  if (order.artist.toString() !== req.user._id.toString()) {
    throw new UnauthorizedError(M.shipping.notAuthorizedToShip);
  }
  if (order.status !== "PAID") {
    throw new BadRequestError(M.shipping.notPaidStatus(order.status));
  }
  if (order.shipping?.otoListId) {
    throw new BadRequestError(M.shipping.alreadyCreated);
  }

  const deliveryOptionId = order.shipping?.deliveryOptionId;
  if (!deliveryOptionId) {
    throw new BadRequestError(M.shipping.noDeliveryOption);
  }

  const artistAddress = order.shipping?.artistAddress || {};
  const buyerAddress = order.shipping?.buyerAddress || {};
  if (!artistAddress.city || !buyerAddress.city) {
    throw new BadRequestError(M.shipping.missingAddressInfo);
  }

  const funoonOrderId = `FUNOON-${order._id}`;

  // ✅ الأبعاد الخام (مجموع اللوحات)
  const rawDims = order.items.reduce(
    (acc, item) => {
      const d = item.artworkSnapshot?.dimensions || {};
      return {
        width: Math.max(acc.width, d.width || 60),
        length: Math.max(acc.length, d.height || 80),
        height: acc.height + (d.depth || 3),
        weight: acc.weight + (d.weight || 2),
      };
    },
    { width: 0, length: 0, height: 0, weight: 0 },
  );

  // ✅ نفس padding الـ checkout بالظبط (+5/+5/+2 و +0.5 kg)
  const dims = {
    width: Math.ceil(rawDims.width + 5),
    length: Math.ceil(rawDims.length + 5),
    height: Math.ceil(rawDims.height + 2),
    weight: Math.round((rawDims.weight + 0.5) * 10) / 10,
  };

  // ✅ سعر أكبر لوحة
  const maxArtworkPrice = Math.max(
    ...order.items.map((item) => item.artworkSnapshot?.price || 0),
  );

  logger.info(
    `📦 Package: ${dims.length}×${dims.width}×${dims.height} cm, ${dims.weight} kg ` +
      `(artworks: ${rawDims.length}×${rawDims.width}×${rawDims.height} cm, ${rawDims.weight} kg)`,
  );
  logger.info(
    `💰 Order amount: ${maxArtworkPrice} SAR (subtotal: ${order.financials.subtotal})`,
  );

  const orderData = {
    orderId: funoonOrderId,
    createShipment: false,
    paymentMethod: "paid",
    amount: maxArtworkPrice,
    amount_due: 0,
    subtotal: order.financials.subtotal,
    shippingAmount: order.financials.shippingCost || 0,
    currency: order.financials.currency || "SAR",

    // ✅ صندوق واحد دايماً (مش عدد اللوحات)
    packageCount: 1,
    packageWeight: dims.weight,

    boxWidth: dims.width,
    boxLength: dims.length,
    boxHeight: dims.height,

    senderInformation: {
      senderFullName: artistAddress.name || "Artist",
      senderMobile: artistAddress.phone?.replace(/[^0-9]/g, "") || "0500000000",
      senderCountry: artistAddress.country || "SA",
      senderCity: artistAddress.city,
      senderDistrict: artistAddress.district || "",
      senderStreet: artistAddress.street || "",
      senderAddressLine:
        `${artistAddress.buildingNo || ""}, ${artistAddress.street || ""}, ${artistAddress.district || ""}, ${artistAddress.city}, Saudi Arabia`.trim(),
      senderBuildingNo: artistAddress.buildingNo || "",
      senderPostcode: artistAddress.zipCode || "",
      senderShortAddressCode: artistAddress.shortAddressCode || "",
      lat: artistAddress.lat || undefined,
      lon: artistAddress.lon || undefined,
    },
    customer: {
      name: buyerAddress.name || "Customer",
      mobile: buyerAddress.phone?.replace(/[^0-9]/g, "") || "0500000000",
      address:
        `${buyerAddress.buildingNo || ""}, ${buyerAddress.street || ""}, ${buyerAddress.district || ""}, ${buyerAddress.city}, Saudi Arabia`.trim(),
      city: buyerAddress.city,
      district: buyerAddress.district || "",
      country: buyerAddress.country || "SA",
      postcode: buyerAddress.zipCode || "",
      buildingNo: buyerAddress.buildingNo || "",
      street: buyerAddress.street || "",
      shortAddressCode: buyerAddress.shortAddressCode || "",
      lat: buyerAddress.lat || undefined,
      lon: buyerAddress.lon || undefined,
    },
    items: order.items.map((item) => ({
      name: item.artworkSnapshot?.title || "Artwork",
      quantity: 1,
      price: item.artworkSnapshot?.price || 0,
      sku: `ART-${item.artwork}`,
    })),
  };

  logger.info(`📦 Creating OTO order (no shipment) for ${order._id}...`);
  let otoOrderResponse;
  try {
    otoOrderResponse = await otoService.createOrder(orderData);
  } catch (err) {
    logger.error(
      `❌ createOrder failed: ${err.otoErrorMessage || err.message}`,
    );
    throw new BadRequestError(
      err.otoErrorMessage || M.shipping.otoCreateFailed,
    );
  }

  if (otoOrderResponse.success === false) {
    logger.error(
      `❌ OTO createOrder failed: ${otoOrderResponse.otoErrorMessage}`,
    );
    throw new BadRequestError(
      otoOrderResponse.otoErrorMessage || M.shipping.otoCreateFailed,
    );
  }

  const otoId = otoOrderResponse.otoId || otoOrderResponse.id;
  logger.info(
    `✅ OTO order created: funoonId=${funoonOrderId}, otoId=${otoId}`,
  );

  const updatedOrder = await Order.findByIdAndUpdate(
    order._id,
    {
      $set: {
        status: "PROCESSING",
        "shipping.otoListId": funoonOrderId,
        "shipping.otoShipmentId": otoId ? String(otoId) : null,
        "shipping.carrier": order.shipping?.deliveryCompanyName || "OTO",
      },
    },
    { new: true, runValidators: false },
  );

  return ApiResponse.success(
    res,
    {
      orderId: updatedOrder._id,
      status: updatedOrder.status,
      funoonOrderId,
      otoId: otoId ? String(otoId) : null,
      message: "تم إنشاء طلب الشحن بنجاح — يمكنك الآن إنشاء الشحنة",
    },
    M.shipping.created,
  );
});

// ═══════════════════════════════════════════════════════════════
// ✅ Endpoint 2: Create Shipment (on existing OTO order)
// ═══════════════════════════════════════════════════════════════
// const createShipment = catchAsync(async (req, res, next) => {
//   const { orderId } = req.params;
//   const order = await Order.findById(orderId);

//   if (!order) throw new NotFoundError(M.orders.notFound);
//   if (order.artist.toString() !== req.user._id.toString()) {
//     throw new UnauthorizedError(M.shipping.notAuthorizedToShip);
//   }
//   if (order.status !== "PROCESSING") {
//     throw new BadRequestError(M.orders.cannotProcessStatus(order.status));
//   }

//   const funoonOrderId = order.shipping?.otoListId;
//   if (!funoonOrderId) {
//     throw new BadRequestError(
//       "يجب إنشاء طلب الشحن أولاً (Step 1) قبل إنشاء الشحنة",
//     );
//   }

//   // ✅ Validation: لو tracking موجود بالفعل
//   if (
//     order.shipping?.trackingNumber ||
//     order.shipping?.trackingUrl ||
//     order.shipping?.shipmentCreatedAt
//   ) {
//     return ApiResponse.success(
//       res,
//       {
//         orderId: order._id,
//         status: order.status,
//         shipping: {
//           trackingNumber: order.shipping.trackingNumber,
//           trackingUrl: order.shipping.trackingUrl,
//           awbUrl: order.shipping.awbUrl,
//           carrier: order.shipping.carrier,
//         },
//         message: "الشحنة موجودة بالفعل",
//       },
//       M.shipping.alreadyCreated,
//     );
//   }

//   const deliveryOptionId = order.shipping?.deliveryOptionId;
//   if (!deliveryOptionId) {
//     throw new BadRequestError(M.shipping.noDeliveryOption);
//   }

//   // ✅ إنشاء الشحنة باستخدام funoonOrderId + deliveryOptionId
//   logger.info(
//     `📦 Creating OTO shipment for ${funoonOrderId} with deliveryOptionId=${deliveryOptionId}...`,
//   );
//   let shipmentResponse;
//   try {
//     shipmentResponse = await otoService.createShipment(
//       funoonOrderId,
//       deliveryOptionId,
//     );
//     logger.info(`✅ OTO shipment created for ${funoonOrderId}`);
//   } catch (err) {
//     logger.error(
//       `❌ createShipment failed: ${err.otoErrorMessage || err.message}`,
//     );
//     throw new BadRequestError(
//       err.otoErrorMessage || "فشل إنشاء الشحنة لدى شركة الشحن",
//     );
//   }

//   // جلب البيانات من orderStatus
//   let trackingNumber = "";
//   let trackingUrl = "";
//   let awbUrl = "";
//   let carrier = "";

//   const maxRetries = 3;
//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     try {
//       const waitTime = attempt === 1 ? 1500 : 2000;
//       logger.info(
//         `⏳ Fetching order status (attempt ${attempt}/${maxRetries})...`,
//       );
//       await new Promise((r) => setTimeout(r, waitTime));

//       const orderStatus = await otoService.getOrderStatus(funoonOrderId);
//       if (orderStatus?.success !== false) {
//         trackingNumber =
//           orderStatus?.shipmentId || orderStatus?.trackingNumber || "";
//         trackingUrl = orderStatus?.trackingUrl || "";
//         awbUrl = orderStatus?.printAWBURL || "";
//         carrier = orderStatus?.deliveryCompany || "";

//         if (trackingNumber || trackingUrl) {
//           logger.info(`🎯 Got tracking on attempt ${attempt}`);
//           break;
//         }
//       }
//     } catch (err) {
//       logger.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
//     }
//   }

//   if (!trackingNumber && !trackingUrl) {
//     logger.warn(`⚠️ Could not get tracking data — relying on webhook`);
//   }

//   const updateData = {
//     "shipping.shipmentCreatedAt": new Date(),
//     status: trackingNumber || trackingUrl ? "SHIPPED" : "PROCESSING",
//     "shipping.trackingNumber": trackingNumber,
//     "shipping.trackingUrl": trackingUrl,
//     "shipping.awbUrl": awbUrl,
//     "shipping.shippedAt": trackingNumber || trackingUrl ? new Date() : null,
//   };
//   if (carrier) updateData["shipping.carrier"] = carrier;

//   const updatedOrder = await Order.findByIdAndUpdate(
//     order._id,
//     { $set: updateData },
//     { new: true, runValidators: false },
//   );

//   if ((trackingNumber || trackingUrl) && order.status !== "SHIPPED") {
//     eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
//       buyerId: updatedOrder.buyer,
//       orderId: updatedOrder._id,
//       orderNumber: updatedOrder._id.toString().slice(-6).toUpperCase(),
//       carrier:
//         carrier || updatedOrder.shipping?.deliveryCompanyName || "شركة الشحن",
//     });
//   }

//   return ApiResponse.success(
//     res,
//     {
//       orderId: updatedOrder._id,
//       status: updatedOrder.status,
//       funoonOrderId,
//       shipping: {
//         trackingNumber: trackingNumber || null,
//         trackingUrl: trackingUrl || null,
//         awbUrl: awbUrl || null,
//         carrier: carrier || order.shipping?.deliveryCompanyName,
//       },
//       message:
//         trackingNumber || trackingUrl
//           ? M.shipping.created
//           : "تم إنشاء الشحنة بنجاح. بيانات التتبع ستصل خلال دقائق قليلة.",
//     },
//     M.shipping.created,
//   );
// });

// @desc    Create Shipment for existing OTO order
// @route   POST /api/v1/shipping/:orderId/create-shipment
// const createShipment = catchAsync(async (req, res, next) => {
//   const { orderId } = req.params;

//   const order = await Order.findById(orderId);
//   if (!order) throw new NotFoundError(M.orders.notFound);

//   if (order.artist.toString() !== req.user._id.toString()) {
//     throw new UnauthorizedError(M.shipping.notAuthorizedToShip);
//   }

//   if (order.status == "DELIVERED"){
//     throw new BadRequestError(
//       "الاوردر وصل بالفعل"
//     )
//   }

//   if (order.status !== "PROCESSING") {
//     throw new BadRequestError(
//       `لا يمكن انشاء شحنه لهذه الحاله : ${order.status}`,
//     );
//   }

//   const funoonOrderId = order.shipping?.otoListId;
//   if (!funoonOrderId) {
//     throw new BadRequestError("يجب إنشاء طلب الشحن أولاً قبل إنشاء الشحنة");
//   }

//   const deliveryOptionId = order.shipping?.deliveryOptionId;
//   if (!deliveryOptionId) {
//     throw new BadRequestError(M.shipping.noDeliveryOption);
//   }

//   /**
//    * ✅ مهم جداً:
//    * لا تعتبر trackingUrl لوحده دليل إن الشحنة اتعملت
//    * لأن OTO بيبعت brandedTrackingURL مع الـ order فقط.
//    */
//   const shipmentAlreadyExists =
//     !!order.shipping?.shipmentCreatedAt ||
//     !!order.shipping?.trackingNumber ||
//     !!order.shipping?.awbUrl;

//   if (shipmentAlreadyExists) {
//     return ApiResponse.success(
//       res,
//       {
//         orderId: order._id,
//         status: order.status,
//         funoonOrderId,
//         shipping: {
//           shipmentCreatedAt: order.shipping.shipmentCreatedAt,
//           trackingNumber: order.shipping.trackingNumber,
//           trackingUrl: order.shipping.trackingUrl,
//           awbUrl: order.shipping.awbUrl,
//           carrier: order.shipping.carrier,
//         },
//         message: "الشحنة موجودة بالفعل",
//       },
//       "الشحنة موجودة بالفعل",
//     );
//   }

//   logger.info(
//     `📦 Creating OTO shipment for ${funoonOrderId} with deliveryOptionId=${deliveryOptionId}...`,
//   );

//   let shipmentResponse;
//   try {
//     shipmentResponse = await otoService.createShipment(
//       funoonOrderId,
//       deliveryOptionId,
//     );

//     logger.info(
//       `✅ OTO createShipment request accepted for ${funoonOrderId}: ${JSON.stringify(
//         shipmentResponse,
//       )}`,
//     );
//   } catch (err) {
//     logger.error(
//       `❌ createShipment failed: ${err.otoErrorMessage || err.message}`,
//     );

//     throw new BadRequestError(
//       err.otoErrorMessage || "فشل إنشاء الشحنة لدى شركة الشحن",
//     );
//   }

//   // نحفظ فوراً إننا طلبنا إنشاء الشحنة حتى لو التتبع لسه مجاش
//   let trackingNumber = "";
//   let trackingUrl = "";
//   let awbUrl = "";
//   let carrier = "";

//   // محاولة جلب بيانات الشحنة بعد الإنشاء
//   const maxRetries = 3;

//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     try {
//       const waitTime = attempt === 1 ? 1500 : 2500;

//       logger.info(
//         `⏳ Fetching OTO orderStatus after shipment attempt ${attempt}/${maxRetries}...`,
//       );

//       await new Promise((resolve) => setTimeout(resolve, waitTime));

//       const statusData = await otoService.getOrderStatus(funoonOrderId);
//       const orderStatus = Array.isArray(statusData) ? statusData[0] : statusData;

//       if (orderStatus?.success === false) {
//         logger.warn(
//           `⚠️ OTO orderStatus success=false: ${JSON.stringify(orderStatus)}`,
//         );
//         continue;
//       }

//       trackingNumber =
//         orderStatus?.shipmentId ||
//         orderStatus?.trackingNumber ||
//         orderStatus?.dcTrackingNumber ||
//         "";

//       trackingUrl = orderStatus?.trackingUrl || "";
//       awbUrl = orderStatus?.printAWBURL || "";
//       carrier = orderStatus?.deliveryCompany || "";

//       if (trackingNumber || awbUrl) {
//         logger.info(
//           `🎯 Got shipment data for ${funoonOrderId}: tracking=${trackingNumber || "(none)"}`,
//         );
//         break;
//       }
//     } catch (err) {
//       logger.warn(`⚠️ orderStatus attempt ${attempt} failed: ${err.message}`);
//     }
//   }

//   const hasShipmentData = !!(trackingNumber || awbUrl);

//   const updateData = {
//     "shipping.shipmentCreatedAt": new Date(),
//     status: hasShipmentData ? "SHIPPED" : "PROCESSING",
//   };

//   if (trackingNumber) updateData["shipping.trackingNumber"] = trackingNumber;
//   if (trackingUrl) updateData["shipping.trackingUrl"] = trackingUrl;
//   if (awbUrl) updateData["shipping.awbUrl"] = awbUrl;
//   if (carrier) updateData["shipping.carrier"] = carrier;
//   if (hasShipmentData) updateData["shipping.shippedAt"] = new Date();

//   const updatedOrder = await Order.findByIdAndUpdate(
//     order._id,
//     { $set: updateData },
//     { new: true, runValidators: false },
//   );

//   if (!updatedOrder) {
//     throw new NotFoundError(M.orders.notFoundDuringUpdate);
//   }

//   if (hasShipmentData) {
//     eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
//       buyerId: updatedOrder.buyer,
//       orderId: updatedOrder._id,
//       orderNumber: updatedOrder._id.toString().slice(-6).toUpperCase(),
//       carrier:
//         updatedOrder.shipping?.carrier ||
//         updatedOrder.shipping?.deliveryCompanyName ||
//         "شركة الشحن",
//     });
//   }

//   return ApiResponse.success(
//     res,
//     {
//       orderId: updatedOrder._id,
//       status: updatedOrder.status,
//       funoonOrderId,
//       shipping: {
//         shipmentCreatedAt: updatedOrder.shipping?.shipmentCreatedAt,
//         trackingNumber: updatedOrder.shipping?.trackingNumber || null,
//         trackingUrl: updatedOrder.shipping?.trackingUrl || null,
//         awbUrl: updatedOrder.shipping?.awbUrl || null,
//         carrier:
//           updatedOrder.shipping?.carrier ||
//           updatedOrder.shipping?.deliveryCompanyName,
//       },
//       message: hasShipmentData
//         ? "تم إنشاء الشحنة بنجاح"
//         : "تم طلب إنشاء الشحنة بنجاح. بيانات التتبع والبوليسة ستصل خلال دقائق.",
//     },
//     M.shipping.created,
//   );
// });

// const createShipment = catchAsync(async (req, res, next) => {
//   const { orderId } = req.params;

//   const order = await Order.findById(orderId);
//   if (!order) throw new NotFoundError(M.orders.notFound);

//   if (order.artist.toString() !== req.user._id.toString()) {
//     throw new UnauthorizedError(M.shipping.notAuthorizedToShip);
//   }

//   if (order.status === "DELIVERED") {
//     throw new BadRequestError("الاوردر وصل بالفعل");
//   }

//   if (order.status !== "PROCESSING") {
//     throw new BadRequestError(`لا يمكن انشاء شحنه لهذه الحاله : ${order.status}`);
//   }

//   const funoonOrderId = order.shipping?.otoListId;
//   if (!funoonOrderId) {
//     throw new BadRequestError("يجب إنشاء طلب الشحن أولاً قبل إنشاء الشحنة");
//   }

//   const deliveryOptionId = order.shipping?.deliveryOptionId;
//   if (!deliveryOptionId) {
//     throw new BadRequestError(M.shipping.noDeliveryOption);
//   }

//   // ✅ Idempotency check
//   const shipmentAlreadyExists =
//     !!order.shipping?.shipmentCreatedAt ||
//     !!order.shipping?.trackingNumber ||
//     !!order.shipping?.awbUrl;

//   if (shipmentAlreadyExists) {
//     return ApiResponse.success(
//       res,
//       {
//         orderId: order._id,
//         status: order.status,
//         funoonOrderId,
//         shipping: {
//           shipmentCreatedAt: order.shipping.shipmentCreatedAt,
//           trackingNumber: order.shipping.trackingNumber,
//           trackingUrl: order.shipping.trackingUrl,
//           awbUrl: order.shipping.awbUrl,
//           carrier: order.shipping.carrier,
//         },
//         message: "الشحنة موجودة بالفعل",
//       },
//       "الشحنة موجودة بالفعل",
//     );
//   }

//   // ✅ حساب الأبعاد والوزن (نفس الـ createOtoOrder)
//   const rawDims = order.items.reduce(
//     (acc, item) => {
//       const d = item.artworkSnapshot?.dimensions || {};
//       return {
//         width: Math.max(acc.width, d.width || 60),
//         length: Math.max(acc.length, d.height || 80),
//         height: acc.height + (d.depth || 3),
//         weight: acc.weight + (d.weight || 2),
//       };
//     },
//     { width: 0, length: 0, height: 0, weight: 0 },
//   );

//   const dims = {
//     width: Math.ceil(rawDims.width + 5),
//     length: Math.ceil(rawDims.length + 5),
//     height: Math.ceil(rawDims.height + 2),
//     weight: Math.round((rawDims.weight + 0.5) * 10) / 10,
//   };

//   // ✅ تحديد whoPays (مين بيدفع للشحن)
//   const whoPays =
//     order.financials?.platformShippingExpense > 0
//       ? "marketplacePaysDeliveryFee" // المنصة بتدفع (free shipping)
//       : "sellerPaysDeliveryFee"; // الفنان بيدفع

//   // ✅ تحديد pickingType (إزاي الشحنة هتتسلم)
//   const pickupDropoff = order.shipping?.pickupDropoff || "freePickup";
//   const pickingType =
//     pickupDropoff === "freePickup" || pickupDropoff === "freePickupDropoff"
//       ? "PICKUP_BY_DC" // شركة الشحن بتيجي تاخد
//       : "BRANCH_DROP_OFF"; // الفنان يودّيها للفرع

//   logger.info(
//     `📦 Creating OTO shipment for ${funoonOrderId} with deliveryOptionId=${deliveryOptionId}...`,
//   );
//   logger.info(
//     `   📏 Dims: ${dims.length}×${dims.width}×${dims.height} cm, ${dims.weight} kg`,
//   );
//   logger.info(`   💰 whoPays: ${whoPays}, pickingType: ${pickingType}`);

//   let shipmentResponse;
//   try {
//     shipmentResponse = await otoService.createShipment(
//       funoonOrderId,
//       deliveryOptionId,
//       {
//         packageWeight: dims.weight,
//         boxWidth: dims.width,
//         boxLength: dims.length,
//         boxHeight: dims.height,
//         packageCount: 1,
//         whoPays,
//         pickingType,
//       },
//     );

//     logger.info(
//       `✅ OTO createShipment request accepted for ${funoonOrderId}: ${JSON.stringify(shipmentResponse)}`,
//     );
//   } catch (err) {
//     logger.error(`❌ createShipment failed: ${err.otoErrorMessage || err.message}`);
//     throw new BadRequestError(
//       err.otoErrorMessage || "فشل إنشاء الشحنة لدى شركة الشحن",
//     );
//   }

//   // ✅ جلب بيانات التتبع (retry logic)
//   let trackingNumber = "";
//   let trackingUrl = "";
//   let awbUrl = "";
//   let carrier = "";

//   const maxRetries = 3;

//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     try {
//       const waitTime = attempt === 1 ? 1500 : 2500;

//       logger.info(`⏳ Fetching OTO orderStatus after shipment attempt ${attempt}/${maxRetries}...`);

//       await new Promise((resolve) => setTimeout(resolve, waitTime));

//       const statusData = await otoService.getOrderStatus(funoonOrderId);
//       const orderStatus = Array.isArray(statusData) ? statusData[0] : statusData;

//       if (orderStatus?.success === false) {
//         logger.warn(`⚠️ OTO orderStatus success=false: ${JSON.stringify(orderStatus)}`);
//         continue;
//       }

//       trackingNumber =
//         orderStatus?.shipmentId ||
//         orderStatus?.trackingNumber ||
//         orderStatus?.dcTrackingNumber ||
//         "";

//       trackingUrl = orderStatus?.trackingUrl || "";
//       awbUrl = orderStatus?.printAWBURL || "";
//       carrier = orderStatus?.deliveryCompany || "";

//       if (trackingNumber || awbUrl) {
//         logger.info(`🎯 Got shipment data for ${funoonOrderId}: tracking=${trackingNumber || "(none)"}`);
//         break;
//       }
//     } catch (err) {
//       logger.warn(`⚠️ orderStatus attempt ${attempt} failed: ${err.message}`);
//     }
//   }

//   const hasShipmentData = !!(trackingNumber || awbUrl);

//   const updateData = {
//     "shipping.shipmentCreatedAt": new Date(),
//     status: hasShipmentData ? "SHIPPED" : "PROCESSING",
//   };

//   if (trackingNumber) updateData["shipping.trackingNumber"] = trackingNumber;
//   if (trackingUrl) updateData["shipping.trackingUrl"] = trackingUrl;
//   if (awbUrl) updateData["shipping.awbUrl"] = awbUrl;
//   if (carrier) updateData["shipping.carrier"] = carrier;
//   if (hasShipmentData) updateData["shipping.shippedAt"] = new Date();

//   const updatedOrder = await Order.findByIdAndUpdate(
//     order._id,
//     { $set: updateData },
//     { new: true, runValidators: false },
//   );

//   if (!updatedOrder) {
//     throw new NotFoundError(M.orders.notFoundDuringUpdate);
//   }

//   if (hasShipmentData) {
//     eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
//       buyerId: updatedOrder.buyer,
//       orderId: updatedOrder._id,
//       orderNumber: updatedOrder._id.toString().slice(-6).toUpperCase(),
//       carrier:
//         updatedOrder.shipping?.carrier ||
//         updatedOrder.shipping?.deliveryCompanyName ||
//         "شركة الشحن",
//     });
//   }

//   return ApiResponse.success(
//     res,
//     {
//       orderId: updatedOrder._id,
//       status: updatedOrder.status,
//       funoonOrderId,
//       shipping: {
//         shipmentCreatedAt: updatedOrder.shipping?.shipmentCreatedAt,
//         trackingNumber: updatedOrder.shipping?.trackingNumber || null,
//         trackingUrl: updatedOrder.shipping?.trackingUrl || null,
//         awbUrl: updatedOrder.shipping?.awbUrl || null,
//         carrier:
//           updatedOrder.shipping?.carrier ||
//           updatedOrder.shipping?.deliveryCompanyName,
//       },
//       message: hasShipmentData
//         ? "تم إنشاء الشحنة بنجاح"
//         : "تم طلب إنشاء الشحنة بنجاح. بيانات التتبع والبوليسة ستصل خلال دقائق.",
//     },
//     M.shipping.created,
//   );
// });

//! test فقط حاليا // checkOrderStatus
const createShipment = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError(M.orders.notFound);

  if (order.artist.toString() !== req.user._id.toString()) {
    throw new UnauthorizedError(M.shipping.notAuthorizedToShip);
  }

  if (order.status === "DELIVERED") {
    throw new BadRequestError("الاوردر وصل بالفعل");
  }

  if (order.status !== "PROCESSING") {
    throw new BadRequestError(
      `لا يمكن انشاء شحنه لهذه الحاله : ${order.status}`,
    );
  }

  const funoonOrderId = order.shipping?.otoListId;
  if (!funoonOrderId) {
    throw new BadRequestError("يجب إنشاء طلب الشحن أولاً قبل إنشاء الشحنة");
  }

  const deliveryOptionId = order.shipping?.deliveryOptionId;
  if (!deliveryOptionId) {
    throw new BadRequestError(M.shipping.noDeliveryOption);
  }

  // نعتبر الشحنة موجودة فقط عند وجود رقم تتبع أو بوليصة فعلية
  const shipmentAlreadyExists = Boolean(
    order.shipping?.trackingNumber || order.shipping?.awbUrl,
  );

  if (shipmentAlreadyExists) {
    return ApiResponse.success(
      res,
      {
        orderId: order._id,
        status: order.status,
        funoonOrderId,
        shipping: {
          shipmentCreatedAt: order.shipping?.shipmentCreatedAt || null,
          trackingNumber: order.shipping?.trackingNumber || null,
          trackingUrl: order.shipping?.trackingUrl || null,
          awbUrl: order.shipping?.awbUrl || null,
          carrier: order.shipping?.carrier || null,
        },
        message: "الشحنة موجودة بالفعل",
      },
      "الشحنة موجودة بالفعل",
    );
  }

  // حساب الأبعاد والوزن
  const rawDims = order.items.reduce(
    (acc, item) => {
      const d = item.artworkSnapshot?.dimensions || {};

      return {
        width: Math.max(acc.width, d.width || 60),
        length: Math.max(acc.length, d.height || 80),
        height: acc.height + (d.depth || 3),
        weight: acc.weight + (d.weight || 2),
      };
    },
    { width: 0, length: 0, height: 0, weight: 0 },
  );

  const dims = {
    width: Math.ceil(rawDims.width + 5),
    length: Math.ceil(rawDims.length + 5),
    height: Math.ceil(rawDims.height + 2),
    weight: Math.round((rawDims.weight + 0.5) * 10) / 10,
  };

  const whoPays =
    order.financials?.platformShippingExpense > 0
      ? "marketplacePaysDeliveryFee"
      : "sellerPaysDeliveryFee";

  const pickupDropoff = order.shipping?.pickupDropoff || "freePickup";

  const pickingType =
    pickupDropoff === "freePickup" || pickupDropoff === "freePickupDropoff"
      ? "PICKUP_BY_DC"
      : "BRANCH_DROP_OFF";

  logger.info(
    `📦 Creating OTO shipment for ${funoonOrderId} with deliveryOptionId=${deliveryOptionId}`,
  );
  logger.info(
    `📏 Dims: ${dims.length}×${dims.width}×${dims.height} cm, ${dims.weight} kg`,
  );
  logger.info(`💰 whoPays: ${whoPays}, pickingType: ${pickingType}`);

  try {
    const shipmentResponse = await otoService.createShipment(
      funoonOrderId,
      deliveryOptionId,
      {
        packageWeight: dims.weight,
        boxWidth: dims.width,
        boxLength: dims.length,
        boxHeight: dims.height,
        packageCount: 1,
        whoPays,
        pickingType,
      },
    );

    logger.info(
      `✅ OTO createShipment request accepted for ${funoonOrderId}: ${JSON.stringify(
        shipmentResponse,
      )}`,
    );
  } catch (err) {
    logger.error(
      `❌ createShipment failed: ${err.otoErrorMessage || err.message}`,
    );

    throw new BadRequestError(
      err.otoErrorMessage || "فشل إنشاء الشحنة لدى شركة الشحن",
    );
  }

  // فحص orderStatus بعد طلب الإنشاء
  let trackingNumber = "";
  let trackingUrl = "";
  let awbUrl = "";
  let carrier = "";
  let latestOtoStatus = "";

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const waitTime = attempt === 1 ? 1500 : 2500;

      logger.info(
        `⏳ Fetching OTO orderStatus after shipment attempt ${attempt}/${maxRetries}`,
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));

      const statusData = await otoService.getOrderStatus(funoonOrderId);
      const orderStatus = Array.isArray(statusData)
        ? statusData[0]
        : statusData;

      logger.info(
        `📦 OTO orderStatus response: ${JSON.stringify(orderStatus)}`,
      );

      if (orderStatus?.success === false) {
        logger.warn(
          `⚠️ OTO orderStatus success=false: ${JSON.stringify(orderStatus)}`,
        );
        continue;
      }

      latestOtoStatus = orderStatus?.status || "";

      trackingNumber =
        orderStatus?.shipmentId ||
        orderStatus?.trackingNumber ||
        orderStatus?.dcTrackingNumber ||
        "";

      trackingUrl =
        orderStatus?.trackingUrl ||
        orderStatus?.trackingURL ||
        orderStatus?.brandedTrackingURL ||
        "";

      awbUrl = orderStatus?.printAWBURL || "";
      carrier = orderStatus?.deliveryCompany || "";

      if (trackingNumber || awbUrl) {
        logger.info(
          `🎯 Got shipment data for ${funoonOrderId}: tracking=${
            trackingNumber || "(none)"
          }`,
        );
        break;
      }
    } catch (err) {
      logger.warn(`⚠️ orderStatus attempt ${attempt} failed: ${err.message}`);
    }
  }

  const hasShipmentData = Boolean(trackingNumber || awbUrl);

  // لا نحدث قاعدة البيانات إذا لم يتم تأكيد الشحنة
  if (!hasShipmentData) {
    logger.error(
      `❌ OTO accepted createShipment but no shipment data was returned`,
      {
        funoonOrderId,
        latestOtoStatus,
      },
    );

    throw new BadRequestError(
      latestOtoStatus
        ? `لم يتم تأكيد إنشاء الشحنة. الحالة الحالية: ${latestOtoStatus}. حاول مرة أخرى.`
        : "لم يتم تأكيد إنشاء الشحنة. لم يصل رقم التتبع أو بوليصة الشحن، حاول مرة أخرى.",
    );
  }

  // لا يتم حفظ بيانات الشحنة إلا بعد وصول رقم التتبع أو AWB
  const updateData = {
    status: "SHIPPED",
    "shipping.shipmentCreatedAt": new Date(),
    "shipping.shippedAt": new Date(),
  };

  if (trackingNumber) {
    updateData["shipping.trackingNumber"] = trackingNumber;
  }

  if (trackingUrl) {
    updateData["shipping.trackingUrl"] = trackingUrl;
  }

  if (awbUrl) {
    updateData["shipping.awbUrl"] = awbUrl;
  }

  if (carrier) {
    updateData["shipping.carrier"] = carrier;
  }

  const updatedOrder = await Order.findByIdAndUpdate(
    order._id,
    { $set: updateData },
    { new: true, runValidators: false },
  );

  if (!updatedOrder) {
    throw new NotFoundError(M.orders.notFoundDuringUpdate);
  }

  eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
    buyerId: updatedOrder.buyer,
    orderId: updatedOrder._id,
    orderNumber: updatedOrder._id.toString().slice(-6).toUpperCase(),
    carrier:
      updatedOrder.shipping?.carrier ||
      updatedOrder.shipping?.deliveryCompanyName ||
      "شركة الشحن",
  });

  return ApiResponse.success(
    res,
    {
      orderId: updatedOrder._id,
      status: updatedOrder.status,
      funoonOrderId,
      shipping: {
        shipmentCreatedAt: updatedOrder.shipping?.shipmentCreatedAt || null,
        trackingNumber: updatedOrder.shipping?.trackingNumber || null,
        trackingUrl: updatedOrder.shipping?.trackingUrl || null,
        awbUrl: updatedOrder.shipping?.awbUrl || null,
        carrier:
          updatedOrder.shipping?.carrier ||
          updatedOrder.shipping?.deliveryCompanyName ||
          null,
      },
      message: "تم إنشاء الشحنة بنجاح",
    },
    M.shipping.created,
  );
});

// @desc    Get AWB print URL
// @route   GET /api/v1/shipping/:orderId/awb
const getAWBUrl = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError(M.orders.notFound);

  const isArtist = order.artist.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  if (!isArtist && !isAdmin) {
    throw new UnauthorizedError(M.shipping.notAuthorizedToAWB);
  }

  if (!order.shipping?.awbUrl) {
    // ✅ محاولة 1: نجيب الـ awbUrl من orderStatus (الأفضل)
    try {
      const orderStatus = await otoService.getOrderStatus(
        `FUNOON-${order._id}`,
      );

      if (orderStatus?.printAWBURL) {
        order.shipping.awbUrl = orderStatus.printAWBURL;
        if (orderStatus.trackingUrl && !order.shipping.trackingUrl) {
          order.shipping.trackingUrl = orderStatus.trackingUrl;
        }
        if (orderStatus.shipmentId && !order.shipping.trackingNumber) {
          order.shipping.trackingNumber = orderStatus.shipmentId;
        }
        await order.save();

        logger.info(`✅ AWB URL retrieved from orderStatus for ${order._id}`);

        return ApiResponse.success(
          res,
          {
            awbUrl: order.shipping.awbUrl,
            trackingUrl: order.shipping.trackingUrl,
          },
          "AWB URL retrieved",
        );
      }
    } catch (err) {
      logger.warn("Could not retrieve AWB from orderStatus:", err.message);
    }

    // ✅ محاولة 2 (fallback): نجرب printAWB endpoint
    try {
      const awbResponse = await otoService.printAWB(`FUNOON-${order._id}`);
      if (awbResponse?.printAWBURL || awbResponse?.awbUrl) {
        const awbUrl = awbResponse.printAWBURL || awbResponse.awbUrl;
        order.shipping.awbUrl = awbUrl;
        await order.save();

        return ApiResponse.success(
          res,
          {
            awbUrl: awbUrl,
            trackingUrl: order.shipping.trackingUrl,
          },
          "AWB URL retrieved",
        );
      }
    } catch (err) {
      logger.warn("Could not retrieve AWB from printAWB:", err.message);
    }

    throw new BadRequestError(
      "No AWB available for this order yet. Please try again in a few moments.",
    );
  }

  return ApiResponse.success(
    res,
    {
      awbUrl: order.shipping.awbUrl,
      trackingUrl: order.shipping.trackingUrl,
    },
    "AWB URL retrieved",
  );
});

// @desc    Track shipment
// @route   GET /api/v1/shipping/:orderId/track
const trackShipment = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError(M.orders.notFound);

  const isBuyer = order.buyer.toString() === req.user._id.toString();
  const isArtist = order.artist.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isBuyer && !isArtist && !isAdmin) {
    throw new UnauthorizedError(M.shipping.notAuthorizedToTrack);
  }

  if (!order.shipping?.otoListId) {
    return ApiResponse.success(
      res,
      {
        status: order.status,
        trackingUrl: order.shipping?.trackingUrl || "",
        deliveryCompanyName: order.shipping?.deliveryCompanyName,
        estimatedDeliveryDate: order.shipping?.estimatedDeliveryDate,
      },
      "No OTO shipment found",
    );
  }

  let otoStatus = null;
  try {
    const statusData = await otoService.getOrderStatus(
      order.shipping.otoListId,
    );

    otoStatus = Array.isArray(statusData) ? statusData[0] : statusData;

    if (otoStatus?.success === false) {
      logger.warn("⚠️ orderStatus returned success=false:", otoStatus);
      otoStatus = null;
    }

    if (otoStatus) {
      let updated = false;

      if (otoStatus.shipmentId && !order.shipping.trackingNumber) {
        order.shipping.trackingNumber = otoStatus.shipmentId;
        updated = true;
      }
      if (otoStatus.trackingUrl && !order.shipping.trackingUrl) {
        order.shipping.trackingUrl = otoStatus.trackingUrl;
        updated = true;
      }
      if (otoStatus.printAWBURL && !order.shipping.awbUrl) {
        order.shipping.awbUrl = otoStatus.printAWBURL;
        updated = true;
      }
      if (otoStatus.deliveryCompany && !order.shipping.carrier) {
        order.shipping.carrier = otoStatus.deliveryCompany;
        updated = true;
      }

      if (updated) {
        await order.save();
        logger.info(`✅ Order ${order._id} updated from orderStatus`);
      }
    }
  } catch (err) {
    logger.warn("⚠️ Could not fetch tracking info from OTO:", err.message);
  }

  return ApiResponse.success(
    res,
    {
      orderId: order._id,
      currentStatus: order.status,
      shipping: {
        carrier: order.shipping.carrier,
        trackingNumber: order.shipping.trackingNumber,
        trackingUrl: order.shipping.trackingUrl,
        awbUrl: order.shipping.awbUrl,
        estimatedDeliveryDate: order.shipping.estimatedDeliveryDate,
        deliveryCompanyName: order.shipping.deliveryCompanyName,
      },
      otoStatus: otoStatus,
    },
    "Shipment tracking retrieved",
  );
});

// @desc    Handle OTO Webhook
// @route   POST /api/v1/webhooks/oto
// const handleOTOWebhook = catchAsync(async (req, res) => {
//   let payload = req.body;

//   logger.info("📥 OTO Webhook received");
//   logger.info(
//     `   Body type: ${typeof payload}, isBuffer: ${Buffer.isBuffer(payload)}`,
//   );

//   // ─── Parse ───
//   if (Buffer.isBuffer(payload)) {
//     try {
//       payload = JSON.parse(payload.toString("utf8"));
//     } catch {
//       return res.status(400).json({ error: "Invalid JSON" });
//     }
//   } else if (typeof payload === "string") {
//     try {
//       payload = JSON.parse(payload);
//     } catch {
//       return res.status(400).json({ error: "Invalid JSON" });
//     }
//   } else if (typeof payload === "object" && payload !== null) {
//     const keys = Object.keys(payload);
//     if (keys.length > 0 && keys.every((k) => !isNaN(parseInt(k)))) {
//       try {
//         payload = JSON.parse(Object.values(payload).join(""));
//       } catch {
//         return res.status(400).json({ error: "Invalid JSON" });
//       }
//     }
//   }

//   if (!payload || typeof payload !== "object") {
//     return res.status(400).json({ error: "Invalid body" });
//   }

//   logger.info(`📦 Webhook payload keys: ${Object.keys(payload).join(", ")}`);

//   const {
//     orderId,
//     otoId,
//     status,
//     trackingNumber,
//     trackingUrl,
//     trackingURL,
//     brandedTrackingURL,
//     printAWBURL,
//     dcTrackingNumber,
//     shipmentNumber,
//   } = payload;

//   if (!orderId && !otoId) {
//     logger.warn("⚠️ OTO Webhook: No orderId or otoId in payload");
//     return res.status(200).json({ received: true });
//   }

//   // ═══ حماية CastError: نتحقق من الـ orderId قبل البحث ═══
//   let funoonOrderId = null;
//   if (orderId) {
//     const rawId = String(orderId).replace("FUNOON-", "");

//     // لو ObjectId صحيح → نبحث بيه
//     if (mongoose.Types.ObjectId.isValid(rawId)) {
//       funoonOrderId = rawId;
//     } else {
//       // ده غالباً webhook اختبار من OTO (مثل orderId: "12356789")
//       // نتجاهله بأدب ونرجع 200 received
//       logger.info(
//         `⏭️ Ignoring webhook with non-ObjectId orderId (likely test): ${rawId}`,
//       );
//       return res
//         .status(200)
//         .json({ received: true, note: "test webhook ignored" });
//     }
//   } else if (otoId) {
//     const foundOrder = await Order.findOne({
//       "shipping.otoShipmentId": String(otoId),
//     });
//     if (!foundOrder) {
//       logger.warn(`⚠️ Order not found for otoId: ${otoId}`);
//       return res.status(200).json({ received: true });
//     }
//     funoonOrderId = foundOrder._id.toString();
//   }

//   const statusMap = {
//     new: "PROCESSING",
//     branchAssigned: "PROCESSING",
//     assignedToWarehouse: "PROCESSING",
//     searchingDriver: "PROCESSING",
//     shipmentCreated: "PROCESSING",
//     pickedUp: "SHIPPED",
//     inTransit: "SHIPPED",
//     outForDelivery: "SHIPPED",
//     delivered: "DELIVERED",
//     returned: "CANCELLED",
//     cancelled: "CANCELLED",
//   };

//   const newStatus = statusMap[status];
//   if (!newStatus) {
//     logger.warn(`⚠️ Unknown OTO status: ${status}`);
//     return res.status(200).json({ received: true });
//   }

//   const existingOrder = await Order.findById(funoonOrderId);
//   if (!existingOrder) {
//     logger.warn(`⚠️ Order not found: ${funoonOrderId}`);
//     return res.status(200).json({ received: true });
//   }
//   const previousStatus = existingOrder.status;

//   // ═══ حماية الترتيب: ممنوع رجوع للخلف أو لمس الحالات المقفولة ═══
//   const STATUS_RANK = { PROCESSING: 2, SHIPPED: 3, DELIVERED: 4, COMPLETED: 5 };
//   const currentRank = STATUS_RANK[previousStatus] || 0;
//   const newRank = STATUS_RANK[newStatus] || 0;

//   let applyStatus = true;
//   if (previousStatus === "COMPLETED") {
//     applyStatus = false;
//   } else if (newStatus === "CANCELLED") {
//     applyStatus = previousStatus !== "CANCELLED";
//   } else if (newRank > 0 && newRank <= currentRank) {
//     applyStatus = false;
//     logger.info(
//       `⏭️ Skipping out-of-order status: ${previousStatus} → ${newStatus}`,
//     );
//   }

//   // ═══ تحديث البيانات ═══
//   // ═══ بيانات الشحن: تتخزن فقط لما يكون فيه شحنة حقيقية ═══
//   const updateData = {};
//   if (applyStatus) updateData.status = newStatus;

//   const hasTrackingNumber = !!(trackingNumber || shipmentNumber);
//   const shipmentLevelStatus = [
//     "shipmentCreated",
//     "pickedUp",
//     "inTransit",
//     "outForDelivery",
//     "delivered",
//   ].includes(status);

//   const finalTrackingUrl = brandedTrackingURL || trackingURL || trackingUrl;
//   if (hasTrackingNumber) {
//     updateData["shipping.trackingNumber"] = trackingNumber || shipmentNumber;
//     if (finalTrackingUrl) updateData["shipping.trackingUrl"] = finalTrackingUrl;
//     if (printAWBURL) updateData["shipping.awbUrl"] = printAWBURL;
//   } else if (shipmentLevelStatus) {
//     if (finalTrackingUrl) updateData["shipping.trackingUrl"] = finalTrackingUrl;
//     if (printAWBURL) updateData["shipping.awbUrl"] = printAWBURL;
//   }
//   // ❌ غير كده (حالات مستوى الـ order زي branchAssigned): ما نلمسش tracking/awb خالص

//   if (dcTrackingNumber) updateData["shipping.otoShipmentId"] = dcTrackingNumber;
//   if (applyStatus && newStatus === "DELIVERED")
//     updateData["shipping.deliveredAt"] = new Date();
//   if (applyStatus && newStatus === "CANCELLED") {
//     updateData["cancellationReason"] =
//       "الشحنة أُلغيت أو ارتجعت من شركة الشحن — راجع الدعم للاسترداد";
//     updateData["cancelledBy"] = "system";
//     updateData["cancelledAt"] = new Date();
//     updateData["refundStatus"] = "PENDING";
//   }

//   if (Object.keys(updateData).length > 0) {
//     await Order.findByIdAndUpdate(
//       funoonOrderId,
//       { $set: updateData },
//       { new: true, runValidators: false },
//     );
//   }

//   logger.info(
//     `✅ Order ${funoonOrderId}: ${previousStatus} → ${applyStatus ? newStatus : previousStatus} (applied=${applyStatus})`,
//   );

//   // ═══ Events ═══
//   if (applyStatus && newStatus === "SHIPPED" && previousStatus !== "SHIPPED") {
//     eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
//       buyerId: existingOrder.buyer,
//       orderId: existingOrder._id,
//       orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//       carrier: existingOrder.shipping?.deliveryCompanyName || "شركة الشحن",
//     });
//   } else if (
//     applyStatus &&
//     newStatus === "DELIVERED" &&
//     previousStatus !== "DELIVERED"
//   ) {
//     eventEmitter.safeEmit(EVENTS.ORDER_DELIVERED, {
//       buyerId: existingOrder.buyer,
//       orderId: existingOrder._id,
//       orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//     });
//   } else if (
//     applyStatus &&
//     newStatus === "CANCELLED" &&
//     previousStatus !== "CANCELLED" &&
//     EVENTS?.ORDER_CANCELLED
//   ) {
//     eventEmitter.safeEmit(EVENTS.ORDER_CANCELLED, {
//       buyerId: existingOrder.buyer,
//       artistId: existingOrder.artist,
//       orderId: existingOrder._id,
//       orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//       reason: updateData["cancellationReason"],
//       refunded: false,
//     });
//   }

//   return res.status(200).json({ received: true });
// });

//! latest
// @desc    Handle OTO Webhook
// @route   POST /api/v1/webhooks/oto
// const handleOTOWebhook = catchAsync(async (req, res) => {
//     let payload = req.body;

//     logger.info("📥 OTO Webhook received");
//     logger.info(`   Body type: ${typeof payload}, isBuffer: ${Buffer.isBuffer(payload)}`);

//     // ─── Parse (Buffer / string / character-spread) ───
//     if (Buffer.isBuffer(payload)) {
//         try { payload = JSON.parse(payload.toString("utf8")); }
//         catch { return res.status(400).json({ error: "Invalid JSON" }); }
//     } else if (typeof payload === "string") {
//         try { payload = JSON.parse(payload); }
//         catch { return res.status(400).json({ error: "Invalid JSON" }); }
//     } else if (typeof payload === "object" && payload !== null) {
//         const keys = Object.keys(payload);
//         if (keys.length > 0 && keys.every((k) => !isNaN(parseInt(k)))) {
//             try { payload = JSON.parse(Object.values(payload).join("")); }
//             catch { return res.status(400).json({ error: "Invalid JSON" }); }
//         }
//     }

//     if (!payload || typeof payload !== "object") {
//         return res.status(400).json({ error: "Invalid body" });
//     }

//     logger.info(`📦 Webhook: otoStatus=${payload.status}, orderId=${payload.orderId}, otoId=${payload.otoId}`);

//     const {
//         orderId, otoId, status,
//         trackingNumber, trackingUrl, trackingURL, brandedTrackingURL,
//         printAWBURL, dcTrackingNumber, shipmentNumber, deliveryCompany,
//     } = payload;

//     if (!orderId && !otoId) {
//         logger.warn("⚠️ OTO Webhook: No orderId or otoId in payload");
//         return res.status(200).json({ received: true });
//     }

//     // ═══ تحديد الطلب (CastError-safe) ═══
//     let funoonOrderId = null;
//     if (orderId) {
//         const rawId = String(orderId).replace("FUNOON-", "");
//         if (mongoose.Types.ObjectId.isValid(rawId)) {
//             funoonOrderId = rawId;
//         } else {
//             logger.info(`⏭️ Ignoring webhook with non-ObjectId orderId (OTO test button): ${rawId}`);
//             return res.status(200).json({ received: true, note: "test webhook ignored" });
//         }
//     } else {
//         const foundOrder = await Order.findOne({ "shipping.otoShipmentId": String(otoId) });
//         if (!foundOrder) {
//             logger.warn(`⚠️ Order not found for otoId: ${otoId}`);
//             return res.status(200).json({ received: true });
//         }
//         funoonOrderId = foundOrder._id.toString();
//     }

//     // ═══ خريطة الحالات — حسب توثيق OTO ═══
//     // قبل الاستلام الفعلي = PROCESSING | بعد الاستلام = SHIPPED
//     const statusMap = {
//         new: "PROCESSING",
//         branchAssigned: "PROCESSING",
//         assignedToWarehouse: "PROCESSING",
//         searchingDriver: "PROCESSING",
//         shipmentCreated: "PROCESSING",
//         shipmentProcessing: "PROCESSING",
//         shipmentConfirmed: "PROCESSING",
//         goingToPickup: "PROCESSING",

//         pickedUp: "SHIPPED",
//         arrivedTerminal: "SHIPPED",
//         inTransit: "SHIPPED",
//         outForDelivery: "SHIPPED",

//         delivered: "DELIVERED",
//         returned: "CANCELLED",
//         cancelled: "CANCELLED",
//     };

//     const newStatus = statusMap[status];
//     if (!newStatus) {
//         logger.warn(`⚠️ Unknown OTO status: ${status}`);
//         return res.status(200).json({ received: true });
//     }

//     const existingOrder = await Order.findById(funoonOrderId);
//     if (!existingOrder) {
//         logger.warn(`⚠️ Order not found: ${funoonOrderId}`);
//         return res.status(200).json({ received: true });
//     }
//     const previousStatus = existingOrder.status;

//     // ═══ حماية الترتيب ═══
//     const STATUS_RANK = { PROCESSING: 2, SHIPPED: 3, DELIVERED: 4, COMPLETED: 5 };
//     const currentRank = STATUS_RANK[previousStatus] || 0;
//     const newRank = STATUS_RANK[newStatus] || 0;

//     let applyStatus = true;
//     if (previousStatus === "COMPLETED") {
//         applyStatus = false;
//     } else if (newStatus === "CANCELLED") {
//         applyStatus = previousStatus !== "CANCELLED";
//     } else if (newRank > 0 && newRank <= currentRank) {
//         applyStatus = false;
//         logger.info(`⏭️ Skipping out-of-order status: ${previousStatus} → ${newStatus}`);
//     }

//     // ═══ بناء التحديث ═══
//     const updateData = {};
//     if (applyStatus) updateData.status = newStatus;

//     // ─── قاعدة بيانات الشحن: تتخزن فقط لو فيه شحنة حقيقية ───
//     const incomingTrackingNumber = trackingNumber || shipmentNumber || "";
//     const shipmentExists =
//         !!existingOrder.shipping?.shipmentCreatedAt ||
//         !!existingOrder.shipping?.trackingNumber ||
//         !!existingOrder.shipping?.awbUrl;
//     const shipmentLevelStatus = [
//         "shipmentCreated", "shipmentProcessing", "shipmentConfirmed", "goingToPickup",
//         "pickedUp", "arrivedTerminal", "inTransit", "outForDelivery", "delivered",
//     ].includes(status);

//     if (incomingTrackingNumber || shipmentExists || shipmentLevelStatus) {
//         // ✅ فيه شحنة → خزّن بياناتها
//         if (incomingTrackingNumber) updateData["shipping.trackingNumber"] = incomingTrackingNumber;
//         const finalTrackingUrl = trackingUrl || trackingURL || brandedTrackingURL;
//         if (finalTrackingUrl) updateData["shipping.trackingUrl"] = finalTrackingUrl;
//         if (printAWBURL) updateData["shipping.awbUrl"] = printAWBURL;
//         if (deliveryCompany) updateData["shipping.carrier"] = deliveryCompany;
//         if (!existingOrder.shipping?.shipmentCreatedAt) {
//             // الشحنة اتعملت خارج نظامنا (Postman/OTO dashboard)
//             updateData["shipping.shipmentCreatedAt"] = new Date();
//         }
//     } else if (otoId) {
//         // ❌ webhook على مستوى الـ order قبل أي شحنة → نخزن الـ otoId بس
//         updateData["shipping.otoShipmentId"] = String(otoId);
//     }

//     if (dcTrackingNumber) updateData["shipping.otoShipmentId"] = dcTrackingNumber;

//     if (applyStatus && newStatus === "SHIPPED" && !existingOrder.shipping?.shippedAt) {
//         updateData["shipping.shippedAt"] = new Date();
//     }
//     if (applyStatus && newStatus === "DELIVERED") {
//         updateData["shipping.deliveredAt"] = new Date();
//     }
//     if (applyStatus && newStatus === "CANCELLED") {
//         updateData["cancellationReason"] = "الشحنة أُلغيت أو ارتجعت من شركة الشحن — راجع الدعم للاسترداد";
//         updateData["cancelledBy"] = "system";
//         updateData["cancelledAt"] = new Date();
//         updateData["refundStatus"] = "PENDING";
//     }

//     if (Object.keys(updateData).length > 0) {
//         await Order.findByIdAndUpdate(
//             funoonOrderId,
//             { $set: updateData },
//             { new: true, runValidators: false },
//         );
//     }

//     logger.info(
//         `✅ Order ${funoonOrderId}: ${previousStatus} → ${applyStatus ? newStatus : previousStatus} (applied=${applyStatus}, otoStatus=${status})`,
//     );

//     // ═══ Events عند التحولات الحقيقية فقط ═══
//     if (applyStatus && newStatus === "SHIPPED" && previousStatus !== "SHIPPED") {
//         eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
//             buyerId: existingOrder.buyer,
//             orderId: existingOrder._id,
//             orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//             carrier: existingOrder.shipping?.deliveryCompanyName || existingOrder.shipping?.carrier || "شركة الشحن",
//         });
//     } else if (applyStatus && newStatus === "DELIVERED" && previousStatus !== "DELIVERED") {
//         eventEmitter.safeEmit(EVENTS.ORDER_DELIVERED, {
//             buyerId: existingOrder.buyer,
//             orderId: existingOrder._id,
//             orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//         });
//     } else if (applyStatus && newStatus === "CANCELLED" && previousStatus !== "CANCELLED" && EVENTS?.ORDER_CANCELLED) {
//         eventEmitter.safeEmit(EVENTS.ORDER_CANCELLED, {
//             buyerId: existingOrder.buyer,
//             artistId: existingOrder.artist,
//             orderId: existingOrder._id,
//             orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//             reason: updateData["cancellationReason"],
//             refunded: false,
//         });
//     }

//     return res.status(200).json({ received: true });
// })


// ═══════════════════════════════════════════════════
// ✅ Inline Refund Helper (3 retries + exponential backoff)
// ═══════════════════════════════════════════════════
async function attemptRefund(paymentId, amount, reason) {
  const MAX_ATTEMPTS = 3;
  const DELAYS = [0, 5000, 10000]; // 0s, 5s, 10s

  if (!paymentId) {
    return {
      refundOk: false,
      refundPaymentId: null,
      lastError: "no_payment_id",
    };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (DELAYS[attempt - 1] > 0) {
      logger.info(
        `⏳ Refund: waiting ${DELAYS[attempt - 1] / 1000}s before retry ${attempt}...`,
      );
      await new Promise((r) => setTimeout(r, DELAYS[attempt - 1]));
    }

    try {
      logger.info(`💰 Refund attempt ${attempt}/${MAX_ATTEMPTS} (${reason})`);
      const result = await MoyasarService.refundPayment(paymentId, {
        amount: Math.round(amount * 100),
        reason,
      });
      logger.info(`✅ Refund succeeded on attempt ${attempt}`);
      return {
        refundOk: true,
        refundPaymentId: result.id || paymentId,
        lastError: null,
      };
    } catch (err) {
      logger.error(`❌ Refund attempt ${attempt} failed: ${err.message}`);
      if (attempt === MAX_ATTEMPTS) {
        return {
          refundOk: false,
          refundPaymentId: null,
          lastError: err.message,
        };
      }
    }
  }
}

// @desc    Handle OTO Webhook
// @route   POST /api/v1/webhooks/oto
const handleOTOWebhook = catchAsync(async (req, res) => {
  let payload = req.body;

  logger.info("📥 OTO Webhook received");

  // ─── Parse ───
  if (Buffer.isBuffer(payload)) {
    try {
      payload = JSON.parse(payload.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  } else if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  } else if (typeof payload === "object" && payload !== null) {
    const keys = Object.keys(payload);
    if (keys.length > 0 && keys.every((k) => !isNaN(parseInt(k)))) {
      try {
        payload = JSON.parse(Object.values(payload).join(""));
      } catch {
        return res.status(400).json({ error: "Invalid JSON" });
      }
    }
  }

  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "Invalid body" });
  }

  logger.info(
    `📦 OTO Webhook: status=${payload.status}, orderId=${payload.orderId}, otoId=${payload.otoId}`,
  );

  const {
    orderId,
    otoId,
    status,
    trackingNumber,
    trackingUrl,
    trackingURL,
    brandedTrackingURL,
    printAWBURL,
    dcTrackingNumber,
    shipmentNumber,
    deliveryCompany,
  } = payload;

  if (!orderId && !otoId) {
    logger.warn("⚠️ OTO Webhook: No orderId or otoId");
    return res.status(200).json({ received: true });
  }

  // ═══ تحديد الطلب ═══
  let funoonOrderId = null;
  if (orderId) {
    const rawId = String(orderId).replace("FUNOON-", "");
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      funoonOrderId = rawId;
    } else {
      logger.info(`⏭️ Ignoring test webhook: ${rawId}`);
      return res
        .status(200)
        .json({ received: true, note: "test webhook ignored" });
    }
  } else {
    const foundOrder = await Order.findOne({
      "shipping.otoShipmentId": String(otoId),
    });
    if (!foundOrder) {
      logger.warn(`⚠️ Order not found for otoId: ${otoId}`);
      return res.status(200).json({ received: true });
    }
    funoonOrderId = foundOrder._id.toString();
  }

  // ═══ خريطة الحالات ═══
  const statusMap = {
    new: "PROCESSING",
    branchAssigned: "PROCESSING",
    assignedToWarehouse: "PROCESSING",
    searchingDriver: "PROCESSING",
    shipmentCreated: "PROCESSING",
    shipmentProcessing: "PROCESSING",
    shipmentConfirmed: "PROCESSING",
    goingToPickup: "PROCESSING",
    pickedUp: "SHIPPED",
    arrivedTerminal: "SHIPPED",
    inTransit: "SHIPPED",
    outForDelivery: "SHIPPED",
    delivered: "DELIVERED",
    returned: "CANCELLED",
    cancelled: "CANCELLED",
  };

  const newStatus = statusMap[status];
  if (!newStatus) {
    logger.warn(`⚠️ Unknown OTO status: ${status}`);
    return res.status(200).json({ received: true });
  }

  const existingOrder = await Order.findById(funoonOrderId);
  if (!existingOrder) {
    logger.warn(`⚠️ Order not found: ${funoonOrderId}`);
    return res.status(200).json({ received: true });
  }

  const previousStatus = existingOrder.status;
  const wasPaid =
    !!existingOrder.payment?.paidAt || !!existingOrder.payment?.paymentId;

  // ═══ حماية الترتيب ═══
  const STATUS_RANK = { PROCESSING: 2, SHIPPED: 3, DELIVERED: 4, COMPLETED: 5 };
  const currentRank = STATUS_RANK[previousStatus] || 0;
  const newRank = STATUS_RANK[newStatus] || 0;

  let applyStatus = true;
  if (previousStatus === "COMPLETED") {
    applyStatus = false;
  } else if (newStatus === "CANCELLED") {
    applyStatus = previousStatus !== "CANCELLED";
  } else if (newRank > 0 && newRank <= currentRank) {
    applyStatus = false;
    logger.info(`⏭️ Skipping out-of-order: ${previousStatus} → ${newStatus}`);
  }

  // ═══ بناء التحديث ═══
  const updateData = {};
  if (applyStatus) updateData.status = newStatus;

  // ─── بيانات الشحن ───
  const incomingTrackingNumber = trackingNumber || shipmentNumber || "";
  const shipmentExists =
    !!existingOrder.shipping?.shipmentCreatedAt ||
    !!existingOrder.shipping?.trackingNumber ||
    !!existingOrder.shipping?.awbUrl;
  const shipmentLevelStatus = [
    "shipmentCreated",
    "shipmentProcessing",
    "shipmentConfirmed",
    "goingToPickup",
    "pickedUp",
    "arrivedTerminal",
    "inTransit",
    "outForDelivery",
    "delivered",
  ].includes(status);

  if (incomingTrackingNumber || shipmentExists || shipmentLevelStatus) {
    if (incomingTrackingNumber)
      updateData["shipping.trackingNumber"] = incomingTrackingNumber;
    const finalTrackingUrl = trackingUrl || trackingURL || brandedTrackingURL;
    if (finalTrackingUrl) updateData["shipping.trackingUrl"] = finalTrackingUrl;
    if (printAWBURL) updateData["shipping.awbUrl"] = printAWBURL;
    if (deliveryCompany) updateData["shipping.carrier"] = deliveryCompany;
    if (!existingOrder.shipping?.shipmentCreatedAt) {
      updateData["shipping.shipmentCreatedAt"] = new Date();
    }
  } else if (otoId) {
    updateData["shipping.otoShipmentId"] = String(otoId);
  }

  if (dcTrackingNumber) updateData["shipping.otoShipmentId"] = dcTrackingNumber;

  if (
    applyStatus &&
    newStatus === "SHIPPED" &&
    !existingOrder.shipping?.shippedAt
  ) {
    updateData["shipping.shippedAt"] = new Date();
  }
  if (applyStatus && newStatus === "DELIVERED") {
    updateData["shipping.deliveredAt"] = new Date();
  }

  // ═══════════════════════════════════════════════════
  // ✅ CANCELLED handling (returned / cancelled by OTO)
  // ═══════════════════════════════════════════════════
  let otoCancellationDetails = null;

  if (applyStatus && newStatus === "CANCELLED") {
    const isReturned = status === "returned";
    const cancellationKey = isReturned
      ? "oto_shipment_returned"
      : "oto_shipment_cancelled";

    updateData.cancellationReason = cancellationKey;
    updateData.cancelledBy = "system";
    updateData.cancelledAt = new Date();
    updateData.adminOverrideReason = isReturned
      ? `الشحنة ارتجعت من شركة الشحن (${deliveryCompany || "OTO"})`
      : `شركة الشحن (${deliveryCompany || "OTO"}) ألغت الشحنة`;

    // لو الطلب كان مدفوع → تعامل مع الـ refund
    if (wasPaid && existingOrder.payment?.paymentId) {
      // ═══ ✅ Race Condition Protection ═══
      // لو Moyasar webhook وصل قبل OTO webhook والـ refund حصل بالفعل
      if (existingOrder.refundStatus === "REFUNDED") {
        logger.info(
          `ℹ️ Refund already processed for order ${funoonOrderId} (likely from Moyasar webhook). Skipping attemptRefund.`,
        );
        updateData.refundStatus = "REFUNDED";
        updateData.refundedAmount =
          existingOrder.refundedAmount || existingOrder.financials.totalAmount;
        updateData.refundedAt = existingOrder.refundedAt || new Date();
        updateData.refundPaymentId =
          existingOrder.refundPaymentId || existingOrder.payment.paymentId;
      } else {
        // الـ refund لسه ما حصلش → نحاول
        const { refundOk, refundPaymentId, lastError } = await attemptRefund(
          existingOrder.payment.paymentId,
          existingOrder.financials.totalAmount,
          `OTO ${status}: Order #${funoonOrderId.slice(-6).toUpperCase()}`,
        );

        updateData.refundStatus = refundOk ? "REFUNDED" : "FAILED";
        updateData.refundRequestedAt = new Date();
        if (refundPaymentId) updateData.refundPaymentId = refundPaymentId;
        if (refundOk) {
          updateData.refundedAmount = existingOrder.financials.totalAmount;
          updateData.refundedAt = new Date();
        }

        // لو فشل → alert للأدمن
        if (!refundOk) {
          logger.error(
            `🚨 CRITICAL: OTO ${status} refund failed for order ${funoonOrderId}. ` +
              `Payment ID: ${existingOrder.payment.paymentId}, ` +
              `Amount: ${existingOrder.financials.totalAmount} SAR. Last error: ${lastError}`,
          );
          eventEmitter.safeEmit(EVENTS.REFUND_FAILED, {
            paymentId: existingOrder.payment.paymentId,
            amount: existingOrder.financials.totalAmount,
            reason: cancellationKey,
            error: lastError,
            orderIds: [funoonOrderId],
          });
        }
      }

      // ═══ ✅ Wallet Reverse (في الحالتين) ═══
      const wallet = await Wallet.findOne({ user: existingOrder.artist });
      if (wallet) {
        const artistEarning = existingOrder.financials.totalArtistEarning;

        if (!existingOrder.fundsReleased) {
          // الحالة العادية: الفلوس لسه pending
          if (wallet.balance.pending >= artistEarning) {
            try {
              await wallet.debitPending(artistEarning);
              await Transaction.create([
                {
                  wallet: wallet._id,
                  order: existingOrder._id,
                  user: existingOrder.artist,
                  type: "DEBIT_REFUND",
                  amount: -artistEarning,
                  description: `استرداد بسبب ${isReturned ? "ارتجاع الشحنة" : "إلغاء شركة الشحن"} - طلب #${funoonOrderId.slice(-6).toUpperCase()}`,
                  balanceAfter: {
                    available: wallet.balance.available,
                    pending: wallet.balance.pending,
                  },
                  status: "COMPLETED",
                },
              ]);
              logger.info(
                `✅ Wallet reversed (pending) for order ${funoonOrderId}`,
              );
            } catch (walletErr) {
              logger.error(
                `❌ Wallet debit failed for ${funoonOrderId}: ${walletErr.message}`,
              );
              updateData.needsManualClawback = true;
            }
          } else {
            logger.warn(
              `⚠️ Insufficient pending balance for ${funoonOrderId} (needed: ${artistEarning}, have: ${wallet.balance.pending})`,
            );
            updateData.needsManualClawback = true;
          }
        } else {
          // الحالة النادرة: الفلوس اتحولت لـ available
          if (wallet.balance.available >= artistEarning) {
            try {
              await wallet.debit(artistEarning);
              await Transaction.create([
                {
                  wallet: wallet._id,
                  order: existingOrder._id,
                  user: existingOrder.artist,
                  type: "DEBIT_CLAWBACK",
                  amount: -artistEarning,
                  description: `خصم بسبب ارتجاع شحنة طلب #${funoonOrderId.slice(-6).toUpperCase()}`,
                  balanceAfter: {
                    available: wallet.balance.available,
                    pending: wallet.balance.pending,
                  },
                  status: "COMPLETED",
                },
              ]);
              logger.info(
                `✅ Wallet clawback (available) for order ${funoonOrderId}`,
              );
            } catch (walletErr) {
              logger.error(
                `❌ Wallet clawback failed for ${funoonOrderId}: ${walletErr.message}`,
              );
              updateData.needsManualClawback = true;
            }
          } else {
            logger.error(
              `🚨 CRITICAL: Cannot clawback from artist wallet for order ${funoonOrderId}. ` +
                `Required: ${artistEarning}, Available: ${wallet.balance.available}. Manual intervention required.`,
            );
            updateData.needsManualClawback = true;
          }
        }
      }

      // ✅ Quota reverse للشحن المجاني
      if (existingOrder.financials?.platformShippingExpense > 0) {
        await User.updateOne(
          { _id: existingOrder.artist, freeShippingUsed: { $gt: 0 } },
          { $inc: { freeShippingUsed: -1 } },
        );
      }

      // حفظ التفاصيل للإشعارات
      otoCancellationDetails = {
        isReturned,
        refundOk: updateData.refundStatus === "REFUNDED",
        carrier:
          deliveryCompany ||
          existingOrder.shipping?.deliveryCompanyName ||
          "شركة الشحن",
        fundsWereReleased: existingOrder.fundsReleased,
      };
    } else {
      // الطلب ما اتدفعش أصلاً
      updateData.refundStatus = "NONE";
    }
  }

  if (Object.keys(updateData).length > 0) {
    await Order.findByIdAndUpdate(
      funoonOrderId,
      { $set: updateData },
      { new: true, runValidators: false },
    );
  }

  logger.info(
    `✅ Order ${funoonOrderId}: ${previousStatus} → ${applyStatus ? newStatus : previousStatus} ` +
      `(applied=${applyStatus}, otoStatus=${status}${wasPaid && newStatus === "CANCELLED" ? `, refund=${updateData.refundStatus}` : ""})`,
  );

  // ═══ Events ═══
  if (applyStatus && newStatus === "SHIPPED" && previousStatus !== "SHIPPED") {
    eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
      buyerId: existingOrder.buyer,
      artistId: existingOrder.artist,
      orderId: existingOrder._id,
      orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
      carrier:
        existingOrder.shipping?.deliveryCompanyName ||
        existingOrder.shipping?.carrier ||
        "شركة الشحن",
    });
  } else if (
    applyStatus &&
    newStatus === "DELIVERED" &&
    previousStatus !== "DELIVERED"
  ) {
    eventEmitter.safeEmit(EVENTS.ORDER_DELIVERED, {
      buyerId: existingOrder.buyer,
      artistId: existingOrder.artist,
      orderId: existingOrder._id,
      orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
    });
  } else if (
    applyStatus &&
    newStatus === "CANCELLED" &&
    previousStatus !== "CANCELLED" &&
    EVENTS?.ORDER_CANCELLED
  ) {
    eventEmitter.safeEmit(EVENTS.ORDER_CANCELLED, {
      buyerId: existingOrder.buyer,
      artistId: existingOrder.artist,
      orderId: existingOrder._id,
      orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
      totalAmount: existingOrder.financials.totalAmount,
      reason: updateData.cancellationReason,
      refundInitiated: wasPaid && updateData.refundStatus === "REFUNDED",
      // حقول إضافية للفنان
      isOtoCancellation: true,
      isReturned: otoCancellationDetails?.isReturned,
      carrier: otoCancellationDetails?.carrier,
      fundsWereReleased: otoCancellationDetails?.fundsWereReleased,
    });
  }

  return res.status(200).json({ received: true });
});


// const crypto = require("crypto");
// const OTO_WEBHOOK_SECRET = process.env.OTO_WEBHOOK_SECRET || "";
// const OTO_WEBHOOK_AUTHORIZATION_KEY =
//   process.env.OTO_WEBHOOK_AUTHORIZATION_KEY || "";

// function parseWebhookPayload(body) {
//   let payload = body;

//   if (Buffer.isBuffer(payload)) {
//     payload = JSON.parse(payload.toString("utf8"));
//   } else if (typeof payload === "string") {
//     payload = JSON.parse(payload);
//   } else if (payload && typeof payload === "object") {
//     const keys = Object.keys(payload);

//     // بعض الـ body parsers قد تحول النص إلى object بمفاتيح رقمية
//     if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
//       payload = JSON.parse(Object.values(payload).join(""));
//     }
//   }

//   if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
//     throw new Error("Invalid webhook body");
//   }

//   return payload;
// }

// function safeEqual(a, b) {
//   const first = Buffer.from(String(a || ""));
//   const second = Buffer.from(String(b || ""));

//   if (first.length !== second.length) return false;
//   return crypto.timingSafeEqual(first, second);
// }

// function verifyOtoSignature(payload) {
//   // لو لم يتم إعداد secretKey، لا نعمل validation للتوقيع
//   if (!OTO_WEBHOOK_SECRET) return true;

//   const { orderId, status, errorCode, timestamp, signature } = payload;
//   if (!orderId || !timestamp || !signature) return false;

//   // orderStatus يوقّع على orderId:status:timestamp
//   // shipmentError يوقّع على orderId:errorCode:timestamp
//   const eventValue = errorCode || status;
//   if (!eventValue) return false;

//   const rawValue = `${orderId}:${eventValue}:${timestamp}`;
//   const expectedSignature = crypto
//     .createHmac("sha256", OTO_WEBHOOK_SECRET)
//     .update(rawValue)
//     .digest("base64");

//   return safeEqual(expectedSignature, signature);
// }

// function verifyOtoAuthorization(req) {
//   if (!OTO_WEBHOOK_AUTHORIZATION_KEY) return true;

//   const authorization = req.get("Authorization") || "";
//   const expected = OTO_WEBHOOK_AUTHORIZATION_KEY;

//   return authorization === expected || authorization === `Bearer ${expected}`;
// }

// async function findFunoonOrder(payload) {
//   const rawOrderId = payload.orderId;
//   const rawOtoId = payload.otoId;

//   if (!rawOrderId && !rawOtoId) return null;

//   const orderId = rawOrderId ? String(rawOrderId) : null;
//   const otoId = rawOtoId ? String(rawOtoId) : null;

//   // في orderStatus قد يكون orderId هو ObjectId الداخلي عند استخدام prefix مثل FUNOON-
//   if (orderId) {
//     const normalizedId = orderId.replace(/^FUNOON-/i, "");

//     if (mongoose.Types.ObjectId.isValid(normalizedId)) {
//       const orderByMongoId = await Order.findById(normalizedId);
//       if (orderByMongoId) return orderByMongoId;
//     }
//   }

//   // في shipmentError قد يكون orderId هو رقم الطلب الموجود في OTO، وليس Mongo ObjectId
//   const values = [orderId, otoId].filter(Boolean);
//   const conditions = [];

//   for (const value of values) {
//     conditions.push(
//       { "shipping.otoOrderId": value },
//       { "shipping.otoId": value },
//       { "shipping.otoShipmentId": value },
//       { "shipping.otoOrderNumber": value },
//       { "shipping.orderId": value },
//     );
//   }

//   if (!conditions.length) return null;
//   return Order.findOne({ $or: conditions });
// }
// // @desc    Handle OTO orderStatus + shipmentError Webhooks
// // @route   POST /api/v1/webhooks/oto
// const handleOTOWebhook = catchAsync(async (req, res) => {
//   let payload;

//   try {
//     payload = parseWebhookPayload(req.body);
//   } catch (error) {
//     logger.warn("⚠️ OTO Webhook: Invalid JSON/body", {
//       error: error.message,
//     });

//     return res.status(400).json({ error: "Invalid JSON" });
//   }

//   logger.info("📥 OTO Webhook received", {
//     bodyType: typeof req.body,
//     isBuffer: Buffer.isBuffer(req.body),
//     keys: Object.keys(payload),
//   });

//   // تحقق Authorization إذا تم تسجيل authorizationKey في OTO
//   if (!verifyOtoAuthorization(req)) {
//     logger.warn("⚠️ OTO Webhook: Invalid Authorization header");
//     return res.status(401).json({ error: "Unauthorized" });
//   }

//   // تحقق HMAC إذا تم تسجيل secretKey في OTO
//   if (!verifyOtoSignature(payload)) {
//     logger.warn("⚠️ OTO Webhook: Invalid signature", {
//       orderId: payload.orderId,
//       status: payload.status,
//       errorCode: payload.errorCode,
//     });

//     return res.status(401).json({ error: "Invalid signature" });
//   }

//   const {
//     orderId,
//     otoId,
//     status,
//     trackingNumber,
//     trackingUrl,
//     trackingURL,
//     brandedTrackingURL,
//     printAWBURL,
//     dcTrackingNumber,
//     shipmentNumber,
//     deliveryCompany,
//   } = payload;

//   logger.info("📦 OTO Webhook payload", {
//     orderId,
//     otoId,
//     status,
//     errorCode: payload.errorCode,
//     deliveryCompany,
//   });

//   const existingOrder = await findFunoonOrder(payload);

//   if (!existingOrder) {
//     logger.warn("⚠️ OTO Webhook: Order not found", {
//       orderId,
//       otoId,
//       status,
//       errorCode: payload.errorCode,
//     });

//     // نرجع 200 حتى لا يعيد OTO إرسال نفس الـ webhook بلا نهاية
//     return res.status(200).json({ received: true });
//   }

//   // =========================================================
//   // 1) shipmentError
//   // =========================================================
//   // هذا النوع لا يحتوي status عادة، ويحتوي errorCode أو deliveryCompanyResponse
//   const isShipmentError =
//     !status &&
//     Boolean(
//       payload.errorCode ||
//         payload.deliveryCompanyResponse ||
//         payload.errorMessage,
//     );

//   if (isShipmentError) {
//     const {
//       errorCode,
//       errorMessage,
//       deliveryCompanyResponse,
//       timestamp,
//     } = payload;

//     const errorUpdate = {
//       "shipping.shipmentCreationFailed": true,
//       "shipping.lastErrorCode": errorCode || "unknown",
//       "shipping.lastErrorMessage": errorMessage || "",
//       "shipping.lastDeliveryCompanyResponse":
//         deliveryCompanyResponse || "",
//       "shipping.lastErrorCompany": deliveryCompany || "",
//       "shipping.lastErrorAt": new Date(),
//     };

//     // خزّن رقم OTO لو وصل في shipmentError ولم يكن محفوظًا
//     if (orderId && !existingOrder.shipping?.otoOrderId) {
//       errorUpdate["shipping.otoOrderId"] = String(orderId);
//     }

//     if (otoId && !existingOrder.shipping?.otoId) {
//       errorUpdate["shipping.otoId"] = String(otoId);
//     }

//     await Order.findByIdAndUpdate(
//       existingOrder._id,
//       { $set: errorUpdate },
//       { new: true, runValidators: false },
//     );

//     logger.error("❌ OTO shipment creation failed", {
//       funoonOrderId: existingOrder._id.toString(),
//       orderId,
//       errorCode,
//       errorMessage,
//       deliveryCompanyResponse,
//       deliveryCompany,
//       timestamp,
//     });

//     // اختياري: أرسل event داخليًا للوحة التحكم أو إشعار الإدارة
//     if (EVENTS?.SHIPMENT_ERROR) {
//       eventEmitter.safeEmit(EVENTS.SHIPMENT_ERROR, {
//         buyerId: existingOrder.buyer,
//         artistId: existingOrder.artist,
//         orderId: existingOrder._id,
//         orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//         otoOrderId: orderId || otoId || null,
//         errorCode: errorCode || "unknown",
//         errorMessage: errorMessage || "",
//         deliveryCompanyResponse: deliveryCompanyResponse || "",
//         deliveryCompany: deliveryCompany || null,
//       });
//     }

//     return res.status(200).json({ received: true });
//   }

//   // =========================================================
//   // 2) orderStatus
//   // =========================================================
//   if (!status) {
//     logger.warn("⚠️ OTO Webhook: No status and not shipmentError", {
//       orderId,
//       otoId,
//     });

//     return res.status(200).json({ received: true });
//   }

//   const statusMap = {
//     new: "PROCESSING",
//     branchAssigned: "PROCESSING",
//     assignedToWarehouse: "PROCESSING",
//     searchingDriver: "PROCESSING",
//     shipmentCreated: "PROCESSING",
//     shipmentProcessing: "PROCESSING",
//     shipmentConfirmed: "PROCESSING",
//     goingToPickup: "PROCESSING",

//     pickedUp: "SHIPPED",
//     arrivedTerminal: "SHIPPED",
//     inTransit: "SHIPPED",
//     outForDelivery: "SHIPPED",

//     delivered: "DELIVERED",
//     returned: "CANCELLED",
//     cancelled: "CANCELLED",
//   };

//   const newStatus = statusMap[status];

//   if (!newStatus) {
//     logger.warn(`⚠️ Unknown OTO status: ${status}`);
//     return res.status(200).json({ received: true });
//   }

//   const previousStatus = existingOrder.status;

//   const STATUS_RANK = {
//     PROCESSING: 2,
//     SHIPPED: 3,
//     DELIVERED: 4,
//     COMPLETED: 5,
//   };

//   const currentRank = STATUS_RANK[previousStatus] || 0;
//   const newRank = STATUS_RANK[newStatus] || 0;

//   let applyStatus = true;

//   if (previousStatus === "COMPLETED") {
//     applyStatus = false;
//   } else if (newStatus === "CANCELLED") {
//     applyStatus = previousStatus !== "CANCELLED";
//   } else if (newRank > 0 && newRank <= currentRank) {
//     applyStatus = false;

//     logger.info("⏭️ Skipping out-of-order status", {
//       previousStatus,
//       newStatus,
//       otoStatus: status,
//     });
//   }

//   const updateData = {};

//   if (applyStatus) {
//     updateData.status = newStatus;
//   }

//   const incomingTrackingNumber =
//     trackingNumber || shipmentNumber || dcTrackingNumber || "";

//   const shipmentExists = Boolean(
//     existingOrder.shipping?.shipmentCreatedAt ||
//       existingOrder.shipping?.trackingNumber ||
//       existingOrder.shipping?.awbUrl,
//   );

//   const shipmentLevelStatus = [
//     "shipmentCreated",
//     "shipmentProcessing",
//     "shipmentConfirmed",
//     "goingToPickup",
//     "pickedUp",
//     "arrivedTerminal",
//     "inTransit",
//     "outForDelivery",
//     "delivered",
//   ].includes(status);

//   if (incomingTrackingNumber || shipmentExists || shipmentLevelStatus) {
//     if (incomingTrackingNumber) {
//       updateData["shipping.trackingNumber"] = incomingTrackingNumber;
//     }

//     const finalTrackingUrl =
//       trackingUrl || trackingURL || brandedTrackingURL;

//     if (finalTrackingUrl) {
//       updateData["shipping.trackingUrl"] = finalTrackingUrl;
//     }

//     if (printAWBURL) {
//       updateData["shipping.awbUrl"] = printAWBURL;
//     }

//     if (deliveryCompany) {
//       updateData["shipping.carrier"] = deliveryCompany;
//     }

//     if (!existingOrder.shipping?.shipmentCreatedAt) {
//       updateData["shipping.shipmentCreatedAt"] = new Date();
//     }

//     // امسح علامة فشل الإنشاء إذا وصل بعد ذلك status خاص بشحنة فعلية
//     updateData["shipping.shipmentCreationFailed"] = false;
//   } else if (orderId && !existingOrder.shipping?.otoOrderId) {
//     updateData["shipping.otoOrderId"] = String(orderId);
//   }

//   if (otoId && !existingOrder.shipping?.otoId) {
//     updateData["shipping.otoId"] = String(otoId);
//   }

//   if (dcTrackingNumber) {
//     updateData["shipping.otoShipmentId"] = String(dcTrackingNumber);
//   }

//   if (
//     applyStatus &&
//     newStatus === "SHIPPED" &&
//     !existingOrder.shipping?.shippedAt
//   ) {
//     updateData["shipping.shippedAt"] = new Date();
//   }

//   if (
//     applyStatus &&
//     newStatus === "DELIVERED" &&
//     !existingOrder.shipping?.deliveredAt
//   ) {
//     updateData["shipping.deliveredAt"] = new Date();
//   }

//   if (applyStatus && newStatus === "CANCELLED") {
//     updateData.cancellationReason =
//       "الشحنة أُلغيت أو ارتجعت من شركة الشحن، راجع الدعم للاسترداد";
//     updateData.cancelledBy = "system";
//     updateData.cancelledAt = new Date();
//     updateData.refundStatus = "PENDING";
//   }

//   if (Object.keys(updateData).length > 0) {
//     await Order.findByIdAndUpdate(
//       existingOrder._id,
//       { $set: updateData },
//       { new: true, runValidators: false },
//     );
//   }

//   logger.info("✅ OTO orderStatus processed", {
//     funoonOrderId: existingOrder._id.toString(),
//     previousStatus,
//     newStatus: applyStatus ? newStatus : previousStatus,
//     applied: applyStatus,
//     otoStatus: status,
//   });

//   // =========================================================
//   // 3) Internal events عند التحولات الحقيقية فقط
//   // =========================================================
//   if (
//     applyStatus &&
//     newStatus === "SHIPPED" &&
//     previousStatus !== "SHIPPED"
//   ) {
//     eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
//       buyerId: existingOrder.buyer,
//       orderId: existingOrder._id,
//       orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//       carrier:
//         existingOrder.shipping?.deliveryCompanyName ||
//         existingOrder.shipping?.carrier ||
//         "شركة الشحن",
//     });
//   } else if (
//     applyStatus &&
//     newStatus === "DELIVERED" &&
//     previousStatus !== "DELIVERED"
//   ) {
//     eventEmitter.safeEmit(EVENTS.ORDER_DELIVERED, {
//       buyerId: existingOrder.buyer,
//       orderId: existingOrder._id,
//       orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//     });
//   } else if (
//     applyStatus &&
//     newStatus === "CANCELLED" &&
//     previousStatus !== "CANCELLED" &&
//     EVENTS?.ORDER_CANCELLED
//   ) {
//     eventEmitter.safeEmit(EVENTS.ORDER_CANCELLED, {
//       buyerId: existingOrder.buyer,
//       artistId: existingOrder.artist,
//       orderId: existingOrder._id,
//       orderNumber: existingOrder._id.toString().slice(-6).toUpperCase(),
//       reason: updateData.cancellationReason,
//       refunded: false,
//     });
//   }

//   return res.status(200).json({ received: true });
// });

// ═══════════════════════════════════════════════════════════════
// ✅ handleOTOWebhook — نفس المنطق + logging cleanup
// ═══════════════════════════════════════════════════════════════
// const handleOTOWebhook = catchAsync(async (req, res, next) => {
//     let payload = req.body;

//     // ✅ Cleanup: logging محسن (بدل char indices)
//     logger.info("📥 OTO Webhook received");
//     logger.info(`   Body type: ${typeof payload}, isBuffer: ${Buffer.isBuffer(payload)}`);

//     if (Buffer.isBuffer(payload)) {
//         try {
//             payload = JSON.parse(payload.toString("utf8"));
//         } catch (e) {
//             logger.error("❌ Could not parse Buffer as JSON");
//             return res.status(400).json({ error: "Invalid JSON" });
//         }
//     } else if (typeof payload === "string") {
//         try {
//             payload = JSON.parse(payload);
//         } catch (e) {
//             logger.error("❌ Could not parse string as JSON");
//             return res.status(400).json({ error: "Invalid JSON" });
//         }
//     } else if (typeof payload === "object" && payload !== null) {
//         const keys = Object.keys(payload);
//         if (keys.length > 0 && keys.every((k) => !isNaN(parseInt(k)))) {
//             try {
//                 payload = JSON.parse(Object.values(payload).join(""));
//             } catch (e) {
//                 logger.error("❌ Could not recover character-spread object");
//                 return res.status(400).json({ error: "Invalid JSON" });
//             }
//         }
//     }

//     if (!payload || typeof payload !== "object") {
//         logger.error("❌ OTO Webhook: Invalid body");
//         return res.status(400).json({ error: "Invalid body" });
//     }

//     // ✅ Cleanup: log محسن
//     logger.info(`📦 Webhook payload: ${JSON.stringify(payload).substring(0, 500)}`);

//     const {
//         orderId,
//         otoId,
//         status,
//         trackingNumber,
//         trackingUrl,
//         trackingURL,
//         brandedTrackingURL,
//         printAWBURL,
//         dcTrackingNumber,
//         shipmentNumber,
//     } = payload;

//     if (!orderId && !otoId) {
//         logger.warn("⚠️ OTO Webhook: No orderId or otoId in payload");
//         return res.status(200).json({ received: true });
//     }

//     let funoonOrderId;
//     if (orderId) {
//         funoonOrderId = orderId.replace("FUNOON-", "");
//     } else if (otoId) {
//         const foundOrder = await Order.findOne({ "shipping.otoShipmentId": String(otoId) });
//         if (!foundOrder) {
//             logger.warn(`⚠️ Order not found for otoId: ${otoId}`);
//             return res.status(200).json({ received: true });
//         }
//         funoonOrderId = foundOrder._id.toString();
//     }

//     const statusMap = {
//         new: "PROCESSING",
//         branchAssigned: "PROCESSING",
//         assignedToWarehouse: "PROCESSING",
//         searchingDriver: "PROCESSING",
//         shipmentCreated: "PROCESSING",
//         pickedUp: "SHIPPED",
//         inTransit: "SHIPPED",
//         outForDelivery: "SHIPPED",
//         delivered: "DELIVERED",
//         returned: "RETURNED",
//         cancelled: "CANCELLED",
//     };

//     const newStatus = statusMap[status];
//     if (!newStatus) {
//         logger.warn(`⚠️ Unknown OTO status: ${status}`);
//         return res.status(200).json({ received: true });
//     }

//     const updateData = { status: newStatus };
//     if (trackingNumber || shipmentNumber) {
//         updateData["shipping.trackingNumber"] = trackingNumber || shipmentNumber;
//     }
//     if (dcTrackingNumber) updateData["shipping.otoShipmentId"] = dcTrackingNumber;
//     if (otoId) updateData["shipping.otoShipmentId"] = String(otoId);

//     const finalTrackingUrl = brandedTrackingURL || trackingURL || trackingUrl;
//     if (finalTrackingUrl) updateData["shipping.trackingUrl"] = finalTrackingUrl;
//     if (printAWBURL) updateData["shipping.awbUrl"] = printAWBURL;
//     if (newStatus === "DELIVERED") updateData["shipping.deliveredAt"] = new Date();

//     const existingOrder = await Order.findById(funoonOrderId);
//     const previousStatus = existingOrder?.status;

//     const updatedOrder = await Order.findByIdAndUpdate(
//         funoonOrderId,
//         { $set: updateData },
//         { new: true, runValidators: false },
//     );

//     if (!updatedOrder) {
//         logger.warn(`⚠️ Order not found: ${funoonOrderId}`);
//         return res.status(200).json({ received: true });
//     }

//     logger.info(`✅ Order ${funoonOrderId}: ${previousStatus} → ${newStatus}`);

//     // Events
//     if (newStatus === "SHIPPED" && previousStatus !== "SHIPPED") {
//         eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
//             buyerId: updatedOrder.buyer,
//             orderId: updatedOrder._id,
//             orderNumber: updatedOrder._id.toString().slice(-6).toUpperCase(),
//             carrier: updatedOrder.shipping?.deliveryCompanyName || "شركة الشحن",
//         });
//     } else if (newStatus === "DELIVERED" && previousStatus !== "DELIVERED") {
//         eventEmitter.safeEmit(EVENTS.ORDER_DELIVERED, {
//             buyerId: updatedOrder.buyer,
//             orderId: updatedOrder._id,
//             orderNumber: updatedOrder._id.toString().slice(-6).toUpperCase(),
//         });
//     }

//     return res.status(200).json({ received: true });
// });

module.exports = {
  calculateShipping,
  createOtoOrder,
  createShipment,
  getAWBUrl,
  trackShipment,
  handleOTOWebhook,
};
