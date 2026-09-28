const Favorite = require("../models/Favorite");
const Artwork = require("../models/Artwork");
const { BadRequestError, NotFoundError } = require("../utils/api-error");
const ApiResponse = require("../utils/api-response");
const catchAsync = require("../utils/catch-async");
const M = require("../utils/messages");

// Toggle favorite (add/remove)
const toggleFavorite = catchAsync(async (req, res, next) => {
  const { artworkId } = req.body;

  if (!artworkId) {
    throw new BadRequestError(M.validation.artworkIdRequired);
  }

  const artwork = await Artwork.findById(artworkId);
  if (!artwork) throw new NotFoundError(M.artworks.notFound);

  // Check if already favorited
  const existingFavorite = await Favorite.findOne({
    user: req.user._id,
    artwork: artworkId,
  });

  if (existingFavorite) {
    // Remove favorite
    await Favorite.deleteOne({ _id: existingFavorite._id });

    // Update artwork favoritesCount
    await Artwork.findByIdAndUpdate(artworkId, {
      $inc: { favoritesCount: -1 },
    });

    return ApiResponse.success(
      res,
      { isFavorite: false },
      M.favorites.removed,
    );
  }

  // Add favorite
  await Favorite.create({ user: req.user._id, artwork: artworkId });
  await Artwork.findByIdAndUpdate(artworkId, { $inc: { favoritesCount: 1 } });

  return ApiResponse.success(res, { isFavorite: true }, M.favorites.added);
});

// Get user's favorites
const getMyFavorites = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 12 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const favorites = await Favorite.find({ user: req.user._id })
    .populate({
      path: "artwork",
      select: "title price coverImage images artist isSold isActive category",
      populate: { path: "artist", select: "name avatar" },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  // Filter out sold/inactive
  const validFavorites = favorites.filter(
    (fav) => fav.artwork && !fav.artwork.isSold && fav.artwork.isActive,
  );

  const total = await Favorite.countDocuments({ user: req.user._id });

  return ApiResponse.success(
    res,
    {
      favorites: validFavorites,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    },
    M.favorites.retrieved,
  );
});

// Check if artwork is favorited (for frontend)
const checkFavoriteStatus = catchAsync(async (req, res, next) => {
  const { artworkId } = req.params;

  const favorite = await Favorite.findOne({
    user: req.user._id,
    artwork: artworkId,
  });

  return ApiResponse.success(
    res,
    {
      isFavorite: !!favorite,
    },
    M.favorites.statusChecked,
  );
});

module.exports = {
  toggleFavorite,
  getMyFavorites,
  checkFavoriteStatus,
};
