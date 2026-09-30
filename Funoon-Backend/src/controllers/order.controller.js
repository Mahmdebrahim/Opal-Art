// src/controllers/order.controller.js
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Artwork = require("../models/Artwork");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const MoyasarService = require("../services/payment/moyasar.service");
const OTOService = require("../services/shipping/oto.service");
const logger = require("../utils/logger");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../utils/api-error");
const ApiResponse = require("../utils/api-response");
const catchAsync = require("../utils/catch-async");

const otoService = OTOService;
const M = require("../utils/messages");
const eventEmitter = require("../events/event-emitter");
const EVENTS = require("../events/events");
/**
 * - Helper function: فلترة خيارات الشحن من OTO
 * - استبعاد PUDO (pickupByCustomer) - العميل مش هيرفع ياخد من فرع
 * - استبعاد dropoffOnly - الفنان مش هيرفع يودّي للفرع
 * - لازم يوصل لحد البيت (toCustomerDoorstep)
 * - لازم الشركة بتيجي تاخد من الفنان (freePickup أو freePickupDropoff)
 */
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

/**
 * Helper function: اختيار أرخص خيار صالح
 */
const selectCheapestOption = (validOptions) => {
  if (!validOptions || validOptions.length === 0) return null;

  return validOptions.reduce((min, opt) => (opt.price < min.price ? opt : min));
};

// ═══════════════════════════════════════════════════
// Prestige Free Shipping Quota — أول 10 طلبات/سنة بس
// ═══════════════════════════════════════════════════
const checkFreeShippingQuota = (artist) => {
  const plan = artist?.subscription?.plan;
  const used = artist?.freeShippingUsed || 0;
  const quotaLimit = User.PLAN_CONFIG?.opal_prestige?.freeShippingQuota ?? 10;

  const result = plan === "opal_prestige" && used < quotaLimit;

  logger.info(
    `🔍 checkFreeShippingQuota debug: ` +
      `plan=${plan}, used=${used}, quotaLimit=${quotaLimit}, result=${result}`,
  );
  return result;
};

