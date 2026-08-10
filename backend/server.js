import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { login, requireAuth } from "./middleware/auth.js";
import companiesRouter from "./routes/companies.js";
import clientsRouter from "./routes/clients.js";
import invoicesRouter from "./routes/invoices.js";
import reportsRouter from "./routes/reports.js";
import searchRouter from "./routes/search.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.post("/api/auth/login", login);

// Everything below requires a valid token
app.use("/api/companies", requireAuth, companiesRouter);
// clientsRouter exposes both /company/:companyId (list/add clients for a company)
// and /:id (single client detail) — mounted once under /api/clients.
app.use("/api/clients", requireAuth, clientsRouter);
app.use("/api/invoices", requireAuth, invoicesRouter);
app.use("/api/reports", requireAuth, reportsRouter);
app.use("/api/search", requireAuth, searchRouter);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`Invoice tracker API listening on port ${PORT}`);
});
