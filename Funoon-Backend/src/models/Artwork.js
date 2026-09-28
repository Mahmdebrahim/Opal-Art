const mongoose = require("mongoose");
const M = require("../utils/messages");

const dimensionsSchema = new mongoose.Schema(
  {
    width: { type: Number, required: true, min: 0 }, // cm
    height: { type: Number, required: true, min: 0 }, // cm
    depth: { type: Number, default: 0, min: 0 }, // cm
  },
  { _id: false },
);

const artworkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, M.validation.titleRequired],
      trim: true,
      maxlength: [100, M.validation.titleTooLong(100)],
    },
    description: {
      type: String,
      required: [true, M.validation.descriptionRequired],
      trim: true,
      maxlength: [2000, M.validation.descriptionTooLong(2000)],
    },
    price: {
      type: Number,
      required: [true, M.validation.priceRequired],
      min: [1, M.validation.priceRange],
      max: [5000, M.validation.priceRange],
    },
    images: [
      {
        url: { type: String, required: true },
        key: { type: String, required: true },
        order: { type: Number, default: 0 },
      },
    ],
    coverImage: { type: String },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dimensions: {
      type: dimensionsSchema,
      required: [true, M.validation.dimensionsRequired],
    },
    // Weight in KG
    weight: {
      type: Number,
      required: [true, M.validation.weightRequired],
      min: [0.1, M.validation.weightMin],
    },
    shippingType: {
      type: String,
      enum: ["standard", "giant"],
      default: "standard",
    },
    isSold: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    hiddenByBan: { type: Boolean, default: false },
    viewsCount: { type: Number, default: 0, min: 0 },
    favoritesCount: { type: Number, default: 0, min: 0 },
    category: {
      type: String,
      enum: [
        "فن البورتريه",
        "فن المناظر الطبيعية",
        "الفن التجريدي",
        "الفن الواقعي",
        "فن الطبيعة الصامتة",
        "الفن الانطباعي",
        "الفن الإسلامي",
        "الفن الزخرفي",
        "الفن السريالي",
        "الفن التعبيري",
        "فن البوب",
        "الفن الكلاسيكي",
        "الفن التكعيبي",
        "الفن الشعبي",
        "الفن المفاهيمي",
        "اخرى",
      ],
      default: "اخرى",
    },
    canvasThickness: {
      type: String,
      enum: [
        "خفيف: 180–250 جم/م²",
        "متوسط: 250–350 جم/م²",
        "ثقيل: 350–450 جم/م²",
        "ثقيل جدًا: 450–600 جم/م²",
        "فائق السماكة: 600 جم/م²",
      ],
      default: null,
    },
    paintType: {
      type: String,
      enum: [
        "ألوان الأكريليك",
        "الألوان الزيتية",
        "الألوان المائية",
        "ألوان الفحم",
        "ألوان الماركر",
        "ألوان الغواش",
        "الباستيل الناعم",
        "الألوان الخشبية",
        "أوراق الذهب",
        "أصباغ الريزن",
        "ألوان السبراي",
        "الباستيل الزيتي",
        "الأحبار الفنية",
        "ألوان القماش",
        "ألوان الزجاج",
        "اخرى",
      ],
      default: null,
    },
    dimensionType: {
      type: String,
      enum: ["2D", "3D"],
      default: "2D",
    },
    medium: { type: String, trim: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    listedUnderPlan: {
      type: String,
      enum: ["opal_classic", "opal_plus", "opal_prestige"],
    },
    reservedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reservedUntil: {
      type: Date,
      default: null,
    },

    // ─── Featured ────────────────────────────────────────────────────────────
    isFeatured: { type: Boolean, default: false, index: true },
    featuredAt: { type: Date, default: null },

    approvalStatus: {
      type: String,
      enum: ["PENDING_APPROVAL", "APPROVED", "SUSPENDED", "REJECTED"],
      default: "PENDING_APPROVAL",
      index: true,
    },
    adminNote: { type: String, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true },
);

artworkSchema.index({ artist: 1, isActive: 1 });
artworkSchema.index({ artist: 1, createdAt: -1 });
artworkSchema.index({ artist: 1, approvalStatus: 1 });
artworkSchema.index({ approvalStatus: 1, createdAt: -1 });
artworkSchema.index({ isSold: 1, isActive: 1 });
artworkSchema.index({ category: 1 });
artworkSchema.index({ paintType: 1 });
artworkSchema.index({ price: 1 });
artworkSchema.index({ createdAt: -1 });
artworkSchema.index({ tags: 1 });
artworkSchema.index({ isFeatured: 1, featuredAt: -1 }); 
artworkSchema.index({ reservedBy: 1, reservedUntil: 1 });
artworkSchema.index({ reservedUntil: 1 }); 
artworkSchema.index({
  isActive: 1,
  isSold: 1,
  approvalStatus: 1,
  createdAt: -1,
});

// Auto-calculate shipping type and cover image before save
artworkSchema.pre("save", function (next) {
  if (this.dimensions) {
    const maxDim = Math.max(
      this.dimensions.width,
      this.dimensions.height,
      this.dimensions.depth || 0,
    );
    this.shippingType = maxDim > 120 ? "giant" : "standard";
  }
  if (this.images && this.images.length > 0) {
    this.coverImage = this.images[0].url;
  }
  next();
});

module.exports = mongoose.model("Artwork", artworkSchema);
