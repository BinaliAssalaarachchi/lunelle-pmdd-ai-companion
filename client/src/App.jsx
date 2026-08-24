import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Track from './pages/Track.jsx';
import Insights from './pages/Insights.jsx';
import DoctorCoach from './pages/DoctorCoach.jsx';
import { InsightsLayout } from './components/insights/InsightsLayout.jsx';
import Reports from './pages/Reports.jsx';
import Profile from './pages/Profile.jsx';
import PartnerSupport from './pages/PartnerSupport.jsx';
import PartnerConnect from './pages/PartnerConnect.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Welcome from './pages/Welcome.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="track" element={<Track />} />
              <Route path="insights" element={<InsightsLayout />}>
                <Route index element={<Insights />} />
                <Route path="coach" element={<DoctorCoach />} />
              </Route>
              <Route path="reports" element={<Reports />} />
              <Route path="profile" element={<Profile />} />
              <Route path="partner/connect" element={<PartnerConnect />} />
              <Route path="partner/support" element={<PartnerSupport />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
