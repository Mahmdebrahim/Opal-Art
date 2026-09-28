// src/validators/bank-account.validator.js
const { body } = require("express-validator");
const M = require("../utils/messages");

const setBankAccountValidator = [
  body("accountHolder")
    .notEmpty()
    .withMessage(M.validation.accountHolderRequired)
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage(M.validation.accountHolderLength),

  body("iban")
    .notEmpty()
    .withMessage(M.validation.ibanRequired)
    .trim()
    .toUpperCase()
    .matches(/^SA\d{22}$/)
    .withMessage(M.validation.ibanInvalid),

  body("bankName")
    .notEmpty()
    .withMessage(M.validation.bankNameRequired)
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage(M.validation.bankNameLength),
];

module.exports = { setBankAccountValidator };
