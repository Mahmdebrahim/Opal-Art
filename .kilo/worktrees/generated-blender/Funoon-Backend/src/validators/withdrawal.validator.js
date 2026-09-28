// src/validators/withdrawal.validator.js
const { body } = require("express-validator");
const M = require("../utils/messages");

const requestWithdrawalValidator = [
  body("amount")
    .notEmpty()
    .withMessage(M.validation.amountRequired)
    .isFloat({ min: 50 })
    .withMessage(M.validation.withdrawalMinAmount)
    .isFloat({ max: 100000 })
    .withMessage(M.validation.withdrawalMaxAmount),
];

module.exports = { requestWithdrawalValidator };
