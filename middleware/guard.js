/**
 * Block unauthenticated users from non-public routes.
 */
export function routeGuard(req, res, next) {
  const publicPaths = ["/login", "/register", "/email", "/config", "/me", "/lesson"];
  const isPublic =
    publicPaths.some((p) => req.path.startsWith(p)) ||
    req.method === "OPTIONS" ||
    req.path.endsWith(".js") ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".map") ||
    req.path.startsWith("/assets/");

  if (isPublic) return next();
  if (!req.user) return res.status(403).redirect("/login");
  next();
}

/**
 * Factory: require one of the listed roles.
 * Usage: requireRole("admin")  or  requireRole("admin", "teacher")
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}
