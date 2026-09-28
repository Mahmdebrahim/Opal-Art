const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const M = require("../utils/messages");

// ─── Sub-Schemas ────────────────────────────────────────────────────────────
const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, default: "SA", trim: true },
    buildingNo: { type: String, trim: true },
    shortAddressCode: { type: String, trim: true },
    secondaryAddressNumber: { type: String, trim: true },
    lat: { type: String },
    lon: { type: String },
  },
  { _id: false },
);

const subscriptionSchema = new mongoose.Schema(
  {
    plan: {
      type: String,
      enum: ["none", "opal_classic", "opal_plus", "opal_prestige"],
      default: "none",
    },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: false },
    pricePaid: { type: Number, default: 0 },

    // ✅ Moyasar fields
    moyasarPaymentId: { type: String },
    moyasarPaymentStatus: { type: String },

    // ✅ Cron Job fields
    reminderSent: { type: Boolean, default: false },
    autoRenew: { type: Boolean, default: true },
    
    // ✅ NEW: Smart reminders tracking
    lastReminderSentAt: { type: Date, default: null },
    lastReminderDaysLeft: { type: Number, default: null },
  },
  { _id: false },
);

// ─── Plan Config (Single Source of Truth) ───────────────────────────────────
const PLAN_CONFIG = {
  opal_classic: {
    id: "opal_classic",
    label: "Opal Classic",
    labelAr: "أوبال كلاسيك",
    price: 299,
    durationMonths: 12,
    commission: 0.15,

    // حدود
    maxArtworks: 5,
    maxArtworkSize: 120, // cm — أكبر بُعد مسموح

    // ظهور + شحن
    searchPriority: 2,
    coversStandardShipping: false,
    freeShippingQuota: 0, // شحنات مجانية/سنة

    // ميزات (booleans — بتشتغل مع hasFeature)
    features: {
      verifiedBadge: false,
      coverImage: false,
      socialLinks: false,
      featuredArtworks: false,
      analytics: false,
      prioritySupport: false,
      canSeeDetailedViews: false,
    },
  },

  opal_plus: {
    id: "opal_plus",
    label: "Opal Plus",
    labelAr: "أوبال بلس",
    price: 399,
    durationMonths: 12,
    commission: 0.15,

    maxArtworks: 15,
    maxArtworkSize: 120,

    searchPriority: 3,
    coversStandardShipping: false,
    freeShippingQuota: 0,

    features: {
      verifiedBadge: false,
      coverImage: true,
      socialLinks: true,
      featuredArtworks: false,
      analytics: true,
      prioritySupport: true,
      canSeeDetailedViews: true,
    },
  },

  opal_prestige: {
    id: "opal_prestige",
    label: "Opal Prestige",
    labelAr: "أوبال برستيج",
    price: 599,
    durationMonths: 12,
    commission: 0.1,

    maxArtworks: Infinity,
    maxArtworkSize: 200,

    searchPriority: 4,
    coversStandardShipping: true,
    freeShippingQuota: 10,

    features: {
      verifiedBadge: true,
      coverImage: true,
      socialLinks: true,
      featuredArtworks: true,
      analytics: true,
      prioritySupport: true,
      canSeeDetailedViews: true,
    },
  },
};

