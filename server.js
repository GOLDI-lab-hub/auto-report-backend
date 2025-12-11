import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "auto_report_secret_key";

// ===============================
// Helper: Verify Token Middleware
// ===============================
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(403).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ===============================
// Routes
// ===============================

// Test Route
app.get("/", (req, res) => {
  res.send("✅ Auto Report Pro Secure Backend is running with Login + Trial System!");
});

// Register User (for login system)
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 10); // 10 days trial

    const result = await pool.query(
      "INSERT INTO users (email, password, trial_ends_at) VALUES ($1, $2, $3) RETURNING id, email, trial_ends_at",
      [email, hashedPassword, trialEndsAt]
    );

    res.json({ message: "User registered successfully", user: result.rows[0] });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// Login User
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const now = new Date();
    if (now > new Date(user.trial_ends_at)) {
      return res.status(403).json({ error: "Trial expired. Please subscribe." });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Protected Dashboard Route
app.get("/api/dashboard", verifyToken, (req, res) => {
  res.json({ message: Welcome to your secure dashboard, ${req.user.email}! });
});

// Client Management
app.post("/api/clients", verifyToken, async (req, res) => {
  try {
    const { name, email, google_ads_id, meta_ads_id } = req.body;

    const result = await pool.query(
      "INSERT INTO clients (name, email, google_ads_id, meta_ads_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, google_ads_id, meta_ads_id]
    );

    res.json({ message: "Client added successfully", client: result.rows[0] });
  } catch (error) {
    console.error("Error inserting client:", error);
    res.status(500).json({ error: "Server error while adding client" });
  }
});

// ===============================
// Start Server
// ===============================
app.listen(PORT, () => {
  console.log(✅ Auto Report Pro secure backend running on port ${PORT});
});
