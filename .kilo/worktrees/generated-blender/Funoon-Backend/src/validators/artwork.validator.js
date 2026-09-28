const { body } = require("express-validator");
const M = require("../utils/messages");

// Create artwork validation
const createArtworkValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage(M.validation.titleRequired)
    .isLength({ max: 100 })
    .withMessage(M.validation.titleTooLong(100)),

  body("description")
    .trim()
    .notEmpty()
    .withMessage(M.validation.descriptionRequired)
    .isLength({ max: 2000 })
    .withMessage(M.validation.descriptionTooLong(2000)),

  body("price")
    .notEmpty()
    .withMessage(M.validation.priceRequired)
    .isFloat({ min: 1, max: 5000 })
    .withMessage(M.validation.priceRange),

  body("weight")
    .notEmpty()
    .withMessage(M.validation.weightRequired)
    .isFloat({ min: 0.1 })
    .withMessage(M.validation.weightMin),

  // ✅ validator واحد بيتعامل مع JSON string أو object
  body("dimensions").custom((value, { req }) => {
    // في الـ update، dimensions اختياري
    if (value === undefined && req.method === "PUT") return true;
    if (!value) throw new Error(M.validation.dimensionsRequired);

    let dims;
    try {
      dims = typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      throw new Error(M.validation.dimensionsInvalidFormat);
    }

    if (!dims.width || Number(dims.width) <= 0)
      throw new Error(M.validation.widthInvalid);
    if (!dims.height || Number(dims.height) <= 0)
      throw new Error(M.validation.heightInvalid);
    if (dims.depth !== undefined && Number(dims.depth) < 0)
      throw new Error(M.validation.depthInvalid);

    return true;
  }),

  body("category")
    .notEmpty()
    .withMessage(M.validation.categoryRequired)
    .isIn([
      "فن البورتريه",
      "فن المناظر الطبيعية",
      "الفن التجريدي",
      "الفن الواقعي",
      "فن الطبيعة الصامتة",
      "الفن الانطباعي",
      "الفن الإسلامي",
      "الفن الزخرفي",
      "الفن السريالي",
      "الفن التعبيري",
      "فن البوب",
      "الفن الكلاسيكي",
      "الفن التكعيبي",
      "الفن الشعبي",
      "الفن المفاهيمي",
      "اخرى",
    ])
    .withMessage(M.validation.categoryInvalid),

  body("paintType")
    .notEmpty()
    .withMessage(M.validation.paintTypeRequired)
    .isIn([
      "ألوان الأكريليك",
      "الألوان الزيتية",
      "الألوان المائية",
      "ألوان الفحم",
      "ألوان الماركر",
      "ألوان الغواش",
      "الباستيل الناعم",
      "الألوان الخشبية",
      "أوراق الذهب",
      "أصباغ الريزن",
      "ألوان السبراي",
      "الباستيل الزيتي",
      "الأحبار الفنية",
      "ألوان القماش",
      "ألوان الزجاج",
      "اخرى",
    ])
    .withMessage(M.validation.paintTypeInvalid),

  body("canvasThickness")
    .notEmpty()
    .withMessage(M.validation.canvasThicknessRequired)
    .isIn([
      "خفيف: 180–250 جم/م²",
      "متوسط: 250–350 جم/م²",
      "ثقيل: 350–450 جم/م²",
      "ثقيل جدًا: 450–600 جم/م²",
      "فائق السماكة: 600 جم/م²",
    ])
    .withMessage(M.validation.canvasThicknessInvalid),

  body("dimensionType")
    .notEmpty()
    .withMessage(M.validation.dimensionTypeRequired)
    .isIn(["2D", "3D"])
    .withMessage(M.validation.dimensionTypeInvalid),

  body("medium")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage(M.validation.mediumTooLong(100)),

  body("tags")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) throw new Error();
        } catch {
          throw new Error(M.validation.tagsInvalidArray);
        }
      } else if (!Array.isArray(value)) {
        throw new Error(M.validation.tagsInvalidArray);
      }
      return true;
    }),
];

// Update artwork validation (all fields optional)
const updateArtworkValidator = [
  body("title")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage(M.validation.titleTooLong(100)),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage(M.validation.descriptionTooLong(2000)),

  body("price")
    .optional()
    .isFloat({ min: 1, max: 5000 })
    .withMessage(M.validation.priceRange),

  body("weight")
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage(M.validation.weightMin),

  body("dimensions").custom((value, { req }) => {
    if (value === undefined && req.method === "PUT") return true;
    if (!value) throw new Error(M.validation.dimensionsRequired);

    let dims;
    try {
      dims = typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      throw new Error(M.validation.dimensionsInvalidFormat);
    }

    if (!dims.width || Number(dims.width) <= 0)
      throw new Error(M.validation.widthInvalid);
    if (!dims.height || Number(dims.height) <= 0)
      throw new Error(M.validation.heightInvalid);
    if (dims.depth !== undefined && Number(dims.depth) < 0)
      throw new Error(M.validation.depthInvalid);

    return true;
  }),

  body("category")
    .optional()
    .isIn([
      "فن البورتريه",
      "فن المناظر الطبيعية",
      "الفن التجريدي",
      "الفن الواقعي",
      "فن الطبيعة الصامتة",
      "الفن الانطباعي",
      "الفن الإسلامي",
      "الفن الزخرفي",
      "الفن السريالي",
      "الفن التعبيري",
      "فن البوب",
      "الفن الكلاسيكي",
      "الفن التكعيبي",
      "الفن الشعبي",
      "الفن المفاهيمي",
      "اخرى",
    ])
    .withMessage(M.validation.categoryInvalid),

  body("paintType")
    .optional()
    .isIn([
      "ألوان الأكريليك",
      "الألوان الزيتية",
      "الألوان المائية",
      "ألوان الفحم",
      "ألوان الماركر",
      "ألوان الغواش",
      "الباستيل الناعم",
      "الألوان الخشبية",
      "أوراق الذهب",
      "أصباغ الريزن",
      "ألوان السبراي",
      "الباستيل الزيتي",
      "الأحبار الفنية",
      "ألوان القماش",
      "ألوان الزجاج",
      "اخرى",
    ])
    .withMessage(M.validation.paintTypeInvalid),

  body("canvasThickness")
    .optional()
    .isIn([
      "خفيف: 180–250 جم/م²",
      "متوسط: 250–350 جم/م²",
      "ثقيل: 350–450 جم/م²",
      "ثقيل جدًا: 450–600 جم/م²",
      "فائق السماكة: 600 جم/م²",
    ])
    .withMessage(M.validation.canvasThicknessInvalid),

  body("dimensionType")
    .optional()
    .isIn(["2D", "3D"])
    .withMessage(M.validation.dimensionTypeInvalid),

  body("medium")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage(M.validation.mediumTooLong(100)),

  body("tags")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) throw new Error();
        } catch {
          throw new Error(M.validation.tagsInvalidArray);
        }
      } else if (!Array.isArray(value)) {
        throw new Error(M.validation.tagsInvalidArray);
      }
      return true;
    }),
];

module.exports = {
  createArtworkValidator,
  updateArtworkValidator,
};
