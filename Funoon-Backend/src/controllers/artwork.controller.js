const mongoose = require("mongoose");
const Artwork = require("../models/Artwork");
const User = require("../models/User");
const Order = require("../models/Order");
const FileUploadService = require("../services/file-upload.service");
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
} = require("../utils/api-error");
const ApiResponse = require("../utils/api-response");
const catchAsync = require("../utils/catch-async");
const eventEmitter = require("../events/event-emitter");
const EVENTS = require("../events/events");
const M = require("../utils/messages");
const { escapeRegex } = require("../utils/regex");

const MAJOR_UPDATE_FIELDS = [
  "title",
  "description",
  "price",
  "category",
  "medium",
  "paintType",
  "images",
];

// @desc    Create artwork (requires admin approval)
// @route   POST /api/v1/artworks
const createArtwork = catchAsync(async (req, res, next) => {
  const user = req.user;

  if (user.isBanned) {
    throw new ForbiddenError("حسابك محظور — النشر غير متاح");
  }

  if (!user.hasActiveSubscription()) {
    throw new BadRequestError("يجب أن يكون لديك اشتراك نشط لنشر اللوحات.");
  }

  const hasValidAddress =
    user.address?.city && user.address?.district && user.address?.street;

  if (!hasValidAddress) {
    throw new BadRequestError(
      "يرجى إكمال بيانات عنوان الشحن الخاص بك (المدينة، الحي، الشارع) قبل رفع لوحات جديدة",
    );
  }

  if (!req.files || req.files.length === 0) {
    throw new BadRequestError("يرجى رفع صورة واحدة على الأقل.");
  }

  const planConfig = user.getPlanConfig();

  // ═══ Dimensions validation ═══
  const { dimensions: rawDimensions } = req.body;
  const dimensions =
    typeof rawDimensions === "string"
      ? JSON.parse(rawDimensions)
      : rawDimensions;

  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new BadRequestError("أبعاد اللوحة (العرض والارتفاع) مطلوبة");
  }

  const maxDim = Math.max(
    Number(dimensions.width),
    Number(dimensions.height),
    Number(dimensions.depth || 0),
  );

  if (maxDim > planConfig.maxArtworkSize) {
    throw new BadRequestError(
      `أبعاد اللوحة (${Math.round(maxDim)} سم) تتجاوز الحد الأقصى لباقتك (${planConfig.maxArtworkSize} سم).`,
    );
  }

  const currentCount = await Artwork.countDocuments({
    artist: user._id,
    isSold: false,
    approvalStatus: { $in: ["APPROVED", "PENDING_APPROVAL"] },
  });

  if (currentCount >= planConfig.maxArtworks) {
    throw new BadRequestError(
      `لقد وصلت للحد الأقصى (${planConfig.maxArtworks}) من اللوحات في باقتك (${planConfig.labelAr}).`,
    );
  }

  // ═══ Upload images ═══
  const artworkId = new mongoose.Types.ObjectId();
  const uploadedImages = await Promise.all(
    req.files.map((file, index) =>
      FileUploadService.uploadArtworkImage(file, artworkId, index),
    ),
  );

  const {
    title,
    description,
    price,
    weight,
    category,
    medium,
    paintType,
    canvasThickness,
    dimensionType,
    tags,
  } = req.body;

  const artwork = new Artwork({
    _id: artworkId,
    title,
    description,
    price,
    images: uploadedImages.map((img, index) => ({
      url: img.url,
      key: img.key,
      order: index,
    })),
    artist: user._id,
    dimensions,
    weight: Number(weight),
    category,
    medium: medium || paintType,
    paintType: paintType || null,
    canvasThickness: canvasThickness || null,
    dimensionType: dimensionType || "2D",
    tags: typeof tags === "string" ? JSON.parse(tags) : tags,
    listedUnderPlan: user.subscription.plan,
    approvalStatus: "PENDING_APPROVAL",
    isActive: false,
  });

  await artwork.save();

  eventEmitter.safeEmit(EVENTS.ARTWORK_SUBMITTED, {
    artistId: user._id,
    artistName: user.name,
    artworkId: artwork._id,
    title: artwork.title,
  });

  return ApiResponse.created(
    res,
    artwork,
    "تم استلام لوحتك بنجاح وهي الآن قيد المراجعة من فريق المنصة. سيتم إشعارك فور الموافقة عليها.",
  );
});

