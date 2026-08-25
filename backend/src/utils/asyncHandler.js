/**
 * Wraps an async Express route handler so a rejected promise is forwarded
 * to next(err) instead of becoming an unhandled rejection. Express 4
 * doesn't await async handlers itself, so without this, any awaited call
 * that rejects (e.g. a transient DB/network error) crashes the whole
 * process instead of just failing that one request.
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
