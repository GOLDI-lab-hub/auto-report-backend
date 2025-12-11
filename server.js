import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Connect PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Root check route
app.get("/", (req, res) => {
  res.send("✅ Auto Report Pro Secure Backend is running with Login + Trial system!");
});

// ✅ Signup (10-day trial)
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 10); // 10-day free trial

    const result = await pool.query(
      "INSERT INTO users (name, email, password, trial_end, is_paid) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, email, hashedPassword, trialEnd, false]
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully! Trial active for 10 days.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, error: "Server error during signup" });
  }
});

// ✅ Login (with trial validation)
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    // Trial expiration check
    const today = new Date();
    const trialEnd = new Date(user.trial_end);
    if (today > trialEnd && !user.is_paid) {
      return res
        .status(403)
        .json({ success: false, message: "Trial expired. Please subscribe." });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "10d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      trial_end: user.trial_end,
      is_paid: user.is_paid,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Server error during login" });
  }
});

// ✅ JWT middleware
function verifyToken(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(403).json({ success: false, message: "No token provided" });

  const token = header.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: "Invalid or expired token" });
    req.userId = decoded.userId;
    next();
  });
}

// ✅ Add Client (protected)
app.post("/add-client", verifyToken, async (req, res) => {
  try {
    const { name, email, googleAdsId, metaAdsId } = req.body;
    const result = await pool.query(
      "INSERT INTO clients (name, email, google_ads_id, meta_ads_id, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, email, googleAdsId, metaAdsId, req.userId]
    );

    res.json({
      success: true,
      message: "Client added successfully!",
      client: result.rows[0],
    });
  } catch (error) {
    console.error("Error adding client:", error);
    res.status(500).json({ success: false, error: "Server error while adding client" });
  }
});

// ✅ Get clients for logged-in user
app.get("/clients", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients WHERE user_id = $1 ORDER BY id DESC", [
      req.userId,
    ]);
    res.json({ success: true, clients: result.rows });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ success: false, error: "Server error while fetching clients" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Auto Report Pro Backend running securely on port ${PORT}`);
});
