const { body } = require("express-validator");
const M = require("../utils/messages");

const addToCartValidator = [
  body("artworkId")
    .notEmpty()
    .withMessage(M.validation.artworkIdRequired)
    .isMongoId()
    .withMessage(M.validation.artworkIdInvalid),
];

module.exports = { addToCartValidator };
