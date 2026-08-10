import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

// GET /api/search?q=
router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json({ invoices: [], clients: [], products: [] });
  const like = `%${q}%`;

  try {
    const [invoicesRes, clientsRes, productsRes] = await Promise.all([
      pool.query(
        `select i.id, i.invoice_number, i.invoice_date, c.name as company_name, cl.name as client_name
         from invoices i
         join companies c on c.id = i.company_id
         join clients cl on cl.id = i.client_id
         where i.is_current = true and i.invoice_number ilike $1
         limit 10`,
        [like]
      ),
      pool.query(
        `select cl.id, cl.name, c.name as company_name
         from clients cl join companies c on c.id = cl.company_id
         where cl.name ilike $1 limit 10`,
        [like]
      ),
      pool.query(
        `select distinct ii.product_name
         from invoice_items ii
         where ii.product_name ilike $1 limit 10`,
        [like]
      )
    ]);

    res.json({
      invoices: invoicesRes.rows,
      clients: clientsRes.rows,
      products: productsRes.rows.map((r) => r.product_name)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
