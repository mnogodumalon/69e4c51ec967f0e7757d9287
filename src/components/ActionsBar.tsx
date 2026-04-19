import { useState, useMemo, useRef } from 'react';
import { IconPlayerPlay, IconCode, IconTrash, IconFile, IconFileTypePdf, IconPhoto, IconDownload, IconBolt, IconChevronLeft, IconChevronRight, IconArrowsSort, IconChevronDown, IconLoader2 } from '@tabler/icons-react';
import { useActions } from '@/context/ActionsContext';
import type { Action, FileAttachment } from '@/lib/actions-agent';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') return <IconFileTypePdf size={14} className="shrink-0 text-red-500" />;
  if (mimeType.startsWith('image/')) return <IconPhoto size={14} className="shrink-0 text-blue-500" />;
  return <IconFile size={14} className="shrink-0 text-muted-foreground" />;
}

function formatDateTime(d?: string) {
  if (!d) return '';
  try { return format(parseISO(d), 'dd.MM.yyyy, HH:mm', { locale: de }); } catch { return d; }
}

type FileSortMode = 'newest' | 'oldest' | 'az' | 'za';
const FILE_SORT_LABELS: Record<FileSortMode, string> = {
  newest: 'Neuste zuerst',
  oldest: 'Älteste zuerst',
  az: 'Name A→Z',
  za: 'Name Z→A',
};

const PAGE_SIZE = 6;

