import { Outlet } from 'react-router-dom';
import { IconAlertCircle, IconArrowBackUp, IconMenu2 } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import ChatWidget from '@/components/ChatWidget';
import { ActionInputDialog } from '@/components/ActionInputDialog';
import { TopBar } from '@/components/TopBar';
import ActionsBar from '@/components/ActionsBar';
import { useActions } from '@/context/ActionsContext';
import { Button } from '@/components/ui/button';
import { VersionCheck } from '@/components/VersionCheck';

const APP_TITLE = 'Katzenpension Manager';

const IS_EMBED = new URLSearchParams(window.location.search).has('embed') || window.navigator.userAgent.startsWith('LivingAppsMobile');

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { inputFormAction, inputFormOptions, submitActionInputs, cancelInputForm } = useActions();
  const [authError, setAuthError] = useState(false);
  useEffect(() => { document.title = APP_TITLE; }, []);
  useEffect(() => {
    const handler = () => setAuthError(true);
    window.addEventListener('auth-error', handler);
    return () => window.removeEventListener('auth-error', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {!IS_EMBED && (
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm" style={{ height: 'var(--topbar-h)' }}>
        <div className="flex items-center justify-between h-full px-4 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <IconMenu2 size={18} />
            </button>
            <svg className="hidden lg:block w-9 h-9 shrink-0" viewBox="0 0 57 57" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.6162 33.9164L20.4429 36.4084C20.4429 36.4084 13.4064 39.5929 9.85984 41.6434C7.73514 42.8719 6.93751 43.762 7.68335 44.356C8.00045 44.6086 18.7719 52.7814 19.1375 53.0247C23.2398 55.7549 15.79 45.2036 15.79 45.2036C15.79 45.2036 26.3397 41.899 28.5944 39.281C30.8491 36.6629 28.9112 33.9164 28.9112 33.9164C28.9112 33.9164 33.0253 35.5016 33.1876 39.281C33.289 41.6444 30.466 46.5779 28.9632 50.3787C28.063 52.6557 27.6349 53.4537 28.5898 53.4582C28.9958 53.4601 43.3581 53.5103 43.7947 53.4582C46.5726 53.1267 36.1923 50.3787 36.1923 50.3787C36.1923 50.3787 40.934 43.8566 42.0571 39.7543C42.7914 37.072 40.4732 33.4431 40.4732 33.4431C40.4732 33.4431 50.6098 36.1253 51.4017 35.4942C52.1937 34.8631 49.026 26.6585 49.026 26.6585C49.026 26.6585 57 22.8756 57 21.4556C57 20.0356 49.171 16.4028 49.171 16.4028C49.171 16.4028 49.8179 9.14493 48.3924 8.35603C46.967 7.56713 36.672 11.996 36.672 11.996C36.672 11.996 31.7464 3.51825 28.8955 3.51825C26.0446 3.51825 20.5168 11.996 20.5168 11.996C20.5168 11.996 11.3306 7.25157 10.0635 7.88269C8.79641 8.51381 8.47964 16.4028 8.47964 16.4028C8.47964 16.4028 0 20.1818 0 21.6019C0 23.0219 8.9548 26.6585 8.9548 26.6585C8.9548 26.6585 6.10388 35.0209 7.21257 35.4942C8.32126 35.9676 18.6162 33.9164 18.6162 33.9164Z" fill="#FF5C00"/>
              <path d="M39.2754 22.6432C39.2754 24.6087 35.038 28.5398 28.6918 28.5398C22.3457 28.5398 18.1083 24.7599 18.1083 22.6432C18.1083 20.5265 22.3457 16.2931 28.6918 16.2931C35.038 16.2931 39.2754 20.6777 39.2754 22.6432Z" fill="white"/>
              <path d="M31.4755 16.5827C32.7516 16.8524 33.9029 17.2929 34.9052 17.8249C36.2586 18.8904 37.1287 20.5421 37.1288 22.3981C37.1288 24.6151 35.8885 26.5416 34.0643 27.5241C33.4073 27.7869 32.6982 28.0121 31.9413 28.1823C31.7334 28.2048 31.5223 28.2174 31.3085 28.2174C28.0946 28.2172 25.4891 25.612 25.4891 22.3981C25.4892 21.683 25.6183 20.9978 25.8544 20.3649C26.2591 20.989 26.9614 21.4029 27.7606 21.403C29.0148 21.4028 30.0311 20.3857 30.0311 19.1315C30.0311 18.2656 29.5467 17.5126 28.8339 17.1295C29.5848 16.7762 30.4236 16.5788 31.3085 16.5788C31.3643 16.5788 31.42 16.5811 31.4755 16.5827Z" fill="black"/>
            </svg>
            <span className="font-semibold text-sm truncate">{APP_TITLE}</span>
          </div>
          <TopBar />
        </div>
      </header>
      )}

      {!IS_EMBED && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          style={{ top: 'var(--topbar-h)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {!IS_EMBED && (
      <aside
        className={`
          fixed left-0 z-40 w-72 bg-sidebar border-r border-sidebar-border overflow-hidden
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
        style={{ top: 'var(--topbar-h)', height: 'calc(100vh - var(--topbar-h))' }}
      >
        <div className="flex flex-col h-full">
        <nav className="px-3 pt-4 space-y-0.5">
          <a
            href="/gateway/apps/69e4c4c98eb47c71ad1956f9?template=list_page"
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-base transition-colors min-w-0 text-sidebar-foreground font-normal hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <IconArrowBackUp size={16} className="shrink-0" />
            <span className="truncate">Zurück</span>
          </a>
        </nav>

        <div className="mt-auto px-3 pb-4">
          <div className="border-t border-sidebar-border pt-3">
            <VersionCheck />
          </div>
        </div>
        </div>
      </aside>
      )}

      <div className={IS_EMBED ? "" : "lg:pl-72"} style={IS_EMBED ? undefined : { paddingTop: 'var(--topbar-h)' }}>
        <main className={`max-w-screen-2xl ${IS_EMBED ? "p-2 lg:p-4" : "p-6 lg:p-8"}`}>
          {!IS_EMBED && !authError && <ActionsBar />}
          {authError ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <IconAlertCircle size={22} className="text-destructive" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground mb-1">Du bist nicht angemeldet.</h3>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                window.location.href = `${window.location.origin}/login.htm?cugCoUrl=${encodeURIComponent(window.location.href)}`;
              }}>Anmelden</Button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {!IS_EMBED && <ChatWidget />}

      {inputFormAction && inputFormAction.metadata?.input_schema && (
        <ActionInputDialog
          action={inputFormAction}
          schema={inputFormAction.metadata.input_schema}
          options={inputFormOptions}
          onSubmit={(inputs, files) => submitActionInputs(inputFormAction, inputs, files)}
          onCancel={cancelInputForm}
        />
      )}
    </div>
  );
}
