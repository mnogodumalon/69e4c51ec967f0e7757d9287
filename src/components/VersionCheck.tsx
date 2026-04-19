import { useState, useEffect, useCallback, Fragment } from 'react';
import { IconRefresh, IconHistory, IconLoader, IconChevronDown, IconCheck, IconClock, IconArrowBackUp, IconSparkles, IconMessageCircle, IconGitBranch, IconArrowLeft } from '@tabler/icons-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const APPGROUP_ID = '69e4c51ec967f0e7757d9287';
const UPDATE_ENDPOINT = '/claude/build/update';
const DEPLOYMENTS_ENDPOINT = `/claude/build/deployments/${APPGROUP_ID}`;
const ROLLBACK_ENDPOINT = '/claude/build/rollback';
const VERSION_ENDPOINT = '/claude/version';

// Poll cadence after a deploy receipt: wait for S3 version.json to reflect
// the expected codebase SHA before reloading. 30 s ceiling to avoid hanging
// the UI indefinitely on CDN propagation glitches.
const VERIFY_POLL_INTERVAL_MS = 1500;
const VERIFY_POLL_TIMEOUT_MS = 30000;

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function formatTimestamp(ts: string): string {
  // "20260411_070729" → "11.04.2026, 07:07"
  if (ts.length < 15) return ts;
  const y = ts.slice(0, 4), m = ts.slice(4, 6), d = ts.slice(6, 8);
  const h = ts.slice(9, 11), min = ts.slice(11, 13);
  return `${d}.${m}.${y}, ${h}:${min}`;
}

function formatDeployedAt(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso.slice(0, 16); }
}

interface Deployment {
  sha: string;       // git SHA (empty string for some legacy attic entries)
  branch: string;    // git branch name ("main" or "branch-{TS}")
  source: string;    // initial | update | agent
  version: string;   // service version at deploy time (e.g. "0.0.102")
  deployed_at: string;  // ISO datetime
  is_live: boolean;
  timestamp?: string;  // legacy attic timestamp (only present for attic-source deployments)
}

interface DeployedVersion {
  schema?: number;
  version?: string;
  commit?: string;
  codebase?: string;
  deployed_at?: string;
  source?: string;
}

type Status = 'idle' | 'loading' | 'updating' | 'verifying' | 'rolling_back' | 'error';

function rollbackId(d: Deployment): string {
  // Prefer sha; fall back to legacy timestamp for attic-only deployments
  return d.sha || d.timestamp || '';
}

function deploymentMeta(source: string | undefined): { icon: typeof IconArrowBackUp; colorClass: string; bgClass: string; label: string } {
  switch (source) {
    case 'initial':
      return { icon: IconSparkles, colorClass: 'text-blue-500', bgClass: 'bg-blue-500/5', label: 'Erstversion' };
    case 'update':
      return { icon: IconRefresh, colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/5', label: 'Scaffold-Update' };
    case 'agent':
      return { icon: IconMessageCircle, colorClass: 'text-violet-500', bgClass: 'bg-violet-500/5', label: 'KI-Änderung' };
    default:
      return { icon: IconArrowBackUp, colorClass: 'text-muted-foreground', bgClass: '', label: '' };
  }
}

async function fetchDeployedVersion(): Promise<DeployedVersion | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Poll version.json until the deployed codebase SHA matches the expected one,
// or a full match on version is seen (rollback case, where we have no receipt
// SHA in advance but a target version). Returns the observed version on success.
async function waitForVersion(
  predicate: (v: DeployedVersion) => boolean,
): Promise<DeployedVersion | null> {
  const deadline = Date.now() + VERIFY_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const v = await fetchDeployedVersion();
    if (v && predicate(v)) return v;
    await new Promise(r => setTimeout(r, VERIFY_POLL_INTERVAL_MS));
  }
  return null;
}

interface ConfirmProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  destructive?: boolean;
}