// @desc    Update artwork (Owner only)
// @route   PUT /api/v1/artworks/:id
const updateArtwork = catchAsync(async (req, res, next) => {
  if (req.user.isBanned) {
    throw new ForbiddenError("حسابك محظور — التعديل غير متاح");
  }

  const artwork = await Artwork.findById(req.params.id).populate(
    "artist",
    "name",
  );
  if (!artwork) throw new NotFoundError(M.artworks.notFound);

  if (artwork.artist._id.toString() !== req.user._id.toString()) {
    throw new UnauthorizedError(M.artworks.notOwner);
  }

  // ═══ NEW: قفل اللوحات المباعة أو المحجوزة ═══
  const isReserved =
    artwork.reservedBy &&
    artwork.reservedUntil &&
    new Date(artwork.reservedUntil) > new Date();

  if (artwork.isSold) {
    throw new BadRequestError("لا يمكن تعديل لوحة مباعة");
  }

  if (isReserved) {
    throw new BadRequestError(
      "اللوحة محجوزة حالياً لمشترٍ آخر — لا يمكن تعديلها حتى انتهاء الحجز",
    );
  }

  const {
    title,
    description,
    price,
    dimensions,
    weight,
    category,
    medium,
    paintType,
    canvasThickness,
    dimensionType,
    tags,
    existingImageKeys,
  } = req.body;

  // ═══ NEW: helper آمن للـ JSON parse (400 بدل 500) ═══
  const safeParse = (value, fieldName) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      throw new BadRequestError(`صيغة ${fieldName} غير صالحة`);
    }
  };

  // ═══ NEW: Validation للعنوان ═══
  if (
    title !== undefined &&
    (!String(title).trim() || String(title).trim().length < 2)
  ) {
    throw new BadRequestError("عنوان اللوحة مطلوب (حرفان على الأقل)");
  }

  // ═══ NEW: Validation للسعر ═══
  if (price !== undefined) {
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      throw new BadRequestError("سعر اللوحة يجب أن يكون رقماً أكبر من صفر");
    }
    if (priceNum > 1000000) {
      throw new BadRequestError("سعر اللوحة يتجاوز الحد الأقصى المسموح");
    }
  }

  // ═══ NEW: Validation للوزن ═══
  if (weight !== undefined) {
    const weightNum = Number(weight);
    if (!Number.isFinite(weightNum) || weightNum <= 0) {
      throw new BadRequestError("وزن اللوحة يجب أن يكون رقماً أكبر من صفر");
    }
    if (weightNum > 100) {
      throw new BadRequestError("وزن اللوحة يتجاوز الحد الأقصى المسموح (100 كجم)");
    }
  }

  // ═══ NEW: Validation للأبعاد (نفس منطق الـ create) ═══
  let parsedDimensions = null;
  let dimsChanged = false;

  if (dimensions !== undefined) {
    parsedDimensions = safeParse(dimensions, "الأبعاد");

    if (
      !parsedDimensions ||
      !Number(parsedDimensions.width) ||
      !Number(parsedDimensions.height)
    ) {
      throw new BadRequestError("أبعاد اللوحة (العرض والارتفاع) مطلوبة");
    }

    dimsChanged =
      Number(parsedDimensions.width) !== Number(artwork.dimensions?.width || 0) ||
      Number(parsedDimensions.height) !== Number(artwork.dimensions?.height || 0) ||
      Number(parsedDimensions.depth || 0) !== Number(artwork.dimensions?.depth || 0);

    // ✅ حد الأبعاد حسب الباقة — بس لو الأبعاد اتغيرت فعلاً
    if (dimsChanged) {
      const newMax = Math.max(
        Number(parsedDimensions.width),
        Number(parsedDimensions.height),
        Number(parsedDimensions.depth || 0),
      );

      const planConfig = req.user.getPlanConfig();
      if (planConfig && newMax > planConfig.maxArtworkSize) {
        throw new BadRequestError(
          `أبعاد اللوحة (${Math.round(newMax)} سم) تتجاوز الحد الأقصى لباقتك (${planConfig.maxArtworkSize} سم).`,
        );
      }
    }
  }

  // ═══ Track major changes for re-approval ═══
  let hasMajorChange = false;

  if (title !== undefined && title !== artwork.title) hasMajorChange = true;
  if (description !== undefined && description !== artwork.description)
    hasMajorChange = true;
  if (price !== undefined && Number(price) !== artwork.price)
    hasMajorChange = true;
  if (category !== undefined && category !== artwork.category)
    hasMajorChange = true;
  if (paintType !== undefined && paintType !== artwork.paintType)
    hasMajorChange = true;
  if (medium !== undefined && medium !== artwork.medium) hasMajorChange = true;
  if (dimsChanged) hasMajorChange = true; // ✅ NEW: الأبعاد تغيير جوهري
  if (req.files && req.files.length > 0) hasMajorChange = true;

  // Apply all fields
  if (title !== undefined) artwork.title = title;
  if (description !== undefined) artwork.description = description;
  if (price !== undefined) artwork.price = Number(price);
  if (weight !== undefined) artwork.weight = Number(weight);
  if (category !== undefined) artwork.category = category;
  if (paintType !== undefined) {
    artwork.paintType = paintType;
    artwork.medium = paintType;
  } else if (medium !== undefined) {
    artwork.medium = medium;
    if (!artwork.paintType) artwork.paintType = medium;
  }
  if (canvasThickness !== undefined) artwork.canvasThickness = canvasThickness;
  if (dimensionType !== undefined) artwork.dimensionType = dimensionType;
  if (parsedDimensions !== null) artwork.dimensions = parsedDimensions;
  if (tags !== undefined) {
    const parsedTags = safeParse(tags, "الوسوم");
    if (parsedTags !== null && !Array.isArray(parsedTags)) {
      throw new BadRequestError("الوسوم يجب أن تكون قائمة (array)");
    }
    artwork.tags = parsedTags;
  }

  // ═══ Images: selective keep + append new ═══
  const hasExistingKeys = existingImageKeys !== undefined;
  const keepArr = hasExistingKeys
    ? safeParse(existingImageKeys, "مفاتيح الصور")
    : null;

  if (keepArr !== null && !Array.isArray(keepArr)) {
    throw new BadRequestError("صيغة مفاتيح الصور غير صالحة");
  }

  let finalImages = artwork.images.map((img) => ({
    url: img.url,
    key: img.key,
    order: img.order,
  }));

  if (keepArr !== null) {
    const keepSet = new Set(keepArr);
    const toDelete = finalImages.filter((img) => !keepSet.has(img.key));

    await Promise.all(
      toDelete.map((img) =>
        FileUploadService.deleteImageByKey
          ? FileUploadService.deleteImageByKey(img.key).catch((err) => {
              logger.warn(`⚠️ Failed to delete image ${img.key}:`, err.message);
            })
          : Promise.resolve(),
      ),
    );

    finalImages = keepArr
      .map((key) => finalImages.find((img) => img.key === key))
      .filter(Boolean);
  }

  if (req.files && req.files.length > 0) {
    const startOrder = finalImages.length;
    const uploadedImages = await Promise.all(
      req.files.map((file, index) =>
        FileUploadService.uploadArtworkImage(
          file,
          artwork._id,
          startOrder + index,
        ),
      ),
    );
    finalImages = [
      ...finalImages,
      ...uploadedImages.map((img, index) => ({
        url: img.url,
        key: img.key,
        order: startOrder + index,
      })),
    ];
  }

  if (finalImages.length === 0) {
    throw new BadRequestError(M.artworks.mustHaveImage);
  }

  artwork.images = finalImages;

  // ═══ Re-approval logic ═══
  if (hasMajorChange && artwork.approvalStatus === "APPROVED") {
    artwork.approvalStatus = "PENDING_APPROVAL";
    artwork.isActive = false;
    artwork.reviewedBy = null;
    artwork.reviewedAt = null;
    artwork.adminNote = null;
    eventEmitter.safeEmit(EVENTS.ARTWORK_UPDATED_NEEDS_REVIEW, {
      artistId: artwork.artist._id,
      artworkId: artwork._id,
      artworkTitle: artwork.title,
      artistName: artwork.artist.name,
    });
  }

  // لو كانت REJECTED وعدّلها الفنان → ترجع للمراجعة تلقائياً
  if (artwork.approvalStatus === "REJECTED") {
    artwork.approvalStatus = "PENDING_APPROVAL";
    artwork.adminNote = null;
    artwork.reviewedBy = null;
    artwork.reviewedAt = null;
    eventEmitter.safeEmit(EVENTS.ARTWORK_UPDATED_NEEDS_REVIEW, {
      artistId: artwork.artist._id,
      artworkId: artwork._id,
      artworkTitle: artwork.title,
      artistName: artwork.artist.name,
    });
  }

  await artwork.save();

  const message =
    hasMajorChange && artwork.approvalStatus === "PENDING_APPROVAL"
      ? "تم تحديث اللوحة بنجاح. التعديلات الجوهرية تتطلب مراجعة جديدة من فريق المنصة."
      : "تم تحديث اللوحة بنجاح";

  return ApiResponse.success(res, artwork, message);
});

