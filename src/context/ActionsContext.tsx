import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import type { Action, FileAttachment } from '@/lib/actions-agent';
import { fetchActionsAndFiles, executeAction, deleteAction as deleteActionApi, deleteAppAttachment as deleteAppAttachmentApi, agentChat, downloadFile } from '@/lib/actions-agent';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
};

interface ActionsContextType {
  actions: Action[];
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  messages: Message[];
  chatLoading: boolean;
  runAction: (action: Action) => void;
  sendMessage: (text: string, image?: string) => void;
  runningActionId: string | null;
  devMode: boolean;
  setDevMode: (v: boolean) => void;
  showActionCode: (action: Action) => void;
  deleteAction: (action: Action) => Promise<void>;
  inputFormAction: Action | null;
  inputFormOptions: Record<string, Array<{ value: string; label: string }>> | null;
  submitActionInputs: (action: Action, inputs: Record<string, unknown>, files: File[]) => void;
  cancelInputForm: () => void;
  files: FileAttachment[];
  filesByAction: Record<string, FileAttachment[]>;
  downloadFile: (url: string, filename: string) => Promise<void>;
  deleteAppAttachment: (file: FileAttachment) => Promise<void>;
}

const ActionsContext = createContext<ActionsContextType | null>(null);

export function useActions() {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useActions must be used within ActionsProvider');
  return ctx;
}