// ─── Main Schema ─────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, M.validation.nameRequired],
      trim: true,
    },
    email: {
      type: String,
      required: [true, M.validation.emailRequired],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, M.validation.emailInvalid],
    },
    password: {
      type: String,
      required: [true, M.validation.passwordRequired],
      minlength: [8, M.validation.passwordMinLength(8)],
      select: false, 
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      match: [/^[0-9+\s-]{7,15}$/, M.validation.phoneInvalid],
    },
    role: {
      type: String,
      enum: ["buyer", "artist", "admin"],
      default: "buyer",
    },
    avatar: { type: String, default: null },
    profileViewsCount: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0 },

    // Address (required for shipping)
    address: { type: addressSchema, default: () => ({}) },

    // Bank Details
    // bankDetails: {
    //   iban: { type: String, trim: true },
    //   bankName: { type: String, trim: true },
    //   accountHolder: { type: String, trim: true },
    // },

    // Artist-only fields
    bio: { type: String, maxlength: 500 },
    // ✅ Free shipping quota counter
    freeShippingUsed: { type: Number, default: 0 },
    // Custom Profile (Plus + Prestige)
    coverImage: { type: String, default: null },
    socialLinks: {
      instagram: { type: String, trim: true },
      facebook: { type: String, trim: true },
      twitter: { type: String, trim: true },
      snapchat: { type: String, trim: true },
      website: { type: String, trim: true },
    },

    subscription: { type: subscriptionSchema, default: () => ({}) },
    freelanceVerification: {
      certificateNumber: { type: String, trim: true },
      isVerified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
    },

    // Compliance
    termsAccepted: { type: Boolean, required: true, default: false },
    termsAcceptedAt: { type: Date },

    // ═══ Email Verification ═══
    emailVerified: { type: Boolean, default: false, index: true },
    emailVerificationOTP: { type: String, default: null, select: false },
    emailVerificationOTPExpires: { type: Date, default: null, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpLockedUntil: { type: Date, default: null, select: false },
    otpLastSentAt: { type: Date, default: null, select: false },
    otpDailyCount: { type: Number, default: 0 },
    otpDailyCountResetAt: { type: Date, default: Date.now },

    // Security
    passwordChangedAt: { type: Date },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    isActive: { type: Boolean, default: true, select: false },
    deletedAt: { type: Date, select: false },

    // ═══ Ban Info ═══
    isBanned: { type: Boolean, default: false },
    bannedAt: { type: Date },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    banReason: { type: String },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1, role: 1 });
userSchema.index({ "subscription.isActive": 1, "subscription.endDate": 1 });
userSchema.index({ "bankDetails.iban": 1 }, { sparse: true });
userSchema.index({ isBanned: 1 });

// ─── Pre-save: Hash Password ──────────────────────────────────────────────────

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// ─── Pre-save: Set termsAcceptedAt ────────────────────────────────────────────

userSchema.pre("save", function (next) {
  if (this.isModified("termsAccepted") && this.termsAccepted) {
    this.termsAcceptedAt = new Date();
  }
  next();
});

// ─── Methods ─────────────────────────────────────────────────────────────────

// Compare entered password with hashed
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if subscription is currently active
userSchema.methods.hasActiveSubscription = function () {
  if (!this.subscription?.isActive) return false;
  if (!this.subscription?.endDate) return false;
  return new Date(this.subscription.endDate) > new Date();
};



userSchema.methods.hasFeature = function (featureName) {
  const config = PLAN_CONFIG[this.subscription?.plan];
  return config?.features?.[featureName] || false;
};

// Get plan configuration
userSchema.methods.getPlanConfig = function () {
  return PLAN_CONFIG[this.subscription.plan] || null;
};

// Get commission rate based on current plan
userSchema.methods.getCommissionRate = function () {
  const config = this.getPlanConfig();
  return config ? config.commission : 0.15; // Default 15%
};

// Check if platform covers shipping
userSchema.methods.isShippingCovered = function () {
  const config = this.getPlanConfig();
  return config ? config.coversStandardShipping : false;
};

// Get max artwork size (cm) for current plan
userSchema.methods.getMaxArtworkSize = function () {
  const config = this.getPlanConfig();
  return config ? config.maxArtworkSize : 120;
};

// Check if artist has verified badge
userSchema.methods.isVerifiedArtist = function () {
  return this.hasFeature("verifiedBadge");
};

// ─── Statics ─────────────────────────────────────────────────────────────────

userSchema.statics.PLAN_CONFIG = PLAN_CONFIG;

module.exports = mongoose.model("User", userSchema);
