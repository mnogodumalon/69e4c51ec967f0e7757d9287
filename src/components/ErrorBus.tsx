import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { toast, Toaster } from 'sonner';

const APPGROUP_ID = '69e4c51ec967f0e7757d9287';
const REPAIR_ENDPOINT = '/claude/build/repair';
const DEDUP_WINDOW_MS = 5000;
const TOAST_DURATION_MS = 10000;

const USER_TYPES = new Set<string>([
  'validation-error',
  'required-field-missing',
  'unique-constraint-violation',
]);

const BUG_TYPES = new Set<string>([
  'illegal-field-value',
  'unsupported-field-value',
  'unknown-control',
  'invalid-request-body',
]);

type ErrorSource = 'api' | 'promise' | 'js' | 'network';
type ErrorCategory = 'user' | 'bug' | 'transient';

export interface ErrorPayload {
  source: ErrorSource;
  type?: string;
  status?: number;
  control_identifier?: string;
  control_type?: string;
  field_type?: string;
  detail?: string;
  message?: string;
  stack?: string;
}

function classify(err: ErrorPayload): ErrorCategory {
  if (err.source === 'network') return 'transient';
  if (typeof err.status === 'number' && err.status >= 500) return 'transient';
  if (err.type && USER_TYPES.has(err.type)) return 'user';
  if (err.type && BUG_TYPES.has(err.type)) return 'bug';
  if (err.source === 'js' || err.source === 'promise') return 'bug';
  return 'bug';
}

function dedupKey(err: ErrorPayload): string {
  const msg = (err.message || err.detail || '').slice(0, 80);
  return [
    err.source,
    err.type ?? '',
    err.control_identifier ?? '',
    err.status ?? '',
    msg,
  ].join(':');
}

interface ErrorBusValue {
  emit: (err: ErrorPayload) => void;
}

const ErrorBusContext = createContext<ErrorBusValue | null>(null);

export function useErrorBus(): ErrorBusValue {
  const ctx = useContext(ErrorBusContext);
  if (!ctx) throw new Error('useErrorBus must be used within ErrorBusProvider');
  return ctx;
}

async function runRepair(err: ErrorPayload): Promise<void> {
  const toastId = toast.loading('Reparatur wird gestartet...');
  const errorContext = JSON.stringify({
    type: err.type || 'api_error',
    source: err.source,
    status: err.status,
    control_identifier: err.control_identifier,
    control_type: err.control_type,
    field_type: err.field_type,
    detail: err.detail,
    message: err.message,
    stack: err.stack,
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
      toast.error('Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.', { id: toastId });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;

    while (!finished) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data: ')) continue;
        const content = line.slice(6);
        if (content.startsWith('[STATUS]')) {
          toast.loading(content.replace(/^\[STATUS]\s*/, ''), { id: toastId });
        }
        if (content.startsWith('[DONE]')) {
          toast.success('Das Problem wurde behoben. Bitte laden Sie die Seite neu.', { id: toastId, duration: 12000 });
          finished = true;
        }
        if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
          toast.error('Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.', { id: toastId });
          finished = true;
        }
      }
    }

    if (!finished) {
      toast.error('Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.', { id: toastId });
    }
  } catch {
    toast.error('Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.', { id: toastId });
  }
}

export function ErrorBusProvider({ children }: { children: ReactNode }) {
  const seen = useRef<Map<string, number>>(new Map());

  const emit = useCallback((err: ErrorPayload) => {
    const key = dedupKey(err);
    const now = Date.now();
    const last = seen.current.get(key);
    if (last && now - last < DEDUP_WINDOW_MS) return;
    seen.current.set(key, now);

    const category = classify(err);
    if (category === 'user') return;

    if (category === 'transient') {
      toast.error('Netzwerkfehler', {
        description: err.message || err.detail || 'Verbindung zum Server verloren.',
        action: {
          label: 'Neu laden',
          onClick: () => window.location.reload(),
        },
        duration: TOAST_DURATION_MS,
      });
      return;
    }

    toast.error('Etwas ist schiefgelaufen', {
      description: err.detail || err.message || 'Ein Problem wurde entdeckt. Das Dashboard kann automatisch repariert werden.',
      action: {
        label: 'Dashboard reparieren',
        onClick: () => { void runRepair(err); },
      },
      duration: TOAST_DURATION_MS,
    });
  }, []);

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as ErrorPayload | undefined;
      if (detail) emit(detail);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason: unknown = e.reason;
      const message =
        reason instanceof Error ? reason.message :
        typeof reason === 'string' ? reason :
        'Unhandled rejection';
      const stack = reason instanceof Error ? (reason.stack ?? '') : '';
      emit({
        source: 'promise',
        message,
        stack: stack.split('\n').slice(0, 10).join('\n'),
      });
    };
    const onError = (e: ErrorEvent) => {
      emit({
        source: 'js',
        message: e.message,
        stack: (e.error?.stack ?? '').split('\n').slice(0, 10).join('\n'),
      });
    };

    window.addEventListener('errorbus:emit', onCustom);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('errorbus:emit', onCustom);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, [emit]);

  return (
    <ErrorBusContext.Provider value={{ emit }}>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </ErrorBusContext.Provider>
  );
}