// @desc    Delete artwork (Owner or Admin)
// @route   DELETE /api/v1/artworks/:id
const deleteArtwork = catchAsync(async (req, res, next) => {
  if (req.user.isBanned) {
    throw new ForbiddenError("حسابك محظور — الحذف غير متاح");
  }

  const artwork = await Artwork.findById(req.params.id);
  if (!artwork) throw new NotFoundError(M.artworks.notFound);

  const isOwner = artwork.artist.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new UnauthorizedError(M.artworks.notOwner);
  }

  // ✅ Guard: لو عليها طلبات → منع الحذف
  const ordersCount = await Order.countDocuments({
    "items.artwork": artwork._id,
  });

  if (ordersCount > 0 && !isAdmin) {
    throw new BadRequestError(
      "لا يمكن حذف لوحة مباعة للحفاظ على سجل طلباتك. يمكنك إخفاؤها من البروفايل بدلاً من ذلك.",
    );
  }

  // Admin hard-delete bypasses the orders check (but should use soft delete instead)
  if (ordersCount > 0 && isAdmin) {
    // Soft delete only
    artwork.isActive = false;
    artwork.approvalStatus = "SUSPENDED";
    artwork.adminNote =
      "تم الإيقاف بواسطة الأدمن (لها طلبات مرتبطة — حذف مرفوض)";
    await artwork.save();

    return ApiResponse.success(
      res,
      { deactivated: true, ordersCount },
      "تم إيقاف اللوحة — لا يمكن حذف لوحة لها طلبات مرتبطة",
    );
  }

  await FileUploadService.deleteArtworkImages(artwork._id);
  await Artwork.findByIdAndDelete(artwork._id);

  return ApiResponse.success(res, null, M.artworks.deleted);
});

