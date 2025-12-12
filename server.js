// server.js
import express from "express";
import cors from "cors";
import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Health check
app.get("/api/health", (req, res) => {
  res.send("✅ Backend is running fine!");
});

// ======================= REGISTER =======================
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log("📩 Received registration data:", { name, email, password });

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields (name, email, password) are required." });
    }

    // Check if user already exists
    const existingUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    const result = await pool.query(
      `INSERT INTO users (name, email, password, trial_start, trial_end, trial_active)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '10 days', TRUE)
       RETURNING id, name, email, trial_start, trial_end, trial_active`,
      [name, email, hashedPassword]
    );

    console.log("✅ User created:", result.rows[0]);
    res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
  } catch (error) {
    console.error("❌ Error registering user:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// ======================= LOGIN =======================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({ message: "Login successful", user });
  } catch (error) {
    console.error("❌ Error logging in:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// ======================= SAVE CLIENT =======================
app.post("/api/clients", async (req, res) => {
  try {
    const { name, email, google_ads_id, meta_ads_id, user_id } = req.body;

    if (!name || !email || !google_ads_id || !meta_ads_id || !user_id) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const result = await pool.query(
      `INSERT INTO clients (name, email, google_ads_id, meta_ads_id, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, google_ads_id, meta_ads_id, user_id]
    );

    res.status(201).json({ message: "Client saved successfully", client: result.rows[0] });
  } catch (error) {
    console.error("❌ Error saving client:", error);
    res.status(500).json({ message: "Server error while saving client" });
  }
});

// ========================
// FORGOT PASSWORD
// ========================
app.post("/api/forgot-password", async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: "Email and new password are required" });
  }

  try {
    // Check if user exists
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hashedPassword, email]);

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



// ======================= START SERVER =======================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port: ${PORT}`));
