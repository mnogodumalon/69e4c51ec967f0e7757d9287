import { Component, type ReactNode, type ErrorInfo } from 'react';
import { IconAlertTriangle, IconRefresh, IconTool, IconCheck } from '@tabler/icons-react';

const APPGROUP_ID = '69e4c51ec967f0e7757d9287';
const REPAIR_ENDPOINT = '/claude/build/repair';

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  repairing: boolean;
  repairStatus: string;
  repairDone: boolean;
  repairFailed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {
    hasError: false,
    error: null,
    componentStack: '',
    repairing: false,
    repairStatus: '',
    repairDone: false,
    repairFailed: false,
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  handleRepair = async () => {
    this.setState({ repairing: true, repairStatus: 'Reparatur wird gestartet...', repairFailed: false });

    const errorContext = JSON.stringify({
      type: 'render_crash',
      message: this.state.error?.message ?? 'Unknown error',
      stack: (this.state.error?.stack ?? '').split('\n').slice(0, 10).join('\n'),
      componentStack: this.state.componentStack.split('\n').slice(0, 8).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        this.setState({ repairing: false, repairFailed: true, repairStatus: `HTTP ${resp.status}` });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            this.setState({ repairStatus: content.replace(/^\[STATUS]\s*/, '') });
          }
          if (content.startsWith('[DONE]')) {
            this.setState({ repairDone: true, repairing: false });
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            this.setState({ repairFailed: true });
          }
        }
      }

      if (!this.state.repairDone) {
        this.setState({ repairing: false, repairFailed: true });
      }
    } catch (err) {
      this.setState({ repairing: false, repairFailed: true, repairStatus: String(err) });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { repairing, repairDone, repairFailed, repairStatus } = this.state;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
          {repairDone
            ? <IconCheck size={22} className="text-green-500" />
            : <IconAlertTriangle size={22} className="text-destructive" />}
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">
            {repairDone ? 'Dashboard repariert' : 'Etwas ist schiefgelaufen'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {repairDone
              ? 'Das Problem wurde behoben. Bitte laden Sie die Seite neu.'
              : repairing
                ? repairStatus
                : this.state.error?.message}
          </p>
        </div>
        <div className="flex gap-2">
          {repairDone ? (
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <IconRefresh size={14} />
              Neu laden
            </button>
          ) : (
            <>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                <IconRefresh size={14} />
                Neu laden
              </button>
              <button
                onClick={this.handleRepair}
                disabled={repairing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {repairing
                  ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <IconTool size={14} />}
                {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
              </button>
            </>
          )}
        </div>
        {repairFailed && !repairDone && (
          <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>
        )}
      </div>
    );
  }
}
