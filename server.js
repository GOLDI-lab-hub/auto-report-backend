// ======= AUTO REPORT PRO BACKEND =======
import express from "express";
import pkg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// --- PostgreSQL Connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// === REGISTER ===
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const user = await pool.query(
      `INSERT INTO users (name, email, password, trial_start, trial_end, trial_active)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '10 days', true)
       RETURNING id, name, email`,
      [name, email, hashed]
    );

    // Automatically create empty client entry linked to new user
    await pool.query(
      `INSERT INTO clients (name, email, google_ads_id, meta_ads_id, user_id)
       VALUES ($1, $2, '', '', $3)`,
      [name, email, user.rows[0].id]
    );

    res.json({ message: "Registration successful", user: user.rows[0] });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// === LOGIN ===
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: "Invalid credentials" });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// === ADD CLIENT (Manual or Auto Expansion) ===
app.post("/api/clients", async (req, res) => {
  try {
    const { name, email, google_ads_id, meta_ads_id, user_id } = req.body;

    const result = await pool.query(
      `INSERT INTO clients (name, email, google_ads_id, meta_ads_id, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, email, google_ads_id, meta_ads_id, user_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error saving client:", err);
    res.status(500).json({ error: "Server error while saving client" });
  }
});

// === FORGOT PASSWORD ===
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (user.rows.length === 0)
      return res.status(404).json({ error: "Email not found" });

    const resetToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: "10m" });
    await pool.query("UPDATE users SET reset_token=$1 WHERE email=$2", [
      resetToken,
      email,
    ]);

    // Later we’ll send email with reset link
    res.json({ message: "Password reset link generated", token: resetToken });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// === RESET PASSWORD ===
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET);
    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password=$1, reset_token=NULL WHERE email=$2",
      [hashed, decoded.email]
    );

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Invalid or expired reset link" });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
