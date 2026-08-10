import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import CompanyDashboard from "./pages/CompanyDashboard";
import ClientPage from "./pages/ClientPage";
import PaymentHistory from "./pages/PaymentHistory";
import UploadInvoice from "./pages/UploadInvoice";
import InvoiceDetails from "./pages/InvoiceDetails";
import Reports from "./pages/Reports";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/companies/:id" element={<ProtectedRoute><CompanyDashboard /></ProtectedRoute>} />
      <Route path="/companies/:id/upload" element={<ProtectedRoute><UploadInvoice /></ProtectedRoute>} />
      <Route path="/companies/:id/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><ClientPage /></ProtectedRoute>} />
      <Route path="/clients/:id/payments" element={<ProtectedRoute><PaymentHistory /></ProtectedRoute>} />
      <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetails /></ProtectedRoute>} />
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
