import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Render automatically injects DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test route
app.get("/", (req, res) => {
  res.send("🚀 Auto Report Pro backend running successfully!");
});

// Route to add client
app.post("/add-client", async (req, res) => {
  const { name, email, googleAdsId, metaAdsId } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  try {
    await pool.query(
      "INSERT INTO clients (name, email, google_ads_id, meta_ads_id) VALUES ($1, $2, $3, $4)",
      [name, email, googleAdsId, metaAdsId]
    );
    res.json({ message: "Client saved successfully" });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
