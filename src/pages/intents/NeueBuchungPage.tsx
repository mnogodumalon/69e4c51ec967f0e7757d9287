import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { KundenverwaltungDialog } from '@/components/dialogs/KundenverwaltungDialog';
import { KatzenverwaltungDialog } from '@/components/dialogs/KatzenverwaltungDialog';
import { ZimmerverwaltungDialog } from '@/components/dialogs/ZimmerverwaltungDialog';
import { LeistungsverwaltungDialog } from '@/components/dialogs/LeistungsverwaltungDialog';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Kundenverwaltung, Katzenverwaltung, Zimmerverwaltung, Leistungsverwaltung } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  IconUser,
  IconCat,
  IconBuildingEstate,
  IconSparkles,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconCalendar,
  IconCurrencyEuro,
  IconPlus,
  IconCircleCheck,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Kunde' },
  { label: 'Katzen' },
  { label: 'Zimmer & Zeit' },
  { label: 'Leistungen' },
  { label: 'Zusammenfassung' },
];

function calcNights(anreise: string, abreise: string): number {
  if (!anreise || !abreise) return 0;
  const a = new Date(anreise);
  const b = new Date(abreise);
  const diff = b.getTime() - a.getTime();
  if (diff <= 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function formatEur(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function NeueBuchungPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialStep = Math.min(
    Math.max(parseInt(searchParams.get('step') || '1', 10), 1),
    5
  );
  const preselectedKundeId = searchParams.get('kundeId');

  const [currentStep, setCurrentStep] = useState(initialStep);

  // Step 1: Kunde
  const [selectedKundeId, setSelectedKundeId] = useState<string>(preselectedKundeId ?? '');
  const [kundeDialogOpen, setKundeDialogOpen] = useState(false);

  // Step 2: Katzen
  const [selectedKatzenIds, setSelectedKatzenIds] = useState<string[]>([]);
  const [katzeDialogOpen, setKatzeDialogOpen] = useState(false);

  // Step 3: Zeitraum & Zimmer
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [selectedZimmerId, setSelectedZimmerId] = useState<string>('');
  const [zimmerDialogOpen, setZimmerDialogOpen] = useState(false);

  // Step 4: Zusatzleistungen
  const [selectedLeistungIds, setSelectedLeistungIds] = useState<string[]>([]);
  const [leistungDialogOpen, setLeistungDialogOpen] = useState(false);

  // Step 5: Buchungsdetails
  const [anzahlung, setAnzahlung] = useState('');
  const [buchungshinweise, setBuchungshinweise] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const {
    kundenverwaltung,
    katzenverwaltung,
    zimmerverwaltung,
    leistungsverwaltung,
    loading,
    error,
    fetchAll,
  } = useDashboardData();

  // Derived selections
  const selectedKunde: Kundenverwaltung | undefined = useMemo(
    () => kundenverwaltung.find(k => k.record_id === selectedKundeId),
    [kundenverwaltung, selectedKundeId]
  );

  const selectedKatzen: Katzenverwaltung[] = useMemo(
    () => katzenverwaltung.filter(k => selectedKatzenIds.includes(k.record_id)),
    [katzenverwaltung, selectedKatzenIds]
  );

  const selectedZimmer: Zimmerverwaltung | undefined = useMemo(
    () => zimmerverwaltung.find(z => z.record_id === selectedZimmerId),
    [zimmerverwaltung, selectedZimmerId]
  );

  const selectedLeistungen: Leistungsverwaltung[] = useMemo(
    () => leistungsverwaltung.filter(l => selectedLeistungIds.includes(l.record_id)),
    [leistungsverwaltung, selectedLeistungIds]
  );

  const nights = calcNights(anreise, abreise);
  const zimmerKosten = (selectedZimmer?.fields.tagespreis ?? 0) * nights;
  const leistungsKosten = selectedLeistungen.reduce((acc, l) => acc + (l.fields.preis ?? 0), 0);
  const gesamtpreis = zimmerKosten + leistungsKosten;

  // Cats belonging to selected customer
  const kundenKatzen = useMemo(() => {
    if (!selectedKundeId) return katzenverwaltung;
    return katzenverwaltung.filter(k => {
      const besitzerId = extractRecordId(k.fields.besitzer ?? '');
      return besitzerId === selectedKundeId;
    });
  }, [katzenverwaltung, selectedKundeId]);

  // Available rooms (not 'belegt')
  const verfuegbareZimmer = useMemo(
    () => zimmerverwaltung.filter(z => z.fields.zimmer_status?.key !== 'belegt'),
    [zimmerverwaltung]
  );

  // Grouped services by category
  const leistungenByKategorie = useMemo(() => {
    const groups: Record<string, Leistungsverwaltung[]> = {};
    leistungsverwaltung.forEach(l => {
      const cat = l.fields.leistung_kategorie?.label ?? 'Sonstiges';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(l);
    });
    return groups;
  }, [leistungsverwaltung]);

  const handleKundeSelect = useCallback((id: string) => {
    setSelectedKundeId(id);
    // Reset downstream selections when customer changes
    setSelectedKatzenIds([]);
    setCurrentStep(2);
  }, []);

  const toggleKatze = useCallback((id: string) => {
    setSelectedKatzenIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const toggleLeistung = useCallback((id: string) => {
    setSelectedLeistungIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const handleSubmit = async () => {
    if (!selectedKundeId || !selectedZimmerId || !anreise || !abreise) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fields: Record<string, unknown> = {
        buchungsstatus: 'bestaetigt',
        zahlungsstatus: 'offen',
        anreise,
        abreise,
        kunde: createRecordUrl(APP_IDS.KUNDENVERWALTUNG, selectedKundeId),
        katzen: selectedKatzenIds.length > 0
          ? createRecordUrl(APP_IDS.KATZENVERWALTUNG, selectedKatzenIds[0])
          : undefined,
        zimmer: createRecordUrl(APP_IDS.ZIMMERVERWALTUNG, selectedZimmerId),
        zusatzleistungen: selectedLeistungIds.length > 0
          ? selectedLeistungIds.map(id => createRecordUrl(APP_IDS.LEISTUNGSVERWALTUNG, id))
          : undefined,
        gesamtpreis,
        anzahlung: anzahlung ? parseFloat(anzahlung) : undefined,
        buchungshinweise: buchungshinweise || undefined,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await LivingAppsService.createBuchungsverwaltungEntry(fields as any);
      const entries = Object.entries(result as Record<string, unknown>);
      const newId = entries.length > 0 ? (entries[0][0] as string) : '';
      setBookingSuccess(newId);
      await fetchAll();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  // Lookup options
  const buchungsstatusOptions = LOOKUP_OPTIONS['buchungsverwaltung']?.buchungsstatus ?? [];
  const zahlungsstatusOptions = LOOKUP_OPTIONS['buchungsverwaltung']?.zahlungsstatus ?? [];
  const defaultBuchungsstatus = buchungsstatusOptions.find(o => o.key === 'bestaetigt') ?? buchungsstatusOptions[0];
  const defaultZahlungsstatus = zahlungsstatusOptions.find(o => o.key === 'offen') ?? zahlungsstatusOptions[0];

  // ---- Success state ----
  if (bookingSuccess !== null) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <IconCircleCheck size={36} className="text-green-600" stroke={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Buchung erstellt!</h2>
          <p className="text-muted-foreground text-sm">
            Die Buchung für{' '}
            <span className="font-semibold text-foreground">
              {selectedKunde?.fields.vorname} {selectedKunde?.fields.nachname}
            </span>{' '}
            wurde erfolgreich angelegt.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Zimmer</span>
            <span className="font-medium">{selectedZimmer?.fields.zimmer_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Anreise</span>
            <span className="font-medium">{anreise.replace('T', ' ')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Abreise</span>
            <span className="font-medium">{abreise.replace('T', ' ')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Nächte</span>
            <span className="font-medium">{nights}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="font-semibold">Gesamtpreis</span>
            <span className="font-bold text-primary">{formatEur(gesamtpreis)}</span>
          </div>
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            variant="default"
            onClick={() => navigate('/buchungsverwaltung')}
          >
            Zur Buchungsübersicht
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setBookingSuccess(null);
              setCurrentStep(1);
              setSelectedKundeId('');
              setSelectedKatzenIds([]);
              setAnreise('');
              setAbreise('');
              setSelectedZimmerId('');
              setSelectedLeistungIds([]);
              setAnzahlung('');
              setBuchungshinweise('');
            }}
          >
            Neue Buchung anlegen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title="Neue Buchung anlegen"
      subtitle="Erstelle Schritt für Schritt eine neue Buchung für die Katzenpension."
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ======== STEP 1: Kunde auswählen ======== */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Kunden auswählen</h2>
            <p className="text-sm text-muted-foreground">
              Wähle den Kunden aus, für den die Buchung erstellt werden soll.
            </p>
          </div>

          <EntitySelectStep
            items={kundenverwaltung.map(k => ({
              id: k.record_id,
              title: [k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ') || '(Kein Name)',
              subtitle: [k.fields.email, k.fields.telefon].filter(Boolean).join(' · '),
              icon: <IconUser size={18} className="text-primary" stroke={1.5} />,
            }))}
            onSelect={handleKundeSelect}
            searchPlaceholder="Kunden suchen..."
            emptyIcon={<IconUser size={32} />}
            emptyText="Noch keine Kunden vorhanden."
            createLabel="Neuen Kunden anlegen"
            onCreateNew={() => setKundeDialogOpen(true)}
            createDialog={
              <KundenverwaltungDialog
                open={kundeDialogOpen}
                onClose={() => setKundeDialogOpen(false)}
                onSubmit={async (fields) => {
                  const result = await LivingAppsService.createKundenverwaltungEntry(fields);
                  await fetchAll();
                  const entries = Object.entries(result as Record<string, unknown>);
                  if (entries.length > 0) {
                    const newId = entries[0][0] as string;
                    setKundeDialogOpen(false);
                    handleKundeSelect(newId);
                  }
                }}
              />
            }
          />
        </div>
      )}

      {/* ======== STEP 2: Katzen auswählen ======== */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCurrentStep(1)}
              aria-label="Zurück"
            >
              <IconArrowLeft size={18} stroke={1.5} />
            </button>
            <div>
              <h2 className="text-lg font-semibold">Katzen auswählen</h2>
              <p className="text-sm text-muted-foreground">
                Wähle eine oder mehrere Katzen für die Buchung.
                {selectedKunde && (
                  <> Katzen von <span className="font-medium text-foreground">{selectedKunde.fields.vorname} {selectedKunde.fields.nachname}</span> sind hervorgehoben.</>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {katzenverwaltung.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <IconCat size={32} className="mx-auto mb-3 opacity-40" stroke={1.5} />
                <p className="text-sm">Noch keine Katzen vorhanden.</p>
              </div>
            ) : (
              <>
                {/* Katzen des Kunden zuerst */}
                {kundenKatzen.length > 0 && (
                  <div className="mb-1">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 px-1">
                      Katzen des Kunden
                    </p>
                    {kundenKatzen.map(katze => {
                      const selected = selectedKatzenIds.includes(katze.record_id);
                      return (
                        <button
                          key={katze.record_id}
                          onClick={() => toggleKatze(katze.record_id)}
                          className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border mb-2 transition-colors overflow-hidden ${
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'bg-card hover:bg-accent hover:border-primary/30'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-primary text-primary-foreground' : 'bg-primary/10'}`}>
                            {selected
                              ? <IconCheck size={18} stroke={2} />
                              : <IconCat size={18} className="text-primary" stroke={1.5} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{katze.fields.katze_name ?? '(Kein Name)'}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[katze.fields.rasse, katze.fields.geschlecht?.label].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <Checkbox
                            checked={selected}
                            className="shrink-0 pointer-events-none"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Alle anderen Katzen */}
                {katzenverwaltung.filter(k => !kundenKatzen.includes(k)).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                      Weitere Katzen
                    </p>
                    {katzenverwaltung.filter(k => !kundenKatzen.includes(k)).map(katze => {
                      const selected = selectedKatzenIds.includes(katze.record_id);
                      return (
                        <button
                          key={katze.record_id}
                          onClick={() => toggleKatze(katze.record_id)}
                          className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border mb-2 transition-colors overflow-hidden ${
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'bg-card hover:bg-accent hover:border-primary/30'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {selected
                              ? <IconCheck size={18} stroke={2} />
                              : <IconCat size={18} className="text-muted-foreground" stroke={1.5} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{katze.fields.katze_name ?? '(Kein Name)'}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[katze.fields.rasse, katze.fields.geschlecht?.label].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <Checkbox
                            checked={selected}
                            className="shrink-0 pointer-events-none"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setKatzeDialogOpen(true)}
              className="gap-2"
            >
              <IconPlus size={15} />
              Neue Katze anlegen
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <IconArrowLeft size={15} className="mr-1" />
                Zurück
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                disabled={selectedKatzenIds.length === 0}
              >
                Weiter
                <IconArrowRight size={15} className="ml-1" />
              </Button>
            </div>
          </div>

          <KatzenverwaltungDialog
            open={katzeDialogOpen}
            onClose={() => setKatzeDialogOpen(false)}
            kundenverwaltungList={kundenverwaltung}
            onSubmit={async (fields) => {
              const result = await LivingAppsService.createKatzenverwaltungEntry({
                ...fields,
                besitzer: selectedKundeId
                  ? createRecordUrl(APP_IDS.KUNDENVERWALTUNG, selectedKundeId)
                  : fields.besitzer,
              });
              await fetchAll();
              const entries = Object.entries(result as Record<string, unknown>);
              if (entries.length > 0) {
                const newId = entries[0][0] as string;
                setKatzeDialogOpen(false);
                setSelectedKatzenIds(prev => [...prev, newId]);
              }
            }}
            defaultValues={
              selectedKundeId
                ? { besitzer: createRecordUrl(APP_IDS.KUNDENVERWALTUNG, selectedKundeId) }
                : undefined
            }
          />
        </div>
      )}

      {/* ======== STEP 3: Zeitraum & Zimmer ======== */}
      {currentStep === 3 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCurrentStep(2)}
              aria-label="Zurück"
            >
              <IconArrowLeft size={18} stroke={1.5} />
            </button>
            <div>
              <h2 className="text-lg font-semibold">Zeitraum & Zimmer wählen</h2>
              <p className="text-sm text-muted-foreground">Lege den Aufenthaltszeitraum fest und wähle ein verfügbares Zimmer.</p>
            </div>
          </div>

          {/* Datum-Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="anreise" className="flex items-center gap-1.5">
                <IconCalendar size={14} className="text-muted-foreground" stroke={1.5} />
                Anreise
              </Label>
              <Input
                id="anreise"
                type="datetime-local"
                value={anreise}
                onChange={e => setAnreise(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abreise" className="flex items-center gap-1.5">
                <IconCalendar size={14} className="text-muted-foreground" stroke={1.5} />
                Abreise
              </Label>
              <Input
                id="abreise"
                type="datetime-local"
                value={abreise}
                onChange={e => setAbreise(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Live-Feedback Nächte */}
          {nights > 0 && (
            <div className="rounded-xl border bg-primary/5 border-primary/20 p-3 text-sm text-primary font-medium">
              {nights} {nights === 1 ? 'Nacht' : 'Nächte'} ausgewählt
            </div>
          )}

          {/* Zimmer-Auswahl */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Verfügbare Zimmer</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZimmerDialogOpen(true)}
                className="gap-1.5"
              >
                <IconPlus size={14} />
                Neues Zimmer
              </Button>
            </div>

            {verfuegbareZimmer.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <IconBuildingEstate size={32} className="mx-auto mb-3 opacity-40" stroke={1.5} />
                <p className="text-sm">Keine verfügbaren Zimmer.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {verfuegbareZimmer.map(zimmer => {
                  const selected = selectedZimmerId === zimmer.record_id;
                  const preis = zimmer.fields.tagespreis ?? 0;
                  const zimmerNights = nights;
                  return (
                    <button
                      key={zimmer.record_id}
                      onClick={() => setSelectedZimmerId(zimmer.record_id)}
                      className={`text-left p-4 rounded-xl border transition-colors overflow-hidden ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'bg-card hover:bg-accent hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{zimmer.fields.zimmer_name ?? '(Kein Name)'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {zimmer.fields.zimmer_typ?.label ?? '—'} · {zimmer.fields.kapazitaet ?? '?'} Plätze
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-primary">{formatEur(preis)}</p>
                          <p className="text-xs text-muted-foreground">/ Nacht</p>
                        </div>
                      </div>
                      {selected && zimmerNights > 0 && (
                        <div className="mt-3 pt-3 border-t text-xs text-primary font-medium">
                          {zimmerNights} Nächte × {formatEur(preis)} = {formatEur(preis * zimmerNights)}
                        </div>
                      )}
                      {selected && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                          <IconCheck size={13} stroke={2.5} />
                          Ausgewählt
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              <IconArrowLeft size={15} className="mr-1" />
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(4)}
              disabled={!selectedZimmerId || !anreise || !abreise || nights <= 0}
            >
              Weiter
              <IconArrowRight size={15} className="ml-1" />
            </Button>
          </div>

          <ZimmerverwaltungDialog
            open={zimmerDialogOpen}
            onClose={() => setZimmerDialogOpen(false)}
            onSubmit={async (fields) => {
              const result = await LivingAppsService.createZimmerverwaltungEntry(fields);
              await fetchAll();
              const entries = Object.entries(result as Record<string, unknown>);
              if (entries.length > 0) {
                const newId = entries[0][0] as string;
                setZimmerDialogOpen(false);
                setSelectedZimmerId(newId);
              }
            }}
          />
        </div>
      )}

      {/* ======== STEP 4: Zusatzleistungen ======== */}
      {currentStep === 4 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCurrentStep(3)}
              aria-label="Zurück"
            >
              <IconArrowLeft size={18} stroke={1.5} />
            </button>
            <div>
              <h2 className="text-lg font-semibold">Zusatzleistungen</h2>
              <p className="text-sm text-muted-foreground">Wähle optionale Zusatzleistungen für den Aufenthalt.</p>
            </div>
          </div>

          {/* Gesamtkosten-Übersicht */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Aktuelle Gesamtkosten</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Zimmer ({nights} {nights === 1 ? 'Nacht' : 'Nächte'} × {formatEur(selectedZimmer?.fields.tagespreis ?? 0)})
                </span>
                <span className="font-medium">{formatEur(zimmerKosten)}</span>
              </div>
              {selectedLeistungen.map(l => (
                <div key={l.record_id} className="flex justify-between">
                  <span className="text-muted-foreground">{l.fields.leistung_name}</span>
                  <span className="font-medium">{formatEur(l.fields.preis ?? 0)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Gesamt</span>
                <span className="text-primary">{formatEur(gesamtpreis)}</span>
              </div>
            </div>
          </div>

          {/* Leistungen nach Kategorie */}
          {leistungsverwaltung.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <IconSparkles size={32} className="mx-auto mb-3 opacity-40" stroke={1.5} />
              <p className="text-sm">Noch keine Leistungen vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(leistungenByKategorie).map(([kategorie, leistungen]) => (
                <div key={kategorie}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                    {kategorie}
                  </p>
                  <div className="space-y-2">
                    {leistungen.map(leistung => {
                      const selected = selectedLeistungIds.includes(leistung.record_id);
                      return (
                        <button
                          key={leistung.record_id}
                          onClick={() => toggleLeistung(leistung.record_id)}
                          className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border transition-colors overflow-hidden ${
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'bg-card hover:bg-accent hover:border-primary/30'
                          }`}
                        >
                          <Checkbox
                            checked={selected}
                            className="shrink-0 pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{leistung.fields.leistung_name ?? '(Kein Name)'}</p>
                            {leistung.fields.leistung_beschreibung && (
                              <p className="text-xs text-muted-foreground truncate">{leistung.fields.leistung_beschreibung}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-primary">{formatEur(leistung.fields.preis ?? 0)}</p>
                            {leistung.fields.preiseinheit?.label && (
                              <p className="text-xs text-muted-foreground">{leistung.fields.preiseinheit.label}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setLeistungDialogOpen(true)}
              className="gap-2"
            >
              <IconPlus size={15} />
              Neue Leistung anlegen
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                <IconArrowLeft size={15} className="mr-1" />
                Zurück
              </Button>
              <Button onClick={() => setCurrentStep(5)}>
                Weiter
                <IconArrowRight size={15} className="ml-1" />
              </Button>
            </div>
          </div>

          <LeistungsverwaltungDialog
            open={leistungDialogOpen}
            onClose={() => setLeistungDialogOpen(false)}
            onSubmit={async (fields) => {
              const result = await LivingAppsService.createLeistungsverwaltungEntry(fields);
              await fetchAll();
              const entries = Object.entries(result as Record<string, unknown>);
              if (entries.length > 0) {
                const newId = entries[0][0] as string;
                setLeistungDialogOpen(false);
                setSelectedLeistungIds(prev => [...prev, newId]);
              }
            }}
          />
        </div>
      )}

      {/* ======== STEP 5: Zusammenfassung ======== */}
      {currentStep === 5 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCurrentStep(4)}
              aria-label="Zurück"
            >
              <IconArrowLeft size={18} stroke={1.5} />
            </button>
            <div>
              <h2 className="text-lg font-semibold">Zusammenfassung & Buchung abschließen</h2>
              <p className="text-sm text-muted-foreground">Überprüfe alle Angaben und schließe die Buchung ab.</p>
            </div>
          </div>

          {/* Zusammenfassungs-Karten */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Kunde */}
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <IconUser size={14} stroke={1.5} />
                Kunde
              </div>
              <p className="font-semibold">
                {selectedKunde?.fields.vorname} {selectedKunde?.fields.nachname}
              </p>
              {selectedKunde?.fields.email && (
                <p className="text-xs text-muted-foreground">{selectedKunde.fields.email}</p>
              )}
              {selectedKunde?.fields.telefon && (
                <p className="text-xs text-muted-foreground">{selectedKunde.fields.telefon}</p>
              )}
            </div>

            {/* Katzen */}
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <IconCat size={14} stroke={1.5} />
                Katzen ({selectedKatzen.length})
              </div>
              {selectedKatzen.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine Katzen ausgewählt</p>
              ) : (
                <ul className="space-y-1">
                  {selectedKatzen.map(k => (
                    <li key={k.record_id} className="text-sm font-medium">
                      {k.fields.katze_name ?? '(Kein Name)'}
                      {k.fields.rasse && <span className="text-xs text-muted-foreground ml-1">({k.fields.rasse})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Zimmer */}
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <IconBuildingEstate size={14} stroke={1.5} />
                Zimmer
              </div>
              <p className="font-semibold">{selectedZimmer?.fields.zimmer_name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">
                {selectedZimmer?.fields.zimmer_typ?.label} · {formatEur(selectedZimmer?.fields.tagespreis ?? 0)} / Nacht
              </p>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{anreise.replace('T', ' ')}</span>
                {' bis '}
                <span className="font-medium text-foreground">{abreise.replace('T', ' ')}</span>
              </div>
              <p className="text-xs text-primary font-medium">
                {nights} {nights === 1 ? 'Nacht' : 'Nächte'} = {formatEur(zimmerKosten)}
              </p>
            </div>

            {/* Buchungsstatus */}
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <IconCheck size={14} stroke={1.5} />
                Buchungsstatus
              </div>
              <p className="font-semibold">{defaultBuchungsstatus?.label ?? 'Bestätigt'}</p>
              <p className="text-xs text-muted-foreground">
                Zahlungsstatus: <span className="font-medium text-foreground">{defaultZahlungsstatus?.label ?? 'Offen'}</span>
              </p>
            </div>
          </div>

          {/* Zusatzleistungen */}
          {selectedLeistungen.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <IconSparkles size={14} stroke={1.5} />
                Zusatzleistungen ({selectedLeistungen.length})
              </div>
              <div className="space-y-2">
                {selectedLeistungen.map(l => (
                  <div key={l.record_id} className="flex justify-between text-sm">
                    <span>{l.fields.leistung_name}</span>
                    <span className="font-medium">{formatEur(l.fields.preis ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preisaufstellung */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <IconCurrencyEuro size={14} stroke={1.5} />
              Preisaufstellung
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Zimmer ({nights} {nights === 1 ? 'Nacht' : 'Nächte'} × {formatEur(selectedZimmer?.fields.tagespreis ?? 0)})
                </span>
                <span>{formatEur(zimmerKosten)}</span>
              </div>
              {selectedLeistungen.map(l => (
                <div key={l.record_id} className="flex justify-between">
                  <span className="text-muted-foreground">{l.fields.leistung_name}</span>
                  <span>{formatEur(l.fields.preis ?? 0)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Gesamtpreis</span>
                <span className="text-primary">{formatEur(gesamtpreis)}</span>
              </div>
            </div>
          </div>

          {/* BudgetTracker als visuelle Anzahlung-Übersicht */}
          {anzahlung && parseFloat(anzahlung) > 0 && (
            <BudgetTracker
              budget={gesamtpreis}
              booked={parseFloat(anzahlung)}
              label="Anzahlung"
              showRemaining
            />
          )}

          {/* Anzahlung & Hinweise */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="anzahlung">Anzahlung (€)</Label>
              <Input
                id="anzahlung"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={anzahlung}
                onChange={e => setAnzahlung(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buchungshinweise">Buchungshinweise</Label>
              <Textarea
                id="buchungshinweise"
                placeholder="Besondere Hinweise zur Buchung..."
                value={buchungshinweise}
                onChange={e => setBuchungshinweise(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Fehler */}
          {submitError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Fehler: {submitError}
            </div>
          )}

          {/* Aktionen */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(4)} disabled={submitting}>
              <IconArrowLeft size={15} className="mr-1" />
              Zurück
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedKundeId || !selectedZimmerId || !anreise || !abreise || nights <= 0}
              className="gap-2"
            >
              {submitting ? (
                <>Buchung wird erstellt...</>
              ) : (
                <>
                  <IconCheck size={15} stroke={2} />
                  Buchung abschließen
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
