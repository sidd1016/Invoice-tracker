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

// GET /api/companies?fy=2025-26&month=All
router.get("/", async (req, res) => {
  const { fy, month } = req.query;
  try {
    const params = [];
    let where = "where i.is_current = true";
    if (fy) {
      params.push(fy);
      where += ` and i.financial_year = $${params.length}`;
    }
    if (month && month !== "All") {
      params.push(monthNameToNumber(month));
      where += ` and extract(month from i.invoice_date) = $${params.length}`;
    }

    const { rows } = await pool.query(
      `select c.id, c.name,
              coalesce(sum(i.sales_total), 0)    as total_sales,
              coalesce(sum(i.purchase_total), 0) as total_purchase,
              coalesce(sum(i.profit_total), 0)   as total_profit,
              count(distinct i.id)               as invoice_count,
              count(distinct i.client_id)        as client_count
       from companies c
       left join invoices i on i.company_id = c.id ${where}
       group by c.id, c.name
       order by c.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load companies" });
  }
});

// POST /api/companies  { name }
router.post("/", async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Company name is required" });
  try {
    const { rows } = await pool.query(
      "insert into companies (name) values ($1) returning id, name",
      [name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A company with this name already exists" });
    console.error(err);
    res.status(500).json({ error: "Failed to create company" });
  }
});

// GET /api/companies/:id?fy=&month=
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const { fy, month } = req.query;
  try {
    const params = [id];
    let where = "where i.company_id = $1 and i.is_current = true";
    if (fy) {
      params.push(fy);
      where += ` and i.financial_year = $${params.length}`;
    }
    if (month && month !== "All") {
      params.push(monthNameToNumber(month));
      where += ` and extract(month from i.invoice_date) = $${params.length}`;
    }

    const companyRes = await pool.query("select id, name from companies where id = $1", [id]);
    if (companyRes.rows.length === 0) return res.status(404).json({ error: "Company not found" });

    const totalsRes = await pool.query(
      `select coalesce(sum(sales_total), 0)    as total_sales,
              coalesce(sum(purchase_total), 0) as total_purchase,
              coalesce(sum(profit_total), 0)   as total_profit,
              coalesce(sum(gst_total), 0)      as gst_collected,
              count(*)                         as invoice_count,
              count(distinct client_id)        as client_count
       from invoices i ${where}`,
      params
    );

    // GST paid = GST embedded in purchase side. We approximate using item-level
    // gst_percent applied to purchase_amount, since GST % is captured per line item.
    const gstPaidRes = await pool.query(
      `select coalesce(sum(ii.purchase_amount * ii.gst_percent / 100), 0) as gst_paid
       from invoice_items ii
       join invoices i on i.id = ii.invoice_id ${where}`,
      params
    );

    const recentInvoicesRes = await pool.query(
      `select i.id, i.invoice_number, i.invoice_date, i.sales_total, i.profit_total, cl.name as client_name
       from invoices i join clients cl on cl.id = i.client_id ${where}
       order by i.invoice_date desc, i.created_at desc
       limit 10`,
      params
    );

    const topClientsRes = await pool.query(
      `select cl.id, cl.name,
              sum(i.sales_total) as total_sales,
              sum(i.profit_total) as total_profit,
              count(i.id) as invoice_count
       from invoices i join clients cl on cl.id = i.client_id ${where}
       group by cl.id, cl.name
       order by total_sales desc
       limit 5`,
      params
    );

    const totals = totalsRes.rows[0];
    const margin = Number(totals.total_sales) > 0
      ? round2((Number(totals.total_profit) / Number(totals.total_sales)) * 100)
      : 0;

    res.json({
      company: companyRes.rows[0],
      totals: {
        totalSales: Number(totals.total_sales),
        totalPurchase: Number(totals.total_purchase),
        grossProfit: Number(totals.total_profit),
        profitMargin: margin,
        gstCollected: Number(totals.gst_collected),
        gstPaid: Number(gstPaidRes.rows[0].gst_paid),
        invoiceCount: Number(totals.invoice_count),
        clientCount: Number(totals.client_count)
      },
      recentInvoices: recentInvoicesRes.rows,
      topClients: topClientsRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load company dashboard" });
  }
});

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default router;