// ═══════════════════════════════════════════════════
// Just-in-Time Cleanup للـ expired orders
// بيشغل قبل حجز الـ quota عشان نضمن الـ count دقيق
// ═══════════════════════════════════════════════════
const cleanupExpiredOrdersForArtists = async (artistIds, session = null) => {
  // ✅ Reads from env (same as the periodic cleanup job)
  const EXPIRE_MINUTES = Number(process.env.ORDER_EXPIRE_MINUTES || 15);
  const EXPIRE_AFTER_MS = EXPIRE_MINUTES * 60 * 1000;
  const cutoff = new Date(Date.now() - EXPIRE_AFTER_MS);

  const expiredOrders = await Order.find({
    artist: { $in: artistIds },
    status: "PENDING_PAYMENT",
    createdAt: { $lte: cutoff },
  }).session(session);

  if (expiredOrders.length === 0) return 0;

  let cleaned = 0;

  for (const order of expiredOrders) {
    // Cancel invoice (best-effort)
    if (order.payment?.invoiceId) {
      try {
        await MoyasarService.cancelInvoice(order.payment.invoiceId);
      } catch {
        // عادي — ممكن يكون expired بالفعل عند Moyasar
      }
    }

    // Mark as cancelled
    order.status = "CANCELLED";
    order.cancelledAt = new Date();
    order.cancellationReason = "expired_jit_cleanup";
    await order.save({ session });

    // Release artworks
    await Artwork.updateMany(
      {
        _id: { $in: order.items.map((i) => i.artwork) },
        reservedBy: order.buyer,
      },
      { $set: { reservedBy: null, reservedUntil: null } },
      { session },
    );

    // Reverse quota
    if (order.financials?.platformShippingExpense > 0) {
      await User.updateOne(
        { _id: order.artist, freeShippingUsed: { $gt: 0 } },
        { $inc: { freeShippingUsed: -1 } },
        { session },
      );
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(
      `🧹 JIT cleanup: reversed ${cleaned} expired quotas for artists (window: ${EXPIRE_MINUTES}m)`,
    );
  }

  return cleaned;
};

// @route   POST /api/v1/orders/checkout
// @desc    Checkout cart and create order(s)
// @access  Private (Buyer only)
const checkout = catchAsync(async (req, res, next) => {
  const buyer = req.user;
  const { paymentMethod = "creditcard" } = req.body;

  // ═══════════════════════════════════════════════════
  // 1. Load cart + clean invalid items
  // ═══════════════════════════════════════════════════
  let cart = await Cart.findOne({ user: buyer._id });
  if (!cart || cart.items.length === 0) {
    throw new BadRequestError(M.orders.cartEmpty);
  }

  await cart.cleanInvalidItems();
  if (cart.items.length === 0) {
    throw new BadRequestError(M.orders.cartEmptyCleaned);
  }

  await cart.populate([
    { path: "items.artwork" },
    {
      path: "items.artist",
      select: "name email subscription address phone isBanned freeShippingUsed",
    },
  ]);

  // ═══════════════════════════════════════════════════
  // 2. Reuse existing PENDING orders (within 10 min window)
  // ═══════════════════════════════════════════════════
  const REUSE_WINDOW = 10 * 60 * 1000;
  const existingPendingOrders = await Order.find({
    buyer: buyer._id,
    status: "PENDING_PAYMENT",
    createdAt: { $gt: new Date(Date.now() - REUSE_WINDOW) },
  }).populate(
    "items.artwork",
    "title isSold isActive reservedBy reservedUntil",
  );

  if (existingPendingOrders.length > 0) {
    const existingOrder = existingPendingOrders[0];
    // ✅ NEW: الـ reuse مسموح بس لو محتويات الـ cart مطابقة تماماً للـ pending orders
    const cartIds = cart.items
      .map((i) => i.artwork._id.toString())
      .sort()
      .join(",");
    const pendingIds = existingPendingOrders
      .flatMap((o) =>
        o.items.map((i) => {
          const artworkId =
            typeof i.artwork === "object"
              ? i.artwork._id.toString()
              : i.artwork.toString();
          return artworkId;
        }),
      )
      .sort()
      .join(",");
    const cartMatchesPending = cartIds === pendingIds;

    if (!cartMatchesPending) {
      logger.info(
        `🛒 Cart changed since pending order (${existingPendingOrders.length}) — will recreate orders`,
      );
      logger.debug(`🔍 Cart IDs: ${cartIds}`);
      logger.debug(`🔍 Pending IDs: ${pendingIds}`);
    }
    let allAvailable = true;

    for (const item of existingOrder.items) {
      const artwork = item.artwork;
      if (!artwork || artwork.isSold || !artwork.isActive) {
        allAvailable = false;
        break;
      }
      if (
        artwork.reservedBy &&
        artwork.reservedBy.toString() !== buyer._id.toString() &&
        artwork.reservedUntil > new Date()
      ) {
        allAvailable = false;
        break;
      }
    }

    const artistIds = [
      ...new Set(
        existingOrder.items.map((i) => i.artwork?.artist).filter(Boolean),
      ),
    ];
    const bannedArtists = await User.find({
      _id: { $in: artistIds },
      isBanned: true,
    }).select("_id");

    if (bannedArtists.length > 0) {
      logger.warn(`⚠️ Reuse blocked: artist(s) banned since original order`);
    } else if (
      cartMatchesPending &&
      allAvailable &&
      existingOrder.payment?.invoiceId
    ) {
      try {
        const invoice = await MoyasarService.fetchInvoice(
          existingOrder.payment.invoiceId,
        );
        if (invoice.status === "initiated" || invoice.status === "pending") {
          logger.info(
            `♻️ Reusing existing pending order: ${existingOrder._id}`,
          );
          return ApiResponse.success(
            res,
            {
              orders: existingPendingOrders.map((o) => ({
                _id: o._id,
                artist: o.artist,
                totalAmount: o.financials.totalAmount,
                items: o.items.length,
                shipping: {
                  deliveryCompanyName: o.shipping?.deliveryCompanyName,
                  deliveryOptionName: o.shipping?.deliveryOptionName,
                  avgDeliveryTime: o.shipping?.avgDeliveryTime,
                  logo: o.shipping?.logo,
                },
              })),
              paymentUrl: invoice.url,
              invoiceId: invoice.id,
              grandTotal: existingPendingOrders.reduce(
                (sum, o) => sum + o.financials.totalAmount,
                0,
              ),
            },
            "Existing pending order found",
          );
        }
      } catch (err) {
        logger.warn("Existing invoice invalid or expired, creating new orders");
      }
    }

    for (const order of existingPendingOrders) {
      if (order.payment?.invoiceId) {
        try {
          await MoyasarService.cancelInvoice(order.payment.invoiceId);
        } catch (err) {
          logger.warn(
            `Failed to cancel invoice ${order.payment.invoiceId}: ${err.message}`,
          );
        }
      }

      await Artwork.updateMany(
        {
          _id: { $in: order.items.map((i) => i.artwork) },
          reservedBy: order.buyer,
        },
        { $set: { reservedBy: null, reservedUntil: null } },
      );

      if (order.financials?.platformShippingExpense > 0 && order.artist) {
        const reversed = await User.updateOne(
          { _id: order.artist, freeShippingUsed: { $gt: 0 } },
          { $inc: { freeShippingUsed: -1 } },
        );
        if (reversed.modifiedCount > 0) {
          logger.info(
            `🔄 Quota reversed in checkout cleanup for order ${order._id}`,
          );

          // ✅ حدّث الـ in-memory artist object في الـ cart
          const artistIdStr = order.artist.toString();
          for (const item of cart.items) {
            if (item.artist?._id?.toString() === artistIdStr) {
              const currentUsed = item.artist.freeShippingUsed || 0;
              item.artist.freeShippingUsed = Math.max(0, currentUsed - 1);
              logger.info(
                `🔄 In-memory quota updated: ${artistIdStr} → ${item.artist.freeShippingUsed}`,
              );
            }
          }
        }
      }
    }

    await Order.updateMany(
      { _id: { $in: existingPendingOrders.map((o) => o._id) } },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "superseded_by_new_checkout",
        },
      },
    );
    logger.info(
      `🗑️ Cancelled ${existingPendingOrders.length} superseded pending orders`,
    );
  }

  // ═══════════════════════════════════════════════════
  // 3. Pre-validation: fail fast before any expensive work
  // ═══════════════════════════════════════════════════
  // ✅ NEW: Defense in depth — single-artist validation
  // (حتى لو حد تحايل على الـ cart validation، هنرفض هنا قبل الـ expensive OTO calls)
  //! for single artist in cart
  const artistIdsInCart = [
    ...new Set(cart.items.map((i) => i.artist._id.toString())),
  ];
  if (artistIdsInCart.length > 1) {
    throw new BadRequestError(
      "السلة تحتوي على أعمال من أكثر من فنان. يرجى إتمام الشراء لكل فنان على حدة.",
    );
  }
  //!

  for (const item of cart.items) {
    const artwork = item.artwork;
    const artist = item.artist;

    if (!artwork || !artwork.isActive || artwork.isSold) {
      throw new BadRequestError(
        `Artwork "${artwork?.title}" is no longer available`,
      );
    }
    if (!artist || !artist.hasActiveSubscription()) {
      throw new BadRequestError(
        `Artist "${artist?.name}" does not have an active subscription`,
      );
    }
    if (artist.isBanned) {
      throw new BadRequestError(
        `أحد الأعمال في سلتك لفنان محظور ولم يعد متاحاً للشراء`,
      );
    }
  }

  // ✅ NEW: Reservation check BEFORE OTO (fail fast if artwork is reserved)
  for (const item of cart.items) {
    const artwork = item.artwork;
    const isAvailable =
      artwork.isActive &&
      !artwork.isSold &&
      (!artwork.reservedBy ||
        artwork.reservedBy.toString() === buyer._id.toString() ||
        artwork.reservedUntil < new Date());

    if (!isAvailable) {
      throw new BadRequestError(
        `للأسف، لوحة ${artwork.title} محجوزة لمشترٍ آخر. يرجى المحاولة بعد دقائق أو اختيار لوحة أخرى.`,
      );
    }
  }

  // ═══════════════════════════════════════════════════
  // 4. Parallel quota + shipping lookups (performance win)
  // ═══════════════════════════════════════════════════
  const uniqueArtistIds = [
    ...new Set(cart.items.map((i) => i.artist._id.toString())),
  ];

  const artistsMap = new Map(
    cart.items.map((i) => [i.artist._id.toString(), i.artist]),
  );

  const quotaResults = await Promise.all(
    uniqueArtistIds.map(async (id) => ({
      artistId: id,
      hasQuota: checkFreeShippingQuota(artistsMap.get(id)),
    })),
  );
  const quotaCache = new Map(quotaResults.map((r) => [r.artistId, r.hasQuota]));

  // const otoStart = Date.now();
  // const shippingResults = await Promise.all(
  //   cart.items.map(async (item) => {
  //     const artwork = item.artwork;
  //     const artist = item.artist;
  //     const itemStart = Date.now();

  //     try {
  //       const originCity = artist.address?.city || "Riyadh";
  //       const destinationCity = buyer.address?.city || "Riyadh";

  //       const otoResponse = await otoService.checkOTODeliveryFee({
  //         originCity,
  //         destinationCity,
  //         weight: artwork.weight || 2,
  //         length: artwork.dimensions?.width || 60,
  //         width: artwork.dimensions?.height || 80,
  //         height: artwork.dimensions?.depth || 3,
  //         shippingType: artwork.shippingType || "standard",
  //       });

  //       const allOptions = otoResponse.deliveryCompany || [];
  //       const validOptions = filterShippingOptions(allOptions, artwork.price);
  //       let selectedOption = selectCheapestOption(validOptions);
  //       let shippingCost = selectedOption?.price;

  //       if (!selectedOption) {
  //         const fallbackOption = selectCheapestOption(allOptions);
  //         if (fallbackOption) {
  //           selectedOption = fallbackOption;
  //           shippingCost = fallbackOption.price;
  //         } else {
  //           shippingCost = 25;
  //         }
  //       }

  //       logger.info(
  //         `⏱️ OTO call for ${artwork.title} took ${Date.now() - itemStart}ms`,
  //       );
  //       return {
  //         artworkId: artwork._id.toString(),
  //         selectedOption,
  //         shippingCost,
  //       };
  //     } catch (error) {
  //       logger.error(`❌ OTO error for ${artwork.title}: ${error.message}`);
  //       return {
  //         artworkId: artwork._id.toString(),
  //         error: true,
  //         message: "تعذّر حساب تكلفة الشحن. يرجى المحاولة مرة أخرى.",
  //       };
  //     }
  //   }),
  // );

  const otoStart = Date.now();

  // ✅ اجمع كل اللوحات في شحنة واحدة
  const totalDimensions = cart.items.reduce(
    (acc, item) => {
      const dims = item.artwork.dimensions || {};
      return {
        width: Math.max(acc.width, dims.width || 60),
        length: Math.max(acc.length, dims.height || 80),
        height: acc.height + (dims.depth || 3),
        weight: acc.weight + (item.artwork.weight || 2),
      };
    },
    { width: 0, length: 0, height: 0, weight: 0 },
  );

  // ✅ NEW: أضف padding للصندوق (bubble wrap + cardboard)
  const packageDims = {
    width: Math.ceil(totalDimensions.width + 5), // +5 سم padding
    length: Math.ceil(totalDimensions.length + 5), // +5 سم padding
    height: Math.ceil(totalDimensions.height + 2), // +2 سم padding عمودي
    weight: Math.round(totalDimensions.weight * 10) / 10, // round to 1 decimal
  };

  logger.info(
    `📦 Combined package: ${packageDims.length}×${packageDims.width}×${packageDims.height} cm, ${packageDims.weight} kg ` +
      `(artworks: ${totalDimensions.length}×${totalDimensions.width}×${totalDimensions.height} cm, ${totalDimensions.weight} kg)`,
  );

  // ✅ OTO call واحدة للصندوق الكلي
  const artist = cart.items[0].artist;
  const originCity = artist.address?.city || "Riyadh";
  const destinationCity = buyer.address?.city || "Riyadh";

  let shippingCost = 0;
  let selectedOption = null;

  try {
    const otoResponse = await otoService.checkOTODeliveryFee({
      originCity,
      destinationCity,
      weight: packageDims.weight,
      length: packageDims.length,
      width: packageDims.width,
      height: packageDims.height,
      shippingType: cart.items[0].artwork.shippingType || "standard",
    });

    const allOptions = otoResponse.deliveryCompany || [];

    // استخدم سعر أعلى لوحة للـ filter (عشان نتأكد إن كل اللوحات مشمولة)
    const maxArtworkPrice = Math.max(...cart.items.map((i) => i.artwork.price));
    const validOptions = filterShippingOptions(allOptions, maxArtworkPrice);
    selectedOption = selectCheapestOption(validOptions);
    shippingCost = selectedOption?.price;

    if (!selectedOption) {
      const fallbackOption = selectCheapestOption(allOptions);
      if (fallbackOption) {
        selectedOption = fallbackOption;
        shippingCost = fallbackOption.price;
      }
    }

    if (!selectedOption) {
      throw new BadRequestError("لا تتوفر خيارات شحن لهذه اللوحات حالياً");
    }

    logger.info(
      `⏱️ OTO call for combined package took ${Date.now() - otoStart}ms, cost: ${shippingCost} SAR`,
    );
  } catch (error) {
    logger.error(`❌ OTO error: ${error.message}`);
    throw new BadRequestError(
      "تعذّر حساب تكلفة الشحن. يرجى المحاولة مرة أخرى.",
    );
  }

  logger.info(`⏱️ OTO call took ${Date.now() - otoStart}ms`);

  // ═══════════════════════════════════════════════════
  // 5. Group by artist + build order data
  // ═══════════════════════════════════════════════════
  const ordersByArtist = new Map();

  // ✅ احسب الـ quota remaining مرة واحدة
  const artistId = cart.items[0].artist._id.toString();
  const quotaRemaining = checkFreeShippingQuota(cart.items[0].artist);

  // ✅ لو في quota remaining + كل اللوحات standard → شحن مجاني (شحنة واحدة بس)
  const allStandard = cart.items.every(
    (i) => i.artwork.shippingType === "standard",
  );
  const isFreeShipping =
    cart.items[0].artist.subscription.plan === "opal_prestige" &&
    allStandard &&
    quotaRemaining > 0;

  const platformShippingExpense = isFreeShipping ? shippingCost : 0;
  const buyerPaysShipping = platformShippingExpense === 0 ? shippingCost : 0;

  logger.info(
    `🎨 Free shipping check: quotaRemaining=${quotaRemaining}, allStandard=${allStandard}, isFreeShipping=${isFreeShipping}, shippingCost=${shippingCost}`,
  );
  logger.info(
    `💰 Shipping decision: platformShippingExpense=${platformShippingExpense}, buyerPaysShipping=${buyerPaysShipping}`,
  );

  // ✅ بناء الـ order (شحنة واحدة لكل الفنانين)
  for (const item of cart.items) {
    const artwork = item.artwork;
    const artist = item.artist;
    const commissionRate = artist.getCommissionRate();
    const artistPlan = artist.subscription.plan;
    const artworkPrice = artwork.price;
    const platformCommission =
      Math.round(artworkPrice * commissionRate * 100) / 100;
    const artistEarning = artworkPrice - platformCommission;

    if (!ordersByArtist.has(artist._id.toString())) {
      ordersByArtist.set(artist._id.toString(), {
        buyer: buyer._id,
        artist: artist._id,
        items: [],
        financials: {
          subtotal: 0,
          shippingCost: 0,
          totalCommission: 0,
          totalArtistEarning: 0,
          totalAmount: 0,
          currency: "SAR",
          platformShippingExpense: 0,
        },
        shipping: {
          deliveryOptionId: selectedOption?.deliveryOptionId || null,
          deliveryCompanyName: selectedOption?.deliveryCompanyName || null,
          deliveryOptionName: selectedOption?.deliveryOptionName || null,
          avgDeliveryTime: selectedOption?.avgDeliveryTime || null,
          pickupCutOffTime: selectedOption?.pickupCutOffTime || null,
          maxFreeWeight: selectedOption?.maxFreeWeight || null,
          extraWeightPerKg: selectedOption?.extraWeightPerKg || null,
          returnFee: selectedOption?.returnFee || null,
          pickupDropoff: selectedOption?.pickupDropoff || null,
          deliveryType: selectedOption?.deliveryType || null,
          serviceType: selectedOption?.serviceType || null,
          logo: selectedOption?.logo || null,
          buyerAddress: {
            name: buyer.name,
            phone: buyer.phone,
            street: buyer.address?.street || "",
            city: buyer.address?.city || "",
            district: buyer.address?.district || "",
            zipCode: buyer.address?.zipCode || "",
            country: buyer.address?.country || "SA",
            buildingNo: buyer.address?.buildingNo || "",
            shortAddressCode: buyer.address?.shortAddressCode || "",
            lat: buyer.address?.lat || "",
            lon: buyer.address?.lon || "",
          },
          artistAddress: {
            name: artist.name,
            phone: artist.phone,
            street: artist.address?.street || "",
            city: artist.address?.city || "",
            district: artist.address?.district || "",
            zipCode: artist.address?.zipCode || "",
            country: artist.address?.country || "SA",
            buildingNo: artist.address?.buildingNo || "",
            shortAddressCode: artist.address?.shortAddressCode || "",
            lat: artist.address?.lat || "",
            lon: artist.address?.lon || "",
          },
        },
      });
    }

    const orderData = ordersByArtist.get(artist._id.toString());
    orderData.items.push({
      artwork: artwork._id,
      artworkSnapshot: {
        title: artwork.title,
        coverImage: artwork.coverImage,
        price: artworkPrice,
        dimensions: artwork.dimensions,
        shippingType: artwork.shippingType,
      },
      financials: {
        artworkPrice,
        commissionRate,
        platformCommission,
        artistEarning,
      },
    });

    orderData.financials.subtotal += artworkPrice;
    orderData.financials.totalCommission += platformCommission;
    orderData.financials.totalArtistEarning += artistEarning;
  }

  // ✅ أضف الشحن مرة واحدة بس (مش لكل لوحة)
  for (const orderData of ordersByArtist.values()) {
    orderData.financials.shippingCost += buyerPaysShipping;
    orderData.financials.platformShippingExpense += platformShippingExpense;
    orderData.financials.totalAmount =
      orderData.financials.subtotal + orderData.financials.shippingCost;
  }

  // for (const item of cart.items) {
  //   const artwork = item.artwork;
  //   const artist = item.artist;
  //   const shipping = shippingMap.get(artwork._id.toString());
  //   let selectedOption = shipping.selectedOption;
  //   let shippingCost = shipping.shippingCost;

  //   // 🧪 TESTING ONLY — hardcoded SMSA Same Day (remove in production)
  //   // selectedOption = {
  //   //   deliveryOptionId: 56469,
  //   //   deliveryCompanyName: "secom",
  //   //   deliveryOptionName: "SMSA Same Day",
  //   //   price: 25,
  //   //   avgDeliveryTime: "1to4WorkingDays",
  //   //   pickupDropoff: "freePickupDropoff",
  //   //   deliveryType: "toCustomerDoorstep",
  //   //   serviceType: "sameDay",
  //   //   maxOrderValue: 5000,
  //   //   logo: "https://storage.googleapis.com/tryoto-public/delivery-logo/smsav2.png",
  //   // };
  //   // shippingCost = 25;

  //   const commissionRate = artist.getCommissionRate();
  //   const artistPlan = artist.subscription.plan;
  //   const artworkPrice = artwork.price;
  //   const hasQuotaLeft = quotaCache.get(artist._id.toString());

  //   // ✅ NEW: Logging للـ free shipping conditions
  //   if (artistPlan === "opal_prestige") {
  //     logger.info(
  //       `🎨 Free shipping check for ${artwork.title}: ` +
  //         `plan=${artistPlan}, shippingType=${artwork.shippingType}, ` +
  //         `hasQuotaLeft=${hasQuotaLeft}, shippingCost=${shippingCost}`,
  //     );
  //   }

  //   const platformShippingExpense =
  //     artistPlan === "opal_prestige" &&
  //     artwork.shippingType === "standard" &&
  //     hasQuotaLeft
  //       ? shippingCost
  //       : 0;

  //   const buyerPaysShipping = platformShippingExpense === 0 ? shippingCost : 0;
  //   const platformCommission =
  //     Math.round(artworkPrice * commissionRate * 100) / 100;
  //   const artistEarning = artworkPrice - platformCommission;

  //   // ✅ NEW: Logging للـ final shipping decision
  //   if (artistPlan === "opal_prestige") {
  //     logger.info(
  //       `💰 Shipping decision for ${artwork.title}: ` +
  //         `platformShippingExpense=${platformShippingExpense}, ` +
  //         `buyerPaysShipping=${buyerPaysShipping}, ` +
  //         `isFreeShipping=${platformShippingExpense > 0}`,
  //     );
  //   }

  //   if (!ordersByArtist.has(artist._id.toString())) {
  //     ordersByArtist.set(artist._id.toString(), {
  //       buyer: buyer._id,
  //       artist: artist._id,
  //       items: [],
  //       financials: {
  //         subtotal: 0,
  //         shippingCost: 0,
  //         totalCommission: 0,
  //         totalArtistEarning: 0,
  //         totalAmount: 0,
  //         currency: "SAR",
  //         platformShippingExpense: 0,
  //       },
  //       shipping: {
  //         deliveryOptionId: selectedOption?.deliveryOptionId || null,
  //         deliveryCompanyName: selectedOption?.deliveryCompanyName || null,
  //         deliveryOptionName: selectedOption?.deliveryOptionName || null,
  //         avgDeliveryTime: selectedOption?.avgDeliveryTime || null,
  //         pickupCutOffTime: selectedOption?.pickupCutOffTime || null,
  //         maxFreeWeight: selectedOption?.maxFreeWeight || null,
  //         extraWeightPerKg: selectedOption?.extraWeightPerKg || null,
  //         returnFee: selectedOption?.returnFee || null,
  //         pickupDropoff: selectedOption?.pickupDropoff || null,
  //         deliveryType: selectedOption?.deliveryType || null,
  //         serviceType: selectedOption?.serviceType || null,
  //         logo: selectedOption?.logo || null,
  //         buyerAddress: {
  //           name: buyer.name,
  //           phone: buyer.phone,
  //           street: buyer.address?.street || "",
  //           city: buyer.address?.city || "",
  //           district: buyer.address?.district || "",
  //           zipCode: buyer.address?.zipCode || "",
  //           country: buyer.address?.country || "SA",
  //           buildingNo: buyer.address?.buildingNo || "",
  //           shortAddressCode: buyer.address?.shortAddressCode || "",
  //           lat: buyer.address?.lat || "",
  //           lon: buyer.address?.lon || "",
  //         },
  //         artistAddress: {
  //           name: artist.name,
  //           phone: artist.phone,
  //           street: artist.address?.street || "",
  //           city: artist.address?.city || "",
  //           district: artist.address?.district || "",
  //           zipCode: artist.address?.zipCode || "",
  //           country: artist.address?.country || "SA",
  //           buildingNo: artist.address?.buildingNo || "",
  //           shortAddressCode: artist.address?.shortAddressCode || "",
  //           lat: artist.address?.lat || "",
  //           lon: artist.address?.lon || "",
  //         },
  //       },
  //     });
  //   }

  //   const orderData = ordersByArtist.get(artist._id.toString());
  //   orderData.items.push({
  //     artwork: artwork._id,
  //     artworkSnapshot: {
  //       title: artwork.title,
  //       coverImage: artwork.coverImage,
  //       price: artworkPrice,
  //       dimensions: artwork.dimensions,
  //       shippingType: artwork.shippingType,
  //     },
  //     financials: {
  //       artworkPrice,
  //       commissionRate,
  //       platformCommission,
  //       artistEarning,
  //     },
  //   });

  //   orderData.financials.subtotal += artworkPrice;
  //   orderData.financials.shippingCost += buyerPaysShipping;
  //   orderData.financials.totalCommission += platformCommission;
  //   orderData.financials.totalArtistEarning += artistEarning;
  //   orderData.financials.totalAmount += artworkPrice + buyerPaysShipping;
  //   orderData.financials.platformShippingExpense += platformShippingExpense;
  // }

  // ═══════════════════════════════════════════════════
  // 6. Transactional: quota reservation + hold + orders + invoice
  // ═══════════════════════════════════════════════════

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const INVOICE_DURATION = 10 * 60 * 1000;
    const HOLD_DURATION = 15 * 60 * 1000;

    const artistIds = [...ordersByArtist.keys()].map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    await cleanupExpiredOrdersForArtists(artistIds, session);

    const updatedArtists = await User.find({
      _id: { $in: artistIds },
    })
      .select("_id freeShippingUsed")
      .lean();

    for (const artist of updatedArtists) {
      const artistIdStr = artist._id.toString();
      for (const item of cart.items) {
        if (item.artist?._id?.toString() === artistIdStr) {
          item.artist.freeShippingUsed = artist.freeShippingUsed || 0;
        }
      }
    }

    for (const orderData of ordersByArtist.values()) {
      const artistId = orderData.artist;
      const wantsFreeShipping =
        orderData.financials.platformShippingExpense > 0;

      if (wantsFreeShipping) {
        const quotaLimit =
          User.PLAN_CONFIG?.opal_prestige?.freeShippingQuota ?? 10;
        const updated = await User.findOneAndUpdate(
          {
            _id: artistId,
            "subscription.plan": "opal_prestige",
            freeShippingUsed: { $lt: quotaLimit },
          },
          { $inc: { freeShippingUsed: 1 } },
          { new: true, session },
        );

        if (!updated) {
          logger.warn(
            `⚠️ Free shipping quota exhausted for artist ${artistId}`,
          );
          const platformExpense = orderData.financials.platformShippingExpense;
          orderData.financials.shippingCost += platformExpense;
          orderData.financials.platformShippingExpense = 0;
          orderData.financials.totalAmount =
            orderData.financials.subtotal + orderData.financials.shippingCost;
        } else {
          logger.info(`✅ Free shipping quota reserved for artist ${artistId}`);
        }
      }
    }

    for (const orderData of ordersByArtist.values()) {
      for (const item of orderData.items) {
        const reservedArtwork = await Artwork.findOneAndUpdate(
          {
            _id: item.artwork,
            isActive: true,
            isSold: false,
            $or: [
              { reservedBy: null },
              { reservedUntil: { $lt: new Date() } },
              { reservedBy: buyer._id },
            ],
          },
          {
            reservedBy: buyer._id,
            reservedUntil: new Date(Date.now() + HOLD_DURATION),
          },
          { new: true, session },
        );

        if (!reservedArtwork) {
          throw new BadRequestError(
            `للأسف، لوحة ${item.artworkSnapshot?.title || "فنية"} محجوزة لمشترٍ آخر. يرجى المحاولة بعد دقائق أو اختيار لوحة أخرى.`,
          );
        }

        logger.info(
          `🔒 Artwork reserved: ${item.artworkSnapshot?.title} for buyer ${buyer._id.toString().slice(-6)}`,
        );
      }
    }

    const orders = [];
    for (const orderData of ordersByArtist.values()) {
      const order = await Order.create([orderData], { session });
      orders.push(order[0]);
    }

    const grandTotal = orders.reduce(
      (sum, order) => sum + order.financials.totalAmount,
      0,
    );

    const invoiceData = {
      amount: grandTotal * 100,
      description: `أوبال جاليري - ${orders.length === 1 ? "لوحة واحدة" : `${orders.length} لوحات`} (طلب #${orders[0]._id.toString().slice(-6).toUpperCase()})`,
      successUrl: `${process.env.FRONTEND_URL}/payment/success`,
      backUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
      expired_at: new Date(Date.now() + INVOICE_DURATION).toISOString(),
      metadata: {
        orderIds: orders.map((o) => o._id.toString()).join(","),
        buyerId: buyer._id.toString(),
        type: "artwork_purchase",
      },
    };

    const moyasarStart = Date.now();
    const moyasarInvoice = await MoyasarService.createInvoice(invoiceData);
    logger.info(`⏱️ Moyasar createInvoice took ${Date.now() - moyasarStart}ms`);

    for (const order of orders) {
      order.payment.invoiceId = moyasarInvoice.id;
      order.payment.method = paymentMethod;
      await order.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return ApiResponse.success(
      res,
      {
        orders: orders.map((o) => ({
          _id: o._id,
          artist: o.artist,
          totalAmount: o.financials.totalAmount,
          items: o.items.length,
          shipping: {
            deliveryCompanyName: o.shipping?.deliveryCompanyName,
            deliveryOptionName: o.shipping?.deliveryOptionName,
            avgDeliveryTime: o.shipping?.avgDeliveryTime,
            logo: o.shipping?.logo,
            isFreeShipping: o.financials.platformShippingExpense > 0,
          },
        })),
        paymentUrl: moyasarInvoice.url,
        invoiceId: moyasarInvoice.id,
        grandTotal,
      },
      "Checkout initiated successfully",
    );
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    const isWriteConflict =
      error?.codeName === "WriteConflict" ||
      error?.code === 112 ||
      error?.errorLabels?.includes?.("TransientTransactionError") ||
      error?.hasErrorLabel?.("TransientTransactionError") ||
      /write conflict/i.test(error?.message || "");

    if (isWriteConflict) {
      logger.warn("⚠️ Checkout WriteConflict");
      throw new BadRequestError(
        "حدث تعارض في معالجة طلبك بسبب ضغط عالي على النظام. يرجى المحاولة مرة أخرى بعد ثوانٍ قليلة.",
      );
    }

    logger.error("Checkout error:", error);
    throw error;
  }
});

