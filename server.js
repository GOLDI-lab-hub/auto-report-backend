// ===========================
// Auto Report Pro Secure Backend
// ===========================

import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

dotenv.config();

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;

// ===========================
// Middleware
// ===========================
app.use(cors());
app.use(express.json());

// ===========================
// PostgreSQL Connection
// ===========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// ===========================
// Authentication Setup
// ===========================
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ===========================
// Helper: Verify Token Middleware
// ===========================
function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(403).json({ error: "No token provided" });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.userId = decoded.id;
    next();
  });
}

// ===========================
// Routes
// ===========================

// Test route
app.get("/", (req, res) => {
  res.send("✅ Auto Report Pro Secure Backend is running!");
});

// Create client
app.post("/api/clients", verifyToken, async (req, res) => {
  try {
    const { name, email, google_ads_id, meta_ads_id } = req.body;
    const result = await pool.query(
      "INSERT INTO clients (name, email, google_ads_id, meta_ads_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, google_ads_id, meta_ads_id]
    );
    res.json({ message: "Client added successfully!", client: result.rows[0] });
  } catch (error) {
    console.error("Error inserting client:", error);
    res.status(500).json({ error: "Server error while adding client" });
  }
});

// Get all clients (admin only)
app.get("/api/clients", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Server error while fetching clients" });
  }
});

// Login route (simple admin login)
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Hardcoded admin for now (can move to DB later)
    const adminUser = { id: 1, username: "admin", password: "Admin@123" };

    if (username !== adminUser.username || password !== adminUser.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: adminUser.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, message: "Login successful!" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ===========================
// Start Server
// ===========================
app.listen(PORT, () => {
  console.log(`✅ Auto Report Pro secure backend running on port ${PORT}`);
});
