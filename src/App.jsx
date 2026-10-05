import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login.jsx';
import TenderList from './pages/TenderList.jsx';
import TenderForm from './pages/TenderForm.jsx';
import TenderDetails from './pages/TenderDetails.jsx';
import Settings from './pages/Settings.jsx';
import Layout from './components/Layout.jsx';

const SessionContext = createContext(null);
const DEFAULT_FONT_SCALE = 130;
const MIN_FONT_SCALE = 90;
const MAX_FONT_SCALE = 160;

export function useSession() {
  return useContext(SessionContext);
}

export { DEFAULT_FONT_SCALE, MIN_FONT_SCALE, MAX_FONT_SCALE };

export function useApi() {
  return window.tenderDesk;
}

export function errorMessage(error) {
  return error?.message || 'Something went wrong. Please try again.';
}

export function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function todayDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T00:00:00`));
}

export function formatDateTime(value) {
  if (!value) return 'Upload time unavailable';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [fontScale, setFontScale] = useState(() => {
    const savedScale = Number(localStorage.getItem('tenderDesk.fontScale'));
    return Number.isInteger(savedScale) && savedScale >= MIN_FONT_SCALE && savedScale <= MAX_FONT_SCALE
      ? savedScale
      : DEFAULT_FONT_SCALE;
  });

  useEffect(() => {
    localStorage.setItem('tenderDesk.fontScale', String(fontScale));
  }, [fontScale]);

  const session = useMemo(() => ({
    user,
    signIn: setUser,
    signOut: () => setUser(null),
    fontScale,
    setFontScale,
  }), [user, fontScale]);

  return (
    <SessionContext.Provider value={session}>
      <div className="app-root" style={{ '--app-zoom': fontScale / 100 }}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
            <Route path="/" element={<TenderList />} />
            <Route path="/tenders/new" element={<TenderForm />} />
            <Route path="/tenders/:id" element={<TenderDetails />} />
            <Route path="/tenders/:id/edit" element={<TenderForm />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
        </Routes>
      </div>
    </SessionContext.Provider>
  );
}