function ConfirmPrompt({ open, title, description, confirmLabel, onCancel, onConfirm, destructive }: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VersionCheck() {
  const [status, setStatus] = useState<Status>('loading');
  const [deployedVersion, setDeployedVersion] = useState('');
  const [deployedCommit, setDeployedCommit] = useState('');
  const [deployedAt, setDeployedAt] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [rollbackDialog, setRollbackDialog] = useState<Deployment | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const applyDeployed = useCallback((d: DeployedVersion, latest: string) => {
    setDeployedVersion(d.version || '');
    setDeployedCommit(d.commit || '');
    setDeployedAt(d.deployed_at || '');
    const current = d.version || '';
    setUpdateAvailable(!!(current && latest && compareSemver(latest, current) > 0));
  }, []);

  const refreshDeployments = useCallback(async () => {
    try {
      const res = await fetch(DEPLOYMENTS_ENDPOINT, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [deployedRes, serviceRes] = await Promise.all([
          fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(VERSION_ENDPOINT, { credentials: 'include' }),
        ]);
        if (cancelled) return;
        if (!deployedRes.ok || !serviceRes.ok) { setStatus('idle'); return; }
        const deployed: DeployedVersion = await deployedRes.json();
        const service = await serviceRes.json();
        setLatestVersion(service.version || '');
        applyDeployed(deployed, service.version || '');
        setStatus('idle');
      } catch { setStatus('idle'); }
    })();
    return () => { cancelled = true; };
  }, [applyDeployed]);

  const loadDeployments = useCallback(async () => {
    if (deployments.length > 0) return;
    setLoadingDeployments(true);
    await refreshDeployments();
    setLoadingDeployments(false);
  }, [deployments.length, refreshDeployments]);

  const performUpdate = useCallback(async () => {
    setUpdateDialogOpen(false);
    setShowPanel(false);
    setStatus('updating');
    setStatusMessage('');
    try {
      const resp = await fetch(UPDATE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, fix_errors: true }),
      });
      if (!resp.ok || !resp.body) { setStatus('error'); return; }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receipt: { version?: string; codebase?: string } | null = null;
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[UPDATED] ')) {
            try { receipt = JSON.parse(content.slice(10)); } catch { /* ignore */ }
          } else if (content.startsWith('[DONE]')) {
            done = true;
            break;
          } else if (content.startsWith('[ERROR]')) {
            setStatus('error');
            return;
          }
        }
      }

      if (!receipt || !receipt.codebase || !receipt.version) {
        // No receipt → server didn't confirm a successful deploy; don't reload.
        setStatus('error');
        return;
      }

      // Verify: poll version.json until the expected codebase lands.
      setStatus('verifying');
      const expectedCodebase = receipt.codebase;
      const verified = await waitForVersion(v => v.codebase === expectedCodebase);
      if (!verified) {
        setStatusMessage('Version konnte nicht bestätigt werden. Bitte Seite neu laden.');
        setStatus('error');
        return;
      }

      applyDeployed(verified, latestVersion);
      await refreshDeployments();
      setStatus('idle');
    } catch { setStatus('error'); }
  }, [applyDeployed, latestVersion, refreshDeployments]);

  const performRollback = useCallback(async (deployment: Deployment) => {
    setRollbackDialog(null);
    const rid = rollbackId(deployment);
    setRollbackTarget(rid);
    setStatus('rolling_back');
    setStatusMessage('');
    try {
      const body: Record<string, string> = { appgroup_id: APPGROUP_ID };
      if (deployment.sha) body.sha = deployment.sha;
      else if (deployment.timestamp) body.timestamp = deployment.timestamp;
      else { setStatus('error'); setRollbackTarget(null); return; }

      // Snapshot deployed_at BEFORE the rollback so we can detect that
      // version.json actually rotated (guards against legacy attic entries
      // that share the same VERSION as the current deployment).
      const beforeSnapshot = await fetchDeployedVersion();
      const beforeDeployedAt = beforeSnapshot?.deployed_at || '';

      const resp = await fetch(ROLLBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!resp.ok) { setStatus('error'); setRollbackTarget(null); return; }

      // Verify in two dimensions:
      //   - deployed_at must have rotated (S3 actually got the new file)
      //   - sha must match (or for legacy attic: version must match)
      setStatus('verifying');
      const targetSha = deployment.sha || '';
      const targetVersion = deployment.version || '';
      const verified = await waitForVersion(v => {
        if ((v.deployed_at || '') === beforeDeployedAt) return false;
        if (targetSha) return v.codebase === targetSha;
        if (targetVersion) return v.version === targetVersion;
        return false;
      });

      if (!verified) {
        setStatusMessage('Version konnte nicht bestätigt werden. Bitte Seite neu laden.');
        setStatus('error');
        setRollbackTarget(null);
        return;
      }

      applyDeployed(verified, latestVersion);
      await refreshDeployments();
      setRollbackTarget(null);
      setStatus('idle');
    } catch { setStatus('error'); setRollbackTarget(null); }
  }, [applyDeployed, latestVersion, refreshDeployments]);

  if (status === 'loading') return null;

  if (status === 'updating' || status === 'verifying' || status === 'rolling_back') {
    const label = status === 'updating'
      ? 'Aktualisiert…'
      : status === 'verifying'
        ? 'Version wird bestätigt…'
        : 'Wird zurückgesetzt…';
    const Icon = status === 'rolling_back' ? IconHistory : IconRefresh;
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
        <Icon size={14} className="shrink-0 animate-spin" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div>
      {/* Version button — toggles panel */}
      <button
        onClick={() => {
          const next = !showPanel;
          setShowPanel(next);
          if (next) loadDeployments();
        }}
        className="flex items-center justify-between gap-2 w-full px-4 py-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-sidebar-accent/30"
      >
        <span className="flex items-center gap-1.5">
          <IconClock size={13} className="shrink-0" />
          {deployedVersion ? `v${deployedVersion}` : '—'}
          {deployedCommit && <span className="text-muted-foreground/50">({deployedCommit})</span>}
        </span>
        <IconChevronDown size={13} className={`shrink-0 transition-transform ${showPanel ? 'rotate-180' : ''}`} />
      </button>

      {/* Update banner */}
      {updateAvailable && !showPanel && (
        <button
          onClick={() => setUpdateDialogOpen(true)}
          className="flex items-center gap-2 mx-3 mt-1 px-3 py-1.5 w-[calc(100%-1.5rem)] rounded-lg text-xs font-medium text-[#2563eb] bg-secondary border border-[#bfdbfe] hover:bg-[#dbeafe] transition-colors"
        >
          <IconRefresh size={13} className="shrink-0" />
          <span>Update verfügbar: v{latestVersion}</span>
        </button>
      )}

      {/* Versions panel */}
      {showPanel && (() => {
        // Group deployments by branch
        const grouped = new Map<string, Deployment[]>();
        for (const d of deployments) {
          const key = d.branch || 'main';
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(d);
        }
        const liveDep = deployments.find(d => d.is_live);
        const liveBranch = liveDep?.branch || 'main';
        const mainDeps = grouped.get('main') || [];
        const altKeys = [...grouped.keys()].filter(k => k !== 'main')
          .sort((a, b) => {
            const at = grouped.get(a)![0]?.deployed_at || '';
            const bt = grouped.get(b)![0]?.deployed_at || '';
            return bt.localeCompare(at);
          });
        const branchEntries = selectedBranch ? (grouped.get(selectedBranch) || []) : [];

        return (
        <div className="mx-3 mt-1 mb-2 rounded-xl border border-sidebar-border bg-sidebar overflow-hidden">
          {/* Update button at top */}
          {updateAvailable && !selectedBranch && (
            <button
              onClick={() => setUpdateDialogOpen(true)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-[#2563eb] bg-secondary/50 hover:bg-secondary border-b border-sidebar-border transition-colors"
            >
              <IconRefresh size={13} className="shrink-0" />
              <span>Update verfügbar: v{latestVersion}</span>
            </button>
          )}

          {loadingDeployments ? (
            <div className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <IconLoader size={13} className="animate-spin" />
              <span>Lade Versionen...</span>
            </div>
          ) : deployments.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              Keine früheren Versionen
            </div>

          /* ── Ebene 2: Version list for selected branch ── */
          ) : selectedBranch ? (
            <div className="max-h-72 overflow-y-auto">
              {/* Back button */}
              <button
                onClick={() => setSelectedBranch(null)}
                className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border-b border-sidebar-border transition-colors"
              >
                <IconArrowLeft size={13} className="shrink-0" />
                {selectedBranch === 'main' ? 'Hauptlinie' : 'Alternative Richtung'}
              </button>

              {/* Version entries */}
              {branchEntries.map((dep) => {
                const meta = deploymentMeta(dep.source);
                const Icon = meta.icon;
                const rid = rollbackId(dep);
                const displayTime = dep.deployed_at
                  ? formatDeployedAt(dep.deployed_at)
                  : (dep.timestamp ? formatTimestamp(dep.timestamp) : '');
                return (
                  <button
                    key={rid || dep.deployed_at}
                    onClick={() => setRollbackDialog(dep)}
                    disabled={dep.is_live || rollbackTarget === rid}
                    className={`group flex items-center gap-2 w-full text-left text-xs transition-colors border-b border-sidebar-border last:border-b-0 ${
                      dep.is_live
                        ? 'bg-primary/5 border-l-[3px] border-l-primary pl-2.5 pr-3 py-2.5 cursor-default'
                        : 'px-3 py-2 hover:bg-sidebar-accent/30 disabled:opacity-50'
                    }`}
                  >
                    {dep.is_live ? (
                      <IconCheck size={14} className="shrink-0 text-primary" />
                    ) : (
                      <>
                        <Icon size={14} className={`shrink-0 ${meta.colorClass} group-hover:hidden`} />
                        <IconArrowBackUp size={14} className="shrink-0 text-muted-foreground hidden group-hover:block" />
                      </>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={dep.is_live ? 'text-foreground font-semibold' : 'text-foreground font-medium'}>{displayTime}</span>
                        {dep.version && <span className="text-muted-foreground/60">v{dep.version}</span>}
                        {dep.is_live && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold uppercase tracking-wider">live</span>
                        )}
                      </div>
                      {meta.label && (
                        <div className={`text-[10px] mt-0.5 ${dep.is_live ? 'text-primary/70' : meta.colorClass}`}>{meta.label}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

          /* ── Ebene 1: Branch graph overview ── */
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {/* Main branch card (only if main has deployments) */}
              {mainDeps.length > 0 && <button
                onClick={() => setSelectedBranch('main')}
                className="w-full px-3 py-3 text-left hover:bg-sidebar-accent/20 transition-colors border-b border-sidebar-border"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-foreground">Hauptlinie</span>
                  <div className="flex items-center gap-1.5">
                    {liveBranch === 'main' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold uppercase tracking-wider">live</span>
                    )}
                    <IconChevronDown size={12} className="-rotate-90 text-muted-foreground" />
                  </div>
                </div>
                {/* Dot-line */}
                <div className="flex items-center gap-0 mb-1">
                  {Array.from({ length: Math.min(mainDeps.length, 8) }).map((_, i) => (
                    <Fragment key={i}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${liveBranch === 'main' ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      {i < Math.min(mainDeps.length, 8) - 1 && (
                        <div className={`w-3 h-0.5 ${liveBranch === 'main' ? 'bg-primary/40' : 'bg-border'}`} />
                      )}
                    </Fragment>
                  ))}
                  {mainDeps.length > 8 && <span className="text-[9px] text-muted-foreground ml-1">+{mainDeps.length - 8}</span>}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {mainDeps.length} {mainDeps.length === 1 ? 'Version' : 'Versionen'}
                </span>
              </button>}

              {/* Alternative branches — indented with connector only when main exists */}
              {altKeys.length > 0 && (
                <div className={mainDeps.length > 0 ? 'ml-4 border-l-2 border-violet-300/50' : ''}>
                  {altKeys.map((branchKey, idx) => {
                    const deps = grouped.get(branchKey)!;
                    const hasLive = branchKey === liveBranch;
                    return (
                      <button
                        key={branchKey}
                        onClick={() => setSelectedBranch(branchKey)}
                        className={`w-full pl-3 pr-3 py-3 text-left hover:bg-sidebar-accent/20 transition-colors ${idx < altKeys.length - 1 ? 'border-b border-sidebar-border' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-foreground">
                            Alternative Richtung{altKeys.length > 1 ? ` ${idx + 1}` : ''}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {hasLive && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-500 font-semibold uppercase tracking-wider">live</span>
                            )}
                            <IconChevronDown size={12} className="-rotate-90 text-muted-foreground" />
                          </div>
                        </div>
                        {/* Dot-line */}
                        <div className="flex items-center gap-0 mb-1">
                          {Array.from({ length: Math.min(deps.length, 8) }).map((_, i) => (
                            <Fragment key={i}>
                              <div className={`w-2 h-2 rounded-full shrink-0 ${hasLive ? 'bg-violet-500' : 'bg-violet-400'}`} />
                              {i < Math.min(deps.length, 8) - 1 && (
                                <div className={`w-3 h-0.5 ${hasLive ? 'bg-violet-300' : 'bg-violet-200'}`} />
                              )}
                            </Fragment>
                          ))}
                          {deps.length > 8 && <span className="text-[9px] text-muted-foreground ml-1">+{deps.length - 8}</span>}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {deps.length} {deps.length === 1 ? 'Version' : 'Versionen'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        );
      })()}

      {status === 'error' && (
        <div className="mx-3 mt-1 px-3 py-1.5 text-xs text-destructive bg-destructive/10 rounded-lg">
          {statusMessage || 'Fehler aufgetreten'}
        </div>
      )}

      <ConfirmPrompt
        open={updateDialogOpen}
        title="Update installieren?"
        description="Die Anwendung wird auf die neueste Version aktualisiert. Das dauert einige Minuten."
        confirmLabel="Aktualisieren"
        onCancel={() => setUpdateDialogOpen(false)}
        onConfirm={performUpdate}
      />

      <ConfirmPrompt
        open={rollbackDialog !== null}
        title="Version zurücksetzen?"
        description="Die Anwendung wird auf die ausgewählte Version zurückgesetzt."
        confirmLabel="Zurücksetzen"
        destructive
        onCancel={() => setRollbackDialog(null)}
        onConfirm={() => rollbackDialog && performRollback(rollbackDialog)}
      />
    </div>
  );
}
