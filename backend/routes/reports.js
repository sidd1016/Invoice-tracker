import { Router } from "express";
import XLSX from "xlsx";
import pool from "../db/pool.js";

const router = Router();

function fyClause(fy, params) {
  if (!fy) return "";
  params.push(fy);
  return ` and i.financial_year = $${params.length}`;
}

// GET /api/reports/company-wise?fy=
router.get("/company-wise", async (req, res) => {
  const params = [];
  const fy = fyClause(req.query.fy, params);
  try {
    const { rows } = await pool.query(
      `select c.name as company, sum(i.sales_total) as sales, sum(i.purchase_total) as purchase, sum(i.profit_total) as profit
       from invoices i join companies c on c.id = i.company_id
       where i.is_current = true ${fy}
       group by c.name order by sales desc`,
      params
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load report" }); }
});

// GET /api/reports/client-wise?companyId=&fy=
router.get("/client-wise", async (req, res) => {
  const params = [req.query.companyId];
  const fy = fyClause(req.query.fy, params);
  try {
    const { rows } = await pool.query(
      `select cl.name as client, sum(i.sales_total) as sales, sum(i.profit_total) as profit, count(i.id) as invoice_count
       from invoices i join clients cl on cl.id = i.client_id
       where i.company_id = $1 and i.is_current = true ${fy}
       group by cl.name order by sales desc`,
      params
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load report" }); }
});

// GET /api/reports/product-wise?companyId=&fy=
router.get("/product-wise", async (req, res) => {
  const params = [req.query.companyId];
  const fy = fyClause(req.query.fy, params);
  try {
    const { rows } = await pool.query(
      `select ii.product_name as product,
              sum(ii.quantity) as quantity_sold,
              sum(ii.sales_amount) as revenue,
              sum(ii.profit) as profit
       from invoice_items ii
       join invoices i on i.id = ii.invoice_id
       where i.company_id = $1 and i.is_current = true ${fy}
       group by ii.product_name order by revenue desc`,
      params
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load report" }); }
});

// GET /api/reports/monthly?companyId=&fy=
router.get("/monthly", async (req, res) => {
  const params = [req.query.companyId];
  const fy = fyClause(req.query.fy, params);
  try {
    const { rows } = await pool.query(
      `select to_char(i.invoice_date, 'YYYY-MM') as month,
              sum(i.sales_total) as sales, sum(i.purchase_total) as purchase, sum(i.profit_total) as profit
       from invoices i
       where i.company_id = $1 and i.is_current = true ${fy}
       group by month order by month`,
      params
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load report" }); }
});

// GET /api/reports/gst-summary?companyId=&fy=
router.get("/gst-summary", async (req, res) => {
  const params = [req.query.companyId];
  const fy = fyClause(req.query.fy, params);
  try {
    const collectedRes = await pool.query(
      `select coalesce(sum(gst_total), 0) as gst_collected
       from invoices i where i.company_id = $1 and i.is_current = true ${fy}`,
      params
    );
    const paidRes = await pool.query(
      `select coalesce(sum(ii.purchase_amount * ii.gst_percent / 100), 0) as gst_paid
       from invoice_items ii join invoices i on i.id = ii.invoice_id
       where i.company_id = $1 and i.is_current = true ${fy}`,
      params
    );
    res.json({
      gstCollected: Number(collectedRes.rows[0].gst_collected),
      gstPaid: Number(paidRes.rows[0].gst_paid)
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load GST summary" }); }
});

// GET /api/reports/export?type=company-wise|client-wise|product-wise|monthly&companyId=&fy=
router.get("/export", async (req, res) => {
  const { type } = req.query;
  const allowed = ["company-wise", "client-wise", "product-wise", "monthly"];
  if (!allowed.includes(type)) return res.status(400).json({ error: "Unknown report type" });

  try {
    // Re-run the same query logic by delegating internally
    const path = `/api/reports/${type}`;
    const qs = new URLSearchParams(req.query);
    qs.delete("type");
    // Fetch via direct DB call rather than HTTP self-call for simplicity:
    const params = [];
    let query, values;
    if (type === "company-wise") {
      const fy = fyClause(req.query.fy, params);
      query = `select c.name as company, sum(i.sales_total) as sales, sum(i.purchase_total) as purchase, sum(i.profit_total) as profit
                from invoices i join companies c on c.id = i.company_id where i.is_current = true ${fy} group by c.name order by sales desc`;
      values = params;
    } else if (type === "client-wise") {
      params.push(req.query.companyId);
      const fy = fyClause(req.query.fy, params);
      query = `select cl.name as client, sum(i.sales_total) as sales, sum(i.profit_total) as profit, count(i.id) as invoice_count
                from invoices i join clients cl on cl.id = i.client_id where i.company_id = $1 and i.is_current = true ${fy} group by cl.name order by sales desc`;
      values = params;
    } else if (type === "product-wise") {
      params.push(req.query.companyId);
      const fy = fyClause(req.query.fy, params);
      query = `select ii.product_name as product, sum(ii.quantity) as quantity_sold, sum(ii.sales_amount) as revenue, sum(ii.profit) as profit
                from invoice_items ii join invoices i on i.id = ii.invoice_id where i.company_id = $1 and i.is_current = true ${fy} group by ii.product_name order by revenue desc`;
      values = params;
    } else {
      params.push(req.query.companyId);
      const fy = fyClause(req.query.fy, params);
      query = `select to_char(i.invoice_date, 'YYYY-MM') as month, sum(i.sales_total) as sales, sum(i.purchase_total) as purchase, sum(i.profit_total) as profit
                from invoices i where i.company_id = $1 and i.is_current = true ${fy} group by month order by month`;
      values = params;
    }

    const { rows } = await pool.query(query, values);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export report" });
  }
});

export default router;
