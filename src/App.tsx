import { HashRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import KundenverwaltungPage from '@/pages/KundenverwaltungPage';
import KatzenverwaltungPage from '@/pages/KatzenverwaltungPage';
import ZimmerverwaltungPage from '@/pages/ZimmerverwaltungPage';
import LeistungsverwaltungPage from '@/pages/LeistungsverwaltungPage';
import BuchungsverwaltungPage from '@/pages/BuchungsverwaltungPage';
import GesundheitsprotokollPage from '@/pages/GesundheitsprotokollPage';
// <custom:imports>
// </custom:imports>

const NeueBuchungPage = lazy(() => import('@/pages/intents/NeueBuchungPage'));
const TagesprotokollPage = lazy(() => import('@/pages/intents/TagesprotokollPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ActionsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardOverview />} />
              <Route path="kundenverwaltung" element={<KundenverwaltungPage />} />
              <Route path="katzenverwaltung" element={<KatzenverwaltungPage />} />
              <Route path="zimmerverwaltung" element={<ZimmerverwaltungPage />} />
              <Route path="leistungsverwaltung" element={<LeistungsverwaltungPage />} />
              <Route path="buchungsverwaltung" element={<BuchungsverwaltungPage />} />
              <Route path="gesundheitsprotokoll" element={<GesundheitsprotokollPage />} />
              <Route path="admin" element={<AdminPage />} />
              {/* <custom:routes> */}
              {/* </custom:routes> */}
              <Route path="intents/neue-buchung" element={<Suspense fallback={null}><NeueBuchungPage /></Suspense>} />
              <Route path="intents/tagesprotokoll" element={<Suspense fallback={null}><TagesprotokollPage /></Suspense>} />
            </Route>
          </Routes>
        </ActionsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