export function ActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [threadId] = useState(() => crypto.randomUUID());
  const chatLoadingRef = useRef(false);
  const [inputFormAction, setInputFormAction] = useState<Action | null>(null);
  const [inputFormOptions, setInputFormOptions] = useState<
    Record<string, Array<{ value: string; label: string }>> | null
  >(null);

  const filesByAction = useMemo(() => {
    const map: Record<string, FileAttachment[]> = {};
    for (const f of files) {
      const key = f.action_identifier || '__unassigned__';
      (map[key] ??= []).push(f);
    }
    return map;
  }, [files]);

  const [devMode, setDevMode] = useState(() => {
    try { return localStorage.getItem('developer-mode') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('developer-mode', String(devMode)); } catch {}
  }, [devMode]);

  const refreshActions = useCallback(async () => {
    try {
      const result = await fetchActionsAndFiles();
      setActions(result.actions);
      setFiles(result.files);
    } catch {
      // silently ignore — actions panel will be empty
    }
  }, []);

  useEffect(() => {
    void refreshActions();
  }, [refreshActions]);

  const executeAndReport = useCallback((action: Action, inputs?: Record<string, unknown>, files?: File[]) => {
    if (chatLoadingRef.current) return;
    chatLoadingRef.current = true;
    setChatLoading(true);
    setRunningActionId(action.identifier);
    setChatOpen(true);

    const placeholderId = crypto.randomUUID();
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: `Aktion: ${action.identifier}` },
      { id: placeholderId, role: 'assistant', content: 'In Arbeit...' },
    ]);

    executeAction(action.app_id, action.identifier, inputs, files)
      .then(result => {
        const content = result.error
          ? `Fehler bei der Ausführung:\n${result.error}`
          : result.stdout || '(no output)';
        setMessages(prev =>
          prev.map(m => m.id === placeholderId ? { ...m, content } : m)
        );
      })
      .catch(err => {
        setMessages(prev =>
          prev.map(m =>
            m.id === placeholderId
              ? { ...m, content: `Fehler bei der Ausführung: ${err instanceof Error ? err.message : String(err)}` }
              : m,
          )
        );
      })
      .finally(() => {
        chatLoadingRef.current = false;
        setChatLoading(false);
        setRunningActionId(null);
        void refreshActions();
        window.dispatchEvent(new Event('dashboard-refresh'));
      });
  }, [refreshActions]);

  const runAction = useCallback((action: Action) => {
    const schema = action.metadata?.input_schema;
    if (!schema?.properties || Object.keys(schema.properties).length === 0) {
      executeAndReport(action);
      return;
    }

    if (schema['x-preflight']) {
      // Two-phase: run preflight to get dynamic options
      if (chatLoadingRef.current) return;
      chatLoadingRef.current = true;
      setChatLoading(true);
      setRunningActionId(action.identifier);
      setChatOpen(true);

      const placeholderId = crypto.randomUUID();
      setMessages(prev => [
        ...prev,
        { id: placeholderId, role: 'assistant', content: 'Wird vorbereitet...' },
      ]);

      executeAction(action.app_id, action.identifier, {})
        .then(result => {
          setMessages(prev => prev.filter(m => m.id !== placeholderId));

          if (result.error) {
            setRunningActionId(null);
            setMessages(prev => [
              ...prev,
              { id: crypto.randomUUID(), role: 'assistant', content: `Fehler bei der Ausführung:\n${result.error}` },
            ]);
            return;
          }

          let options: Record<string, Array<{ value: string; label: string }>> | null = null;
          try {
            const parsed = JSON.parse(result.stdout || '');
            if (parsed._options && typeof parsed._options === 'object') {
              options = parsed._options;
            }
          } catch { /* not JSON — fall back to schema-only form */ }

          setInputFormOptions(options);
          setInputFormAction(action);
        })
        .catch(err => {
          setRunningActionId(null);
          setMessages(prev => prev.filter(m => m.id !== placeholderId));
          setMessages(prev => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', content: `Fehler bei der Ausführung: ${err instanceof Error ? err.message : String(err)}` },
          ]);
        })
        .finally(() => {
          chatLoadingRef.current = false;
          setChatLoading(false);
        });
      return;
    }

    // No preflight: show form immediately
    setInputFormOptions(null);
    setInputFormAction(action);
  }, [executeAndReport]);

  const submitActionInputs = useCallback((action: Action, inputs: Record<string, unknown>, files: File[]) => {
    setInputFormAction(null);
    setInputFormOptions(null);
    executeAndReport(action, inputs, files.length > 0 ? files : undefined);
  }, [executeAndReport]);

  const cancelInputForm = useCallback(() => {
    setInputFormAction(null);
    setInputFormOptions(null);
    setRunningActionId(null);
  }, []);

  const showActionCode = useCallback((action: Action) => {
    const code = action.value.trim() || '# Leere Aktion';
    const msg = `**Code für \`${action.identifier}\` in \`${action.app_name}\`:**\n\n\`\`\`python\n${code}\n\`\`\``;
    setChatOpen(true);
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content: msg },
    ]);
  }, []);

  const deleteActionFn = useCallback(async (action: Action) => {
    const confirmed = window.confirm(`Aktion löschen "${action.identifier}" (aus "${action.app_name}")?`);
    if (!confirmed) return;
    const result = await deleteActionApi(action.app_id, action.identifier);
    setChatOpen(true);
    if (result.error) {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `**Fehler bei der Ausführung:** ${result.error}` },
      ]);
    } else {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Aktion gelöscht: \`${action.identifier}\` (aus \`${action.app_name}\`).` },
      ]);
      await refreshActions();
    }
  }, [refreshActions]);

  const deleteAppAttachmentFn = useCallback(async (file: FileAttachment) => {
    const confirmed = window.confirm(`Datei löschen "${file.filename}"?`);
    if (!confirmed) return;
    const result = await deleteAppAttachmentApi(file.app_id, file.identifier);
    if (result.error) {
      setChatOpen(true);
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `**Fehler bei der Ausführung:** ${result.error}` },
      ]);
    } else {
      await refreshActions();
    }
  }, [refreshActions]);

  const sendMessage = useCallback(async (text: string, image?: string) => {
    if (chatLoadingRef.current) return;
    chatLoadingRef.current = true;
    setChatLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      image: image ?? undefined,
    };
    const assistantId = crypto.randomUUID();

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ]);

    try {
      const apiMessages = messages
        .concat(userMsg)
        .map(m => ({ role: m.role, content: m.content, image: m.image }));

      await agentChat(apiMessages, threadId, (delta) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + delta } : m,
          )
        );
      });
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Fehler bei der Ausführung: ${err instanceof Error ? err.message : String(err)}` }
            : m,
        )
      );
    } finally {
      chatLoadingRef.current = false;
      setChatLoading(false);
      void refreshActions();
      window.dispatchEvent(new Event('dashboard-refresh'));
    }
  }, [messages, threadId, refreshActions]);

  return (
    <ActionsContext.Provider
      value={{ actions, chatOpen, setChatOpen, messages, chatLoading, runningActionId, runAction, sendMessage, devMode, setDevMode, showActionCode, deleteAction: deleteActionFn, inputFormAction, inputFormOptions, submitActionInputs, cancelInputForm, files, filesByAction, downloadFile, deleteAppAttachment: deleteAppAttachmentFn }}
    >
      {children}
    </ActionsContext.Provider>
  );
}