function FileList({ files, onDownload, onDelete }: { files: FileAttachment[]; onDownload: (url: string, filename: string) => void; onDelete: (file: FileAttachment) => void }) {
  const [fileSort, setFileSort] = useState<FileSortMode>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...files].sort((a, b) => {
      switch (fileSort) {
        case 'newest':
        case 'oldest': {
          if (!a.created_at && !b.created_at) return a.filename.localeCompare(b.filename);
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          const cmp = a.created_at.localeCompare(b.created_at);
          if (cmp !== 0) return fileSort === 'newest' ? -cmp : cmp;
          return a.filename.localeCompare(b.filename);
        }
        case 'az':
        case 'za': {
          const cmp = a.filename.localeCompare(b.filename);
          if (cmp !== 0) return fileSort === 'za' ? -cmp : cmp;
          return b.created_at.localeCompare(a.created_at);
        }
      }
    });
  }, [files, fileSort]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const safePage = totalPages > 0 ? Math.min(page, totalPages - 1) : 0;
  const pageFiles = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="mt-3">
      <div className="-mx-1">
        <div className="flex items-center justify-end py-1">
          <div className="flex-1 border-b border-border" />
          <div className="relative">
            <button
              onClick={() => setSortOpen(o => !o)}
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                sortOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <IconArrowsSort size={14} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-32">
                  {(['newest', 'oldest', 'az', 'za'] as FileSortMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => { setFileSort(mode); setPage(0); setExpandedId(null); setSortOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        fileSort === mode ? 'text-primary font-medium bg-primary/5' : 'text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {FILE_SORT_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        {pageFiles.map(f => {
          const id = `${f.app_id}/${f.identifier}`;
          const isOpen = expandedId === id;
          return (
            <div key={id}>
              <button
                onClick={() => setExpandedId(isOpen ? null : id)}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover:bg-accent text-left transition-colors"
              >
                <FileIcon mimeType={f.mime_type} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-muted-foreground truncate">{f.filename}</div>
                </div>
                <IconChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="pl-9 pr-3 pb-2.5">
                  {f.created_at && (
                    <div className="text-xs text-muted-foreground/60 mb-2">{formatDateTime(f.created_at)}</div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDownload(f.url, f.filename)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <IconDownload size={13} />
                      Herunterladen
                    </button>
                    <button
                      onClick={() => onDelete(f)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                      title="Löschen"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t">
          <button
            onClick={() => { setPage(p => p - 1); setExpandedId(null); }}
            disabled={safePage === 0}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <IconChevronLeft size={14} />
          </button>
          <span className="text-xs text-muted-foreground">{safePage + 1} / {totalPages}</span>
          <button
            onClick={() => { setPage(p => p + 1); setExpandedId(null); }}
            disabled={safePage >= totalPages - 1}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <IconChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function ActionWidget({ action, files, onRun, onShowCode, onDelete, onDownload, onDeleteFile, devMode, running, disabled }: {
  action: Action;
  files: FileAttachment[];
  onRun: (action: Action) => void;
  onShowCode: (action: Action) => void;
  onDelete: (action: Action) => Promise<void>;
  onDownload: (url: string, filename: string) => void;
  onDeleteFile: (file: FileAttachment) => void;
  devMode: boolean;
  running: boolean;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (expanded && contentRef.current) contentRef.current.style.overflow = 'hidden';
    setExpanded(e => !e);
  };

  return (
    <div className="min-w-0 rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={toggle}
        className="flex items-center justify-between gap-2 w-full p-4 sm:p-6 text-left hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <IconBolt size={18} className="shrink-0 text-muted-foreground" />
          <p className="font-semibold text-foreground truncate">{action.title || action.identifier}</p>
        </div>
        <IconChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        onTransitionEnd={(e) => { if (e.target === e.currentTarget && expanded && contentRef.current) contentRef.current.style.overflow = 'visible'; }}
      >
        <div ref={contentRef} className="overflow-hidden min-w-0">
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            {devMode && <div className="text-xs text-muted-foreground font-mono mb-1 truncate">{action.identifier}</div>}
            {action.description && <p className="text-xs text-muted-foreground mb-3">{action.description}</p>}
            <div className="flex gap-1">
              <button
                onClick={() => onRun(action)}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
              >
                {running ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlayerPlay size={14} />}
                {running ? 'In Arbeit...' : 'Ausführen'}
              </button>
              {devMode && (
                <button
                  onClick={() => onShowCode(action)}
                  className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                  title="Quellcode"
                >
                  <IconCode size={16} />
                </button>
              )}
              <button
                onClick={() => { void onDelete(action); }}
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                title="Löschen"
              >
                <IconTrash size={16} />
              </button>
            </div>
            {files.length > 0 && (
              <FileList files={files} onDownload={onDownload} onDelete={onDeleteFile} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilesWidget({ files, onDownload, onDeleteFile, label }: { files: FileAttachment[]; onDownload: (url: string, filename: string) => void; onDeleteFile: (file: FileAttachment) => void; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (expanded && contentRef.current) contentRef.current.style.overflow = 'hidden';
    setExpanded(e => !e);
  };

  return (
    <div className="min-w-0 rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={toggle}
        className="flex items-center justify-between gap-2 w-full p-4 sm:p-6 text-left hover:bg-accent/50 transition-colors"
      >
        <p className="font-semibold text-foreground truncate">{label}</p>
        <div className="flex items-center gap-1 shrink-0">
          <IconFile size={18} className="text-muted-foreground" />
          <IconChevronDown size={16} className={`text-muted-foreground transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        onTransitionEnd={(e) => { if (e.target === e.currentTarget && expanded && contentRef.current) contentRef.current.style.overflow = 'visible'; }}
      >
        <div ref={contentRef} className="overflow-hidden min-w-0">
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <p className="text-2xl font-bold">{files.length}</p>
            <FileList files={files} onDownload={onDownload} onDelete={onDeleteFile} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActionsBar() {
  const { actions, runAction, showActionCode, deleteAction, deleteAppAttachment, devMode, runningActionId, files, filesByAction, downloadFile } = useActions();

  const unassignedFiles = filesByAction['__unassigned__'] || [];

  if (actions.length === 0 && files.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6 items-start">
      {actions.map(a => (
        <ActionWidget
          key={`${a.app_id}/${a.identifier}`}
          action={a}
          files={filesByAction[a.identifier] || []}
          onRun={runAction}
          onShowCode={showActionCode}
          onDelete={deleteAction}
          onDownload={(url, filename) => { void downloadFile(url, filename); }}
          onDeleteFile={(f) => { void deleteAppAttachment(f); }}
          devMode={devMode}
          running={runningActionId === a.identifier}
          disabled={runningActionId !== null}
        />
      ))}
      {unassignedFiles.length > 0 && (
        <FilesWidget
          files={unassignedFiles}
          onDownload={(url, filename) => { void downloadFile(url, filename); }}
          onDeleteFile={(f) => { void deleteAppAttachment(f); }}
          label="Dateien"
        />
      )}
    </div>
  );
}
