const { body } = require("express-validator");
const M = require("../utils/messages");

const updateProfileValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage(M.validation.nameNotEmpty)
    .isLength({ max: 50 })
    .withMessage(M.validation.nameTooLong(50)),

  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9+\s-]{7,15}$/)
    .withMessage(M.validation.phoneInvalid),

  body("bio")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage(M.validation.bioTooLong(500)),
];

const changePasswordValidator = [
  body("currentPassword")
    .notEmpty()
    .withMessage(M.validation.passwordRequired),

  body("newPassword")
    .notEmpty()
    .withMessage(M.validation.passwordRequired)
    .isLength({ min: 8 })
    .withMessage(M.validation.passwordMinLength(8))
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error(M.validation.passwordMustBeDifferent);
      }
      return true;
    }),
];

const updateBankDetailsValidator = [
  body("iban")
    .notEmpty()
    .withMessage(M.validation.ibanRequired)
    .matches(/^SA\d{22}$/)
    .withMessage(M.validation.ibanInvalid),

  body("bankName")
    .notEmpty()
    .withMessage(M.validation.bankNameRequired)
    .trim(),

  body("accountHolder")
    .notEmpty()
    .withMessage(M.validation.accountHolderRequired)
    .trim(),
];

module.exports = {
  updateProfileValidator,
  changePasswordValidator,
  updateBankDetailsValidator,
};
