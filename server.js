// ===========================
// Auto Report Pro - Secure Backend
// ===========================

// Import dependencies
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Initialize app
const app = express();
app.use(cors());
app.use(express.json());

// Load environment variables (securely from Render)
const PORT = process.env.PORT || 4000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

// PostgreSQL Connection
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// ===========================
// Health Check Endpoint
// ===========================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend secure and running!" });
});

// ===========================
// Admin Authentication Middleware
// ===========================
function authenticateAdmin(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== ADMIN_API_KEY) {
    return res.status(403).json({ error: "Unauthorized access" });
  }
  next();
}

// ===========================
// User Routes
// ===========================

// Register new user (Client)
app.post("/api/clients", async (req, res) => {
  try {
    const { name, email, company, password } = req.body;

    if (!name || !email || !company || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO clients (name, email, company, password) VALUES ($1, $2, $3, $4)",
      [name, email, company, hashedPassword]
    );

    res.json({ message: "✅ Client saved successfully" });
  } catch (error) {
    console.error("Error saving client:", error);
    res.status(500).json({ error: "Server error while saving client" });
  }
});

// Get all clients (Admin only)
app.get("/api/clients", authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, company FROM clients");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Server error fetching clients" });
  }
});

// ===========================
// JWT Login Example (Future use)
// ===========================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM clients WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const client = result.rows[0];
    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ clientId: client.id }, JWT_SECRET, { expiresIn: "7d" });
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
  console.log(✅ Auto Report Pro secure backend running on port ${PORT});
});
