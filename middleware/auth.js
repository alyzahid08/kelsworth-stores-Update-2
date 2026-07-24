const jwt = require("jsonwebtoken");

const COOKIE_NAME = "vw_admin_token";
const TOKEN_TTL = "7d";

function signAdminToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

function readToken(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Blocks API routes with a 401 JSON response if not logged in.
function requireAdminApi(req, res, next) {
  const payload = readToken(req);
  if (!payload) return res.status(401).json({ error: "Not authenticated" });
  req.admin = payload;
  next();
}

// Blocks admin HTML pages by redirecting to the login page if not logged in.
function requireAdminPage(req, res, next) {
  const payload = readToken(req);
  if (!payload) return res.redirect("/admin/login.html");
  req.admin = payload;
  next();
}

module.exports = {
  COOKIE_NAME,
  signAdminToken,
  readToken,
  setAuthCookie,
  clearAuthCookie,
  requireAdminApi,
  requireAdminPage,
};
