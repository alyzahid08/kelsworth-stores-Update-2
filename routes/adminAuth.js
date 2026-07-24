const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db");
const { signAdminToken, setAuthCookie, clearAuthCookie, requireAdminApi } = require("../middleware/auth");

const router = express.Router();

// POST /api/admin/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  try {
    const { rows } = await query("SELECT * FROM admin_users WHERE username = $1", [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Incorrect username or password" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Incorrect username or password" });

    const token = signAdminToken(user);
    setAuthCookie(res, token);
    res.json({ username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/admin/logout
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/admin/me — used by the admin panel to check if the session is valid
router.get("/me", requireAdminApi, (req, res) => {
  res.json({ username: req.admin.username });
});

// POST /api/admin/change-password
router.post("/change-password", requireAdminApi, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }
  try {
    const { rows } = await query("SELECT * FROM admin_users WHERE id = $1", [req.admin.sub]);
    const user = rows[0];
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    const hash = await bcrypt.hash(newPassword, 10);
    await query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [hash, user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not change password" });
  }
});

module.exports = router;
