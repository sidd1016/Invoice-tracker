import { Router } from "express";
import multer from "multer";
import pool from "../db/pool.js";
import { buildTemplateWorkbook, parseInvoiceExcel, summarizeItems } from "../utils/excel.js";
import { financialYearFor } from "../utils/financialYear.js";
import { uploadOriginalFile, getSignedDownloadUrl, storageEnabled } from "../db/storage.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/invoices/template — downloadable blank Excel template
router.get("/template", (req, res) => {
  const buffer = buildTemplateWorkbook();
  res.setHeader("Content-Disposition", 'attachment; filename="invoice_template.xlsx"');
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

// GET /api/invoices/check-duplicate?companyId=&clientId=&invoiceNumber=
router.get("/check-duplicate", async (req, res) => {
  const { companyId, clientId, invoiceNumber } = req.query;
  if (!companyId || !clientId || !invoiceNumber) {
    return res.status(400).json({ error: "companyId, clientId and invoiceNumber are required" });
  }
  try {
    const { rows } = await pool.query(
      `select id, invoice_date, sales_total, version,
              (select count(*) from invoice_items where invoice_id = invoices.id) as item_count
       from invoices
       where company_id = $1 and client_id = $2 and invoice_number = $3 and is_current = true`,
      [companyId, clientId, invoiceNumber]
    );
    if (rows.length === 0) return res.json({ duplicate: false });
    const existing = rows[0];
    res.json({
      duplicate: true,
      existing: {
        id: existing.id,
        invoiceDate: existing.invoice_date,
        salesTotal: Number(existing.sales_total),
        itemCount: Number(existing.item_count),
        version: existing.version
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check for duplicates" });
  }
});

// POST /api/invoices/preview — multipart file upload, parses + validates, returns computed items.
// Does NOT save anything.
router.post("/preview", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const { items, errors } = parseInvoiceExcel(req.file.buffer);
    if (errors.length > 0) return res.status(422).json({ errors });
    const totals = summarizeItems(items);
    res.json({ items, totals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to parse the Excel file. Please check the file format." });
  }
});

// POST /api/invoices — save an invoice (after preview has been confirmed by the user).
// Body: { companyId, clientId, invoiceNumber, invoiceDate, items: [...], action?: 'replace' | 'new-version' }
// `file` is optionally attached (multipart) to keep the original for re-download.
router.post("/", upload.single("file"), async (req, res) => {
  const body = req.body || {};
  const { companyId, clientId, invoiceNumber, invoiceDate, action, advanceAmount, advanceDate } = body;
  let items = body.items;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = null; }
  }

  if (!companyId || !clientId || !invoiceNumber || !invoiceDate || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "companyId, clientId, invoiceNumber, invoiceDate and items are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Handle duplicate resolution
    const dupRes = await client.query(
      `select id, version from invoices
       where company_id = $1 and client_id = $2 and invoice_number = $3 and is_current = true`,
      [companyId, clientId, invoiceNumber]
    );

    let version = 1;
    if (dupRes.rows.length > 0) {
      if (action !== "replace" && action !== "new-version") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Duplicate invoice. Specify action: 'replace' or 'new-version'." });
      }
      // Either way, mark the previous current version as superseded.
      await client.query("update invoices set is_current = false where id = $1", [dupRes.rows[0].id]);
      version = action === "new-version" ? dupRes.rows[0].version + 1 : dupRes.rows[0].version;
    }

    const totals = summarizeItems(items);
    const fy = financialYearFor(invoiceDate);

    let filePath = null;
    if (req.file && storageEnabled()) {
      filePath = `${companyId}/${clientId}/${invoiceNumber}-v${version}-${Date.now()}.xlsx`;
      await uploadOriginalFile(filePath, req.file.buffer, req.file.mimetype);
    }

    const invoiceRes = await client.query(
      `insert into invoices
         (company_id, client_id, invoice_number, invoice_date, financial_year,
          purchase_total, sales_total, profit_total, gst_total, original_file_path, version, is_current)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
       returning id`,
      [companyId, clientId, invoiceNumber, invoiceDate, fy,
        totals.purchaseTotal, totals.salesTotal, totals.profitTotal, totals.gstTotal, filePath, version]
    );
    const invoiceId = invoiceRes.rows[0].id;

    for (const it of items) {
      await client.query(
        `insert into invoice_items
           (invoice_id, product_name, hsn, quantity, buy_price, sell_price, gst_percent,
            purchase_amount, sales_amount, profit, gst_amount)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [invoiceId, it.productName, it.hsn || null, it.quantity, it.buyPrice, it.sellPrice, it.gstPercent,
          it.purchaseAmount, it.salesAmount, it.profit, it.gstAmount]
      );
    }

    // Optional advance payment recorded at invoice-creation time.
    const advanceAmt = Number(advanceAmount);
    if (Number.isFinite(advanceAmt) && advanceAmt > 0 && advanceDate) {
      await client.query(
        `insert into invoice_payments (invoice_id, amount, payment_date, payment_type)
         values ($1,$2,$3,'advance')`,
        [invoiceId, advanceAmt, advanceDate]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ id: invoiceId, version, totals });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to save invoice" });
  } finally {
    client.release();
  }
});

// GET /api/invoices/:id — full detail with items + payment history/balance
router.get("/:id", async (req, res) => {
  try {
    const invoiceRes = await pool.query(
      `select i.*, c.name as company_name, cl.name as client_name
       from invoices i
       join companies c on c.id = i.company_id
       join clients cl on cl.id = i.client_id
       where i.id = $1`,
      [req.params.id]
    );
    if (invoiceRes.rows.length === 0) return res.status(404).json({ error: "Invoice not found" });

    const itemsRes = await pool.query(
      "select * from invoice_items where invoice_id = $1 order by created_at",
      [req.params.id]
    );

    const paymentsRes = await pool.query(
      "select * from invoice_payments where invoice_id = $1 order by payment_date, created_at",
      [req.params.id]
    );

    const totalReceived = round2(paymentsRes.rows.reduce((sum, p) => sum + Number(p.amount), 0));
    // Grand total = what the customer actually owes: sales (exclusive) + GST charged on top.
    // Profit stays based on the exclusive amount elsewhere — this total is for collection/balance only.
    const grandTotal = round2(Number(invoiceRes.rows[0].sales_total) + Number(invoiceRes.rows[0].gst_total));

    res.json({
      invoice: invoiceRes.rows[0],
      items: itemsRes.rows,
      payments: paymentsRes.rows,
      paymentSummary: {
        grandTotal,
        totalReceived,
        balanceDue: round2(grandTotal - totalReceived)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load invoice" });
  }
});

// POST /api/invoices/:id/payments — record a payment (advance or later payment)
// Body: { amount, paymentDate, paymentType: 'advance' | 'payment', notes? }
router.post("/:id/payments", async (req, res) => {
  const { amount, paymentDate, paymentType, notes } = req.body || {};
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: "A valid payment amount is required" });
  if (!paymentDate) return res.status(400).json({ error: "Payment date is required" });
  const type = paymentType === "advance" ? "advance" : "payment";

  try {
    const invoiceRes = await pool.query("select id from invoices where id = $1", [req.params.id]);
    if (invoiceRes.rows.length === 0) return res.status(404).json({ error: "Invoice not found" });

    const { rows } = await pool.query(
      `insert into invoice_payments (invoice_id, amount, payment_date, payment_type, notes)
       values ($1,$2,$3,$4,$5) returning *`,
      [req.params.id, amt, paymentDate, type, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// DELETE /api/invoices/:id/payments/:paymentId — remove a payment entry (e.g. entered by mistake)
router.delete("/:id/payments/:paymentId", async (req, res) => {
  try {
    await pool.query(
      "delete from invoice_payments where id = $1 and invoice_id = $2",
      [req.params.paymentId, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

// GET /api/invoices/:id/download — signed URL (or 404 if storage not configured)
router.get("/:id/download", async (req, res) => {
  try {
    const { rows } = await pool.query("select original_file_path from invoices where id = $1", [req.params.id]);
    if (rows.length === 0 || !rows[0].original_file_path) {
      return res.status(404).json({ error: "No original file available for this invoice" });
    }
    const url = await getSignedDownloadUrl(rows[0].original_file_path);
    if (!url) return res.status(404).json({ error: "File not found in storage" });
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate download link" });
  }
});

// PUT /api/invoices/:id — edit header fields + replace items wholesale
router.put("/:id", async (req, res) => {
  const { invoiceNumber, invoiceDate, items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items are required" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const totals = summarizeItems(items);
    const fy = invoiceDate ? financialYearFor(invoiceDate) : undefined;

    await client.query(
      `update invoices set
         invoice_number = coalesce($1, invoice_number),
         invoice_date   = coalesce($2, invoice_date),
         financial_year = coalesce($3, financial_year),
         purchase_total = $4, sales_total = $5, profit_total = $6, gst_total = $7,
         updated_at = now()
       where id = $8`,
      [invoiceNumber || null, invoiceDate || null, fy || null,
        totals.purchaseTotal, totals.salesTotal, totals.profitTotal, totals.gstTotal, req.params.id]
    );

    await client.query("delete from invoice_items where invoice_id = $1", [req.params.id]);
    for (const it of items) {
      await client.query(
        `insert into invoice_items
           (invoice_id, product_name, hsn, quantity, buy_price, sell_price, gst_percent,
            purchase_amount, sales_amount, profit, gst_amount)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [req.params.id, it.productName, it.hsn || null, it.quantity, it.buyPrice, it.sellPrice, it.gstPercent,
          it.purchaseAmount, it.salesAmount, it.profit, it.gstAmount]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true, totals });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to update invoice" });
  } finally {
    client.release();
  }
});

// DELETE /api/invoices/:id
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("delete from invoices where id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default router;