// @desc    Moyasar webhook handler
// @route   POST /api/v1/webhooks/moyasar
// @access  Public (Moyasar server)
const handleMoyasarWebhook = catchAsync(async (req, res, next) => {
  console.log("📥 Moyasar Webhook received");

  // ═══ Parse the event ═══
  let event;
  try {
    if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString("utf8"));
    } else if (typeof req.body === "string") {
      event = JSON.parse(req.body);
    } else if (typeof req.body === "object" && req.body !== null) {
      event = req.body;
    } else {
      throw new Error("Invalid body type");
    }
    console.log("✅ Parsed event, id:", event.id, "status:", event.status);
  } catch (err) {
    console.error("❌ Parse error:", err.message);
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // ═══════════════════════════════════════════════════
  // Unified Refund Helper (3 retries + tracking)
  // ═══════════════════════════════════════════════════
  async function attemptRefund(paymentId, amount, reason) {
    const MAX_ATTEMPTS = 3;
    const DELAYS = [0, 5000, 10000];
    let refundOk = false;
    let lastError = null;

    if (!paymentId) return { refundOk: false, lastError: "no_payment_id" };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (DELAYS[attempt - 1] > 0) {
        logger.info(
          `⏳ Refund: waiting ${DELAYS[attempt - 1] / 1000}s before retry ${attempt}...`,
        );
        await new Promise((r) => setTimeout(r, DELAYS[attempt - 1]));
      }

      try {
        logger.info(`💰 Refund attempt ${attempt}/${MAX_ATTEMPTS}`);
        await MoyasarService.refundPayment(paymentId, {
          amount: Math.round(amount * 100),
          reason,
        });
        refundOk = true;
        logger.info(`✅ Refund succeeded on attempt ${attempt}`);
        break;
      } catch (err) {
        lastError = err.message;
        logger.error(`❌ Refund attempt ${attempt} failed: ${err.message}`);
      }
    }

    return { refundOk, lastError };
  }

  // ═══════════════════════════════════════════════════
  // Handle "refunded" events (manual refund من Moyasar)
  // ═══════════════════════════════════════════════════
  if (event.status === "refunded") {
    logger.info(
      `💰 Moyasar refund event: id=${event.id}, amount=${event.refunded}`,
    );

    const paymentId = event.id;
    const invoiceId = event.invoice_id;
    const refundedAmount = event.refunded || event.amount;

    // Idempotency
    const alreadyRefunded = await Order.findOne({
      $or: [
        { "payment.paymentId": paymentId },
        { "payment.invoiceId": invoiceId },
      ],
      refundStatus: "REFUNDED",
    });
    if (alreadyRefunded) {
      logger.info(`⚠️ Refund already processed: ${paymentId}`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    const order = await Order.findOne({
      $or: [
        { "payment.paymentId": paymentId },
        { "payment.invoiceId": invoiceId },
      ],
    });

    if (!order) {
      logger.warn(`⚠️ No order found for refunded payment: ${paymentId}`);
      return res.status(200).json({ received: true });
    }

    const previousStatus = order.refundStatus;
    const shouldUpdate = ["FAILED", "PENDING", "NONE"].includes(previousStatus);

    if (shouldUpdate) {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            refundStatus: "REFUNDED",
            refundedAt: new Date(),
            refundedAmount: refundedAmount / 100,
            refundPaymentId: paymentId,
          },
        },
      );

      logger.info(
        `✅ Refund confirmed via webhook for order ${order._id} (${previousStatus} → REFUNDED, ${refundedAmount / 100} SAR)`,
      );

      if (previousStatus === "FAILED") {
        eventEmitter.safeEmit(EVENTS.REFUND_MANUALLY_COMPLETED, {
          orderId: order._id,
          buyerId: order.buyer,
          artistId: order.artist,
          amount: refundedAmount / 100,
          orderNumber: order._id.toString().slice(-6).toUpperCase(),
          paymentId,
        });
      }
    }

    return res.status(200).json({ received: true });
  }

  // ═══════════════════════════════════════════════════
  // ✅ Ignore non-paid events
  // ═══════════════════════════════════════════════════
  if (event.status !== "paid") {
    console.log("⚠️ Ignoring non-paid event, status:", event.status);
    return res.status(200).json({ received: true });
  }

  const metadata = event.metadata || {};
  const paymentId = event.id || event.payments?.[0]?.id || null;

  // ═══ Resolve orderIds (metadata fallback to invoice lookup) ═══
  let orderIds = metadata.orderIds ? metadata.orderIds.split(",") : [];

  if (orderIds.length === 0) {
    const invoiceId = event.invoice_id || event.id;
    console.log(`🔍 Fallback: Looking up orders by invoice ID: ${invoiceId}`);
    const orders = await Order.find({ "payment.invoiceId": invoiceId });
    orderIds = orders.map((o) => o._id.toString());
    if (orderIds.length === 0) {
      console.error("❌ No orders found for invoiceId:", invoiceId);
      return res.status(200).json({ received: true });
    }
  }

  // Idempotency check
  const existingOrders = await Order.find({
    _id: { $in: orderIds },
    status: "PAID",
  });
  if (existingOrders.length === orderIds.length) {
    return res.status(200).json({ received: true });
  }

  // ═══ Ban check ═══
  const pendingOrdersForCheck = await Order.find({
    _id: { $in: orderIds },
    status: "PENDING_PAYMENT",
  })
    .populate("artist", "isBanned name")
    .populate("buyer", "isBanned name");

  // ─── 1. Buyer ban ───
  const bannedBuyer = pendingOrdersForCheck.find((o) => o.buyer?.isBanned);
  if (bannedBuyer) {
    logger.warn(`🚫 Moyasar webhook blocked: buyer is banned`);
    const totalAmount = pendingOrdersForCheck.reduce(
      (sum, o) => sum + o.financials.totalAmount,
      0,
    );

    const { refundOk, lastError } = await attemptRefund(
      paymentId,
      totalAmount,
      "Buyer account banned during checkout",
    );

    for (const o of pendingOrdersForCheck) {
      eventEmitter.safeEmit(EVENTS.ORDER_CANCELLED, {
        buyerId: o.buyer?._id || o.buyer,
        orderId: o._id,
        orderNumber: o._id.toString().slice(-6).toUpperCase(),
        totalAmount: o.financials.totalAmount,
        reason: "buyer_banned_during_checkout",
        refundInitiated: refundOk,
      });
    }

    if (!refundOk && paymentId) {
      logger.error(`🚨 CRITICAL: Buyer ban refund failed after 3 attempts`);
      eventEmitter.safeEmit(EVENTS.REFUND_FAILED, {
        paymentId,
        amount: totalAmount,
        reason: "buyer_banned_during_checkout",
        error: lastError,
        orderIds,
      });
    }

    await Order.updateMany(
      { _id: { $in: orderIds }, status: "PENDING_PAYMENT" },
      {
        $set: {
          status: "CANCELLED",
          cancellationReason: "buyer_banned_during_checkout",
          cancelledAt: new Date(),
          cancelledBy: "system",
          "payment.paymentId": paymentId,
          "payment.paidAt": new Date(),
          refundStatus: refundOk ? "REFUNDED" : "FAILED",
          refundPaymentId: paymentId,
          refundedAmount: refundOk ? totalAmount : null,
          refundedAt: refundOk ? new Date() : null,
        },
      },
    );

    await Artwork.updateMany(
      { reservedBy: { $in: pendingOrdersForCheck.map((o) => o.buyer) } },
      { $set: { reservedBy: null, reservedUntil: null } },
    );

    for (const o of pendingOrdersForCheck) {
      if (o.financials?.platformShippingExpense > 0) {
        await User.updateOne(
          { _id: o.artist, freeShippingUsed: { $gt: 0 } },
          { $inc: { freeShippingUsed: -1 } },
        );
      }
    }

    return res.status(200).json({
      received: true,
      blocked: "banned_buyer",
      refundStatus: refundOk ? "REFUNDED" : "FAILED",
    });
  }

  // ─── 2. Artist ban ───
  const bannedArtists = pendingOrdersForCheck.filter((o) => o.artist?.isBanned);
  if (bannedArtists.length > 0) {
    logger.warn(`🚫 Moyasar webhook blocked: banned artist(s)`);
    const totalAmount = pendingOrdersForCheck.reduce(
      (sum, o) => sum + o.financials.totalAmount,
      0,
    );

    const { refundOk, lastError } = await attemptRefund(
      paymentId,
      totalAmount,
      "Artist account(s) banned during checkout",
    );

    for (const o of pendingOrdersForCheck) {
      eventEmitter.safeEmit(EVENTS.ORDER_CANCELLED, {
        buyerId: o.buyer?._id || o.buyer,
        orderId: o._id,
        orderNumber: o._id.toString().slice(-6).toUpperCase(),
        totalAmount: o.financials.totalAmount,
        reason: "artist_banned_during_checkout",
        refundInitiated: refundOk,
      });
    }

    if (!refundOk && paymentId) {
      logger.error(`🚨 CRITICAL: Artist ban refund failed after 3 attempts`);
      eventEmitter.safeEmit(EVENTS.REFUND_FAILED, {
        paymentId,
        amount: totalAmount,
        reason: "artist_banned_during_checkout",
        error: lastError,
        orderIds,
      });
    }

    await Order.updateMany(
      { _id: { $in: orderIds }, status: "PENDING_PAYMENT" },
      {
        $set: {
          status: "CANCELLED",
          cancellationReason: "artist_banned_during_checkout",
          cancelledAt: new Date(),
          cancelledBy: "system",
          "payment.paymentId": paymentId,
          "payment.paidAt": new Date(),
          refundStatus: refundOk ? "REFUNDED" : "FAILED",
          refundPaymentId: paymentId,
          refundedAmount: refundOk ? totalAmount : null,
          refundedAt: refundOk ? new Date() : null,
        },
      },
    );

    await Artwork.updateMany(
      { reservedBy: { $in: pendingOrdersForCheck.map((o) => o.buyer) } },
      { $set: { reservedBy: null, reservedUntil: null } },
    );

    return res.status(200).json({
      received: true,
      blocked: "banned_artist",
      refundStatus: refundOk ? "REFUNDED" : "FAILED",
    });
  }

  // ═══════════════════════════════════════════════════
  // ✅ Happy path: process paid orders
  // ═══════════════════════════════════════════════════
  const session = await mongoose.startSession();
  session.startTransaction();
  let processedOrders = [];

  try {
    for (const orderId of orderIds) {
      const pendingOrder = await Order.findOne({
        _id: orderId,
        status: "PENDING_PAYMENT",
      }).session(session);

      if (!pendingOrder) {
        const deadOrder = await Order.findById(orderId)
          .select("status payment refundStatus financials")
          .lean();

        if (
          deadOrder &&
          deadOrder.status === "CANCELLED" &&
          !deadOrder.payment?.paidAt &&
          deadOrder.payment?.paymentId &&
          deadOrder.refundStatus !== "REFUNDED" &&
          deadOrder.refundStatus !== "FAILED"
        ) {
          logger.warn(
            `🚨 Paid-after-cancellation detected for order ${orderId}`,
          );
          const { refundOk, lastError } = await attemptRefund(
            deadOrder.payment.paymentId,
            deadOrder.financials.totalAmount,
            "Payment received after order cancellation (late webhook)",
          );
          if (refundOk) {
            await Order.updateOne(
              { _id: orderId },
              {
                $set: {
                  refundStatus: "REFUNDED",
                  refundPaymentId: deadOrder.payment.paymentId,
                  refundedAmount: deadOrder.financials.totalAmount,
                  refundedAt: new Date(),
                  "payment.paidAt": new Date(),
                },
              },
            );
          } else {
            logger.error(`❌ Late refund failed for ${orderId}: ${lastError}`);
            eventEmitter.safeEmit(EVENTS.REFUND_FAILED, {
              paymentId: deadOrder.payment.paymentId,
              amount: deadOrder.financials.totalAmount,
              reason: "late_webhook_after_cancel",
              error: lastError,
              orderIds: [orderId],
            });
          }
        }
        continue;
      }

      // Atomic sold + hold cleanup
      let allSold = true;
      let soldArtworkTitle = null;

      for (const item of pendingOrder.items) {
        const artwork = await Artwork.findOneAndUpdate(
          {
            _id: item.artwork,
            isSold: false,
            isActive: true,
            $or: [
              { reservedBy: pendingOrder.buyer },
              { reservedBy: null },
              { reservedUntil: { $lt: new Date() } },
            ],
          },
          {
            isSold: true,
            reservedBy: null,
            reservedUntil: null,
            isFeatured: false,
            featuredAt: null,
          },
          { new: true, session },
        );

        if (!artwork) {
          allSold = false;
          soldArtworkTitle = item.artworkSnapshot?.title || "Unknown";
          break;
        }

        await Cart.updateMany(
          { "items.artwork": item.artwork },
          { $pull: { items: { artwork: item.artwork } } },
          { session },
        );
      }

      if (!allSold) {
        // ═══ artwork sold to another buyer — with retry! ═══
        console.log(
          `⚠️ Order ${orderId}: artwork "${soldArtworkTitle}" already sold`,
        );

        const { refundOk, lastError } = await attemptRefund(
          paymentId,
          pendingOrder.financials.totalAmount,
          `Artwork "${soldArtworkTitle}" sold to another buyer`,
        );

        await Order.findOneAndUpdate(
          { _id: orderId, status: "PENDING_PAYMENT" },
          {
            $set: {
              status: "CANCELLED",
              cancellationReason: `auto_cancelled: artwork "${soldArtworkTitle}" sold to another buyer`,
              cancelledAt: new Date(),
              cancelledBy: "system",
              "payment.paymentId": paymentId,
              "payment.paidAt": new Date(),
              refundStatus: refundOk ? "REFUNDED" : "FAILED",
              refundPaymentId: paymentId,
              refundedAmount: refundOk
                ? pendingOrder.financials.totalAmount
                : null,
              refundedAt: refundOk ? new Date() : null,
            },
          },
          { session },
        );

        eventEmitter.safeEmit(EVENTS.ORDER_CANCELLED, {
          buyerId: pendingOrder.buyer,
          orderId: pendingOrder._id,
          orderNumber: pendingOrder._id.toString().slice(-6).toUpperCase(),
          totalAmount: pendingOrder.financials.totalAmount,
          reason: "artwork_sold_to_another_buyer",
          refundInitiated: refundOk,
        });

        if (!refundOk && paymentId) {
          logger.error(`🚨 CRITICAL: Artwork-sold refund failed`);
          eventEmitter.safeEmit(EVENTS.REFUND_FAILED, {
            paymentId,
            amount: pendingOrder.financials.totalAmount,
            reason: "artwork_sold_to_another_buyer",
            error: lastError,
            orderIds: [orderId],
          });
        }

        continue;
      }

      const order = await Order.findOneAndUpdate(
        { _id: orderId, status: "PENDING_PAYMENT" },
        {
          $set: {
            status: "PAID",
            "payment.paymentId": paymentId,
            "payment.paidAt": new Date(),
          },
        },
        { new: true, session, runValidators: false },
      );

      if (!order) continue;

      processedOrders.push(order);

      let wallet = await Wallet.findOne({ user: order.artist }).session(
        session,
      );
      if (!wallet) {
        wallet = await Wallet.create([{ user: order.artist }], { session });
        wallet = wallet[0];
      }

      await wallet.creditPending(order.financials.totalArtistEarning, session);

      await Transaction.create(
        [
          {
            wallet: wallet._id,
            order: order._id,
            user: order.artist,
            type: "CREDIT_SALE",
            amount: order.financials.totalArtistEarning,
            description: `بيع ${order.items.length === 1 ? "لوحة واحدة" : `${order.items.length} لوحات`} - طلب #${order._id.toString().slice(-6).toUpperCase()}`,
            balanceAfter: {
              available: wallet.balance.available,
              pending: wallet.balance.pending,
            },
            status: "COMPLETED",
          },
        ],
        { session },
      );
    }

    // Clear cart
    const buyerId =
      metadata.buyerId ||
      (await Order.findById(orderIds[0]).select("buyer").lean())?.buyer;
    if (buyerId) {
      await Cart.findOneAndUpdate(
        { user: buyerId },
        { $set: { items: [] } },
        { session },
      );
    }

    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    console.error("❌ Webhook processing error:", error);

    const isTransient =
      error?.codeName === "WriteConflict" ||
      error?.code === 112 ||
      error?.errorLabels?.includes?.("TransientTransactionError") ||
      error?.hasErrorLabel?.("TransientTransactionError");

    if (isTransient) {
      return res
        .status(500)
        .json({ received: false, retry: true, error: error.message });
    }
    return res.status(200).json({ received: true, error: error.message });
  }

  session.endSession();

  // ═══ Async events ═══
  try {
    for (const order of processedOrders) {
      eventEmitter.safeEmit(EVENTS.ORDER_PAID, {
        artistId: order.artist,
        buyerId: order.buyer,
        orderId: order._id,
        orderNumber: order._id.toString().slice(-6).toUpperCase(),
        totalAmount: order.financials.totalAmount,
        order,
      });
    }
  } catch (eventError) {
    logger.error("❌ Event emission error:", eventError);
  }

  return res.status(200).json({ received: true });
});

