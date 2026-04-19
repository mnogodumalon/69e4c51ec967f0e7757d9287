import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BuchungsverwaltungDialog } from '@/components/dialogs/BuchungsverwaltungDialog';
import { KatzenverwaltungDialog } from '@/components/dialogs/KatzenverwaltungDialog';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Katzenverwaltung, Buchungsverwaltung } from '@/types/app';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  IconCalendar,
  IconCheck,
  IconAlertTriangle,
  IconLoader2,
  IconCat,
  IconClipboardCheck,
  IconArrowRight,
  IconArrowLeft,
  IconCircleCheck,
  IconExternalLink,
} from '@tabler/icons-react';

// ---- Types ----

interface CatProtocol {
  catId: string;
  fressverhalten: string;
  aktivitaet: string;
  befinden: string;
  medikamente_verabreicht: boolean;
  medikamente_notiz: string;
  beobachtungen: string;
}

const WIZARD_STEPS = [
  { label: 'Datum & Buchung' },
  { label: 'Katzen protokollieren' },
  { label: 'Bestätigung & Speichern' },
];

// ---- Segmented Button Group ----

interface SegmentedGroupProps {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}

function SegmentedGroup({ options, value, onChange }: SegmentedGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            value === opt.key
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-accent'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---- Main Component ----

export default function TagesprotokollPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStep = Math.min(
    Math.max(parseInt(searchParams.get('step') || '1', 10), 1),
    3
  );
  const preselectedBuchungId = searchParams.get('buchungId') ?? null;
  const preselectedDatum =
    searchParams.get('datum') ?? new Date().toISOString().split('T')[0];

  // ---- Data ----
  const {
    buchungsverwaltung,
    katzenverwaltung,
    kundenverwaltung,
    zimmerverwaltung,
    leistungsverwaltung,
    kundenverwaltungMap,
    katzenverwaltungMap,
    loading,
    error,
    fetchAll,
  } = useDashboardData();

  // ---- Wizard state ----
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedDatum, setSelectedDatum] = useState(preselectedDatum);
  const [selectedBuchungId, setSelectedBuchungId] = useState<string | null>(preselectedBuchungId);
  const [protocols, setProtocols] = useState<Record<string, CatProtocol>>({});
  const [buchungDialogOpen, setBuchungDialogOpen] = useState(false);
  const [katzeDialogOpen, setKatzeDialogOpen] = useState(false);

  // Save state
  const [saveProgress, setSaveProgress] = useState<number>(0);
  const [savingTotal, setSavingTotal] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [saveComplete, setSaveComplete] = useState(false);

  // ---- Derived data ----

  // Filter active bookings: anreise <= selectedDatum <= abreise AND active status
  const activeBuchungen = useMemo(() => {
    return buchungsverwaltung.filter(b => {
      const status = b.fields.buchungsstatus?.key ?? '';
      const isActive = ['bestaetigt', 'aktiv', 'checked_in', 'eingecheckt'].includes(status);
      if (!isActive) return false;
      const anreise = b.fields.anreise ? b.fields.anreise.slice(0, 10) : null;
      const abreise = b.fields.abreise ? b.fields.abreise.slice(0, 10) : null;
      if (!anreise || !abreise) return false;
      return anreise <= selectedDatum && selectedDatum <= abreise;
    });
  }, [buchungsverwaltung, selectedDatum]);

  const selectedBuchung: Buchungsverwaltung | undefined = useMemo(
    () => buchungsverwaltung.find(b => b.record_id === selectedBuchungId),
    [buchungsverwaltung, selectedBuchungId]
  );

  const selectedKundeName = useMemo(() => {
    if (!selectedBuchung?.fields.kunde) return '';
    const kundeId = extractRecordId(selectedBuchung.fields.kunde);
    if (!kundeId) return '';
    const kunde = kundenverwaltungMap.get(kundeId);
    if (!kunde) return '';
    return [kunde.fields.vorname, kunde.fields.nachname].filter(Boolean).join(' ');
  }, [selectedBuchung, kundenverwaltungMap]);

  // Cats for selected booking
  const bookingCatIds = useMemo(() => {
    if (!selectedBuchung?.fields.katzen) return [];
    // katzen is applookup/select — single or comma-separated URLs? Check as single URL.
    const url = selectedBuchung.fields.katzen;
    // It may be a single URL (applookup/select)
    const id = extractRecordId(url);
    if (id) return [id];
    return [];
  }, [selectedBuchung]);

  const bookingCats: Katzenverwaltung[] = useMemo(() => {
    return bookingCatIds
      .map(id => katzenverwaltungMap.get(id))
      .filter((c): c is Katzenverwaltung => c !== undefined);
  }, [bookingCatIds, katzenverwaltungMap]);

  // Lookup options
  const fressverhaltenOpts = LOOKUP_OPTIONS.gesundheitsprotokoll?.fressverhalten ?? [];
  const aktivitaetOpts = LOOKUP_OPTIONS.gesundheitsprotokoll?.aktivitaet ?? [];
  const befindenOpts = LOOKUP_OPTIONS.gesundheitsprotokoll?.befinden ?? [];

  // Per-cat protocol helpers
  const getProtocol = useCallback((catId: string): CatProtocol => {
    return (
      protocols[catId] ?? {
        catId,
        fressverhalten: '',
        aktivitaet: '',
        befinden: '',
        medikamente_verabreicht: false,
        medikamente_notiz: '',
        beobachtungen: '',
      }
    );
  }, [protocols]);

  const updateProtocol = useCallback((catId: string, update: Partial<CatProtocol>) => {
    setProtocols(prev => ({
      ...prev,
      [catId]: { ...getProtocol(catId), ...update },
    }));
  }, [getProtocol]);

  const isCatComplete = useCallback((catId: string): boolean => {
    const p = protocols[catId];
    if (!p) return false;
    return !!(p.fressverhalten && p.aktivitaet && p.befinden);
  }, [protocols]);

  const completedCount = useMemo(
    () => bookingCats.filter(c => isCatComplete(c.record_id)).length,
    [bookingCats, isCatComplete]
  );

  // ---- Step navigation with URL sync ----
  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    const params = new URLSearchParams(searchParams);
    params.set('step', String(step));
    if (selectedBuchungId) params.set('buchungId', selectedBuchungId);
    params.set('datum', selectedDatum);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, selectedBuchungId, selectedDatum]);

  // ---- Save all protocols ----
  const handleSaveAll = useCallback(async () => {
    if (!selectedBuchungId) return;
    setSaving(true);
    setSaveError(null);
    setSaveProgress(0);
    setSavedCount(0);
    setSaveComplete(false);
    setSavingTotal(bookingCats.length);

    let saved = 0;
    for (const cat of bookingCats) {
      const p = getProtocol(cat.record_id);
      try {
        await LivingAppsService.createGesundheitsprotokollEntry({
          buchung: createRecordUrl(APP_IDS.BUCHUNGSVERWALTUNG, selectedBuchungId),
          katze: createRecordUrl(APP_IDS.KATZENVERWALTUNG, cat.record_id),
          protokoll_datum: selectedDatum,
          fressverhalten: p.fressverhalten || undefined,
          aktivitaet: p.aktivitaet || undefined,
          befinden: p.befinden || undefined,
          medikamente_verabreicht: p.medikamente_verabreicht,
          medikamente_notiz: p.medikamente_notiz || undefined,
          beobachtungen: p.beobachtungen || undefined,
        });
        saved += 1;
        setSaveProgress(saved);
        setSavedCount(saved);
      } catch (err) {
        setSaving(false);
        setSaveError(
          err instanceof Error
            ? err.message
            : `Fehler beim Speichern des Protokolls für ${cat.fields.katze_name ?? 'Katze'}`
        );
        return;
      }
    }
    setSaving(false);
    setSaveComplete(true);
    await fetchAll();
  }, [selectedBuchungId, bookingCats, getProtocol, selectedDatum, fetchAll]);

  // ---- Render ----

  return (
    <IntentWizardShell
      title="Tagesprotokoll erfassen"
      subtitle="Täglich Gesundheitszustand aller Gäste dokumentieren"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ========== STEP 1: Datum & Buchung ========== */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Date picker */}
          <div className="space-y-2">
            <Label htmlFor="datum-picker" className="text-sm font-medium flex items-center gap-2">
              <IconCalendar size={16} className="text-muted-foreground" />
              Protokolldatum
            </Label>
            <input
              id="datum-picker"
              type="date"
              value={selectedDatum}
              onChange={e => {
                setSelectedDatum(e.target.value);
                setSelectedBuchungId(null);
              }}
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Booking selection */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Aktive Buchung auswählen
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({activeBuchungen.length} aktiv am {selectedDatum})
              </span>
            </h2>

            <EntitySelectStep
              items={activeBuchungen.map(b => {
                const kundeId = extractRecordId(b.fields.kunde ?? '');
                const kunde = kundeId ? kundenverwaltungMap.get(kundeId) : undefined;
                const kundeName = kunde
                  ? [kunde.fields.vorname, kunde.fields.nachname].filter(Boolean).join(' ')
                  : '';
                const anreise = b.fields.anreise ? b.fields.anreise.slice(0, 10) : '?';
                const abreise = b.fields.abreise ? b.fields.abreise.slice(0, 10) : '?';
                const katzeId = extractRecordId(b.fields.katzen ?? '');
                const katzenAnzahl = katzeId ? 1 : 0;
                return {
                  id: b.record_id,
                  title: [b.fields.buchungsnummer, kundeName].filter(Boolean).join(' — '),
                  subtitle: `${anreise} bis ${abreise} · ${katzenAnzahl} Katze${katzenAnzahl !== 1 ? 'n' : ''}`,
                  status: b.fields.buchungsstatus
                    ? { key: b.fields.buchungsstatus.key, label: b.fields.buchungsstatus.label }
                    : undefined,
                  icon: <IconCat size={18} className="text-primary" />,
                };
              })}
              onSelect={id => {
                setSelectedBuchungId(id);
              }}
              searchPlaceholder="Buchung oder Kunde suchen..."
              emptyIcon={<IconCalendar size={32} />}
              emptyText="Keine aktiven Buchungen für dieses Datum gefunden."
              createLabel="Neue Buchung anlegen"
              onCreateNew={() => setBuchungDialogOpen(true)}
              createDialog={
                <BuchungsverwaltungDialog
                  open={buchungDialogOpen}
                  onClose={() => setBuchungDialogOpen(false)}
                  onSubmit={async fields => {
                    await LivingAppsService.createBuchungsverwaltungEntry(fields);
                    await fetchAll();
                  }}
                  kundenverwaltungList={kundenverwaltung}
                  katzenverwaltungList={katzenverwaltung}
                  zimmerverwaltungList={zimmerverwaltung}
                  leistungsverwaltungList={leistungsverwaltung}
                  enablePhotoScan={AI_PHOTO_SCAN['Buchungsverwaltung']}
                  enablePhotoLocation={AI_PHOTO_LOCATION['Buchungsverwaltung']}
                />
              }
            />
          </div>

          {/* Selected booking summary + continue */}
          {selectedBuchungId && selectedBuchung && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCheck size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {selectedBuchung.fields.buchungsnummer ?? 'Buchung'} — {selectedKundeName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bookingCatIds.length} Katze{bookingCatIds.length !== 1 ? 'n' : ''} in dieser Buchung
                  </p>
                </div>
              </div>
              <Button onClick={() => goToStep(2)} className="shrink-0 gap-2">
                Weiter
                <IconArrowRight size={16} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ========== STEP 2: Katzen protokollieren ========== */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Header with progress */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Gesundheitsprotokolle</h2>
              <p className="text-sm text-muted-foreground">
                {selectedBuchung?.fields.buchungsnummer} · {selectedDatum}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-semibold text-primary">
                {completedCount} / {bookingCats.length} vollständig
              </span>
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: bookingCats.length > 0 ? `${(completedCount / bookingCats.length) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>

          {/* Cat cards */}
          {bookingCats.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="flex justify-center opacity-40">
                <IconCat size={40} />
              </div>
              <p className="text-sm text-muted-foreground">
                Keine Katzen in dieser Buchung gefunden.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setKatzeDialogOpen(true)}
                className="gap-2"
              >
                <IconCat size={14} />
                Katze anlegen
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookingCats.map(cat => {
                const p = getProtocol(cat.record_id);
                const complete = isCatComplete(cat.record_id);
                return (
                  <div
                    key={cat.record_id}
                    className={`rounded-xl border bg-card overflow-hidden transition-colors ${
                      complete ? 'border-green-300' : 'border-border'
                    }`}
                  >
                    {/* Cat header */}
                    <div className={`px-4 py-3 flex items-center gap-3 ${complete ? 'bg-green-50' : 'bg-muted/30'}`}>
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <IconCat size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">
                            {cat.fields.katze_name ?? 'Unbekannte Katze'}
                          </span>
                          {cat.fields.rasse && (
                            <span className="text-xs text-muted-foreground">{cat.fields.rasse}</span>
                          )}
                          {cat.fields.farbe && (
                            <span className="text-xs text-muted-foreground">· {cat.fields.farbe}</span>
                          )}
                          {complete && (
                            <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-700">
                              <IconCircleCheck size={14} stroke={2} />
                              Vollständig
                            </span>
                          )}
                        </div>
                        {/* Warnings */}
                        <div className="flex flex-wrap gap-2 mt-1">
                          {cat.fields.medikamente && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                              <IconAlertTriangle size={11} stroke={2} />
                              Medikamente: {cat.fields.medikamente}
                            </span>
                          )}
                          {cat.fields.allergien && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                              <IconAlertTriangle size={11} stroke={2} />
                              Allergien: {cat.fields.allergien}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Protocol form */}
                    <div className="p-4 space-y-4">
                      {/* Fressverhalten */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Fressverhalten <span className="text-destructive">*</span>
                        </Label>
                        <SegmentedGroup
                          options={fressverhaltenOpts}
                          value={p.fressverhalten}
                          onChange={val => updateProtocol(cat.record_id, { fressverhalten: val })}
                        />
                      </div>

                      {/* Aktivität */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Aktivität <span className="text-destructive">*</span>
                        </Label>
                        <SegmentedGroup
                          options={aktivitaetOpts}
                          value={p.aktivitaet}
                          onChange={val => updateProtocol(cat.record_id, { aktivitaet: val })}
                        />
                      </div>

                      {/* Befinden */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Befinden <span className="text-destructive">*</span>
                        </Label>
                        <SegmentedGroup
                          options={befindenOpts}
                          value={p.befinden}
                          onChange={val => updateProtocol(cat.record_id, { befinden: val })}
                        />
                      </div>

                      {/* Medikamente verabreicht */}
                      {cat.fields.medikamente && (
                        <div className="flex items-start gap-2 pt-1">
                          <Checkbox
                            id={`med-${cat.record_id}`}
                            checked={p.medikamente_verabreicht}
                            onCheckedChange={checked =>
                              updateProtocol(cat.record_id, {
                                medikamente_verabreicht: checked === true,
                              })
                            }
                          />
                          <Label htmlFor={`med-${cat.record_id}`} className="text-sm leading-snug cursor-pointer">
                            Medikamente verabreicht
                          </Label>
                        </div>
                      )}

                      {/* Medikamente Notiz (only when checked) */}
                      {p.medikamente_verabreicht && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Medikamenten-Notiz
                          </Label>
                          <Textarea
                            placeholder="Welche Medikamente, Dosis, Uhrzeit..."
                            value={p.medikamente_notiz}
                            onChange={e =>
                              updateProtocol(cat.record_id, { medikamente_notiz: e.target.value })
                            }
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>
                      )}

                      {/* Beobachtungen */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Beobachtungen
                        </Label>
                        <Textarea
                          placeholder="Weitere Beobachtungen oder Auffälligkeiten..."
                          value={p.beobachtungen}
                          onChange={e =>
                            updateProtocol(cat.record_id, { beobachtungen: e.target.value })
                          }
                          rows={2}
                          className="resize-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add cat button */}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setKatzeDialogOpen(true)}
              className="gap-2"
            >
              <IconCat size={15} />
              Neue Katze anlegen
            </Button>
            <KatzenverwaltungDialog
              open={katzeDialogOpen}
              onClose={() => setKatzeDialogOpen(false)}
              onSubmit={async fields => {
                await LivingAppsService.createKatzenverwaltungEntry(fields);
                await fetchAll();
              }}
              kundenverwaltungList={kundenverwaltung}
              enablePhotoScan={AI_PHOTO_SCAN['Katzenverwaltung']}
              enablePhotoLocation={AI_PHOTO_LOCATION['Katzenverwaltung']}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button variant="outline" onClick={() => goToStep(1)} className="gap-2">
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={() => goToStep(3)}
              disabled={bookingCats.length === 0}
              className="gap-2"
            >
              Weiter zur Zusammenfassung
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ========== STEP 3: Bestätigung & Speichern ========== */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {saveComplete ? (
            /* Success state */
            <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <IconClipboardCheck size={32} className="text-green-600" stroke={1.5} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Protokolle gespeichert!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {savedCount} Gesundheitsprotokoll{savedCount !== 1 ? 'e' : ''} wurden erfolgreich gespeichert.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentStep(1);
                    setSelectedBuchungId(null);
                    setProtocols({});
                    setSaveComplete(false);
                    setSavedCount(0);
                    const params = new URLSearchParams();
                    params.set('datum', selectedDatum);
                    setSearchParams(params, { replace: true });
                  }}
                >
                  Neues Protokoll starten
                </Button>
                <Button asChild className="gap-2">
                  <a href="#/gesundheitsprotokoll">
                    Alle Protokolle ansehen
                    <IconExternalLink size={15} />
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Summary header */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                <h2 className="text-sm font-semibold text-foreground">Zusammenfassung</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Datum</span>
                    <span className="font-medium">{selectedDatum}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Buchung</span>
                    <span className="font-medium">
                      {selectedBuchung?.fields.buchungsnummer ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Kunde</span>
                    <span className="font-medium">{selectedKundeName || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Per-cat preview */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">
                  {bookingCats.length} Katze{bookingCats.length !== 1 ? 'n' : ''} — Protokollvorschau
                </h3>
                {bookingCats.map(cat => {
                  const p = getProtocol(cat.record_id);
                  const complete = isCatComplete(cat.record_id);

                  const labelFor = (opts: { key: string; label: string }[], key: string) =>
                    opts.find(o => o.key === key)?.label ?? key;

                  return (
                    <div key={cat.record_id} className="rounded-xl border bg-card overflow-hidden">
                      <div className={`px-4 py-2.5 flex items-center gap-2 ${complete ? 'bg-green-50' : 'bg-amber-50'}`}>
                        {complete ? (
                          <IconCircleCheck size={15} className="text-green-600 shrink-0" stroke={2} />
                        ) : (
                          <IconAlertTriangle size={15} className="text-amber-600 shrink-0" stroke={2} />
                        )}
                        <span className="font-semibold text-sm">
                          {cat.fields.katze_name ?? 'Katze'}
                        </span>
                        {!complete && (
                          <span className="text-xs text-amber-700 ml-1">(unvollständig)</span>
                        )}
                      </div>
                      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground block">Fressverhalten</span>
                          <span className={p.fressverhalten ? 'font-medium' : 'text-muted-foreground'}>
                            {p.fressverhalten ? labelFor(fressverhaltenOpts, p.fressverhalten) : 'Nicht angegeben'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Aktivität</span>
                          <span className={p.aktivitaet ? 'font-medium' : 'text-muted-foreground'}>
                            {p.aktivitaet ? labelFor(aktivitaetOpts, p.aktivitaet) : 'Nicht angegeben'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Befinden</span>
                          <span className={p.befinden ? 'font-medium' : 'text-muted-foreground'}>
                            {p.befinden ? labelFor(befindenOpts, p.befinden) : 'Nicht angegeben'}
                          </span>
                        </div>
                        {p.medikamente_verabreicht && (
                          <div className="sm:col-span-3">
                            <span className="text-xs text-muted-foreground block">Medikamente verabreicht</span>
                            <span className="font-medium text-amber-700">Ja</span>
                            {p.medikamente_notiz && (
                              <span className="text-xs text-muted-foreground ml-2">— {p.medikamente_notiz}</span>
                            )}
                          </div>
                        )}
                        {p.beobachtungen && (
                          <div className="sm:col-span-3">
                            <span className="text-xs text-muted-foreground block">Beobachtungen</span>
                            <span className="text-sm">{p.beobachtungen}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Warning if some cats incomplete */}
              {completedCount < bookingCats.length && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <IconAlertTriangle size={16} className="shrink-0 mt-0.5" stroke={2} />
                  <span>
                    {bookingCats.length - completedCount} Katze{(bookingCats.length - completedCount) !== 1 ? 'n haben' : ' hat'} noch keine Pflichtfelder (Fressverhalten, Aktivität, Befinden) ausgefüllt. Diese Protokolle werden ohne diese Felder gespeichert.
                  </span>
                </div>
              )}

              {/* Save error */}
              {saveError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <IconAlertTriangle size={16} className="shrink-0 mt-0.5" stroke={2} />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Save progress indicator */}
              {saving && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconLoader2 size={16} className="animate-spin" />
                    Speichere {saveProgress} / {savingTotal} Protokoll{savingTotal !== 1 ? 'e' : ''}...
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: savingTotal > 0 ? `${(saveProgress / savingTotal) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => goToStep(2)}
                  disabled={saving}
                  className="gap-2"
                >
                  <IconArrowLeft size={16} />
                  Zurück
                </Button>
                <Button
                  onClick={handleSaveAll}
                  disabled={saving || bookingCats.length === 0}
                  className="gap-2"
                >
                  {saving ? (
                    <>
                      <IconLoader2 size={16} className="animate-spin" />
                      Speichern...
                    </>
                  ) : (
                    <>
                      <IconClipboardCheck size={16} />
                      Alle Protokolle speichern ({bookingCats.length})
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

    </IntentWizardShell>
  );
}
