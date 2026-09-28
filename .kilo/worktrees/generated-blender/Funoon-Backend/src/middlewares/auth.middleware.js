const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { UnauthorizedError, ForbiddenError } = require("../utils/api-error");
const catchAsync = require("../utils/catch-async");
const M = require("../utils/messages");

const optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.userId).select(
        "+isActive",
      );

      if (currentUser && currentUser.isActive && !currentUser.isBanned) {
        req.user = currentUser;
      }
    } catch (err) {
      // تجاهل
    }
  }

  next();
});

// protect - Verify JWT and attach user to request
const protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new UnauthorizedError(M.auth.notLoggedIn);
  }

  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new UnauthorizedError(M.auth.invalidToken);
  }

  // Check if user still exists
  const currentUser = await User.findById(decoded.userId).select("+isActive");

  if (!currentUser) {
    // ✅ الأول: user موجود؟
    throw new UnauthorizedError(M.auth.userNotFound);
  }

  if (currentUser.isBanned) {
    // ✅ بعدين: محظور؟
    throw new UnauthorizedError(M.auth.accountBanned);
  }

  if (!currentUser.isActive) {
    throw new UnauthorizedError(M.auth.accountDisabled);
  }

  if (currentUser.passwordChangedAt) {
    const changedTimestamp = parseInt(
      currentUser.passwordChangedAt.getTime() / 1000,
      10,
    );
    if (decoded.iat < changedTimestamp) {
      throw new UnauthorizedError(M.auth.passwordRecentlyChanged);
    }
  }

  // ✅ تحقق من تأكيد البريد — المستخدمون القدامى (emailVerified: true) يكملون عادي
  if (!currentUser.emailVerified) {
    throw new UnauthorizedError(M.auth.emailNotVerified);
  }

  req.user = currentUser;
  next();
});

// restrictTo - Role-based access control
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(M.general.forbidden);
    }
    next();
  };
};

module.exports = { protect, restrictTo, optionalAuth };
