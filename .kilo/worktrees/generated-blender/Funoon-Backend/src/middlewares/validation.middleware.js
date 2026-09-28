const { validationResult } = require('express-validator');
const { BadRequestError } = require('../utils/api-error');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => `${err.path}: ${err.msg}`).join(' — ');
    return next(new BadRequestError(`بيانات غير صالحة: ${errorMessages}`));
  }
  next();
};

module.exports = validate;
