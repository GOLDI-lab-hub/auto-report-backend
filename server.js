import express from "express";
import cors from "cors";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// ============================
// Database Connection
// ============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ Database connection error:", err));

// ============================
// Default Route
// ============================
app.get("/api/health", (req, res) => {
  res.json({ status: "Backend running smoothly ✅" });
});

// ============================
// Register
// ============================
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// ============================
// Login
// ============================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user_id: user.rows[0].id,
      name: user.rows[0].name,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// ============================
// Add New Client (Linked to User)
// ============================
app.post("/api/clients", async (req, res) => {
  try {
    const { name, email, google_ads_id, meta_ads_id, user_id } = req.body;

    // ✅ Check if all required fields are present
    if (!name || !email || !google_ads_id || !meta_ads_id || !user_id) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ Insert into database
    const result = await pool.query(
      "INSERT INTO clients (name, email, google_ads_id, meta_ads_id, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, email, google_ads_id, meta_ads_id, user_id]
    );

    res.status(201).json({
      success: true,
      message: "Client saved successfully!",
      client: result.rows[0],
    });
  } catch (error) {
    console.error("Error saving client:", error);
    res.status(500).json({ message: "Server error while saving client" });
  }
});

// ============================
// Forgot Password (Basic Setup)
// ============================
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });
  res.json({ message: "Password reset email would be sent (demo setup)" });
});

// ============================
// Server Listen
// ============================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(🚀 Server running on port ${PORT}));
