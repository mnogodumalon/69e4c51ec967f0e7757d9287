import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichKatzenverwaltung, enrichBuchungsverwaltung } from '@/lib/enrich';
import type { EnrichedBuchungsverwaltung } from '@/types/enriched';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconCat, IconBuilding,
  IconCalendar, IconUsers, IconBed, IconHeartHandshake,
  IconCurrencyEuro, IconClipboardList, IconChevronRight,
  IconCalendarPlus, IconClipboardCheck
} from '@tabler/icons-react';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { BuchungsverwaltungDialog } from '@/components/dialogs/BuchungsverwaltungDialog';
import { GesundheitsprotokollDialog } from '@/components/dialogs/GesundheitsprotokollDialog';

const APPGROUP_ID = '69e4c51ec967f0e7757d9287';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  anfrage:     { label: 'Anfrage',     color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400' },
  bestaetigt:  { label: 'Bestätigt',   color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500' },
  eingecheckt: { label: 'Eingecheckt', color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200',dot: 'bg-emerald-500' },
  ausgecheckt: { label: 'Ausgecheckt', color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200',   dot: 'bg-slate-400' },
  storniert:   { label: 'Storniert',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       dot: 'bg-red-400' },
};

const ZIMMER_STATUS_COLOR: Record<string, string> = {
  verfuegbar: 'bg-emerald-100 text-emerald-800',
  belegt:     'bg-blue-100 text-blue-800',
  reinigung:  'bg-amber-100 text-amber-800',
  gesperrt:   'bg-red-100 text-red-800',
};

export default function DashboardOverview() {
  const {
    kundenverwaltung, katzenverwaltung, zimmerverwaltung, leistungsverwaltung,
    buchungsverwaltung, gesundheitsprotokoll,
    kundenverwaltungMap, katzenverwaltungMap, zimmerverwaltungMap, leistungsverwaltungMap, buchungsverwaltungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedKatzenverwaltung = enrichKatzenverwaltung(katzenverwaltung, { kundenverwaltungMap });
  const enrichedBuchungsverwaltung = enrichBuchungsverwaltung(buchungsverwaltung, { kundenverwaltungMap, katzenverwaltungMap, zimmerverwaltungMap, leistungsverwaltungMap });

  const [buchungDialogOpen, setBuchungDialogOpen] = useState(false);
  const [editBuchung, setEditBuchung] = useState<EnrichedBuchungsverwaltung | null>(null);
  const [deleteBuchung, setDeleteBuchung] = useState<EnrichedBuchungsverwaltung | null>(null);
  const [protokollDialogOpen, setProtokollDialogOpen] = useState(false);
  const [protokollBuchungId, setProtokollBuchungId] = useState<string | null>(null);
  const [protokollKatzeId, setProtokollKatzeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'aktiv' | 'alle' | 'zimmer'>('aktiv');

  const today = new Date().toISOString().slice(0, 10);

  const aktiveBuchungen = useMemo(() =>
    enrichedBuchungsverwaltung.filter(b =>
      b.fields.buchungsstatus?.key === 'eingecheckt' ||
      b.fields.buchungsstatus?.key === 'bestaetigt'
    ),
    [enrichedBuchungsverwaltung]
  );

  const heuteAnreise = useMemo(() =>
    enrichedBuchungsverwaltung.filter(b => {
      const a = b.fields.anreise ?? '';
      return a.startsWith(today) && b.fields.buchungsstatus?.key !== 'storniert';
    }),
    [enrichedBuchungsverwaltung, today]
  );

  const heuteAbreise = useMemo(() =>
    enrichedBuchungsverwaltung.filter(b => {
      const a = b.fields.abreise ?? '';
      return a.startsWith(today) && b.fields.buchungsstatus?.key !== 'storniert';
    }),
    [enrichedBuchungsverwaltung, today]
  );

  const umsatzGesamt = useMemo(() =>
    buchungsverwaltung.reduce((s, b) => s + (b.fields.gesamtpreis ?? 0), 0),
    [buchungsverwaltung]
  );

  const displayBuchungen = useMemo(() => {
    if (activeTab === 'aktiv') return aktiveBuchungen;
    if (activeTab === 'alle') return enrichedBuchungsverwaltung;
    return [];
  }, [activeTab, aktiveBuchungen, enrichedBuchungsverwaltung]);

  const handleDeleteBuchung = async () => {
    if (!deleteBuchung) return;
    await LivingAppsService.deleteBuchungsverwaltungEntry(deleteBuchung.record_id);
    setDeleteBuchung(null);
    fetchAll();
  };

  const handleStatusChange = async (buchung: EnrichedBuchungsverwaltung, newStatus: string) => {
    await LivingAppsService.updateBuchungsverwaltungEntry(buchung.record_id, { buchungsstatus: newStatus });
    fetchAll();
  };

  const openProtokoll = (buchung: EnrichedBuchungsverwaltung) => {
    setProtokollBuchungId(buchung.record_id);
    const katzeId = extractRecordId(buchung.fields.katzen);
    setProtokollKatzeId(katzeId);
    setProtokollDialogOpen(true);
  };

  // All hooks MUST be before early returns
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Workflow-Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/neue-buchung" className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 border-l-4 border-l-primary overflow-hidden">
          <IconCalendarPlus size={24} className="text-primary shrink-0" stroke={1.5} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">Neue Buchung anlegen</div>
            <div className="text-xs text-muted-foreground line-clamp-2">Kunde, Katzen, Zimmer und Leistungen in einem Schritt buchen</div>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" stroke={1.5} />
        </a>
        <a href="#/intents/tagesprotokoll" className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 border-l-4 border-l-primary overflow-hidden">
          <IconClipboardCheck size={24} className="text-primary shrink-0" stroke={1.5} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">Tagesprotokoll erfassen</div>
            <div className="text-xs text-muted-foreground line-clamp-2">Gesundheitszustand aller Katzen einer aktiven Buchung protokollieren</div>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" stroke={1.5} />
        </a>
      </div>

      {/* KPI-Leiste */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Aktuelle Gäste"
          value={String(aktiveBuchungen.length)}
          description="Eingecheckt & bestätigt"
          icon={<IconCat size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Anreise heute"
          value={String(heuteAnreise.length)}
          description={today}
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Abreise heute"
          value={String(heuteAbreise.length)}
          description={today}
          icon={<IconBed size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamtumsatz"
          value={formatCurrency(umsatzGesamt)}
          description={`${buchungsverwaltung.length} Buchungen`}
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Heute-Banner wenn Anreise/Abreise */}
      {(heuteAnreise.length > 0 || heuteAbreise.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {heuteAnreise.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold text-emerald-800 text-sm">Anreise heute ({heuteAnreise.length})</span>
              </div>
              <div className="space-y-2">
                {heuteAnreise.map(b => (
                  <div key={b.record_id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-emerald-900 truncate min-w-0">{b.katzenName ?? '—'}</span>
                    <span className="text-emerald-700 shrink-0 text-xs">{b.kundeName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {heuteAbreise.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700 text-sm">Abreise heute ({heuteAbreise.length})</span>
              </div>
              <div className="space-y-2">
                {heuteAbreise.map(b => (
                  <div key={b.record_id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800 truncate min-w-0">{b.katzenName ?? '—'}</span>
                    <span className="text-slate-600 shrink-0 text-xs">{b.kundeName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Haupt-Workspace: Buchungen + Zimmer */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(['aktiv', 'alle', 'zimmer'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'aktiv' ? 'Aktuelle Gäste' : tab === 'alle' ? 'Alle Buchungen' : 'Zimmerplan'}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => { setEditBuchung(null); setBuchungDialogOpen(true); }}>
            <IconPlus size={15} className="mr-1.5 shrink-0" />
            Neue Buchung
          </Button>
        </div>

        {/* Zimmerplan */}
        {activeTab === 'zimmer' && (
          <div className="p-4">
            {zimmerverwaltung.length === 0 ? (
              <EmptyState icon={<IconBuilding size={40} stroke={1.5} className="text-muted-foreground" />} text="Noch keine Zimmer angelegt" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {zimmerverwaltung.map(zimmer => {
                  const aktuelleB = enrichedBuchungsverwaltung.filter(b => {
                    const zId = extractRecordId(b.fields.zimmer);
                    return zId === zimmer.record_id && b.fields.buchungsstatus?.key === 'eingecheckt';
                  });
                  const statusKey = zimmer.fields.zimmer_status?.key ?? 'verfuegbar';
                  return (
                    <div key={zimmer.record_id} className="rounded-xl border bg-background p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{zimmer.fields.zimmer_name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{zimmer.fields.zimmer_typ?.label ?? ''}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${ZIMMER_STATUS_COLOR[statusKey] ?? 'bg-muted text-muted-foreground'}`}>
                          {zimmer.fields.zimmer_status?.label ?? 'Unbekannt'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Kapazität: {zimmer.fields.kapazitaet ?? '—'}</span>
                        <span className="font-medium text-foreground">{formatCurrency(zimmer.fields.tagespreis ?? 0)}/Tag</span>
                      </div>
                      {aktuelleB.length > 0 && (
                        <div className="border-t pt-2 space-y-1">
                          {aktuelleB.map(b => (
                            <div key={b.record_id} className="flex items-center gap-1.5 text-xs">
                              <IconCat size={12} className="text-emerald-500 shrink-0" />
                              <span className="text-foreground font-medium truncate min-w-0">{b.katzenName ?? '—'}</span>
                              <span className="text-muted-foreground shrink-0 ml-auto">{b.kundeName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {aktuelleB.length === 0 && statusKey === 'verfuegbar' && (
                        <div className="text-xs text-muted-foreground italic">Frei</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Buchungsliste */}
        {activeTab !== 'zimmer' && (
          <div className="divide-y">
            {displayBuchungen.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<IconHeartHandshake size={40} stroke={1.5} className="text-muted-foreground" />}
                  text={activeTab === 'aktiv' ? 'Keine aktiven Gäste im Moment' : 'Noch keine Buchungen'}
                />
              </div>
            ) : (
              displayBuchungen.map(buchung => {
                const statusKey = buchung.fields.buchungsstatus?.key ?? 'anfrage';
                const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG['anfrage'];
                const katzeId = extractRecordId(buchung.fields.katzen);
                const katze = katzeId ? katzenverwaltungMap.get(katzeId) : null;
                const gesundheitCount = gesundheitsprotokoll.filter(g => {
                  const bId = extractRecordId(g.fields.buchung);
                  return bId === buchung.record_id;
                }).length;
                return (
                  <div key={buchung.record_id} className={`p-4 hover:bg-muted/30 transition-colors`}>
                    <div className="flex flex-wrap items-start gap-3">
                      {/* Status-Indikator */}
                      <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />

                      {/* Haupt-Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground truncate">{buchung.katzenName ?? '—'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          {buchung.fields.buchungsnummer && (
                            <span className="text-xs text-muted-foreground font-mono">#{buchung.fields.buchungsnummer}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IconUsers size={11} className="shrink-0" />
                            {buchung.kundeName ?? '—'}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconBed size={11} className="shrink-0" />
                            {buchung.zimmerName ?? '—'}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconCalendar size={11} className="shrink-0" />
                            {formatDate(buchung.fields.anreise)} – {formatDate(buchung.fields.abreise)}
                          </span>
                          {(buchung.fields.gesamtpreis ?? 0) > 0 && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <IconCurrencyEuro size={11} className="shrink-0" />
                              {formatCurrency(buchung.fields.gesamtpreis ?? 0)}
                            </span>
                          )}
                        </div>
                        {katze && (katze.fields.medikamente || katze.fields.allergien) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {katze.fields.medikamente && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-700 border border-purple-100">Medikamente</span>
                            )}
                            {katze.fields.allergien && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-orange-50 text-orange-700 border border-orange-100">Allergien</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Aktionen */}
                      <div className="flex items-center gap-1 shrink-0 flex-wrap">
                        {/* Status-Schnellwechsel */}
                        {statusKey === 'bestaetigt' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => handleStatusChange(buchung, 'eingecheckt')}
                          >
                            Einchecken
                          </Button>
                        )}
                        {statusKey === 'eingecheckt' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => handleStatusChange(buchung, 'ausgecheckt')}
                          >
                            Auschecken
                          </Button>
                        )}
                        {/* Gesundheitsprotokoll */}
                        {(statusKey === 'eingecheckt') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2 gap-1"
                            onClick={() => openProtokoll(buchung)}
                          >
                            <IconClipboardList size={13} className="shrink-0" />
                            {gesundheitCount > 0 && <span className="font-mono">{gesundheitCount}</span>}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => { setEditBuchung(buchung); setBuchungDialogOpen(true); }}
                        >
                          <IconPencil size={14} className="shrink-0" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteBuchung(buchung)}
                        >
                          <IconTrash size={14} className="shrink-0" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Statistik-Zeile unten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <IconCat size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Katzen-Gäste</span>
          </div>
          <div className="text-2xl font-bold">{enrichedKatzenverwaltung.length}</div>
          <div className="text-xs text-muted-foreground mt-1">registrierte Katzen</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <IconBuilding size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Zimmer</span>
          </div>
          <div className="text-2xl font-bold">{zimmerverwaltung.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {zimmerverwaltung.filter(z => z.fields.zimmer_status?.key === 'verfuegbar').length} verfügbar
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <IconUsers size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Kunden</span>
          </div>
          <div className="text-2xl font-bold">{kundenverwaltung.length}</div>
          <div className="text-xs text-muted-foreground mt-1">registrierte Besitzer</div>
        </div>
      </div>

      {/* Dialoge */}
      <BuchungsverwaltungDialog
        open={buchungDialogOpen}
        onClose={() => { setBuchungDialogOpen(false); setEditBuchung(null); }}
        onSubmit={async (fields) => {
          if (editBuchung) {
            await LivingAppsService.updateBuchungsverwaltungEntry(editBuchung.record_id, fields);
          } else {
            await LivingAppsService.createBuchungsverwaltungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editBuchung?.fields}
        kundenverwaltungList={kundenverwaltung}
        katzenverwaltungList={katzenverwaltung}
        zimmerverwaltungList={zimmerverwaltung}
        leistungsverwaltungList={leistungsverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungsverwaltung']}
      />

      <GesundheitsprotokollDialog
        open={protokollDialogOpen}
        onClose={() => { setProtokollDialogOpen(false); setProtokollBuchungId(null); setProtokollKatzeId(null); }}
        onSubmit={async (fields) => {
          await LivingAppsService.createGesundheitsprotokollEntry(fields);
          fetchAll();
        }}
        defaultValues={
          protokollBuchungId || protokollKatzeId
            ? {
                buchung: protokollBuchungId
                  ? createRecordUrl(APP_IDS.BUCHUNGSVERWALTUNG, protokollBuchungId)
                  : undefined,
                katze: protokollKatzeId
                  ? createRecordUrl(APP_IDS.KATZENVERWALTUNG, protokollKatzeId)
                  : undefined,
                protokoll_datum: today,
              }
            : undefined
        }
        buchungsverwaltungList={buchungsverwaltung}
        katzenverwaltungList={katzenverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Gesundheitsprotokoll']}
      />

      <ConfirmDialog
        open={!!deleteBuchung}
        title="Buchung löschen"
        description={`Buchung für ${deleteBuchung?.katzenName ?? 'diese Katze'} wirklich löschen?`}
        onConfirm={handleDeleteBuchung}
        onClose={() => setDeleteBuchung(null)}
      />
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
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
        setRepairing(false);
        setRepairFailed(true);
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
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
