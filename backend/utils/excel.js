import XLSX from "xlsx";

// Columns the app cares about. Any other columns in the sheet (Remarks, Discount,
// Transport, Notes, etc.) are simply ignored — never cause a validation failure.
const REQUIRED_COLUMNS = [
  "Product Name",
  "HSN",
  "Quantity",
  "Buy Price",
  "Sell Price",
  "GST %"
];

// Accept a few common header spelling variants so real-world spreadsheets don't
// get rejected over cosmetic differences.
const HEADER_ALIASES = {
  "product name": "Product Name",
  "product": "Product Name",
  "hsn": "HSN",
  "hsn code": "HSN",
  "quantity": "Quantity",
  "qty": "Quantity",
  "buy price": "Buy Price",
  "purchase price": "Buy Price",
  "cost price": "Buy Price",
  "sell price": "Sell Price",
  "selling price": "Sell Price",
  "sale price": "Sell Price",
  "gst %": "GST %",
  "gst%": "GST %",
  "gst": "GST %",
  "gst percent": "GST %"
};

function normalizeHeader(raw) {
  const key = String(raw || "").trim().toLowerCase();
  return HEADER_ALIASES[key] || null;
}

export function buildTemplateWorkbook() {
  const headers = [...REQUIRED_COLUMNS, "Remarks"];
  const sampleRow = ["Sample Widget", "8471", 10, 100, 150, 18, "Optional notes column"];
  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoice Items");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Parses an uploaded invoice Excel buffer.
 * Returns { items, errors, columnMap } where items are computed line items
 * ready to preview/save, and errors are user-friendly validation messages.
 */
export function parseInvoiceExcel(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) {
    return { items: [], errors: ["The uploaded file has no data rows."] };
  }

  // Build a header map from whatever the first row's keys are.
  const rawHeaders = Object.keys(rows[0]);
  const headerMap = {}; // normalized name -> raw key in the row object
  for (const raw of rawHeaders) {
    const normalized = normalizeHeader(raw);
    if (normalized) headerMap[normalized] = raw;
  }

  const missingColumns = REQUIRED_COLUMNS.filter((c) => !(c in headerMap));
  if (missingColumns.length > 0) {
    return {
      items: [],
      errors: [`Missing required column(s): ${missingColumns.join(", ")}. Please use the provided template.`]
    };
  }

  const errors = [];
  const items = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // account for header row, 1-indexed for humans
    const productName = String(row[headerMap["Product Name"]] || "").trim();
    const hsn = String(row[headerMap["HSN"]] || "").trim();
    const quantityRaw = row[headerMap["Quantity"]];
    const buyPriceRaw = row[headerMap["Buy Price"]];
    const sellPriceRaw = row[headerMap["Sell Price"]];
    const gstRaw = row[headerMap["GST %"]];

    // Skip fully blank trailing rows
    if (!productName && quantityRaw === "" && buyPriceRaw === "" && sellPriceRaw === "") {
      return;
    }

    if (!productName) {
      errors.push(`Row ${rowNum}: Product name is required.`);
      return;
    }

    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Row ${rowNum} (${productName}): Quantity must be a positive number.`);
      return;
    }

    const buyPrice = Number(buyPriceRaw);
    if (!Number.isFinite(buyPrice) || buyPriceRaw === "") {
      errors.push(`Row ${rowNum} (${productName}): Buy price is required and must be a number.`);
      return;
    }

    const sellPrice = Number(sellPriceRaw);
    if (!Number.isFinite(sellPrice) || sellPriceRaw === "") {
      errors.push(`Row ${rowNum} (${productName}): Sell price is required and must be a number.`);
      return;
    }

    let gstPercent = Number(gstRaw);
    if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) {
      errors.push(`Row ${rowNum} (${productName}): GST % must be a number between 0 and 100.`);
      return;
    }

    const purchaseAmount = round2(quantity * buyPrice);
    const salesAmount = round2(quantity * sellPrice);
    const profit = round2(salesAmount - purchaseAmount);
    const gstAmount = round2(salesAmount * (gstPercent / 100));

    items.push({
      productName,
      hsn,
      quantity,
      buyPrice,
      sellPrice,
      gstPercent,
      purchaseAmount,
      salesAmount,
      profit,
      gstAmount
    });
  });

  if (items.length === 0 && errors.length === 0) {
    errors.push("No valid item rows were found in the file.");
  }

  return { items, errors };
}

export function summarizeItems(items) {
  return items.reduce(
    (acc, it) => ({
      purchaseTotal: round2(acc.purchaseTotal + it.purchaseAmount),
      salesTotal: round2(acc.salesTotal + it.salesAmount),
      profitTotal: round2(acc.profitTotal + it.profit),
      gstTotal: round2(acc.gstTotal + it.gstAmount)
    }),
    { purchaseTotal: 0, salesTotal: 0, profitTotal: 0, gstTotal: 0 }
  );
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
