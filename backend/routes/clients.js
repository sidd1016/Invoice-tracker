import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

function monthNameToNumber(name) {
  const calendarOrder = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return calendarOrder.indexOf(name) + 1;
}

// GET /api/companies/:companyId/clients  (used by upload dropdown + client list)
router.get("/company/:companyId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select cl.id, cl.name,
              coalesce(sum(i.sales_total), 0)  as total_sales,
              coalesce(sum(i.profit_total), 0) as total_profit,
              count(i.id) as invoice_count
       from clients cl
       left join invoices i on i.client_id = cl.id and i.is_current = true
       where cl.company_id = $1
       group by cl.id, cl.name
       order by cl.name`,
      [req.params.companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load clients" });
  }
});

// POST /api/companies/:companyId/clients  { name }
router.post("/company/:companyId", async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Client name is required" });
  try {
    const { rows } = await pool.query(
      "insert into clients (company_id, name) values ($1, $2) returning id, name",
      [req.params.companyId, name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "This client already exists for the company" });
    console.error(err);
    res.status(500).json({ error: "Failed to create client" });
  }
});

// GET /api/clients/:id?month=
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const { month } = req.query;
  try {
    const clientRes = await pool.query(
      `select cl.id, cl.name, cl.company_id, c.name as company_name
       from clients cl join companies c on c.id = cl.company_id
       where cl.id = $1`,
      [id]
    );
    if (clientRes.rows.length === 0) return res.status(404).json({ error: "Client not found" });

    const params = [id];
    let where = "where i.client_id = $1 and i.is_current = true";
    if (month && month !== "All") {
      params.push(monthNameToNumber(month));
      where += ` and extract(month from i.invoice_date) = $${params.length}`;
    }

    const totalsRes = await pool.query(
      `select coalesce(sum(sales_total), 0) as total_sales,
              coalesce(sum(purchase_total), 0) as total_purchase,
              coalesce(sum(profit_total), 0) as total_profit,
              count(*) as invoice_count,
              max(invoice_date) as last_invoice_date
       from invoices i ${where}`,
      params
    );

    const invoicesRes = await pool.query(
      `select id, invoice_number, invoice_date, sales_total, purchase_total, profit_total, gst_total
       from invoices i ${where}
       order by invoice_date desc`,
      params
    );

    const t = totalsRes.rows[0];
    const avgMargin = Number(t.total_sales) > 0
      ? round2((Number(t.total_profit) / Number(t.total_sales)) * 100)
      : 0;

    res.json({
      client: clientRes.rows[0],
      totals: {
        totalSales: Number(t.total_sales),
        totalPurchase: Number(t.total_purchase),
        totalProfit: Number(t.total_profit),
        invoiceCount: Number(t.invoice_count),
        averageMargin: avgMargin,
        lastInvoiceDate: t.last_invoice_date
      },
      invoices: invoicesRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load client" });
  }
});

// GET /api/clients/:id/payments — all payments across this client's invoices, with running totals
router.get("/:id/payments", async (req, res) => {
  try {
    const clientRes = await pool.query("select id, name, company_id from clients where id = $1", [req.params.id]);
    if (clientRes.rows.length === 0) return res.status(404).json({ error: "Client not found" });

    const invoiceTotalsRes = await pool.query(
      `select coalesce(sum(sales_total + gst_total), 0) as total_invoiced
       from invoices where client_id = $1 and is_current = true`,
      [req.params.id]
    );

    const paymentsRes = await pool.query(
      `select p.id, p.amount, p.payment_date, p.payment_type, p.notes,
              i.id as invoice_id, i.invoice_number, i.invoice_date,
              (i.sales_total + i.gst_total) as invoice_grand_total
       from invoice_payments p
       join invoices i on i.id = p.invoice_id
       where i.client_id = $1 and i.is_current = true
       order by p.payment_date desc, p.created_at desc`,
      [req.params.id]
    );

    const totalReceived = round2(paymentsRes.rows.reduce((sum, p) => sum + Number(p.amount), 0));
    const totalInvoiced = round2(Number(invoiceTotalsRes.rows[0].total_invoiced));

    res.json({
      client: clientRes.rows[0],
      payments: paymentsRes.rows,
      summary: {
        totalInvoiced,
        totalReceived,
        balanceDue: round2(totalInvoiced - totalReceived)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load payment history" });
  }
});

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default router;
