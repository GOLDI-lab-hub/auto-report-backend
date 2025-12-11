// ===== Import Required Modules =====
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ===== Initialize and Configure =====
const { Pool } = pkg;
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== Database Connection =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ===== Root Test Route =====
app.get("/", (req, res) => {
  res.send("✅ Auto Report Pro Secure Backend is running with Authentication + Trial system!");
});

// ===== Helper: Token Verification =====
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Access denied, token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// ===== Login (example route, temporary) =====
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const user = result.rows[0];
    const validPass = await bcrypt.compare(password, user.password);

    if (!validPass)
      return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ===== Create Client =====
app.post("/api/clients", async (req, res) => {
  try {
    const { name, email, googleAdsId, metaAdsId } = req.body;

    const result = await pool.query(
      "INSERT INTO clients (name, email, google_ads_id, meta_ads_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, googleAdsId, metaAdsId]
    );

    res.status(200).json({
      message: "Client added successfully",
      client: result.rows[0],
    });
  } catch (error) {
    console.error("Error inserting client:", error);
    res.status(500).json({ error: "Server error while adding client" });
  }
});

// ===== Get All Clients =====
app.get("/api/clients", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Error fetching clients" });
  }
});

// ===== Trial Tracking Example =====
app.post("/api/start-trial", async (req, res) => {
  try {
    const { email } = req.body;
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 10); // 10-day trial

    await pool.query(
      "INSERT INTO trials (email, trial_end) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET trial_end = $2",
      [email, trialEnds]
    );

    res.json({ message: "Trial started", trialEnds });
  } catch (error) {
    console.error("Error starting trial:", error);
    res.status(500).json({ error: "Server error while starting trial" });
  }
});

// ===== Start Server =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Auto Report Pro backend running on port ${PORT}`);
});
