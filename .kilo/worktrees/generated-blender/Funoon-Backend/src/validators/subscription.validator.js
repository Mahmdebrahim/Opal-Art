// src/validators/subscription.validator.js
const { body } = require("express-validator");
const M = require("../utils/messages");

const purchaseSubscriptionValidator = [
  body("planId")
    .notEmpty()
    .withMessage(M.validation.planIdRequired)
    .isIn(["opal_classic", "opal_plus", "opal_prestige"])
    .withMessage(M.validation.planIdInvalid),
];

module.exports = { purchaseSubscriptionValidator };