// @desc    Toggle active status (Owner only, requires APPROVED)
// @route   PATCH /api/v1/artworks/:id/toggle
const toggleActiveStatus = catchAsync(async (req, res, next) => {
  if (req.user.isBanned) {
    throw new ForbiddenError("حسابك محظور — التعديل غير متاح");
  }

  const artwork = await Artwork.findById(req.params.id);
  if (!artwork) throw new NotFoundError(M.artworks.notFound);

  if (artwork.artist.toString() !== req.user._id.toString()) {
    throw new UnauthorizedError(M.artworks.notOwner);
  }

  // ═══ ✅ APPROVED فقط هو اللي الفنان يقدر يتحكم فيه ═══
  if (artwork.approvalStatus !== "APPROVED") {
    const statusMessages = {
      PENDING_APPROVAL: "لوحتك قيد المراجعة من فريق المنصة. يرجى الانتظار.",
      REJECTED: `تم رفض اللوحة. ${artwork.adminNote ? `السبب: ${artwork.adminNote}` : ""}`,
      SUSPENDED: `تم إيقاف اللوحة بواسطة فريق المنصة. ${artwork.adminNote ? `السبب: ${artwork.adminNote}` : ""}`,
    };

    throw new BadRequestError(
      statusMessages[artwork.approvalStatus] ||
        "لا يمكنك تفعيل/إيقاف هذه اللوحة في حالتها الحالية.",
    );
  }

  artwork.isActive = !artwork.isActive;
  await artwork.save();

  return ApiResponse.success(
    res,
    artwork,
    artwork.isActive ? "تم تفعيل اللوحة" : "تم إيقاف اللوحة",
  );
});

// Get single artwork details (with optional view counter)
const getArtworkDetails = catchAsync(async (req, res, next) => {
  const artworkId = req.params.id;
  const userId = req.user?._id;

  // ═══════════════════════════════════════════════════
  // Get artwork with populated data
  // ═══════════════════════════════════════════════════
  const pipeline = [
    { $match: { _id: new mongoose.Types.ObjectId(artworkId) } },
    {
      $lookup: {
        from: "users",
        localField: "artist",
        foreignField: "_id",
        as: "artist",
      },
    },
    { $unwind: "$artist" },
  ];

  // Add isFavorite flag if user is logged in
  if (userId) {
    pipeline.push(
      {
        $lookup: {
          from: "favorites",
          let: { artworkId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$artwork", "$$artworkId"] },
                    { $eq: ["$user", userId] },
                  ],
                },
              },
            },
          ],
          as: "favoriteData",
        },
      },
      {
        $addFields: {
          isFavorite: { $gt: [{ $size: "$favoriteData" }, 0] },
        },
      },
      { $project: { favoriteData: 0 } },
    );
  }

  const results = await Artwork.aggregate(pipeline);

  if (!results[0]) {
    throw new NotFoundError(M.artworks.notFound);
  }

  if (results[0].artist?.isBanned) {
    throw new NotFoundError(M.artworks.notFound);
  }

  // ═══════════════════════════════════════════════════
  // View Counter (unique per user/IP per 24h)
  // ═══════════════════════════════════════════════════
  // Note: ArtworkView model لازم يكون موجود
  try {
    const ArtworkView = require("../models/ArtworkView");
    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.connection?.remoteAddress;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const viewQuery = userId
      ? { artwork: artworkId, user: userId, expiresAt: { $gt: new Date() } }
      : { artwork: artworkId, ipAddress, expiresAt: { $gt: new Date() } };

    const result = await ArtworkView.findOneAndUpdate(
      viewQuery,
      {
        $set: {
          artwork: artworkId,
          user: userId || null,
          ipAddress: userId ? null : ipAddress,
          viewedAt: new Date(),
          expiresAt,
        },
      },
      { upsert: true, new: true, includeResultMetadata: true },
    );

    if (result.lastErrorObject && !result.lastErrorObject.updatedExisting) {
      await Artwork.findByIdAndUpdate(artworkId, { $inc: { viewsCount: 1 } });
    }
  } catch (error) {
    // لو ArtworkView مش موجود، تجاهل الخطأ
    console.warn("ArtworkView tracking failed:", error.message);
  }

  // ═══════════════════════════════════════════════════
  // Get related artworks (same category/artist)
  // ═══════════════════════════════════════════════════
  const relatedArtworks = await Artwork.find({
    _id: { $ne: artworkId },
    isActive: true,
    approvalStatus: "APPROVED",
    isSold: false,
    $or: [{ category: results[0].category }, { artist: results[0].artist._id }],
  })
    .select("title coverImage price artist dimensions isSold")
    .populate("artist", "name avatar isVerified subscription.plan")
    .limit(4)
    .lean();

  // 1. Main artwork
  const mainArtwork = results[0];
  const mainPlanConfig =
    User.PLAN_CONFIG?.[mainArtwork.artist?.subscription?.plan];
  const finalArtwork = {
    ...mainArtwork,
    artist: mainArtwork.artist
      ? {
          ...mainArtwork.artist,
          isVerified: mainPlanConfig?.features?.verifiedBadge || false,
          coverImage: mainArtwork.artist.coverImage || null,
        }
      : null,
  };

  // 2. Related artworks
  const finalRelated = relatedArtworks.map((a) => {
    const planConfig = User.PLAN_CONFIG?.[a.artist?.subscription?.plan];
    return {
      ...a,
      coverImage: a.images?.[0]?.url || a.coverImage,
      artist: a.artist
        ? {
            ...a.artist,
            isVerified: planConfig?.features?.verifiedBadge || false,
          }
        : null,
    };
  });

  return ApiResponse.success(
    res,
    {
      artwork: finalArtwork,
      relatedArtworks: finalRelated,
    },
    "Artwork details retrieved",
  );
});

