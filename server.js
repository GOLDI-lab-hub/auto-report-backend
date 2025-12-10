import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ✅ Root route for testing
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Auto Report Pro backend running successfully!" });
});

// ✅ Add new client route
app.post("/api/clients", async (req, res) => {
  try {
    const { client_name, client_email, google_ads_id, meta_ads_id } = req.body;

    if (!client_name || !client_email) {
      return res.status(400).json({ error: "Client name and email are required" });
    }

    const query = `
      INSERT INTO clients (client_name, client_email, google_ads_id, meta_ads_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query(query, [client_name, client_email, google_ads_id, meta_ads_id]);

    res.status(201).json({ success: true, client: result.rows[0] });
  } catch (error) {
    console.error("❌ Error adding client:", error.message);
    res.status(500).json({ error: "Server error while adding client" });
  }
});

// ✅ Get all clients route
app.get("/api/clients", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching clients:", error.message);
    res.status(500).json({ error: "Server error while fetching clients" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Auto Report Pro backend running on port ${PORT}`);
});
