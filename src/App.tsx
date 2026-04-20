import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
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

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
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
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
