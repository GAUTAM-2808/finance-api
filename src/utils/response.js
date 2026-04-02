/**
 * Consistent response shape helpers.
 * Every success: { success: true, data: ... }
 * Every error:   { success: false, error: { code, message, details? } }
 */

function sendJSON(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "X-Powered-By": "finance-api",
  });
  res.end(payload);
}

function ok(res, data, status = 200) {
  sendJSON(res, status, { success: true, data });
}

function created(res, data) {
  ok(res, data, 201);
}

function noContent(res) {
  res.writeHead(204);
  res.end();
}

function error(res, status, message, details) {
  const codes = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "UNPROCESSABLE",
    500: "INTERNAL_ERROR",
  };
  const body = { success: false, error: { code: codes[status] ?? "ERROR", message } };
  if (details) body.error.details = details;
  sendJSON(res, status, body);
}

function badRequest(res, message, details) { error(res, 400, message, details); }
function unauthorized(res, msg = "Authentication required") { error(res, 401, msg); }
function forbidden(res, msg = "You do not have permission to perform this action") { error(res, 403, msg); }
function notFound(res, msg = "Resource not found") { error(res, 404, msg); }
function conflict(res, msg) { error(res, 409, msg); }
function internalError(res, msg = "An unexpected error occurred") { error(res, 500, msg); }

module.exports = { ok, created, noContent, badRequest, unauthorized, forbidden, notFound, conflict, internalError, error };
