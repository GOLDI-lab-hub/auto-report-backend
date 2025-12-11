import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// ✅ PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Root route
app.get("/", (req, res) => {
  res.send("✅ Auto Report Pro Secure Backend is running!");
});

// ✅ Add Client route (frontend expects /add-client)
app.post("/add-client", async (req, res) => {
  try {
    const { name, email, googleAdsId, metaAdsId } = req.body;

    // Insert client details into the database
    const result = await pool.query(
      "INSERT INTO clients (name, email, google_ads_id, meta_ads_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, googleAdsId, metaAdsId]
    );

    res.json({ success: true, client: result.rows[0], message: "Client saved successfully!" });
  } catch (error) {
    console.error("❌ Error saving client:", error);
    res.status(500).json({ success: false, error: "Server error while saving client" });
  }
});

// ✅ Get All Clients (optional route for viewing data)
app.get("/clients", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching clients:", error);
    res.status(500).json({ error: "Server error while fetching clients" });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(✅ Auto Report Pro Secure Backend running on port ${PORT});
});