// @desc    Artist processes order (PAID → PROCESSING)
// @route   PUT /api/v1/orders/:orderId/process
// @access  Private (Artist only)
const processOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError(M.orders.notFound);

  if (order.artist.toString() !== req.user._id.toString()) {
    throw new UnauthorizedError(M.orders.notAuthorizedToProcess);
  }

  if (order.status !== "PAID") {
    throw new BadRequestError(
      `Cannot process order with status: ${order.status}`,
    );
  }

  order.status = "PROCESSING";
  await order.save();

  return ApiResponse.success(res, order, M.orders.markedProcessing);
});

// @desc    Update order status manually (Admin Override / Fallback)
// @route   PUT /api/v1/orders/:orderId/status
// @access  Private (Admin only)
const updateOrderStatus = catchAsync(async (req, res, next) => {
  if (req.user.role !== "admin") {
    throw new UnauthorizedError(
      "هذه العملية متاحة لفريق المنصة فقط. تحديث الحالة يتم تلقائياً عبر شركة الشحن.",
    );
  }

  const { status, carrier } = req.body;
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError(M.orders.notFound);

  // ═══ Validation: حالات مسموح يدوياً ═══
  const allowedStatuses = ["SHIPPED", "DELIVERED", "CANCELLED"];
  if (!allowedStatuses.includes(status)) {
    throw new BadRequestError(
      `حالة غير مسموحة. المسموح يدوياً: ${allowedStatuses.join(", ")}`,
    );
  }

  // ═══ Validation: تدفق منطقي ═══
  const flow = {
    SHIPPED: ["PAID", "PROCESSING"],
    DELIVERED: ["SHIPPED"],
    CANCELLED: ["PENDING_PAYMENT", "PAID", "PROCESSING"],
  };
  if (!flow[status].includes(order.status)) {
    throw new BadRequestError(
      `لا يمكن تحويل من ${order.status} إلى ${status}. التدفق المنطقي: ${flow[status].join(" ← ")} → ${status}`,
    );
  }

  const previousStatus = order.status;
  order.status = status;

  if (status === "SHIPPED") {
    if (carrier) order.shipping.deliveryCompanyName = carrier;
    if (!order.shipping.shippedAt) order.shipping.shippedAt = new Date();
  } else if (status === "DELIVERED") {
    if (!order.shipping.deliveredAt) order.shipping.deliveredAt = new Date();
  }

  // Audit trail — مهم جداً للـ admin override
  order.adminOverrideBy = req.user._id;
  order.adminOverrideAt = new Date();
  order.adminOverrideReason =
    req.body.reason || `Manual status update: ${previousStatus} → ${status}`;

  await order.save();

  // ═══ Emit events (زي الـ webhook بالظبط) ═══
  if (status === "SHIPPED" && previousStatus !== "SHIPPED") {
    eventEmitter.safeEmit(EVENTS.ORDER_SHIPPED, {
      buyerId: order.buyer,
      orderId: order._id,
      orderNumber: order._id.toString().slice(-6).toUpperCase(),
      carrier: carrier || order.shipping?.deliveryCompanyName || "شركة الشحن",
    });
  } else if (status === "DELIVERED" && previousStatus !== "DELIVERED") {
    eventEmitter.safeEmit(EVENTS.ORDER_DELIVERED, {
      buyerId: order.buyer,
      orderId: order._id,
      orderNumber: order._id.toString().slice(-6).toUpperCase(),
    });
  }

  logger.info(
    `🛡️ Admin ${req.user._id} manually updated order ${order._id}: ${previousStatus} → ${status}`,
  );

  return ApiResponse.success(
    res,
    order,
    `✅ تم تحديث حالة الطلب يدوياً إلى ${status}`,
  );
});

