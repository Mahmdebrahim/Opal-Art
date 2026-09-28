const { body } = require('express-validator');
const M = require('../utils/messages');

const checkoutValidator = [
  body('shippingAddress')
    .notEmpty()
    .withMessage(M.validation.shippingAddressRequired),
  body('shippingAddress.street')
    .trim()
    .notEmpty()
    .withMessage(M.validation.streetRequired),
  body('shippingAddress.city')
    .trim()
    .notEmpty()
    .withMessage(M.validation.cityRequired),
  body('shippingAddress.district')
    .trim()
    .notEmpty()
    .withMessage(M.validation.districtRequired),
  body('shippingAddress.zipCode')
    .trim()
    .notEmpty()
    .withMessage(M.validation.zipCodeRequired),
];

module.exports = {
  checkoutValidator,
};
