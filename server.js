import express from "express";
import cors from "cors";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const { Pool } = pkg;
const app = express();
app.use(cors());
app.use(express.json());

// ✅ Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Health Check Route (for Render)
app.get("/", (req, res) => {
  res.send("✅ Auto Report Backend is running!");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ User Registration
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0)
      return res.status(400).json({ message: "User already exists" });

    await pool.query(
      "INSERT INTO users (email, password, trial_start, trial_end, trial_active) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '10 days', TRUE)",
      [email, hashedPassword]
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// ✅ Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0)
      return res.status(400).json({ message: "Invalid email or password" });

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "secretkey", {
      expiresIn: "1h",
    });

    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("Error logging in:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

// ✅ Forgot Password (Reset)
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hashedPassword, email]);
    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ message: "Server error during password reset" });
  }
});

// ✅ Save Client (linked to user)
app.post("/api/clients", async (req, res) => {
  try {
    const { name, email, google_ads_id, meta_ads_id, user_id } = req.body;

    if (!user_id) return res.status(400).json({ message: "Missing user ID" });

    await pool.query(
      "INSERT INTO clients (name, email, google_ads_id, meta_ads_id, user_id) VALUES ($1, $2, $3, $4, $5)",
      [name, email, google_ads_id, meta_ads_id, user_id]
    );

    res.status(201).json({ message: "Client saved successfully" });
  } catch (err) {
    console.error("Error saving client:", err);
    res.status(500).json({ message: "Server error while saving client" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
