import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

dotenv.config();

const { Pool } = pkg;
const app = express();
app.use(cors());
app.use(express.json());

// ✅ PostgreSQL connection (same as before)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ✅ Root route
app.get("/", (req, res) => {
  res.send("🚀 Auto Report Pro Secure Backend is running with Auto-Register + Password Reset!");
});

// ✅ Manual Register (still optional)
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
      [name, email, hashedPassword]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

// ✅ Auto-register Login
app.post("/api/login", async (req, res) => {
  const { email, password, name } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    let user;

    if (result.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const insertResult = await pool.query(
        "INSERT INTO users (name, email, password, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
        [name || email.split("@")[0], email, hashedPassword]
      );
      user = insertResult.rows[0];
    } else {
      user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// ✅ Forgot Password: Request reset
app.post("/api/request-reset", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    await pool.query(
      "UPDATE users SET reset_token = $1, reset_expires = $2 WHERE email = $3",
      [hashedToken, expiry, email]
    );

    // ✅ In real setup: send resetToken by email — for now, return in response for testing
    res.json({
      message: "Password reset link generated successfully",
      resetToken,
      note: "Use this token in /api/reset-password within 15 minutes",
    });
  } catch (error) {
    console.error("Reset request error:", error);
    res.status(500).json({ message: "Error generating password reset" });
  }
});

// ✅ Reset Password: Confirm token and update
app.post("/api/reset-password", async (req, res) => {
  const { email, token, newPassword } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = result.rows[0];
    if (!user.reset_token || !user.reset_expires) {
      return res.status(400).json({ message: "No reset request found" });
    }

    if (new Date(user.reset_expires) < new Date()) {
      return res.status(400).json({ message: "Reset token expired" });
    }

    const isMatch = await bcrypt.compare(token, user.reset_token);
    if (!isMatch) return res.status(400).json({ message: "Invalid reset token" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_expires = NULL WHERE email = $2",
      [hashedPassword, email]
    );

    res.json({ message: "Password reset successful. You can now log in with your new password." });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// ✅ Save client (linked to logged-in user)
app.post("/api/clients", authenticateToken, async (req, res) => {
  const { client_name, client_email, google_ads_id, meta_ads_id } = req.body;
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      "INSERT INTO clients (user_id, client_name, client_email, google_ads_id, meta_ads_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [user_id, client_name, client_email, google_ads_id, meta_ads_id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error saving client:", error);
    res.status(500).json({ message: "Error saving client" });
  }
});

// ✅ Get all clients for the logged-in user
app.get("/api/clients", authenticateToken, async (req, res) => {
  const user_id = req.user.id;
  try {
    const result = await pool.query("SELECT * FROM clients WHERE user_id = $1", [user_id]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ message: "Error fetching clients" });
  }
});

// ✅ Server Listen
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