// List all artworks with filters, pagination & sorting
const listAllArtworks = catchAsync(async (req, res, next) => {
  const {
    category,
    medium,
    paintType,
    canvasThickness,
    dimensionType,
    minPrice,
    maxPrice,
    size,
    search,
    tags,
    subscriptionPlan,
    minRating,
    sort = "priority",
  } = req.query;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 12));
  const skip = (page - 1) * limit;

  const userId = req.user?._id;

  // ═══════════════════════════════════════════════════
  // Build Query
  // ═══════════════════════════════════════════════════
  const query = { isActive: true, approvalStatus: "APPROVED", isSold: false };

  if (category) {
    const categories = Array.isArray(category) ? category : category.split(",");
    query.category = { $in: categories };
  }

  if (paintType || medium) {
    const pTypes = Array.isArray(paintType || medium)
      ? paintType || medium
      : (paintType || medium).split(",");
    query.$or = query.$or || [];
    query.$or.push({ paintType: { $in: pTypes } }, { medium: { $in: pTypes } });
  }

  if (canvasThickness) {
    const thicknesses = Array.isArray(canvasThickness)
      ? canvasThickness
      : canvasThickness.split(",");
    query.canvasThickness = { $in: thicknesses };
  }

  if (dimensionType) {
    const dims = Array.isArray(dimensionType)
      ? dimensionType
      : dimensionType.split(",");
    query.dimensionType = { $in: dims };
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (size) {
    const sizes = Array.isArray(size) ? size : [size];
    const sizeConditions = [];
    sizes.forEach((s) => {
      switch (s.toLowerCase()) {
        case "small":
          sizeConditions.push({
            $or: [
              { "dimensions.width": { $lt: 30 } },
              { "dimensions.height": { $lt: 30 } },
            ],
          });
          break;
        case "medium":
          sizeConditions.push({
            $or: [
              { "dimensions.width": { $gte: 30, $lt: 60 } },
              { "dimensions.height": { $gte: 30, $lt: 60 } },
            ],
          });
          break;
        case "large":
          sizeConditions.push({
            $or: [
              { "dimensions.width": { $gte: 60, $lt: 100 } },
              { "dimensions.height": { $gte: 60, $lt: 100 } },
            ],
          });
          break;
        case "giant":
          sizeConditions.push({
            $or: [
              { "dimensions.width": { $gte: 100 } },
              { "dimensions.height": { $gte: 100 } },
            ],
          });
          break;
      }
    });
    if (sizeConditions.length > 0) {
      query.$and = query.$and || [];
      query.$and.push({ $or: sizeConditions });
    }
  }

  if (tags) {
    const tagArray = Array.isArray(tags)
      ? tags
      : tags.split(",").map((t) => t.trim().toLowerCase());
    query.tags = { $in: tagArray };
  }

  if (typeof search === "string" && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    query.$or = query.$or || [];
    query.$or.push(
      { title: { $regex: escapedSearch, $options: "i" } },
      { description: { $regex: escapedSearch, $options: "i" } },
      { medium: { $regex: escapedSearch, $options: "i" } },
      { paintType: { $regex: escapedSearch, $options: "i" } },
      { category: { $regex: escapedSearch, $options: "i" } },
      { canvasThickness: { $regex: escapedSearch, $options: "i" } },
      { tags: { $regex: escapedSearch, $options: "i" } },
    );
  }

  // ═══════════════════════════════════════════════════
  // ✅ Build priority branches dynamically from PLAN_CONFIG
  // ═══════════════════════════════════════════════════
  const priorityBranches = Object.entries(User.PLAN_CONFIG || {}).map(
    ([planId, cfg]) => ({
      case: { $eq: ["$artist.subscription.plan", planId] },
      then: cfg.searchPriority || 1,
    }),
  );

  // ═══════════════════════════════════════════════════
  // Build base pipeline (filters + artist lookup + sort)
  // ═══════════════════════════════════════════════════
  const basePipeline = [
    { $match: query },
    {
      $lookup: {
        from: "users",
        localField: "artist",
        foreignField: "_id",
        as: "artist",
      },
    },
    { $unwind: { path: "$artist", preserveNullAndEmptyArrays: true } },
    { $match: { "artist.isBanned": { $ne: true } } },
    {
      $addFields: {
        subscriptionPriority: {
          $switch: {
            branches: priorityBranches,
            default: 1,
          },
        },
      },
    },
  ];

  // Add subscriptionPlan filter
  if (subscriptionPlan) {
    const plans = Array.isArray(subscriptionPlan)
      ? subscriptionPlan
      : subscriptionPlan.split(",");
    basePipeline.push({
      $match: { "artist.subscription.plan": { $in: plans } },
    });
  }

  // Add minRating filter
  if (minRating) {
    const minRatingNum = parseFloat(minRating);
    if (!isNaN(minRatingNum) && minRatingNum >= 1 && minRatingNum <= 5) {
      basePipeline.push({
        $match: { "artist.avgRating": { $gte: minRatingNum } },
      });
    }
  }

  // Sort
  let sortStage = {};
  switch (sort) {
    case "priority":
      sortStage = { subscriptionPriority: -1, createdAt: -1 };
      break;
    case "newest":
      sortStage = { createdAt: -1 };
      break;
    case "price_asc":
      sortStage = { subscriptionPriority: -1, price: 1 };
      break;
    case "price_desc":
      sortStage = { subscriptionPriority: -1, price: -1 };
      break;
    case "popular":
      sortStage = {
        subscriptionPriority: -1,
        favoritesCount: -1,
        viewsCount: -1,
      };
      break;
    default:
      sortStage = { subscriptionPriority: -1, createdAt: -1 };
  }

  basePipeline.push({ $sort: sortStage });

  // ═══════════════════════════════════════════════════
  // ✅ Count: aggregation بسيطة بدون favorites/project
  // ═══════════════════════════════════════════════════
  const countPipeline = [...basePipeline, { $count: "total" }];
  const countResult = await Artwork.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // ═══════════════════════════════════════════════════
  // Data pipeline: pagination + favorites + project
  // ═══════════════════════════════════════════════════
  const dataPipeline = [...basePipeline, { $skip: skip }, { $limit: limit }];

  if (userId) {
    dataPipeline.push({
      $lookup: {
        from: "favorites",
        let: { artworkId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$artwork", "$$artworkId"] },
                  { $eq: ["$user", userId] },
                ],
              },
            },
          },
        ],
        as: "favoriteData",
      },
    });
    dataPipeline.push({
      $addFields: { isFavorite: { $gt: [{ $size: "$favoriteData" }, 0] } },
    });
  } else {
    dataPipeline.push({ $addFields: { isFavorite: false } });
  }

  // Project
  dataPipeline.push({
    $project: {
      favoriteData: 0,
      "artist.password": 0,
      "artist.address.buildingNo": 0,
      "artist.address.street": 0,
    },
  });

  const artworks = await Artwork.aggregate(dataPipeline);

  // ═══════════════════════════════════════════════════
  // Final mapping
  // ═══════════════════════════════════════════════════
  const finalArtworks = artworks.map((a) => {
    const planConfig = User.PLAN_CONFIG?.[a.artist?.subscription?.plan];
    return {
      ...a,
      coverImage: a.images?.[0]?.url || a.coverImage || null,
      artist: a.artist
        ? {
            ...a.artist,
            isVerified: planConfig?.features?.verifiedBadge || false,
            coverImage: a.artist.coverImage || null,
          }
        : null,
    };
  });

  return ApiResponse.success(
    res,
    {
      artworks: finalArtworks,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    },
    "Artworks retrieved"
  );
});

