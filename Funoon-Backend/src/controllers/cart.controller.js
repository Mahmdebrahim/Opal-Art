// cart.controller.js
const Cart = require("../models/Cart");
const Artwork = require("../models/Artwork");
const User = require("../models/User");
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require("../utils/api-error");
const ApiResponse = require("../utils/api-response");
const catchAsync = require("../utils/catch-async");
const M = require("../utils/messages");

const calculateShippingCost = (artwork, artistPlan) => {
  return 0;
};

// @desc    Get current user's cart with summary
// @route   GET /api/v1/cart
// @access  Private
const getCart = catchAsync(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  await cart.cleanInvalidItems();

  await cart.populate([
    { path: "items.artwork" },
    { path: "items.artist", select: "name email subscription" },
  ]);

  cart.items = cart.items.filter((item) => !item.artist?.isBanned);
  await cart.save();

  let subtotal = 0;

  const responseItems = cart.items.map((item) => {
    const currentPrice = item.artwork.price;
    subtotal += currentPrice;

    return {
      artwork: {
        _id: item.artwork._id,
        title: item.artwork.title,
        coverImage: item.artwork.coverImage,
        price: currentPrice,
        dimensions: item.artwork.dimensions,
        shippingType: item.artwork.shippingType,
        weight: item.artwork.weight,
      },
      artist: {
        _id: item.artist._id,
        name: item.artist.name,
        city: item.artist.address?.city,
      },
      priceSnapshot: currentPrice,
      shippingCost: 0,
      shippingType: item.artwork.shippingType,
    };
  });

  const cartArtist =
    cart.items.length > 0
      ? {
          _id: cart.items[0].artist._id,
          name: cart.items[0].artist.name,
          city: cart.items[0].artist.address?.city,
        }
      : null;

  return ApiResponse.success(
    res,
    {
      items: responseItems,
      artist: cartArtist,
      summary: {
        subtotal,
        totalShipping: 0,
        total: subtotal,
      },
    },
    M.orders.cartRetrieved,
  );
});

// @desc    Add item to cart
// @route   POST /api/v1/cart/items
// @access  Private
const addToCart = catchAsync(async (req, res, next) => {
  const { artworkId } = req.body;
  if (req.user.isBanned) {
    throw new ForbiddenError(M.orders.accountBanned);
  }
  if (!artworkId) {
    throw new BadRequestError(M.validation.artworkIdRequired);
  }

  const artwork = await Artwork.findById(artworkId).populate("artist");
  if (!artwork || !artwork.isActive || artwork.isSold) {
    throw new NotFoundError(M.artworks.notFound);
  }

  const artist = artwork.artist;
  if (!artist || !artist.hasActiveSubscription()) {
    throw new BadRequestError(M.orders.artistNoSubscription(artist?.name));
  }

  if (artist._id.toString() === req.user._id.toString()) {
    throw new BadRequestError(M.orders.cannotBuyOwnArtwork);
  }

  let cart = await Cart.findOne({ user: req.user._id }).populate({
    path: "items.artist",
    select: "name",
  });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const exists = cart.items.some(
    (item) => item.artwork.toString() === artworkId,
  );
  if (exists) {
    throw new BadRequestError(M.orders.cartAlreadyIn);
  }

  if (cart.items.length >= 10) {
    throw new BadRequestError(M.orders.cartMaxItems);
  }

  // ═══════════════════════════════════════════════════
  // ✅ NEW: Single-artist validation
  // ═══════════════════════════════════════════════════
  if (cart.items.length > 0) {
    const existingArtist = cart.items[0].artist;
    const existingArtistId =
      existingArtist?._id?.toString() || existingArtist?.toString();

    if (!existingArtistId) {
      // بيانات تالفة في السلة، نسيبها تكمل عادي (edge case نادر جداً)
      logger.warn(`Cart ${cart._id} has item with missing artist reference`);
    } else if (existingArtistId !== artist._id.toString()) {
      const existingArtistName = existingArtist?.name || "فنان آخر";
      throw new BadRequestError(
        `لا يمكن إضافة أعمال من فنانين مختلفين في نفس الطلب. ` +
          `سلتك الحالية تحتوي على أعمال من "${existingArtistName}". ` +
          `يرجى إتمام الشراء أولاً أو مسح السلة قبل إضافة أعمال جديدة.`,
      );
    }
  }

  cart.items.push({
    artwork: artwork._id,
    artist: artist._id,
    priceSnapshot: artwork.price,
    shippingCost: 0,
    shippingType: artwork.shippingType,
  });

  await cart.save();

  return ApiResponse.success(res, cart, M.orders.cartItemAdded);
});

//! multi artist in cart
// @desc    Add item to cart
// @route   POST /api/v1/cart/items
// @access  Private
// const addToCart = catchAsync(async (req, res, next) => {
//   const { artworkId } = req.body;
//   if (req.user.isBanned) {
//     throw new ForbiddenError(M.orders.accountBanned);
//   }
//   if (!artworkId) {
//     throw new BadRequestError(M.validation.artworkIdRequired);
//   }

//   const artwork = await Artwork.findById(artworkId).populate("artist");
//   if (!artwork || !artwork.isActive || artwork.isSold) {
//     throw new NotFoundError(M.artworks.notFound);
//   }

//   const artist = artwork.artist;
//   if (!artist || !artist.hasActiveSubscription()) {
//     throw new BadRequestError(M.orders.artistNoSubscription(artist?.name));
//   }

//   if (artist._id.toString() === req.user._id.toString()) {
//     throw new BadRequestError(M.orders.cannotBuyOwnArtwork);
//   }

//   let cart = await Cart.findOne({ user: req.user._id });
//   if (!cart) {
//     cart = await Cart.create({ user: req.user._id, items: [] });
//   }

//   const exists = cart.items.some(
//     (item) => item.artwork.toString() === artworkId,
//   );
//   if (exists) {
//     throw new BadRequestError(M.orders.cartAlreadyIn);
//   }

//   if (cart.items.length >= 10) {
//     throw new BadRequestError(M.orders.cartMaxItems);
//   }

//   cart.items.push({
//     artwork: artwork._id,
//     artist: artist._id,
//     priceSnapshot: artwork.price,
//     shippingCost: 0,
//     shippingType: artwork.shippingType,
//   });

//   await cart.save();

//   return ApiResponse.success(res, cart, M.orders.cartItemAdded);
// });



// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/items/:artworkId
// @access  Private
const removeFromCart = catchAsync(async (req, res, next) => {
  const { artworkId } = req.params;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    throw new NotFoundError(M.orders.cartNotFound);
  }

  cart.items = cart.items.filter(
    (item) => item.artwork.toString() !== artworkId,
  );
  await cart.save();

  return ApiResponse.success(res, cart, M.orders.cartItemRemoved);
});

// @desc    Clear all items from cart
// @route   DELETE /api/v1/cart
// @access  Private
const clearCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (cart) {
    cart.items = [];
    await cart.save();
  }
  return ApiResponse.success(res, null, M.orders.cartCleared);
});

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  calculateShippingCost,
};
