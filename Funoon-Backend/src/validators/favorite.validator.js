const { body } = require("express-validator");
const M = require("../utils/messages");

const toggleFavoriteValidator = [
  body("artworkId")
    .notEmpty()
    .withMessage(M.validation.artworkIdRequired)
    .isMongoId()
    .withMessage(M.validation.artworkIdInvalid),
];

module.exports = { toggleFavoriteValidator };