// @desc    Get my artworks (artist only)
// @route   GET /api/v1/artworks/my
// @access  Private (Artist)
const getMyArtworks = catchAsync(async (req, res, next) => {
  const { status, isSold, page = 1, limit = 12 } = req.query;
  const artistId = req.user._id;

  const filter = { artist: artistId };
  if (status === "active") {
    filter.isActive = true;
    filter.isSold = false;
    filter.approvalStatus = "APPROVED";
  } else if (status === "inactive") {
    filter.isActive = false;
    // filter.isSold = false;
    filter.approvalStatus = "APPROVED";
  } else if (status === "pending") {
    filter.approvalStatus = "PENDING_APPROVAL";
  } else if (status === "rejected") {
    filter.approvalStatus = "REJECTED";
  } else if (status === "suspended") {
    filter.approvalStatus = "SUSPENDED";
  } else if (isSold === "true") {
    filter.isSold = true;
  }
  // if (status === "active") query.isActive = true;
  // if (status === "inactive") query.isActive = false;
  // if (isSold === "true") query.isSold = true;
  // if (isSold === "false") query.isSold = false;

  const skip = (Number(page) - 1) * Number(limit);

  const artworks = await Artwork.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Artwork.countDocuments(filter);

  return ApiResponse.success(
    res,
    {
      artworks,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    },
    "My artworks retrieved",
  );
});

