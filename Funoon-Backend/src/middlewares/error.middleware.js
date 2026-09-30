const logger = require("../utils/logger");

const escapeHtml = (str) =>
  String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  const logMessage = `${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`;
  if (err.authErrorCode === "ACCESS_TOKEN_EXPIRED") {
    logger.info(logMessage);
  } else {
    logger.error(logMessage, { stack: err.stack });
  }

  // ✅ CastError
  if (err.name === "CastError") {
    const path = escapeHtml(err.path || "field");
    return res.status(400).json({
      success: false,
      message: `قيمة غير صالحة للحقل "${path}"`,
    });
  }

  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : null;

    const FIELD_LABELS = {
      email: "البريد الإلكتروني",
      phone: "رقم الجوال",
    };

    const fieldLabel = FIELD_LABELS[field] || "القيمة المدخلة";

    return res.status(400).json({
      success: false,
      message: `${fieldLabel} مستخدم بالفعل. يرجى استخدام قيمة أخرى.`,
    });
  }

  // ✅ ValidationError
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors)
      .map((el) => escapeHtml(el.message))
      .join(" — ");
    return res.status(400).json({
      success: false,
      message: `بيانات غير صالحة ${errors}`,
    });
  }

  // ✅ JWT
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "جلسة غير صالحة. يرجى تسجيل الدخول مرة أخرى.",
    });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.",
    });
  }

  // ✅ Standard response — دايمًا آخر حاجة، وبيتنفذ مرة واحدة بس
  const isOperational = err.isOperational === true;
  const publicMessage = isOperational
    ? escapeHtml(err.message || "حدث خطأ غير متوقع")
    : "حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.";

  return res.status(err.statusCode).json({
    success: false,
    message: publicMessage,
    ...(err.authErrorCode && { authErrorCode: err.authErrorCode }),
    ...(err.data && { data: err.data }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
