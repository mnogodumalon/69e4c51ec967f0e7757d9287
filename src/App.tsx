import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import { WorkflowPlaceholders } from '@/components/WorkflowPlaceholders';
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
      <HashRouter>
        <ActionsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<><div className="mb-8"><WorkflowPlaceholders /></div><DashboardOverview /></>} />
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
    </ErrorBoundary>
  );
}
