import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default client;

// --- API calls -------------------------------------------------------------

export const login = (username, password) =>
  client.post("/auth/login", { username, password }).then((r) => r.data);

export const getCompanies = (fy, month) =>
  client.get("/companies", { params: { fy, month } }).then((r) => r.data);

export const createCompany = (name) =>
  client.post("/companies", { name }).then((r) => r.data);

export const getCompanyDashboard = (id, fy, month) =>
  client.get(`/companies/${id}`, { params: { fy, month } }).then((r) => r.data);

export const getClientsForCompany = (companyId) =>
  client.get(`/clients/company/${companyId}`).then((r) => r.data);

export const createClient = (companyId, name) =>
  client.post(`/clients/company/${companyId}`, { name }).then((r) => r.data);

export const getClientDetail = (id, month) =>
  client.get(`/clients/${id}`, { params: { month } }).then((r) => r.data);

export const getClientPaymentHistory = (id) =>
  client.get(`/clients/${id}/payments`).then((r) => r.data);

export const checkDuplicateInvoice = (companyId, clientId, invoiceNumber) =>
  client
    .get("/invoices/check-duplicate", { params: { companyId, clientId, invoiceNumber } })
    .then((r) => r.data);

export const previewInvoiceExcel = (file) => {
  const form = new FormData();
  form.append("file", file);
  return client.post("/invoices/preview", form, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};

export const saveInvoice = ({ companyId, clientId, invoiceNumber, invoiceDate, items, action, file, advanceAmount, advanceDate }) => {
  const form = new FormData();
  form.append("companyId", companyId);
  form.append("clientId", clientId);
  form.append("invoiceNumber", invoiceNumber);
  form.append("invoiceDate", invoiceDate);
  form.append("items", JSON.stringify(items));
  if (action) form.append("action", action);
  if (file) form.append("file", file);
  if (advanceAmount) form.append("advanceAmount", advanceAmount);
  if (advanceDate) form.append("advanceDate", advanceDate);
  return client.post("/invoices", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

export const addPayment = (invoiceId, { amount, paymentDate, paymentType, notes }) =>
  client.post(`/invoices/${invoiceId}/payments`, { amount, paymentDate, paymentType, notes }).then((r) => r.data);

export const deletePayment = (invoiceId, paymentId) =>
  client.delete(`/invoices/${invoiceId}/payments/${paymentId}`).then((r) => r.data);

export const getInvoice = (id) => client.get(`/invoices/${id}`).then((r) => r.data);

export const updateInvoice = (id, payload) => client.put(`/invoices/${id}`, payload).then((r) => r.data);

export const deleteInvoice = (id) => client.delete(`/invoices/${id}`).then((r) => r.data);

export const getInvoiceDownloadUrl = (id) => client.get(`/invoices/${id}/download`).then((r) => r.data);

// File downloads go through axios (not a plain <a href>) so the auth header is attached.
function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const downloadTemplate = () =>
  client.get("/invoices/template", { responseType: "blob" }).then((r) => downloadBlob(r.data, "invoice_template.xlsx"));

export const getReport = (type, params) => client.get(`/reports/${type}`, { params }).then((r) => r.data);

export const exportReport = (type, params) =>
  client
    .get("/reports/export", { params: { type, ...params }, responseType: "blob" })
    .then((r) => downloadBlob(r.data, `${type}-report.xlsx`));

export const globalSearch = (q) => client.get("/search", { params: { q } }).then((r) => r.data);