// @desc    Buyer confirms delivery (SHIPPED → COMPLETED)
// @route   PUT /api/v1/orders/:orderId/confirm-delivery
// @access  Private (Buyer only)
const confirmDelivery = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError(M.orders.notFound);

  // ✅ بس المشتري يقدر
  if (order.buyer.toString() !== req.user._id.toString()) {
    throw new UnauthorizedError(M.orders.confirmOwnOrdersOnly);
  }

  // ✅ لازم يكون DELIVERED
  if (order.status !== "DELIVERED") {
    throw new BadRequestError(
      `Cannot confirm delivery for order with status: ${order.status}`,
    );
  }

  // ✅ لازم يكون لسه مش confirmed
  if (order.status === "COMPLETED") {
    throw new BadRequestError(M.orders.alreadyCompleted);
  }

  if (order.onHold) {
    throw new BadRequestError(
      "هذا الطلب قيد مراجعة الدعم حالياً ولا يمكن تأكيد الاستلام. يرجى التواصل مع خدمة العملاء.",
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. حدّث الأوردر
    order.status = "COMPLETED";
    order.completedAt = new Date();
    order.fundsReleased = true;
    await order.save({ session });

    // 2. إطلاق الفلوس من pending لـ available
    const wallet = await Wallet.findOne({ user: order.artist }).session(
      session,
    );
    if (
      wallet &&
      wallet.balance.pending >= order.financials.totalArtistEarning
    ) {
      await wallet.releaseToAvailable(
        order.financials.totalArtistEarning,
        session,
      );

      await Transaction.create(
        [
          {
            wallet: wallet._id,
            order: order._id,
            user: order.artist,
            type: "CREDIT_RELEASE",
            amount: order.financials.totalArtistEarning,
            description: `إطلاق أموال الطلب #${order._id.toString().slice(-6).toUpperCase()} بعد تأكيد الاستلام`,
            balanceAfter: {
              available: wallet.balance.available,
              pending: wallet.balance.pending,
            },
            status: "COMPLETED",
          },
        ],
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    logger.info(`✅ Order ${order._id} confirmed by buyer - funds released`);

    return ApiResponse.success(
      res,
      { orderId: order._id, status: "COMPLETED" },
      "تم تأكيد الاستلام بنجاح. سيتم تحويل الأموال للفنان خلال دقائق.",
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`❌ Confirm delivery error:`, error);
    throw error;
  }
});

// @desc    Get current user's orders
// @route   GET /api/v1/orders/my-orders
// @access  Private
const getMyOrders = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  const excludeAutoCancelled = {
    $nor: [
      { status: "PENDING_PAYMENT" },
      { status: "CANCELLED", "payment.paidAt": null },
    ],
  };

  const matchQuery = { buyer: userId, ...excludeAutoCancelled };

  if (req.query.includeArchived !== "true") {
    matchQuery.status = { $ne: "PENDING_PAYMENT" };
  }

  if (status && status !== "all") {
    matchQuery.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  // ✅ Aggregation بدل populate
  const pipeline = [
    { $match: matchQuery },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },

    // Lookup للـ artist (واحد لكل order)
    {
      $lookup: {
        from: "users",
        localField: "artist",
        foreignField: "_id",
        as: "artist",
      },
    },
    { $unwind: { path: "$artist", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "artworks",
        localField: "items.artwork",
        foreignField: "_id",
        as: "artworksData",
      },
    },
    {
      $project: {
        status: 1,
        createdAt: 1,
        financials: 1,
        shipping: 1,
        payment: 1,
        cancellationReason: 1,
        adminOverrideReason: 1,
        refundStatus: 1,
        refundedAmount: 1,
        refundedAt: 1,
        cancelledAt: 1,
        fundsReleased: 1,
        onHold: 1,
        "artist.name": 1,
        "artist.avatar": 1,
        items: 1,
        artworksData: 1,
      },
    },
  ];

  const [orders, total] = await Promise.all([
    Order.aggregate(pipeline),
    Order.countDocuments(matchQuery),
  ]);

  // ✅ Mapping سريع (بدون toObject)
  const finalOrders = orders.map((order) => {
    const artworksMap = new Map(
      order.artworksData.map((a) => [a._id.toString(), a]),
    );

    return {
      ...order,
      items: order.items.map((item) => {
        const artwork = artworksMap.get(item.artwork.toString());
        return {
          ...item,
          artwork: artwork
            ? {
                _id: artwork._id,
                title: artwork.title,
                coverImage: artwork.images?.[0]?.url || artwork.coverImage,
                images: artwork.images,
                price: artwork.price,
              }
            : null,
        };
      }),
      artworksData: undefined, // شيلها من الـ response
    };
  });

  return ApiResponse.success(
    res,
    {
      orders: finalOrders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    },
    "Orders retrieved",
  );
});

