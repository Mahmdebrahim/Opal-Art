const multer = require('multer');
const { BadRequestError } = require('../utils/api-error');
const M = require('../utils/messages');

// Use memory storage to allow processing in-memory with sharp
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new BadRequestError(M.validation.onlyImageAllowed), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, 
    files: 10,
  },
});

module.exports = upload;
