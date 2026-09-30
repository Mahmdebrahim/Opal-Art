const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { UnauthorizedError, ForbiddenError } = require("../utils/api-error");
const catchAsync = require("../utils/catch-async");
const M = require("../utils/messages");

const createAccessTokenError = (jwtError) => {
  const isExpired = jwtError?.name === "TokenExpiredError";
  const authError = new UnauthorizedError(
    isExpired ? M.auth.expiredToken : M.auth.invalidToken,
  );
  if (isExpired) authError.authErrorCode = "ACCESS_TOKEN_EXPIRED";
  return authError;
};

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
    throw createAccessTokenError(err);
  }

  // Check if user still exists
  const currentUser = await User.findById(decoded.userId).select("+isActive");

  if (!currentUser) {
    throw new UnauthorizedError(M.auth.userNotFound);
  }

  if (currentUser.isBanned) {
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

  if (!currentUser.emailVerified) {
    throw new UnauthorizedError(M.auth.emailNotVerified);
  }

  req.user = currentUser;
  next();
});

// restrictTo - Role-based access control
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError(M.general.forbidden));
    }
    return next();
  };
};

module.exports = { protect, restrictTo, optionalAuth, createAccessTokenError };
