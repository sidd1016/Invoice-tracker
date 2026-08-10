import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// DATABASE_URL comes from Supabase: Project Settings -> Database -> Connection string (URI)
// Use the "Transaction" pooler URL on Render's free tier to avoid connection limits.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error", err);
});

export default pool;
