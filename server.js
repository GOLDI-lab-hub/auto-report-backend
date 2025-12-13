// =======================
// Auto Report Backend (Updated)
// =======================

import express from "express";
import cors from "cors";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const { Pool } = pkg;

app.use(cors());
app.use(express.json());

// =======================
// DATABASE CONNECTION
// =======================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ Database connection error:", err));

// =======================
// REGISTER
// =======================
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, email",
      [name, email, hashedPassword]
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// =======================
// LOGIN
// =======================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: "2h" });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user_id: user.rows[0].id,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// =======================
// FORGOT PASSWORD
// =======================
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password required" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const result = await pool.query("UPDATE users SET password = $1 WHERE email = $2 RETURNING id", [hashed, email]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error during password reset" });
  }
});

// =======================
// ADD CLIENT (Linked to user)
// =======================
app.post("/api/clients", async (req, res) => {
  try {
    const { name, email, google_ads_id, meta_ads_id, user_id } = req.body;

    // 🧩 Validation
    if (!name || !email || !google_ads_id || !meta_ads_id || !user_id) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const result = await pool.query(
      `INSERT INTO clients (name, email, google_ads_id, meta_ads_id, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, google_ads_id, meta_ads_id, user_id`,
      [name, email, google_ads_id, meta_ads_id, user_id]
    );

    res.status(201).json({
      success: true,
      message: "Client saved successfully",
      client: result.rows[0],
    });
  } catch (error) {
    console.error("Error saving client:", error);
    res.status(500).json({ message: "Server error while saving client" });
  }
});

// =======================
// HEALTH CHECK
// =======================
app.get("/api/health", (req, res) => {
  res.json({ status: "Server running fine ✅" });
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(🚀 Server running on port ${PORT}));
