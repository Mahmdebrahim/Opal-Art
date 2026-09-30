export function getSessionErrorStatus(error) {
  return error?.response?.status ?? error?.status ?? null;
}

export function isTemporarySessionError(error) {
  const status = getSessionErrorStatus(error);
  return (
    status === null ||
    status === 0 ||
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

export function isDefinitiveSessionError(error) {
  const status = getSessionErrorStatus(error);
  return status === 401 || status === 403;
}

export function isAccessTokenExpiredResponse(data) {
  return data?.authErrorCode === "ACCESS_TOKEN_EXPIRED";
}