// @desc    Get single order details (buyer or artist or admin)
// @route   GET /api/v1/orders/:id
// @access  Private
const getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate("buyer", "name email phone address")
    .populate("artist", "name email phone avatar address")
    .populate(
      "items.artwork",
      "title coverImage images price dimensions medium category",
    );

  if (!order) {
    throw new NotFoundError(M.orders.notFound);
  }

  // Check access
  const userId = req.user._id.toString();
  const userRole = req.user.role;

  if (
    userRole !== "admin" &&
    order.buyer._id.toString() !== userId &&
    order.artist._id.toString() !== userId
  ) {
    throw new UnauthorizedError(M.orders.notAuthorizedToView);
  }

  // Add coverImage to items
  const orderObj = order.toObject();
  orderObj.items = orderObj.items.map((item) => ({
    ...item,
    artwork: item.artwork
      ? {
          ...item.artwork,
          coverImage: item.artwork.images?.[0]?.url || item.artwork.coverImage,
        }
      : null,
  }));

  return ApiResponse.success(res, orderObj, M.orders.retrieved);
});

// @desc    Get order by Moyasar payment/invoice ID
// @route   GET /api/v1/orders/by-payment/:paymentId
// @access  Private
const getOrderByPaymentId = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;

  const orders = await Order.find({
    buyer: req.user._id,
    $or: [
      { "payment.paymentId": paymentId },
      { "payment.invoiceId": paymentId },
    ],
  })
    .populate("artist", "name")
    .lean();

  if (!orders.length) {
    return res.status(200).json({ success: true, data: null });
  }

  const paid = orders.filter((o) => ["PAID", "COMPLETED"].includes(o.status));
  const cancelled = orders.filter((o) => o.status === "CANCELLED");

  // احسب الـ outcome من حالة كل الـ orders
  let outcome = "pending";
  if (paid.length && cancelled.length) outcome = "partial";
  else if (paid.length) outcome = "paid";
  else if (cancelled.length) outcome = "cancelled";

  return res.status(200).json({
    success: true,
    data: {
      order: orders[0],
      orders,
      outcome,
    },
  });
});

