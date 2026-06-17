import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import EmployeeDashboard from './pages/employee/Dashboard';
import LeaveForm from './pages/employee/LeaveForm';
import EmployeeSchedule from './pages/employee/Schedule';
import AdminDashboard from './pages/admin/Dashboard';
import Employees from './pages/admin/Employees';
import Rules from './pages/admin/Rules';
import AdminSchedule from './pages/admin/Schedule';
import Reports from './pages/admin/Reports';

import Settings from './pages/shared/Settings';

// Mock Pages
const Placeholder = ({ title }) => (
  <div className="card fade-in">
    <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>{title}</h2>
    <p>此頁面正在建置中...</p>
  </div>
);

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && user.position !== allowedRole) {
    return <Navigate to={user.position === '管理者' ? '/admin/dashboard' : '/employee/dashboard'} />;
  }
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? (user.position === '管理者' ? '/admin/dashboard' : '/employee/dashboard') : '/login'} />} />
      <Route path="/login" element={<Login />} />
      
      {/* Employee Routes */}
      <Route path="/employee" element={<ProtectedRoute allowedRole="員工"><Layout /></ProtectedRoute>}>
        <Route path="dashboard" element={<EmployeeDashboard />} />
        <Route path="leave" element={<LeaveForm />} />
        <Route path="schedule" element={<EmployeeSchedule />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute allowedRole="管理者"><Layout /></ProtectedRoute>}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="clock-in" element={<EmployeeDashboard />} />
        <Route path="leave" element={<LeaveForm />} />
        <Route path="employees" element={<Employees />} />
        <Route path="rules" element={<Rules />} />
        <Route path="schedule" element={<AdminSchedule />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
