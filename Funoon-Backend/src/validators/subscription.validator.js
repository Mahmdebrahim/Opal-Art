// src/validators/subscription.validator.js
const { body } = require("express-validator");
const M = require("../utils/messages");

const purchaseSubscriptionValidator = [
  body("planId")
    .notEmpty()
    .withMessage(M.validation.planIdRequired)
    .isIn(["opal_classic", "opal_plus", "opal_prestige"])
    .withMessage(M.validation.planIdInvalid),
  body("couponCode")
    .optional({ checkFalsy: true })
    .isString()
    .withMessage("كود الخصم غير صالح")
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage("كود الخصم يجب أن يكون بين 3 و32 حرفاً")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage("كود الخصم يحتوي على أحرف غير مسموحة"),
];

module.exports = { purchaseSubscriptionValidator };