const getCheckoutInvoiceStatus = catchAsync(async (req, res) => {
  const { invoiceId } = req.params;
  const orders = await Order.find({
    buyer: req.user._id,
    "payment.invoiceId": invoiceId,
  }).select("status");

  if (!orders.length) {
    throw new NotFoundError(M.orders.notFound);
  }

  const invoice = await MoyasarService.fetchInvoice(invoiceId);

  return ApiResponse.success(
    res,
    {
      status: String(invoice.status || "").toLowerCase(),
      orders: orders.map((order) => ({ status: order.status })),
    },
    "Checkout invoice status retrieved",
  );
});

// @desc    Get artist's sales (orders where he's the seller)
// @route   GET /api/v1/orders/my-sales
// @access  Private (Artist)
const getMySales = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  // ✅ استبعاد: الطلبات اللي لسه ما اتدفعتش + الملغية اللي ملهاش دفع
  const excludeAutoCancelled = {
    $nor: [
      { status: "PENDING_PAYMENT" },
      { status: "CANCELLED", "payment.paidAt": null },
    ],
  };

  const matchQuery = { artist: userId, ...excludeAutoCancelled };

  if (req.query.includeArchived !== "true") {
    matchQuery.status = { $ne: "PENDING_PAYMENT" };
  }
  if (status && status !== "all") matchQuery.status = status;

  const skip = (Number(page) - 1) * Number(limit);

  // ✅ Aggregation
  const pipeline = [
    { $match: matchQuery },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },

    // Lookup للـ buyer
    {
      $lookup: {
        from: "users",
        localField: "buyer",
        foreignField: "_id",
        as: "buyer",
      },
    },
    { $unwind: { path: "$buyer", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        status: 1,
        createdAt: 1,
        cancellationReason: 1,
        cancelledAt: 1,
        cancelledBy: 1,
        refundStatus: 1,
        adminOverrideReason: 1,
        refundedAmount: 1,
        refundedAt: 1,
        payment: 1,
        onHold: 1,
        fundsReleased: 1,
        financials: 1,
        items: 1,
        shipping: 1,
        "buyer.name": 1,
        "buyer.avatar": 1,
      },
    },
  ];

  const [orders, total] = await Promise.all([
    Order.aggregate(pipeline),
    Order.countDocuments(matchQuery),
  ]);

  // ✅ Mapping (بدون toObject)
  const finalOrders = orders.map((order) => ({
    _id: order._id,
    status: order.status,
    createdAt: order.createdAt,
    cancellationReason: order.cancellationReason,
    cancelledAt: order.cancelledAt,
    cancelledBy: order.cancelledBy,
    refundStatus: order.refundStatus,
    adminOverrideReason: order.adminOverrideReason, // ✅ NEW
    refundedAmount: order.refundedAmount, // ✅ NEW
    refundedAt: order.refundedAt, // ✅ NEW
    payment: order.payment // ✅ NEW
      ? { paidAt: order.payment.paidAt, paymentId: order.payment.paymentId }
      : null,
    onHold: order.onHold,
    fundsReleased: order.fundsReleased,
    totalAmount: order.financials.subtotal,
    artistEarning: order.financials.totalArtistEarning,
    buyer: order.buyer,
    items: order.items.map((item) => ({
      title: item.artworkSnapshot?.title,
      coverImage: item.artworkSnapshot?.coverImage,
      price: item.artworkSnapshot?.price,
    })),
    shipping: {
      deliveryCompanyName: order.shipping?.deliveryCompanyName,
      carrier: order.shipping?.carrier,
      trackingNumber: order.shipping?.trackingNumber,
      trackingUrl: order.shipping?.trackingUrl,
      shipmentCreatedAt: order.shipping?.shipmentCreatedAt,
      shippedAt: order.shipping?.shippedAt,
      deliveredAt: order.shipping?.deliveredAt,
      awbUrl: order.shipping?.awbUrl,
    },
  }));

  return ApiResponse.success(
    res,
    {
      orders: finalOrders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    },
    "Sales retrieved",
  );
});

