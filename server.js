import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Root route
app.get("/", (req, res) => {
  res.send("✅ Auto Report Pro Secure Backend is running with Authentication + Trial System!");
});

/* =======================================================
   🔐 AUTHENTICATION + TRIAL SYSTEM
======================================================= */

// Register new user
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, trial_start, trial_end, trial_active)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '10 days', TRUE)
       RETURNING id, email, trial_end`,
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: "User registered successfully. 10-day trial started!",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error registering user:", error);
    res.status(500).json({ message: "Server error while registering user." });
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(400).json({ message: "Invalid email or password." });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password." });

    const now = new Date();
    const trialExpired = new Date(user.trial_end) < now;

    if (trialExpired || !user.trial_active) {
      await pool.query("UPDATE users SET trial_active = FALSE WHERE email = $1", [email]);
      return res.status(403).json({ message: "Trial expired. Please subscribe to continue." });
    }

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful!", token });
  } catch (error) {
    console.error("❌ Error logging in:", error);
    res.status(500).json({ message: "Server error while logging in." });
  }
});

// Middleware for token verification
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token." });
    req.user = user;
    next();
  });
}

/* =======================================================
   🧾 CLIENT MANAGEMENT (Your existing working logic)
======================================================= */

// Add new client
app.post("/api/clients", verifyToken, async (req, res) => {
  const { name, email, google_ads_id, meta_ads_id } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO clients (name, email, google_ads_id, meta_ads_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, google_ads_id, meta_ads_id]
    );

    res.status(201).json({ message: "Client saved successfully!", client: result.rows[0] });
  } catch (error) {
    console.error("❌ Error inserting client:", error);
    res.status(500).json({ message: "Server error while saving client." });
  }
});

// Get all clients
app.get("/api/clients", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients");
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching clients:", error);
    res.status(500).json({ message: "Server error while fetching clients." });
  }
});

/* =======================================================
   🚀 START SERVER
======================================================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
