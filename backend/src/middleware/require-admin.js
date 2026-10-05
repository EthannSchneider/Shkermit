export function requireAdmin(request, response, next) {
  if (!request.user?.isAdmin) {
    return response.status(403).json({ error: "Administrator access required." });
  }
  next();
}
