// src/validators/admin.validator.js
const { body, param } = require("express-validator");
const M = require("../utils/messages");

const approveWithdrawalValidator = []; // No body required

const markPaidWithdrawalValidator = [
  body("transferReference")
    .notEmpty()
    .withMessage(M.validation.transferRefRequired)
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage(M.validation.transferRefLength),
];

const rejectWithdrawalValidator = [
  body("reason")
    .notEmpty()
    .withMessage(M.validation.reasonRequired)
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage(M.validation.reasonLength),
];

const updateUserRoleValidator = [
  param("id").isMongoId().withMessage("معرف المستخدم غير صالح"),
  body("role").isIn(["buyer", "artist", "admin"]).withMessage("الدور غير صالح"),
];

module.exports = {
  approveWithdrawalValidator,
  markPaidWithdrawalValidator,
  rejectWithdrawalValidator,
  updateUserRoleValidator,
};
