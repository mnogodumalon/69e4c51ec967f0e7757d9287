import { useState, useEffect, useRef, useCallback } from 'react';
import type { Katzenverwaltung, Kundenverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, uploadFile, getUserProfile } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconArrowBigDownLinesFilled, IconCamera, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode, dataUriToBlob } from '@/lib/ai';
import { lookupKey, lookupKeys } from '@/lib/formatters';

interface KatzenverwaltungDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Katzenverwaltung['fields']) => Promise<void>;
  defaultValues?: Katzenverwaltung['fields'];
  kundenverwaltungList: Kundenverwaltung[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function KatzenverwaltungDialog({ open, onClose, onSubmit, defaultValues, kundenverwaltungList, enablePhotoScan = true, enablePhotoLocation = true }: KatzenverwaltungDialogProps) {
  const [fields, setFields] = useState<Partial<Katzenverwaltung['fields']>>({});
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  useEffect(() => {
    if (open) {
      setFields(defaultValues ?? {});
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
    }
  }, [open, defaultValues]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const clean = cleanFieldsForApi({ ...fields }, 'katzenverwaltung');
      await onSubmit(clean as Katzenverwaltung['fields']);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="besitzer" entity="Kundenverwaltung">\n${JSON.stringify(kundenverwaltungList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "besitzer": string | null, // Display name from Kundenverwaltung (see <available-records>)\n  "katze_name": string | null, // Name der Katze\n  "rasse": string | null, // Rasse\n  "geburtsdatum": string | null, // YYYY-MM-DD\n  "geschlecht": LookupValue | null, // Geschlecht (select one key: "weiblich" | "maennlich" | "unbekannt") mapping: weiblich=Weiblich, maennlich=Männlich, unbekannt=Unbekannt\n  "farbe": string | null, // Farbe / Markierungen\n  "kastriert": boolean | null, // Kastriert / Sterilisiert\n  "impfstatus": LookupValue[] | null, // Impfungen (select one or more keys: "tollwut" | "katzenseuche" | "katzenschnupfen" | "leukose" | "sonstige") mapping: tollwut=Tollwut, katzenseuche=Katzenseuche, katzenschnupfen=Katzenschnupfen, leukose=Leukose, sonstige=Sonstige\n  "tierarzt_vorname": string | null, // Tierarzt Vorname\n  "tierarzt_nachname": string | null, // Tierarzt Nachname\n  "tierarzt_telefon": string | null, // Tierarzt Telefon\n  "medikamente": string | null, // Medikamente\n  "allergien": string | null, // Allergien / Unverträglichkeiten\n  "fuetterung": string | null, // Fütterungsanweisungen\n  "verhalten": string | null, // Verhalten & Besonderheiten\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["besitzer"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const besitzerName = raw['besitzer'] as string | null;
        if (besitzerName) {
          const besitzerMatch = kundenverwaltungList.find(r => matchName(besitzerName!, [[r.fields.vorname ?? '', r.fields.nachname ?? ''].filter(Boolean).join(' ')]));
          if (besitzerMatch) merged['besitzer'] = createRecordUrl(APP_IDS.KUNDENVERWALTUNG, besitzerMatch.record_id);
        }
        return merged as Partial<Katzenverwaltung['fields']>;
      });
      // Upload scanned file to file fields
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        try {
          const blob = dataUriToBlob(uri!);
          const fileUrl = await uploadFile(blob, file.name);
          setFields(prev => ({ ...prev, impfpass_foto: fileUrl }));
          setFields(prev => ({ ...prev, katze_foto: fileUrl }));
        } catch (uploadErr) {
          console.error('File upload failed:', uploadErr);
        }
      }
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error('Scan fehlgeschlagen:', err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues ? 'Katzenverwaltung bearbeiten' : 'Katzenverwaltung hinzufügen';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{DIALOG_INTENT}</DialogTitle>
        </DialogHeader>

        {enablePhotoScan && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div>
              <div className="flex items-center gap-1.5 font-medium">
                <IconSparkles className="h-4 w-4 text-primary" />
                KI-Assistent
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Versteht Fotos, Dokumente und Text und füllt alles für dich aus</p>
            </div>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  KI-Assistent darf zusätzlich Informationen zu meiner Person verwenden
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? 'Lade...' : '(mehr Infos)'}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Folgende Infos über dich können von der KI genutzt werden:</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">Profil konnte nicht geladen werden</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">KI analysiert...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Felder werden automatisch ausgefüllt</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Felder ausgefüllt!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Prüfe die Werte und passe sie ggf. an</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Foto oder Dokument hierher ziehen oder auswählen</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />Kamera
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />Foto wählen
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />Dokument
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder="Text eingeben oder einfügen, z.B. Notizen, E-Mails, Beschreibungen..."
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title="Paste"
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />Analysieren
              </Button>
            )}
            <div className="flex justify-center pt-1">
              <IconArrowBigDownLinesFilled className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="besitzer">Besitzer</Label>
            <Select
              value={extractRecordId(fields.besitzer) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, besitzer: v === 'none' ? undefined : createRecordUrl(APP_IDS.KUNDENVERWALTUNG, v) }))}
            >
              <SelectTrigger id="besitzer"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {kundenverwaltungList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.nachname ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="katze_name">Name der Katze</Label>
            <Input
              id="katze_name"
              value={fields.katze_name ?? ''}
              onChange={e => setFields(f => ({ ...f, katze_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rasse">Rasse</Label>
            <Input
              id="rasse"
              value={fields.rasse ?? ''}
              onChange={e => setFields(f => ({ ...f, rasse: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="geburtsdatum">Geburtsdatum</Label>
            <Input
              id="geburtsdatum"
              type="date"
              value={fields.geburtsdatum ?? ''}
              onChange={e => setFields(f => ({ ...f, geburtsdatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="geschlecht">Geschlecht</Label>
            <Select
              value={lookupKey(fields.geschlecht) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, geschlecht: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="geschlecht"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="weiblich">Weiblich</SelectItem>
                <SelectItem value="maennlich">Männlich</SelectItem>
                <SelectItem value="unbekannt">Unbekannt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="farbe">Farbe / Markierungen</Label>
            <Input
              id="farbe"
              value={fields.farbe ?? ''}
              onChange={e => setFields(f => ({ ...f, farbe: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kastriert">Kastriert / Sterilisiert</Label>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="kastriert"
                checked={!!fields.kastriert}
                onCheckedChange={(v) => setFields(f => ({ ...f, kastriert: !!v }))}
              />
              <Label htmlFor="kastriert" className="font-normal">Kastriert / Sterilisiert</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="impfstatus">Impfungen</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_tollwut"
                  checked={lookupKeys(fields.impfstatus).includes('tollwut')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'tollwut'] : current.filter(k => k !== 'tollwut');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_tollwut" className="font-normal">Tollwut</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_katzenseuche"
                  checked={lookupKeys(fields.impfstatus).includes('katzenseuche')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'katzenseuche'] : current.filter(k => k !== 'katzenseuche');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_katzenseuche" className="font-normal">Katzenseuche</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_katzenschnupfen"
                  checked={lookupKeys(fields.impfstatus).includes('katzenschnupfen')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'katzenschnupfen'] : current.filter(k => k !== 'katzenschnupfen');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_katzenschnupfen" className="font-normal">Katzenschnupfen</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_leukose"
                  checked={lookupKeys(fields.impfstatus).includes('leukose')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'leukose'] : current.filter(k => k !== 'leukose');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_leukose" className="font-normal">Leukose</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_sonstige"
                  checked={lookupKeys(fields.impfstatus).includes('sonstige')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'sonstige'] : current.filter(k => k !== 'sonstige');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_sonstige" className="font-normal">Sonstige</Label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="impfpass_foto">Impfpass (Foto/Scan)</Label>
            {fields.impfpass_foto ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <IconFileText size={20} className="text-muted-foreground" />
                  </div>
                  <img
                    src={fields.impfpass_foto}
                    alt=""
                    className="relative h-full w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-foreground">{fields.impfpass_foto.split("/").pop()}</p>
                  <div className="flex gap-2 mt-1">
                    <label
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Ändern
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const fileUrl = await uploadFile(file, file.name);
                            setFields(f => ({ ...f, impfpass_foto: fileUrl }));
                          } catch (err) { console.error('Upload failed:', err); }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setFields(f => ({ ...f, impfpass_foto: undefined }))}
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <IconUpload size={20} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Datei hochladen</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const fileUrl = await uploadFile(file, file.name);
                      setFields(f => ({ ...f, impfpass_foto: fileUrl }));
                    } catch (err) { console.error('Upload failed:', err); }
                  }}
                />
              </label>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tierarzt_vorname">Tierarzt Vorname</Label>
            <Input
              id="tierarzt_vorname"
              value={fields.tierarzt_vorname ?? ''}
              onChange={e => setFields(f => ({ ...f, tierarzt_vorname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tierarzt_nachname">Tierarzt Nachname</Label>
            <Input
              id="tierarzt_nachname"
              value={fields.tierarzt_nachname ?? ''}
              onChange={e => setFields(f => ({ ...f, tierarzt_nachname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tierarzt_telefon">Tierarzt Telefon</Label>
            <Input
              id="tierarzt_telefon"
              value={fields.tierarzt_telefon ?? ''}
              onChange={e => setFields(f => ({ ...f, tierarzt_telefon: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medikamente">Medikamente</Label>
            <Textarea
              id="medikamente"
              value={fields.medikamente ?? ''}
              onChange={e => setFields(f => ({ ...f, medikamente: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allergien">Allergien / Unverträglichkeiten</Label>
            <Textarea
              id="allergien"
              value={fields.allergien ?? ''}
              onChange={e => setFields(f => ({ ...f, allergien: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuetterung">Fütterungsanweisungen</Label>
            <Textarea
              id="fuetterung"
              value={fields.fuetterung ?? ''}
              onChange={e => setFields(f => ({ ...f, fuetterung: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="verhalten">Verhalten & Besonderheiten</Label>
            <Textarea
              id="verhalten"
              value={fields.verhalten ?? ''}
              onChange={e => setFields(f => ({ ...f, verhalten: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="katze_foto">Foto der Katze</Label>
            {fields.katze_foto ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <IconFileText size={20} className="text-muted-foreground" />
                  </div>
                  <img
                    src={fields.katze_foto}
                    alt=""
                    className="relative h-full w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-foreground">{fields.katze_foto.split("/").pop()}</p>
                  <div className="flex gap-2 mt-1">
                    <label
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Ändern
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const fileUrl = await uploadFile(file, file.name);
                            setFields(f => ({ ...f, katze_foto: fileUrl }));
                          } catch (err) { console.error('Upload failed:', err); }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setFields(f => ({ ...f, katze_foto: undefined }))}
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <IconUpload size={20} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Datei hochladen</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const fileUrl = await uploadFile(file, file.name);
                      setFields(f => ({ ...f, katze_foto: fileUrl }));
                    } catch (err) { console.error('Upload failed:', err); }
                  }}
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Speichern...' : defaultValues ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}