//! without OTO
// @desc    Cancel order (buyer only, BEFORE shipping)
// @route   PATCH /api/v1/orders/:orderId/cancel
// @access  Private (Buyer)
const cancelOrder = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError(M.orders.notFound);

  if (order.buyer.toString() !== req.user._id.toString()) {
    throw new UnauthorizedError(M.orders.cancelOwnOrdersOnly);
  }

  const cancellableStatuses = ["PENDING_PAYMENT", "PAID"];
  if (!cancellableStatuses.includes(order.status)) {
    throw new BadRequestError(M.orders.cancelNotAllowed(order.status));
  }

  const originalStatus = order.status;
  const wasPaid = originalStatus === "PAID";

  // ═══════════════════════════════════════════════════
  // ✅ Cancel Moyasar invoice (لو PENDING_PAYMENT)
  // ═══════════════════════════════════════════════════
  if (!wasPaid && order.payment?.invoiceId) {
    try {
      await MoyasarService.cancelInvoice(order.payment.invoiceId);
      logger.info(`✅ Moyasar invoice cancelled: ${order.payment.invoiceId}`);
    } catch (err) {
      logger.warn(`⚠️ Failed to cancel invoice: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════
  // ✅ Moyasar Refund (لو كان PAID) — مع Retry Logic + Idempotency
  // ═══════════════════════════════════════════════════
  let refundOk = false;
  let refundPaymentId = null;
  let lastError = null;

  if (wasPaid) {
    // Step 1: Resolve paymentId to refund
    let paymentIdToRefund = null;
    let alreadyRefunded = false;

    if (order.payment?.paymentId) {
      try {
        const payment = await MoyasarService.fetchPayment(
          order.payment.paymentId,
        );
        if (payment?.status === "paid" || payment?.status === "captured") {
          paymentIdToRefund = order.payment.paymentId;
          logger.info(`✅ Using stored paymentId: ${paymentIdToRefund}`);
        } else if (payment?.status === "refunded") {
          alreadyRefunded = true;
          logger.info(
            `ℹ️ Payment was already refunded: ${order.payment.paymentId}`,
          );
        } else {
          logger.warn(
            `⚠️ Stored paymentId status is "${payment?.status}" — trying invoice`,
          );
        }
      } catch (e) {
        logger.warn(
          `⚠️ Stored paymentId invalid (${e.message}) — trying invoice`,
        );
      }
    }

    if (!paymentIdToRefund && !alreadyRefunded && order.payment?.invoiceId) {
      try {
        const invoice = await MoyasarService.fetchInvoice(
          order.payment.invoiceId,
        );
        if (
          invoice?.payment?.status === "paid" ||
          invoice?.payment?.status === "captured"
        ) {
          paymentIdToRefund = invoice.payment.id;
          logger.info(`✅ Found paymentId from invoice: ${paymentIdToRefund}`);
        } else if (invoice?.payment?.status === "refunded") {
          alreadyRefunded = true;
          logger.info(`ℹ️ Invoice payment was already refunded`);
        }
      } catch (e) {
        logger.warn(`⚠️ Invoice fallback failed: ${e.message}`);
      }
    }

    // Step 2: لو already refunded → success فوراً
    if (alreadyRefunded) {
      refundOk = true;
      refundPaymentId = order.payment?.paymentId;
      logger.info(`✅ Payment was already refunded — marking as REFUNDED`);
    }
    // Step 3: لو لقينا paymentId → حاول refund مع retry
    else if (paymentIdToRefund) {
      const MAX_ATTEMPTS = 3;
      const DELAYS = [0, 5000, 10000]; // 0, 5s, 10s

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (DELAYS[attempt - 1] > 0) {
          logger.info(
            `⏳ Buyer cancel refund: waiting ${DELAYS[attempt - 1] / 1000}s before retry ${attempt}...`,
          );
          await new Promise((r) => setTimeout(r, DELAYS[attempt - 1]));
        }

        try {
          logger.info(
            `💰 Buyer cancel refund attempt ${attempt}/${MAX_ATTEMPTS} for order ${orderId}`,
          );
          const refundResult = await MoyasarService.refundPayment(
            paymentIdToRefund,
            {
              amount: Math.round(order.financials.totalAmount * 100),
              reason: reason || "Order cancelled by buyer",
            },
          );
          refundOk = true;
          refundPaymentId = refundResult.id || paymentIdToRefund;
          logger.info(
            `✅ Buyer cancel refund succeeded on attempt ${attempt}: ${refundResult.id}`,
          );
          break;
        } catch (refundError) {
          lastError = refundError.message;
          logger.error(
            `❌ Buyer cancel refund attempt ${attempt} failed for order ${orderId}: ${refundError.message}`,
          );
        }
      }

      // Step 4: لو فشل بعد 3 محاولات → alert للأدمن
      if (!refundOk) {
        logger.error(
          `🚨 CRITICAL: Buyer cancel refund failed after ${MAX_ATTEMPTS} attempts. ` +
            `Order ID: ${orderId}, Payment ID: ${paymentIdToRefund}, ` +
            `Amount: ${order.financials.totalAmount} SAR. ` +
            `Manual refund required! Last error: ${lastError}`,
        );

        eventEmitter.safeEmit(EVENTS.REFUND_FAILED, {
          paymentId: paymentIdToRefund,
          amount: order.financials.totalAmount,
          reason: "buyer_cancel_failed",
          error: lastError,
          orderIds: [orderId.toString()],
        });
      }
    } else {
      logger.warn(
        `⚠️ No paid payment found for order ${orderId} — cancelling without Moyasar refund`,
      );
    }
  }

  // ═══════════════════════════════════════════════════
  // ✅ DB Transaction: cancel + unmark + quota reverse + wallet reverse
  // ═══════════════════════════════════════════════════
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Cancel order + set refund status (unified: REFUNDED / FAILED / null)
    order.status = "CANCELLED";
    order.cancelledAt = new Date();
    order.cancellationReason = reason || "Cancelled by buyer";
    order.cancelledBy = "buyer";

    if (wasPaid) {
      order.refundStatus = refundOk ? "REFUNDED" : "FAILED";
      order.refundRequestedAt = new Date();
      if (refundPaymentId) order.refundPaymentId = refundPaymentId;
      if (refundOk) {
        order.refundedAmount = order.financials.totalAmount;
        order.refundedAt = new Date();
      }
    }
    await order.save({ session });

    // 2. Unmark artworks
    for (const item of order.items) {
      await Artwork.findOneAndUpdate(
        { _id: item.artwork },
        { isSold: false, reservedBy: null, reservedUntil: null },
        { session },
      );
      logger.info(`✅ Artwork ${item.artwork} unmarked (wasSold: ${wasPaid})`);
    }

    // 3. Reverse Free Shipping Quota
    if (order.financials?.platformShippingExpense > 0 && order.artist) {
      const updatedArtist = await User.findOneAndUpdate(
        {
          _id: order.artist,
          "subscription.plan": "opal_prestige",
          freeShippingUsed: { $gt: 0 },
        },
        { $inc: { freeShippingUsed: -1 } },
        { new: true, session },
      );
      if (updatedArtist) {
        logger.info(
          `🔄 Free shipping quota reversed for artist ${order.artist}`,
        );
      }
    }

    // 4. Reverse wallet pending (بس لو PAID)
    if (wasPaid) {
      const wallet = await Wallet.findOne({ user: order.artist }).session(
        session,
      );
      if (
        wallet &&
        wallet.balance.pending >= order.financials.totalArtistEarning
      ) {
        await wallet.debitPending(order.financials.totalArtistEarning, session);
        await Transaction.create(
          [
            {
              wallet: wallet._id,
              order: order._id,
              user: order.artist,
              type: "DEBIT_REFUND",
              amount: -order.financials.totalArtistEarning,
              description: `استرداد - طلب ملغي #${order._id.toString().slice(-6).toUpperCase()}`,
              balanceAfter: {
                available: wallet.balance.available,
                pending: wallet.balance.pending,
              },
              status: "COMPLETED",
            },
          ],
          { session },
        );
        logger.info(`✅ Wallet reversed for order ${orderId}`);
      }
    }

    await session.commitTransaction();
    session.endSession();

    logger.info(
      `✅ Order ${orderId} cancelled (was: ${originalStatus}, refund: ${refundOk ? "REFUNDED" : "FAILED"})`,
    );

    // 5. Emit ORDER_CANCELLED event (unified payload)
    if (EVENTS?.ORDER_CANCELLED) {
      eventEmitter.safeEmit(EVENTS.ORDER_CANCELLED, {
        buyerId: order.buyer,
        artistId: order.artist,
        orderId: order._id,
        orderNumber: order._id.toString().slice(-6).toUpperCase(),
        totalAmount: order.financials.totalAmount,
        reason: order.cancellationReason,
        refundInitiated: refundOk,
      });
    }

    return ApiResponse.success(
      res,
      {
        order: {
          _id: order._id,
          status: order.status,
          cancelledAt: order.cancelledAt,
          cancellationReason: order.cancellationReason,
          cancelledBy: order.cancelledBy,
          refundStatus: order.refundStatus || null,
          refundPaymentId: order.refundPaymentId || null,
          refundedAmount: order.refundedAmount || null,
          refundedAt: order.refundedAt || null,
        },
        refundInitiated: refundOk,
      },
      wasPaid && refundOk
        ? M.orders.cancelRefundSuccess
        : wasPaid
          ? "تم إلغاء الطلب — فشل الاسترداد التلقائي بعد 3 محاولات، سيتم التواصل معك قريباً"
          : M.orders.cancelled,
    );
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error(`❌ Cancel order transaction error for ${orderId}:`, error);
    throw error;
  }
});

module.exports = {
  checkout,
  handleMoyasarWebhook,
  processOrder,
  updateOrderStatus,
  confirmDelivery,
  getMyOrders,
  getMySales,
  getOrderById,
  cancelOrder,
  getOrderByPaymentId,
  getCheckoutInvoiceStatus,
};
