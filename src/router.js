/**
 * Tiny router that supports path parameters (:id) and middleware chains.
 * No dependencies. Minimal surface area.
 */

class Router {
  constructor() {
    this._routes = []; // { method, pattern, paramNames, handlers[] }
  }

  _add(method, path, handlers) {
    // Convert "/users/:id/records/:rid" → regex + param name list
    const paramNames = [];
    const regexStr = path
      .replace(/:([a-zA-Z_]+)/g, (_, name) => {
        paramNames.push(name);
        return "([^/]+)";
      })
      .replace(/\//g, "\\/");
    const pattern = new RegExp(`^${regexStr}$`);
    this._routes.push({ method: method.toUpperCase(), pattern, paramNames, handlers });
  }

  get(path, ...handlers)    { this._add("GET",    path, handlers); }
  post(path, ...handlers)   { this._add("POST",   path, handlers); }
  put(path, ...handlers)    { this._add("PUT",    path, handlers); }
  patch(path, ...handlers)  { this._add("PATCH",  path, handlers); }
  delete(path, ...handlers) { this._add("DELETE", path, handlers); }

  /**
   * Handle an incoming request. Returns true if a route matched, false otherwise.
   */
  handle(req, res) {
    for (const route of this._routes) {
      if (route.method !== req.method) continue;
      const match = req.path.match(route.pattern);
      if (!match) continue;

      req.params = {};
      route.paramNames.forEach((name, i) => {
        req.params[name] = match[i + 1];
      });

      // Run middleware chain
      let idx = 0;
      const next = (err) => {
        if (err) {
          const { internalError } = require("./utils/response");
          console.error("[Unhandled middleware error]", err);
          internalError(res);
          return;
        }
        const handler = route.handlers[idx++];
        if (handler) handler(req, res, next);
      };
      next();
      return true;
    }
    return false;
  }
}

module.exports = Router;
