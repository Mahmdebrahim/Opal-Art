const mongoose = require("mongoose");
const User = require("./User");
const M = require("../utils/messages");

const reviewSchema = new mongoose.Schema(
  {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, M.validation.reviewerRequired],
      index: true,
    },
    reviewedArtist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, M.validation.reviewedArtistRequired],
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, M.validation.orderRequired],
      unique: true,
    },
    artwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artwork",
      default: null,
    },
    rating: {
      type: Number,
      required: [true, M.validation.ratingRequired],
      min: [1, M.validation.ratingMin],
      max: [5, M.validation.ratingMax],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, M.validation.commentMaxChars],
      validate: {
        validator: function (v) {
          if (!v || v.trim().length === 0) return true;
          return v.trim().length >= 3;
        },
        message: M.validation.commentMinChars,
      },
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },
    hiddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    hiddenAt: {
      type: Date,
      default: null,
    },
    hiddenReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index
reviewSchema.index({ reviewedArtist: 1, isHidden: 1, createdAt: -1 });

// Helper function for denormalization
reviewSchema.statics.recalcArtistStats = async function (artistId) {
  if (!artistId) return;

  const stats = await this.aggregate([
    {
      $match: {
        reviewedArtist: new mongoose.Types.ObjectId(artistId),
        isHidden: false,
      },
    },
    {
      $group: {
        _id: "$reviewedArtist",
        avgRating: { $avg: "$rating" },
        reviewsCount: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    const rawAvg = stats[0].avgRating || 0;
    const roundedAvg = Math.round(rawAvg * 10) / 10;
    await User.findByIdAndUpdate(artistId, {
      avgRating: roundedAvg,
      reviewsCount: stats[0].reviewsCount || 0,
    });
  } else {
    await User.findByIdAndUpdate(artistId, {
      avgRating: 0,
      reviewsCount: 0,
    });
  }
};

// Hooks to keep artist stats in sync
reviewSchema.post("save", async function () {
  await this.constructor.recalcArtistStats(this.reviewedArtist);
});

reviewSchema.post("findOneAndUpdate", async function (doc) {
  if (doc) {
    await doc.constructor.recalcArtistStats(doc.reviewedArtist);
  }
});

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await doc.constructor.recalcArtistStats(doc.reviewedArtist);
  }
});

module.exports = mongoose.model("Review", reviewSchema);
