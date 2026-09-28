const { body } = require('express-validator');
const M = require('../utils/messages');

const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage(M.validation.nameRequired)
    .isLength({ max: 50 })
    .withMessage(M.validation.nameTooLong(50)),
  body("email")
    .trim()
    .notEmpty()
    .withMessage(M.validation.emailRequired)
    .isEmail()
    .withMessage(M.validation.emailInvalid)
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage(M.validation.passwordRequired)
    .isLength({ min: 8 })
    .withMessage(M.validation.passwordMinLength(8))
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(M.validation.passwordComplexity),
  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9+\s-]{7,15}$/)
    .withMessage(M.validation.phoneInvalid),
  body("role")
    .optional()
    .isIn(["buyer", "artist"])
    .withMessage(M.validation.roleInvalid),
  body("termsAccepted")
    .custom((value) => value === true || value === "true")
    .withMessage(M.validation.termsRequired),
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage(M.validation.emailRequired)
    .isEmail()
    .withMessage(M.validation.emailInvalid)
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage(M.validation.passwordRequired),
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage(M.validation.emailRequired)
    .isEmail()
    .withMessage(M.validation.emailInvalid)
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body('password')
    .notEmpty()
    .withMessage(M.validation.passwordRequired)
    .isLength({ min: 8 })
    .withMessage(M.validation.passwordMinLength(8)),
];

const updateProfileValidator = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage(M.validation.nameNotEmpty)
    .isLength({ max: 50 })
    .withMessage(M.validation.nameTooLong(50)),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9+\s-]{7,15}$/)
    .withMessage(M.validation.phoneInvalid),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage(M.validation.bioTooLong(500)),
  body('address.street').optional().trim(),
  body('address.city').optional().trim(),
  body('address.district').optional().trim(),
  body('address.zipCode').optional().trim(),
];

const verifyEmailValidator = [
  body("userId")
    .trim()
    .notEmpty()
    .withMessage(M.validation.userIdRequired)
    .isMongoId()
    .withMessage(M.validation.userIdInvalid),
  body("otp")
    .trim()
    .notEmpty()
    .withMessage(M.validation.otpRequired)
    .matches(/^[0-9]{6}$/)
    .withMessage(M.validation.otpDigits),
];

const resendOtpValidator = [
  body("userId")
    .trim()
    .notEmpty()
    .withMessage(M.validation.userIdRequired)
    .isMongoId()
    .withMessage(M.validation.userIdInvalid),
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  updateProfileValidator,
  verifyEmailValidator,
  resendOtpValidator,
};
