import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Test route
app.get("/", (req, res) => {
  res.send("✅ Auto Report Pro Secure Backend is running with Authentication!");
});

// ---------------- AUTH ROUTES ----------------

// Signup Route (with trial start)
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Trial start = current date, trial end = +10 days
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 10);

    await pool.query(
      `INSERT INTO users (name, email, password, trial_start, trial_end) 
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, hashedPassword, trialStart, trialEnd]
    );

    res.json({ message: "Signup successful! Trial started for 10 days." });
  } catch (error) {
    console.error("Error in signup:", error);
    res.status(500).json({ error: "Error during signup" });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign({ id: user.rows[0].id, email: user.rows[0].email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ error: "Error during login" });
  }
});

// Middleware to verify token
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// Example protected route
app.get("/api/dashboard", verifyToken, (req, res) => {
  res.json({ message: `Welcome to your secure dashboard, ${req.user.email}!` });
});

// --------------------------------------------

// Run server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
