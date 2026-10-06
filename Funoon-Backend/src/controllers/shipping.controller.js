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

  const opalOrderId = `OPAL-${order._id}`;

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
    orderId: opalOrderId,
    createShipment: false,
    paymentMethod: "paid",
    amount: maxArtworkPrice,
    amount_due: 0,
    subtotal: order.financials.subtotal,
    shippingAmount: order.financials.shippingCost || 0,
    currency: order.financials.currency || "SAR",

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
  logger.info(`✅ OTO order created: opalId=${opalOrderId}, otoId=${otoId}`);

  const updatedOrder = await Order.findByIdAndUpdate(
    order._id,
    {
      $set: {
        status: "PROCESSING",
        "shipping.otoListId": opalOrderId,
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
      opalOrderId,
      otoId: otoId ? String(otoId) : null,
      message: "تم إنشاء طلب الشحن بنجاح — يمكنك الآن إنشاء الشحنة",
    },
    M.shipping.created,
  );
});

//! test checkOrderStatus
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

  const opalOrderId = order.shipping?.otoListId;
  if (!opalOrderId) {
    throw new BadRequestError("يجب إنشاء طلب الشحن أولاً قبل إنشاء الشحنة");
  }

  const deliveryOptionId = order.shipping?.deliveryOptionId;
  if (!deliveryOptionId) {
    throw new BadRequestError(M.shipping.noDeliveryOption);
  }

  const shipmentAlreadyExists = Boolean(
    order.shipping?.trackingNumber || order.shipping?.awbUrl,
  );

  if (shipmentAlreadyExists) {
    return ApiResponse.success(
      res,
      {
        orderId: order._id,
        status: order.status,
        opalOrderId,
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
    `📦 Creating OTO shipment for ${opalOrderId} with deliveryOptionId=${deliveryOptionId}`,
  );
  logger.info(
    `📏 Dims: ${dims.length}×${dims.width}×${dims.height} cm, ${dims.weight} kg`,
  );
  logger.info(`💰 whoPays: ${whoPays}, pickingType: ${pickingType}`);

  try {
    const shipmentResponse = await otoService.createShipment(
      opalOrderId,
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
      `✅ OTO createShipment request accepted for ${opalOrderId}: ${JSON.stringify(
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

      const statusData = await otoService.getOrderStatus(opalOrderId);
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
          `🎯 Got shipment data for ${opalOrderId}: tracking=${
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
        opalOrderId,
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
      opalOrderId,
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
    try {
      const orderStatus = await otoService.getOrderStatus(`OPAL-${order._id}`);

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

    try {
      const awbResponse = await otoService.printAWB(`OPAL-${order._id}`);
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

  let opalOrderId = null;
  if (orderId) {
    const rawId = String(orderId).replace("OPAL-", "");
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      opalOrderId = rawId;
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
    opalOrderId = foundOrder._id.toString();
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

  const existingOrder = await Order.findById(opalOrderId);
  if (!existingOrder) {
    logger.warn(`⚠️ Order not found: ${opalOrderId}`);
    return res.status(200).json({ received: true });
  }

  const previousStatus = existingOrder.status;
  const wasPaid =
    !!existingOrder.payment?.paidAt || !!existingOrder.payment?.paymentId;

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

  const updateData = {};
  if (applyStatus) updateData.status = newStatus;

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
  // CANCELLED handling (returned / cancelled by OTO)
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

    if (wasPaid && existingOrder.payment?.paymentId) {
      if (existingOrder.refundStatus === "REFUNDED") {
        logger.info(
          `ℹ️ Refund already processed for order ${opalOrderId} (likely from Moyasar webhook). Skipping attemptRefund.`,
        );
        updateData.refundStatus = "REFUNDED";
        updateData.refundedAmount =
          existingOrder.refundedAmount || existingOrder.financials.totalAmount;
        updateData.refundedAt = existingOrder.refundedAt || new Date();
        updateData.refundPaymentId =
          existingOrder.refundPaymentId || existingOrder.payment.paymentId;
      } else {
        const { refundOk, refundPaymentId, lastError } = await attemptRefund(
          existingOrder.payment.paymentId,
          existingOrder.financials.totalAmount,
          `OTO ${status}: Order #${opalOrderId.slice(-6).toUpperCase()}`,
        );

        updateData.refundStatus = refundOk ? "REFUNDED" : "FAILED";
        updateData.refundRequestedAt = new Date();
        if (refundPaymentId) updateData.refundPaymentId = refundPaymentId;
        if (refundOk) {
          updateData.refundedAmount = existingOrder.financials.totalAmount;
          updateData.refundedAt = new Date();
        }

        if (!refundOk) {
          logger.error(
            `🚨 CRITICAL: OTO ${status} refund failed for order ${opalOrderId}. ` +
              `Payment ID: ${existingOrder.payment.paymentId}, ` +
              `Amount: ${existingOrder.financials.totalAmount} SAR. Last error: ${lastError}`,
          );
          eventEmitter.safeEmit(EVENTS.REFUND_FAILED, {
            paymentId: existingOrder.payment.paymentId,
            amount: existingOrder.financials.totalAmount,
            reason: cancellationKey,
            error: lastError,
            orderIds: [opalOrderId],
          });
        }
      }

      const wallet = await Wallet.findOne({ user: existingOrder.artist });
      if (wallet) {
        const artistEarning = existingOrder.financials.totalArtistEarning;

        if (!existingOrder.fundsReleased) {
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
                  description: `استرداد بسبب ${isReturned ? "ارتجاع الشحنة" : "إلغاء شركة الشحن"} - طلب #${opalOrderId.slice(-6).toUpperCase()}`,
                  balanceAfter: {
                    available: wallet.balance.available,
                    pending: wallet.balance.pending,
                  },
                  status: "COMPLETED",
                },
              ]);
              logger.info(
                `✅ Wallet reversed (pending) for order ${opalOrderId}`,
              );
            } catch (walletErr) {
              logger.error(
                `❌ Wallet debit failed for ${opalOrderId}: ${walletErr.message}`,
              );
              updateData.needsManualClawback = true;
            }
          } else {
            logger.warn(
              `⚠️ Insufficient pending balance for ${opalOrderId} (needed: ${artistEarning}, have: ${wallet.balance.pending})`,
            );
            updateData.needsManualClawback = true;
          }
        } else {
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
                  description: `خصم بسبب ارتجاع شحنة طلب #${opalOrderId.slice(-6).toUpperCase()}`,
                  balanceAfter: {
                    available: wallet.balance.available,
                    pending: wallet.balance.pending,
                  },
                  status: "COMPLETED",
                },
              ]);
              logger.info(
                `✅ Wallet clawback (available) for order ${opalOrderId}`,
              );
            } catch (walletErr) {
              logger.error(
                `❌ Wallet clawback failed for ${opalOrderId}: ${walletErr.message}`,
              );
              updateData.needsManualClawback = true;
            }
          } else {
            logger.error(
              `🚨 CRITICAL: Cannot clawback from artist wallet for order ${opalOrderId}. ` +
                `Required: ${artistEarning}, Available: ${wallet.balance.available}. Manual intervention required.`,
            );
            updateData.needsManualClawback = true;
          }
        }
      }

      if (existingOrder.financials?.platformShippingExpense > 0) {
        await User.updateOne(
          { _id: existingOrder.artist, freeShippingUsed: { $gt: 0 } },
          { $inc: { freeShippingUsed: -1 } },
        );
      }

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
      updateData.refundStatus = "NONE";
    }
  }

  if (Object.keys(updateData).length > 0) {
    await Order.findByIdAndUpdate(
      opalOrderId,
      { $set: updateData },
      { new: true, runValidators: false },
    );
  }

  logger.info(
    `✅ Order ${opalOrderId}: ${previousStatus} → ${applyStatus ? newStatus : previousStatus} ` +
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

      isOtoCancellation: true,
      isReturned: otoCancellationDetails?.isReturned,
      carrier: otoCancellationDetails?.carrier,
      fundsWereReleased: otoCancellationDetails?.fundsWereReleased,
    });
  }

  return res.status(200).json({ received: true });
});

module.exports = {
  calculateShipping,
  createOtoOrder,
  createShipment,
  getAWBUrl,
  trackShipment,
  handleOTOWebhook,
};
