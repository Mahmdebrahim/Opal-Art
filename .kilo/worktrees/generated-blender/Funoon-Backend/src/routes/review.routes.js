const express = require("express");
const router = express.Router();
const {
  createReview,
  getArtistReviews,
  getMyReviews,
  getRecentReviews,
  updateReview,
  hideReview,
  unhideReview,
} = require("../controllers/review.controller");
const { protect, restrictTo, optionalAuth } = require("../middlewares/auth.middleware");

// Public
router.get("/recent", getRecentReviews);
router.get("/artist/:artistId", optionalAuth, getArtistReviews);

// Protected (Buyer)
router.post("/", protect, createReview);
router.get("/my", protect,  getMyReviews);
router.put("/:id", protect, updateReview);

// Protected (Admin)
router.patch("/:id/hide", protect, restrictTo("admin"), hideReview);
router.patch("/:id/unhide", protect, restrictTo("admin"), unhideReview);

module.exports = router;