// ═══════════════════════════════════════════════════
// In-memory cache للـ filters (5 دقايق TTL)
// ═══════════════════════════════════════════════════
const filterCache = {
  data: null,
  expiresAt: 0,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 دقايق

const invalidateFilterCache = () => {
  filterCache.data = null;
  filterCache.expiresAt = 0;
};

// ═══════════════════════════════════════════════════
// Get available filter options (cached + parallel)
// ═══════════════════════════════════════════════════
const getFilterOptions = catchAsync(async (req, res, next) => {
  // ✅ Step 1: Check cache
  const now = Date.now();
  if (filterCache.data && now < filterCache.expiresAt) {
    return ApiResponse.success(
      res,
      filterCache.data,
      "Filter options retrieved (cached)"
    );
  }

  // ✅ Step 2: Parallel queries
  const commonFilter = { isActive: true, isSold: false };

  const [
    categories,
    paintTypesResult,
    mediumsResult,
    canvasThicknesses,
    dimensionTypes,
    citiesResult,
    priceStats,
    sizeStats,
    totalCount,
  ] = await Promise.all([
    Artwork.distinct("category", commonFilter),
    Artwork.distinct("paintType", commonFilter),
    Artwork.distinct("medium", commonFilter),
    Artwork.distinct("canvasThickness", commonFilter),
    Artwork.distinct("dimensionType", commonFilter),
    Artwork.aggregate([
      { $match: commonFilter },
      {
        $lookup: {
          from: "users",
          localField: "artist",
          foreignField: "_id",
          as: "artist",
        },
      },
      { $unwind: "$artist" },
      { $group: { _id: "$artist.address.city" } },
      { $match: { _id: { $ne: null } } },
    ]),
    Artwork.aggregate([
      { $match: commonFilter },
      {
        $group: {
          _id: null,
          min: { $min: "$price" },
          max: { $max: "$price" },
        },
      },
    ]),
    Artwork.aggregate([
      { $match: commonFilter },
      {
        $addFields: {
          maxDimension: {
            $max: ["$dimensions.width", "$dimensions.height"],
          },
        },
      },
      {
        $bucket: {
          groupBy: "$maxDimension",
          boundaries: [0, 30, 60, 100, Number.MAX_SAFE_INTEGER],
          default: "Other",
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    Artwork.countDocuments(commonFilter),
  ]);

  // ═══════════════════════════════════════════════════
  // Process results
  // ═══════════════════════════════════════════════════
  const paintTypes = Array.from(
    new Set([...paintTypesResult, ...mediumsResult])
  )
    .filter(Boolean)
    .sort();

  const cities = citiesResult.map((c) => c._id);
  const priceRange = priceStats[0] || { min: 0, max: 10000 };

  const sizeDistribution = {
    small: sizeStats.find((s) => s._id === 0)?.count || 0,
    medium: sizeStats.find((s) => s._id === 30)?.count || 0,
    large: sizeStats.find((s) => s._id === 60)?.count || 0,
    giant: sizeStats.find((s) => s._id === 100)?.count || 0,
  };

  const responseData = {
    categories: categories.filter(Boolean).sort(),
    mediums: paintTypes,
    paintTypes: paintTypes,
    canvasThicknesses: canvasThicknesses.filter(Boolean).sort(),
    dimensionTypes: dimensionTypes.filter(Boolean).sort(),
    cities: cities.filter(Boolean).sort(),
    priceRange: {
      min: Math.floor(priceRange.min),
      max: Math.ceil(priceRange.max),
    },
    sizeDistribution,
    totalCount,
  };

  // ✅ Step 3: Save to cache
  filterCache.data = responseData;
  filterCache.expiresAt = now + CACHE_TTL;

  return ApiResponse.success(res, responseData, "Filter options retrieved");
});

// ═══════════════════════════════════════════════════
// Featured Artworks
// ═══════════════════════════════════════════════════

const featureArtwork = catchAsync(async (req, res, next) => {
  const user = req.user;

  const isPrestige =
    user.subscription?.plan === "opal_prestige" && user.hasActiveSubscription();

  if (!isPrestige) {
    throw new ForbiddenError(
      "ميزة التمييز متاحة فقط للفنانين المشتركين في باقة Opal Prestige النشطة. " +
        "قم بترقية اشتراكك من صفحة الاشتراكات للاستفادة من هذه الميزة."
    );
  }

  const artwork = await Artwork.findById(req.params.id);
  if (!artwork) throw new NotFoundError("اللوحة غير موجودة");

  if (artwork.artist.toString() !== user._id.toString()) {
    throw new ForbiddenError("لا يحق لك تمييز لوحة لا تملكها");
  }

  if (artwork.approvalStatus !== "APPROVED") {
    throw new BadRequestError("يمكن تمييز اللوحات المعتمدة فقط");
  }
  if (!artwork.isActive) {
    throw new BadRequestError("يمكن تمييز اللوحات النشطة فقط");
  }

  const previousFeatured = await Artwork.findOneAndUpdate(
    { artist: user._id, isFeatured: true, _id: { $ne: artwork._id } },
    { $set: { isFeatured: false, featuredAt: null } }, // ✅ كان فيه bug: isFeatured: true
    { new: false }
  );

  artwork.isFeatured = true;
  artwork.featuredAt = new Date();
  await artwork.save();

  invalidateFilterCache(); // ✅ invalidate cache

  const message = previousFeatured
    ? `تم تمييز اللوحة بنجاح. تم إلغاء تمييز لوحتك السابقة "${previousFeatured.title}" تلقائياً.`
    : "تم تمييز اللوحة بنجاح ";

  return ApiResponse.success(
    res,
    {
      artwork: {
        _id: artwork._id,
        isFeatured: true,
        featuredAt: artwork.featuredAt,
      },
      previousUnfeatured: previousFeatured
        ? { _id: previousFeatured._id, title: previousFeatured.title }
        : null,
    },
    message
  );
});

const unfeatureArtwork = catchAsync(async (req, res, next) => {
  const artwork = await Artwork.findById(req.params.id);
  if (!artwork) throw new NotFoundError("اللوحة غير موجودة");

  const isOwner = artwork.artist.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("لا يحق لك إلغاء تمييز هذه اللوحة");
  }

  artwork.isFeatured = false;
  artwork.featuredAt = null;
  await artwork.save();

  invalidateFilterCache();

  return ApiResponse.success(res, null, "تم إلغاء تمييز اللوحة بنجاح");
});

const getFeaturedArtworks = catchAsync(async (req, res, next) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const skip = (page - 1) * limit;

  const baseQuery = {
    isFeatured: true,
    approvalStatus: "APPROVED",
  };

  const artworks = await Artwork.find(baseQuery)
    .sort({ featuredAt: -1 })
    .populate(
      "artist",
      "name avatar subscription isBanned avgRating reviewsCount"
    )
    .lean();

  const validArtworks = artworks.filter((a) => {
    const artist = a.artist;
    if (!artist || artist.isBanned) return false;
    if (artist.subscription?.plan !== "opal_prestige") return false;
    if (!artist.subscription?.isActive) return false;
    const endDate = artist.subscription?.endDate;
    if (!endDate || new Date(endDate) <= new Date()) return false;
    return true;
  });

  const total = validArtworks.length;
  const paginated = validArtworks.slice(skip, skip + limit);

  const finalArtworks = paginated.map((a) => ({
    ...a,
    coverImage: a.images?.[0]?.url || a.coverImage || null,
    artist: a.artist
      ? {
          ...a.artist,
          isVerified: true,
        }
      : null,
  }));

  return ApiResponse.success(
    res,
    {
      artworks: finalArtworks,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    },
    "اللوحات المميزة"
  );
});

const getPlatformStats = catchAsync(async (req, res, next) => {
  const [artistCount, artworkCount, salesCount, reviewCount] =
    await Promise.all([
      User.countDocuments({ role: "artist", isBanned: { $ne: true } }),
      Artwork.countDocuments({ isActive: true, approvalStatus: "APPROVED" }),
      Artwork.countDocuments({ isSold: true }),
      (async () => {
        try {
          const Review = require("../models/Review");
          return await Review.countDocuments({ isHidden: { $ne: true } });
        } catch {
          return 0;
        }
      })(),
    ]);

  return ApiResponse.success(
    res,
    { artistCount, artworkCount, salesCount, reviewCount },
    "إحصائيات المنصة"
  );
});

module.exports = {
  createArtwork,
  updateArtwork,
  deleteArtwork,
  toggleActiveStatus,
  getArtworkDetails,
  listAllArtworks,
  getFilterOptions,
  getMyArtworks,
  featureArtwork,
  unfeatureArtwork,
  getFeaturedArtworks,
  getPlatformStats,
  invalidateFilterCache, 
};








