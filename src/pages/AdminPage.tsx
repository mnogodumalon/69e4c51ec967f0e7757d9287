import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Kundenverwaltung, Katzenverwaltung, Zimmerverwaltung, Leistungsverwaltung, Buchungsverwaltung, Gesundheitsprotokoll } from '@/types/app';
import { LivingAppsService, extractRecordId, cleanFieldsForApi } from '@/services/livingAppsService';
import { KundenverwaltungDialog } from '@/components/dialogs/KundenverwaltungDialog';
import { KundenverwaltungViewDialog } from '@/components/dialogs/KundenverwaltungViewDialog';
import { KatzenverwaltungDialog } from '@/components/dialogs/KatzenverwaltungDialog';
import { KatzenverwaltungViewDialog } from '@/components/dialogs/KatzenverwaltungViewDialog';
import { ZimmerverwaltungDialog } from '@/components/dialogs/ZimmerverwaltungDialog';
import { ZimmerverwaltungViewDialog } from '@/components/dialogs/ZimmerverwaltungViewDialog';
import { LeistungsverwaltungDialog } from '@/components/dialogs/LeistungsverwaltungDialog';
import { LeistungsverwaltungViewDialog } from '@/components/dialogs/LeistungsverwaltungViewDialog';
import { BuchungsverwaltungDialog } from '@/components/dialogs/BuchungsverwaltungDialog';
import { BuchungsverwaltungViewDialog } from '@/components/dialogs/BuchungsverwaltungViewDialog';
import { GesundheitsprotokollDialog } from '@/components/dialogs/GesundheitsprotokollDialog';
import { GesundheitsprotokollViewDialog } from '@/components/dialogs/GesundheitsprotokollViewDialog';
import { BulkEditDialog } from '@/components/dialogs/BulkEditDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageShell } from '@/components/PageShell';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconPencil, IconTrash, IconPlus, IconFilter, IconX, IconArrowsUpDown, IconArrowUp, IconArrowDown, IconSearch, IconCopy, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

// Field metadata per entity for bulk edit and column filters
const KUNDENVERWALTUNG_FIELDS = [
  { key: 'nachname', label: 'Nachname', type: 'string/text' },
  { key: 'email', label: 'E-Mail-Adresse', type: 'string/email' },
  { key: 'telefon', label: 'Telefonnummer', type: 'string/tel' },
  { key: 'strasse', label: 'Straße', type: 'string/text' },
  { key: 'hausnummer', label: 'Hausnummer', type: 'string/text' },
  { key: 'plz', label: 'Postleitzahl', type: 'string/text' },
  { key: 'ort', label: 'Ort', type: 'string/text' },
  { key: 'notfall_vorname', label: 'Notfallkontakt Vorname', type: 'string/text' },
  { key: 'notfall_nachname', label: 'Notfallkontakt Nachname', type: 'string/text' },
  { key: 'notfall_telefon', label: 'Notfallkontakt Telefon', type: 'string/tel' },
  { key: 'anmerkungen', label: 'Anmerkungen', type: 'string/textarea' },
  { key: 'vorname', label: 'Vorname', type: 'string/text' },
];
const KATZENVERWALTUNG_FIELDS = [
  { key: 'besitzer', label: 'Besitzer', type: 'applookup/select', targetEntity: 'kundenverwaltung', targetAppId: 'KUNDENVERWALTUNG', displayField: 'nachname' },
  { key: 'katze_name', label: 'Name der Katze', type: 'string/text' },
  { key: 'rasse', label: 'Rasse', type: 'string/text' },
  { key: 'geburtsdatum', label: 'Geburtsdatum', type: 'date/date' },
  { key: 'geschlecht', label: 'Geschlecht', type: 'lookup/radio', options: [{ key: 'weiblich', label: 'Weiblich' }, { key: 'maennlich', label: 'Männlich' }, { key: 'unbekannt', label: 'Unbekannt' }] },
  { key: 'farbe', label: 'Farbe / Markierungen', type: 'string/text' },
  { key: 'kastriert', label: 'Kastriert / Sterilisiert', type: 'bool' },
  { key: 'impfstatus', label: 'Impfungen', type: 'multiplelookup/checkbox', options: [{ key: 'tollwut', label: 'Tollwut' }, { key: 'katzenseuche', label: 'Katzenseuche' }, { key: 'katzenschnupfen', label: 'Katzenschnupfen' }, { key: 'leukose', label: 'Leukose' }, { key: 'sonstige', label: 'Sonstige' }] },
  { key: 'impfpass_foto', label: 'Impfpass (Foto/Scan)', type: 'file' },
  { key: 'tierarzt_vorname', label: 'Tierarzt Vorname', type: 'string/text' },
  { key: 'tierarzt_nachname', label: 'Tierarzt Nachname', type: 'string/text' },
  { key: 'tierarzt_telefon', label: 'Tierarzt Telefon', type: 'string/tel' },
  { key: 'medikamente', label: 'Medikamente', type: 'string/textarea' },
  { key: 'allergien', label: 'Allergien / Unverträglichkeiten', type: 'string/textarea' },
  { key: 'fuetterung', label: 'Fütterungsanweisungen', type: 'string/textarea' },
  { key: 'verhalten', label: 'Verhalten & Besonderheiten', type: 'string/textarea' },
  { key: 'katze_foto', label: 'Foto der Katze', type: 'file' },
];
const ZIMMERVERWALTUNG_FIELDS = [
  { key: 'zimmer_name', label: 'Zimmername / -nummer', type: 'string/text' },
  { key: 'zimmer_typ', label: 'Zimmertyp', type: 'lookup/select', options: [{ key: 'einzelzimmer', label: 'Einzelzimmer' }, { key: 'doppelzimmer', label: 'Doppelzimmer' }, { key: 'suite', label: 'Suite' }, { key: 'freigehege', label: 'Freigehege' }] },
  { key: 'kapazitaet', label: 'Kapazität (Anzahl Katzen)', type: 'number' },
  { key: 'tagespreis', label: 'Tagespreis (€)', type: 'number' },
  { key: 'beschreibung', label: 'Beschreibung', type: 'string/textarea' },
  { key: 'ausstattung', label: 'Ausstattung', type: 'multiplelookup/checkbox', options: [{ key: 'kletterbaum', label: 'Kletterbaum' }, { key: 'fensterplatz', label: 'Fensterplatz' }, { key: 'kuschelhoehle', label: 'Kuschelhöhle' }, { key: 'spielzeug', label: 'Spielzeug' }, { key: 'heizung', label: 'Heizung' }, { key: 'kamera', label: 'Kameraüberwachung' }, { key: 'freigehege_zugang', label: 'Freigehege-Zugang' }] },
  { key: 'zimmer_status', label: 'Status', type: 'lookup/radio', options: [{ key: 'verfuegbar', label: 'Verfügbar' }, { key: 'belegt', label: 'Belegt' }, { key: 'reinigung', label: 'In Reinigung' }, { key: 'gesperrt', label: 'Gesperrt' }] },
  { key: 'zimmer_foto', label: 'Foto des Zimmers', type: 'file' },
];
const LEISTUNGSVERWALTUNG_FIELDS = [
  { key: 'leistung_name', label: 'Bezeichnung der Leistung', type: 'string/text' },
  { key: 'leistung_beschreibung', label: 'Beschreibung', type: 'string/textarea' },
  { key: 'preis', label: 'Preis (€)', type: 'number' },
  { key: 'preiseinheit', label: 'Preiseinheit', type: 'lookup/radio', options: [{ key: 'pro_tag', label: 'Pro Tag' }, { key: 'pro_sitzung', label: 'Pro Sitzung' }, { key: 'einmalig', label: 'Einmalig' }, { key: 'pro_woche', label: 'Pro Woche' }] },
  { key: 'leistung_kategorie', label: 'Kategorie', type: 'lookup/select', options: [{ key: 'pflege', label: 'Pflege' }, { key: 'tierarzt', label: 'Tierarzt' }, { key: 'spielen', label: 'Spielen & Beschäftigung' }, { key: 'transport', label: 'Transport' }, { key: 'sonstiges', label: 'Sonstiges' }] },
];
const BUCHUNGSVERWALTUNG_FIELDS = [
  { key: 'buchungsnummer', label: 'Buchungsnummer', type: 'string/text' },
  { key: 'buchungsstatus', label: 'Buchungsstatus', type: 'lookup/select', options: [{ key: 'anfrage', label: 'Anfrage' }, { key: 'bestaetigt', label: 'Bestätigt' }, { key: 'eingecheckt', label: 'Eingecheckt' }, { key: 'ausgecheckt', label: 'Ausgecheckt' }, { key: 'storniert', label: 'Storniert' }] },
  { key: 'anreise', label: 'Anreisedatum', type: 'date/datetimeminute' },
  { key: 'abreise', label: 'Abreisedatum', type: 'date/datetimeminute' },
  { key: 'kunde', label: 'Kunde', type: 'applookup/select', targetEntity: 'kundenverwaltung', targetAppId: 'KUNDENVERWALTUNG', displayField: 'nachname' },
  { key: 'katzen', label: 'Katze', type: 'applookup/select', targetEntity: 'katzenverwaltung', targetAppId: 'KATZENVERWALTUNG', displayField: 'katze_name' },
  { key: 'zimmer', label: 'Zimmer', type: 'applookup/select', targetEntity: 'zimmerverwaltung', targetAppId: 'ZIMMERVERWALTUNG', displayField: 'zimmer_name' },
  { key: 'zusatzleistungen', label: 'Zusatzleistung', type: 'applookup/select', targetEntity: 'leistungsverwaltung', targetAppId: 'LEISTUNGSVERWALTUNG', displayField: 'leistung_name' },
  { key: 'gesamtpreis', label: 'Gesamtpreis (€)', type: 'number' },
  { key: 'anzahlung', label: 'Anzahlung (€)', type: 'number' },
  { key: 'zahlungsstatus', label: 'Zahlungsstatus', type: 'lookup/select', options: [{ key: 'offen', label: 'Offen' }, { key: 'anzahlung_erhalten', label: 'Anzahlung erhalten' }, { key: 'bezahlt', label: 'Vollständig bezahlt' }, { key: 'erstattet', label: 'Erstattet' }] },
  { key: 'buchungshinweise', label: 'Besondere Hinweise zur Buchung', type: 'string/textarea' },
];
const GESUNDHEITSPROTOKOLL_FIELDS = [
  { key: 'buchung', label: 'Buchung', type: 'applookup/select', targetEntity: 'buchungsverwaltung', targetAppId: 'BUCHUNGSVERWALTUNG', displayField: 'buchungsnummer' },
  { key: 'katze', label: 'Katze', type: 'applookup/select', targetEntity: 'katzenverwaltung', targetAppId: 'KATZENVERWALTUNG', displayField: 'katze_name' },
  { key: 'protokoll_datum', label: 'Datum der Beobachtung', type: 'date/date' },
  { key: 'fressverhalten', label: 'Fressverhalten', type: 'lookup/radio', options: [{ key: 'sehr_gut', label: 'Sehr gut' }, { key: 'gut', label: 'Gut' }, { key: 'maessig', label: 'Mäßig' }, { key: 'schlecht', label: 'Schlecht' }, { key: 'verweigert', label: 'Verweigert' }] },
  { key: 'aktivitaet', label: 'Aktivitätslevel', type: 'lookup/radio', options: [{ key: 'sehr_aktiv', label: 'Sehr aktiv' }, { key: 'normal', label: 'Normal' }, { key: 'ruhig', label: 'Ruhig' }, { key: 'apathisch', label: 'Apathisch' }] },
  { key: 'befinden', label: 'Allgemeines Befinden', type: 'lookup/radio', options: [{ key: 'sehr_gut', label: 'Sehr gut' }, { key: 'gut', label: 'Gut' }, { key: 'auffaellig', label: 'Auffällig' }, { key: 'krank', label: 'Krank' }] },
  { key: 'medikamente_verabreicht', label: 'Medikamente verabreicht', type: 'bool' },
  { key: 'medikamente_notiz', label: 'Notiz zu Medikamenten', type: 'string/textarea' },
  { key: 'beobachtungen', label: 'Besondere Beobachtungen', type: 'string/textarea' },
  { key: 'protokoll_foto', label: 'Foto (optional)', type: 'file' },
];

const ENTITY_TABS = [
  { key: 'kundenverwaltung', label: 'Kundenverwaltung', pascal: 'Kundenverwaltung' },
  { key: 'katzenverwaltung', label: 'Katzenverwaltung', pascal: 'Katzenverwaltung' },
  { key: 'zimmerverwaltung', label: 'Zimmerverwaltung', pascal: 'Zimmerverwaltung' },
  { key: 'leistungsverwaltung', label: 'Leistungsverwaltung', pascal: 'Leistungsverwaltung' },
  { key: 'buchungsverwaltung', label: 'Buchungsverwaltung', pascal: 'Buchungsverwaltung' },
  { key: 'gesundheitsprotokoll', label: 'Gesundheitsprotokoll', pascal: 'Gesundheitsprotokoll' },
] as const;

type EntityKey = typeof ENTITY_TABS[number]['key'];

export default function AdminPage() {
  const data = useDashboardData();
  const { loading, error, fetchAll } = data;

  const [activeTab, setActiveTab] = useState<EntityKey>('kundenverwaltung');
  const [selectedIds, setSelectedIds] = useState<Record<EntityKey, Set<string>>>(() => ({
    'kundenverwaltung': new Set(),
    'katzenverwaltung': new Set(),
    'zimmerverwaltung': new Set(),
    'leistungsverwaltung': new Set(),
    'buchungsverwaltung': new Set(),
    'gesundheitsprotokoll': new Set(),
  }));
  const [filters, setFilters] = useState<Record<EntityKey, Record<string, string>>>(() => ({
    'kundenverwaltung': {},
    'katzenverwaltung': {},
    'zimmerverwaltung': {},
    'leistungsverwaltung': {},
    'buchungsverwaltung': {},
    'gesundheitsprotokoll': {},
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [dialogState, setDialogState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [createEntity, setCreateEntity] = useState<EntityKey | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<{ entity: EntityKey; ids: string[] } | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState<EntityKey | null>(null);
  const [viewState, setViewState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const getRecords = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'kundenverwaltung': return (data as any).kundenverwaltung as Kundenverwaltung[] ?? [];
      case 'katzenverwaltung': return (data as any).katzenverwaltung as Katzenverwaltung[] ?? [];
      case 'zimmerverwaltung': return (data as any).zimmerverwaltung as Zimmerverwaltung[] ?? [];
      case 'leistungsverwaltung': return (data as any).leistungsverwaltung as Leistungsverwaltung[] ?? [];
      case 'buchungsverwaltung': return (data as any).buchungsverwaltung as Buchungsverwaltung[] ?? [];
      case 'gesundheitsprotokoll': return (data as any).gesundheitsprotokoll as Gesundheitsprotokoll[] ?? [];
      default: return [];
    }
  }, [data]);

  const getLookupLists = useCallback((entity: EntityKey) => {
    const lists: Record<string, any[]> = {};
    switch (entity) {
      case 'katzenverwaltung':
        lists.kundenverwaltungList = (data as any).kundenverwaltung ?? [];
        break;
      case 'buchungsverwaltung':
        lists.kundenverwaltungList = (data as any).kundenverwaltung ?? [];
        lists.katzenverwaltungList = (data as any).katzenverwaltung ?? [];
        lists.zimmerverwaltungList = (data as any).zimmerverwaltung ?? [];
        lists.leistungsverwaltungList = (data as any).leistungsverwaltung ?? [];
        break;
      case 'gesundheitsprotokoll':
        lists.buchungsverwaltungList = (data as any).buchungsverwaltung ?? [];
        lists.katzenverwaltungList = (data as any).katzenverwaltung ?? [];
        break;
    }
    return lists;
  }, [data]);

  const getApplookupDisplay = useCallback((entity: EntityKey, fieldKey: string, url?: unknown) => {
    if (!url) return '—';
    const id = extractRecordId(url);
    if (!id) return '—';
    const lists = getLookupLists(entity);
    void fieldKey; // ensure used for noUnusedParameters
    if (entity === 'katzenverwaltung' && fieldKey === 'besitzer') {
      const match = (lists.kundenverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.nachname ?? '—';
    }
    if (entity === 'buchungsverwaltung' && fieldKey === 'kunde') {
      const match = (lists.kundenverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.nachname ?? '—';
    }
    if (entity === 'buchungsverwaltung' && fieldKey === 'katzen') {
      const match = (lists.katzenverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.katze_name ?? '—';
    }
    if (entity === 'buchungsverwaltung' && fieldKey === 'zimmer') {
      const match = (lists.zimmerverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.zimmer_name ?? '—';
    }
    if (entity === 'buchungsverwaltung' && fieldKey === 'zusatzleistungen') {
      const match = (lists.leistungsverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.leistung_name ?? '—';
    }
    if (entity === 'gesundheitsprotokoll' && fieldKey === 'buchung') {
      const match = (lists.buchungsverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.buchungsnummer ?? '—';
    }
    if (entity === 'gesundheitsprotokoll' && fieldKey === 'katze') {
      const match = (lists.katzenverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.katze_name ?? '—';
    }
    return String(url);
  }, [getLookupLists]);

  const getFieldMeta = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'kundenverwaltung': return KUNDENVERWALTUNG_FIELDS;
      case 'katzenverwaltung': return KATZENVERWALTUNG_FIELDS;
      case 'zimmerverwaltung': return ZIMMERVERWALTUNG_FIELDS;
      case 'leistungsverwaltung': return LEISTUNGSVERWALTUNG_FIELDS;
      case 'buchungsverwaltung': return BUCHUNGSVERWALTUNG_FIELDS;
      case 'gesundheitsprotokoll': return GESUNDHEITSPROTOKOLL_FIELDS;
      default: return [];
    }
  }, []);

  const getFilteredRecords = useCallback((entity: EntityKey) => {
    const records = getRecords(entity);
    const s = search.toLowerCase();
    const searched = !s ? records : records.filter((r: any) => {
      return Object.values(r.fields).some((v: any) => {
        if (v == null) return false;
        if (Array.isArray(v)) return v.some((item: any) => typeof item === 'object' && item !== null && 'label' in item ? String((item as any).label).toLowerCase().includes(s) : String(item).toLowerCase().includes(s));
        if (typeof v === 'object' && 'label' in (v as any)) return String((v as any).label).toLowerCase().includes(s);
        return String(v).toLowerCase().includes(s);
      });
    });
    const entityFilters = filters[entity] ?? {};
    const fieldMeta = getFieldMeta(entity);
    return searched.filter((r: any) => {
      return fieldMeta.every((fm: any) => {
        const fv = entityFilters[fm.key];
        if (!fv || fv === '') return true;
        const val = r.fields?.[fm.key];
        if (fm.type === 'bool') {
          if (fv === 'true') return val === true;
          if (fv === 'false') return val !== true;
          return true;
        }
        if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
          const label = val && typeof val === 'object' && 'label' in val ? val.label : '';
          return String(label).toLowerCase().includes(fv.toLowerCase());
        }
        if (fm.type.includes('multiplelookup')) {
          if (!Array.isArray(val)) return false;
          return val.some((item: any) => String(item?.label ?? '').toLowerCase().includes(fv.toLowerCase()));
        }
        if (fm.type.includes('applookup')) {
          const display = getApplookupDisplay(entity, fm.key, val);
          return String(display).toLowerCase().includes(fv.toLowerCase());
        }
        return String(val ?? '').toLowerCase().includes(fv.toLowerCase());
      });
    });
  }, [getRecords, filters, getFieldMeta, getApplookupDisplay, search]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(''); setSortDir('asc'); }
    } else { setSortKey(key); setSortDir('asc'); }
  }

  function sortRecords<T extends { fields: Record<string, any> }>(recs: T[]): T[] {
    if (!sortKey) return recs;
    return [...recs].sort((a, b) => {
      let va: any = a.fields[sortKey], vb: any = b.fields[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'object' && 'label' in va) va = va.label;
      if (typeof vb === 'object' && 'label' in vb) vb = vb.label;
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  const toggleSelect = useCallback((entity: EntityKey, id: string) => {
    setSelectedIds(prev => {
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (next[entity].has(id)) next[entity].delete(id);
      else next[entity].add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((entity: EntityKey) => {
    const filtered = getFilteredRecords(entity);
    setSelectedIds(prev => {
      const allSelected = filtered.every((r: any) => prev[entity].has(r.record_id));
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (allSelected) {
        filtered.forEach((r: any) => next[entity].delete(r.record_id));
      } else {
        filtered.forEach((r: any) => next[entity].add(r.record_id));
      }
      return next;
    });
  }, [getFilteredRecords]);

  const clearSelection = useCallback((entity: EntityKey) => {
    setSelectedIds(prev => ({ ...prev, [entity]: new Set() }));
  }, []);

  const getServiceMethods = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'kundenverwaltung': return {
        create: (fields: any) => LivingAppsService.createKundenverwaltungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateKundenverwaltungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteKundenverwaltungEntry(id),
      };
      case 'katzenverwaltung': return {
        create: (fields: any) => LivingAppsService.createKatzenverwaltungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateKatzenverwaltungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteKatzenverwaltungEntry(id),
      };
      case 'zimmerverwaltung': return {
        create: (fields: any) => LivingAppsService.createZimmerverwaltungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateZimmerverwaltungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteZimmerverwaltungEntry(id),
      };
      case 'leistungsverwaltung': return {
        create: (fields: any) => LivingAppsService.createLeistungsverwaltungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateLeistungsverwaltungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteLeistungsverwaltungEntry(id),
      };
      case 'buchungsverwaltung': return {
        create: (fields: any) => LivingAppsService.createBuchungsverwaltungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateBuchungsverwaltungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteBuchungsverwaltungEntry(id),
      };
      case 'gesundheitsprotokoll': return {
        create: (fields: any) => LivingAppsService.createGesundheitsprotokollEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateGesundheitsprotokollEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteGesundheitsprotokollEntry(id),
      };
      default: return null;
    }
  }, []);

  async function handleCreate(entity: EntityKey, fields: any) {
    const svc = getServiceMethods(entity);
    if (!svc) return;
    await svc.create(fields);
    fetchAll();
    setCreateEntity(null);
  }

  async function handleUpdate(fields: any) {
    if (!dialogState) return;
    const svc = getServiceMethods(dialogState.entity);
    if (!svc) return;
    await svc.update(dialogState.record.record_id, fields);
    fetchAll();
    setDialogState(null);
  }

  async function handleBulkDelete() {
    if (!deleteTargets) return;
    const svc = getServiceMethods(deleteTargets.entity);
    if (!svc) return;
    setBulkLoading(true);
    try {
      for (const id of deleteTargets.ids) {
        await svc.remove(id);
      }
      clearSelection(deleteTargets.entity);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setDeleteTargets(null);
    }
  }

  async function handleBulkClone() {
    const svc = getServiceMethods(activeTab);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const records = getRecords(activeTab);
      const ids = Array.from(selectedIds[activeTab]);
      for (const id of ids) {
        const rec = records.find((r: any) => r.record_id === id);
        if (!rec) continue;
        const clean = cleanFieldsForApi(rec.fields, activeTab);
        await svc.create(clean as any);
      }
      clearSelection(activeTab);
      fetchAll();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkEdit(fieldKey: string, value: any) {
    if (!bulkEditOpen) return;
    const svc = getServiceMethods(bulkEditOpen);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds[bulkEditOpen]);
      for (const id of ids) {
        await svc.update(id, { [fieldKey]: value });
      }
      clearSelection(bulkEditOpen);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setBulkEditOpen(null);
    }
  }

  function updateFilter(entity: EntityKey, fieldKey: string, value: string) {
    setFilters(prev => ({
      ...prev,
      [entity]: { ...prev[entity], [fieldKey]: value },
    }));
  }

  function clearEntityFilters(entity: EntityKey) {
    setFilters(prev => ({ ...prev, [entity]: {} }));
  }

  const activeFilterCount = useMemo(() => {
    const f = filters[activeTab] ?? {};
    return Object.values(f).filter(v => v && v !== '').length;
  }, [filters, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-destructive">{error.message}</p>
        <Button onClick={fetchAll}>Erneut versuchen</Button>
      </div>
    );
  }

  const filtered = getFilteredRecords(activeTab);
  const sel = selectedIds[activeTab];
  const allFiltered = filtered.every((r: any) => sel.has(r.record_id)) && filtered.length > 0;
  const fieldMeta = getFieldMeta(activeTab);

  return (
    <PageShell
      title="Verwaltung"
      subtitle="Alle Daten verwalten"
      action={
        <Button onClick={() => setCreateEntity(activeTab)} className="shrink-0">
          <IconPlus className="h-4 w-4 mr-2" /> Hinzufügen
        </Button>
      }
    >
      <div className="flex gap-2 flex-wrap">
        {ENTITY_TABS.map(tab => {
          const count = getRecords(tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(''); setSortKey(''); setSortDir('asc'); fetchAll(); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
              <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)} className="gap-2">
            <IconFilter className="h-4 w-4" />
            Filtern
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearEntityFilters(activeTab)}>
              Filter zurücksetzen
            </Button>
          )}
        </div>
        {sel.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap bg-muted/60 rounded-lg px-3 py-1.5">
            <span className="text-sm font-medium">{sel.size} ausgewählt</span>
            <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(activeTab)}>
              <IconPencil className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Feld bearbeiten</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkClone()}>
              <IconCopy className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Kopieren</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteTargets({ entity: activeTab, ids: Array.from(sel) })}>
              <IconTrash className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Ausgewählte löschen</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => clearSelection(activeTab)}>
              <IconX className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Auswahl aufheben</span>
            </Button>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 rounded-lg border bg-muted/30">
          {fieldMeta.map((fm: any) => (
            <div key={fm.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{fm.label}</label>
              {fm.type === 'bool' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="true">Ja</SelectItem>
                    <SelectItem value="false">Nein</SelectItem>
                  </SelectContent>
                </Select>
              ) : fm.type === 'lookup/select' || fm.type === 'lookup/radio' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    {fm.options?.map((o: any) => (
                      <SelectItem key={o.key} value={o.label}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  placeholder="Filtern..."
                  value={filters[activeTab]?.[fm.key] ?? ''}
                  onChange={e => updateFilter(activeTab, fm.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[27px] bg-card shadow-lg overflow-x-auto">
        <Table className="[&_tbody_td]:px-6 [&_tbody_td]:py-2 [&_tbody_td]:text-base [&_tbody_td]:font-medium [&_tbody_tr:first-child_td]:pt-6 [&_tbody_tr:last-child_td]:pb-10">
          <TableHeader className="bg-secondary">
            <TableRow className="border-b border-input">
              <TableHead className="w-10 px-6">
                <Checkbox
                  checked={allFiltered}
                  onCheckedChange={() => toggleSelectAll(activeTab)}
                />
              </TableHead>
              {fieldMeta.map((fm: any) => (
                <TableHead key={fm.key} className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(fm.key)}>
                  <span className="inline-flex items-center gap-1">
                    {fm.label}
                    {sortKey === fm.key ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-24 uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortRecords(filtered).map((record: any) => (
              <TableRow key={record.record_id} className={`transition-colors cursor-pointer ${sel.has(record.record_id) ? "bg-primary/5" : "hover:bg-muted/50"}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return; setViewState({ entity: activeTab, record }); }}>
                <TableCell>
                  <Checkbox
                    checked={sel.has(record.record_id)}
                    onCheckedChange={() => toggleSelect(activeTab, record.record_id)}
                  />
                </TableCell>
                {fieldMeta.map((fm: any) => {
                  const val = record.fields?.[fm.key];
                  if (fm.type === 'bool') {
                    return (
                      <TableCell key={fm.key}>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          val ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {val ? 'Ja' : 'Nein'}
                        </span>
                      </TableCell>
                    );
                  }
                  if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{val?.label ?? '—'}</span></TableCell>;
                  }
                  if (fm.type.includes('multiplelookup')) {
                    return <TableCell key={fm.key}>{Array.isArray(val) ? val.map((v: any) => v?.label ?? v).join(', ') : '—'}</TableCell>;
                  }
                  if (fm.type.includes('applookup')) {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getApplookupDisplay(activeTab, fm.key, val)}</span></TableCell>;
                  }
                  if (fm.type.includes('date')) {
                    return <TableCell key={fm.key} className="text-muted-foreground">{fmtDate(val)}</TableCell>;
                  }
                  if (fm.type.startsWith('file')) {
                    return (
                      <TableCell key={fm.key}>
                        {val ? (
                          <div className="relative h-8 w-8 rounded bg-muted overflow-hidden">
                            <img src={val} alt="" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          </div>
                        ) : '—'}
                      </TableCell>
                    );
                  }
                  if (fm.type === 'string/textarea') {
                    return <TableCell key={fm.key} className="max-w-xs"><span className="truncate block">{val ?? '—'}</span></TableCell>;
                  }
                  if (fm.type === 'geo') {
                    return (
                      <TableCell key={fm.key} className="max-w-[200px]">
                        <span className="truncate block" title={val ? `${val.lat}, ${val.long}` : undefined}>
                          {val?.info ?? (val ? `${val.lat?.toFixed(4)}, ${val.long?.toFixed(4)}` : '—')}
                        </span>
                      </TableCell>
                    );
                  }
                  return <TableCell key={fm.key}>{val ?? '—'}</TableCell>;
                })}
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDialogState({ entity: activeTab, record })}>
                      <IconPencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTargets({ entity: activeTab, ids: [record.record_id] })}>
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={fieldMeta.length + 2} className="text-center py-16 text-muted-foreground">
                  Keine Ergebnisse gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(createEntity === 'kundenverwaltung' || dialogState?.entity === 'kundenverwaltung') && (
        <KundenverwaltungDialog
          open={createEntity === 'kundenverwaltung' || dialogState?.entity === 'kundenverwaltung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'kundenverwaltung' ? handleUpdate : (fields: any) => handleCreate('kundenverwaltung', fields)}
          defaultValues={dialogState?.entity === 'kundenverwaltung' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Kundenverwaltung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Kundenverwaltung']}
        />
      )}
      {(createEntity === 'katzenverwaltung' || dialogState?.entity === 'katzenverwaltung') && (
        <KatzenverwaltungDialog
          open={createEntity === 'katzenverwaltung' || dialogState?.entity === 'katzenverwaltung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'katzenverwaltung' ? handleUpdate : (fields: any) => handleCreate('katzenverwaltung', fields)}
          defaultValues={dialogState?.entity === 'katzenverwaltung' ? dialogState.record?.fields : undefined}
          kundenverwaltungList={(data as any).kundenverwaltung ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Katzenverwaltung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Katzenverwaltung']}
        />
      )}
      {(createEntity === 'zimmerverwaltung' || dialogState?.entity === 'zimmerverwaltung') && (
        <ZimmerverwaltungDialog
          open={createEntity === 'zimmerverwaltung' || dialogState?.entity === 'zimmerverwaltung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'zimmerverwaltung' ? handleUpdate : (fields: any) => handleCreate('zimmerverwaltung', fields)}
          defaultValues={dialogState?.entity === 'zimmerverwaltung' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Zimmerverwaltung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Zimmerverwaltung']}
        />
      )}
      {(createEntity === 'leistungsverwaltung' || dialogState?.entity === 'leistungsverwaltung') && (
        <LeistungsverwaltungDialog
          open={createEntity === 'leistungsverwaltung' || dialogState?.entity === 'leistungsverwaltung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'leistungsverwaltung' ? handleUpdate : (fields: any) => handleCreate('leistungsverwaltung', fields)}
          defaultValues={dialogState?.entity === 'leistungsverwaltung' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Leistungsverwaltung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Leistungsverwaltung']}
        />
      )}
      {(createEntity === 'buchungsverwaltung' || dialogState?.entity === 'buchungsverwaltung') && (
        <BuchungsverwaltungDialog
          open={createEntity === 'buchungsverwaltung' || dialogState?.entity === 'buchungsverwaltung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'buchungsverwaltung' ? handleUpdate : (fields: any) => handleCreate('buchungsverwaltung', fields)}
          defaultValues={dialogState?.entity === 'buchungsverwaltung' ? dialogState.record?.fields : undefined}
          kundenverwaltungList={(data as any).kundenverwaltung ?? []}
          katzenverwaltungList={(data as any).katzenverwaltung ?? []}
          zimmerverwaltungList={(data as any).zimmerverwaltung ?? []}
          leistungsverwaltungList={(data as any).leistungsverwaltung ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Buchungsverwaltung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Buchungsverwaltung']}
        />
      )}
      {(createEntity === 'gesundheitsprotokoll' || dialogState?.entity === 'gesundheitsprotokoll') && (
        <GesundheitsprotokollDialog
          open={createEntity === 'gesundheitsprotokoll' || dialogState?.entity === 'gesundheitsprotokoll'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'gesundheitsprotokoll' ? handleUpdate : (fields: any) => handleCreate('gesundheitsprotokoll', fields)}
          defaultValues={dialogState?.entity === 'gesundheitsprotokoll' ? dialogState.record?.fields : undefined}
          buchungsverwaltungList={(data as any).buchungsverwaltung ?? []}
          katzenverwaltungList={(data as any).katzenverwaltung ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Gesundheitsprotokoll']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Gesundheitsprotokoll']}
        />
      )}
      {viewState?.entity === 'kundenverwaltung' && (
        <KundenverwaltungViewDialog
          open={viewState?.entity === 'kundenverwaltung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'kundenverwaltung', record: r }); }}
        />
      )}
      {viewState?.entity === 'katzenverwaltung' && (
        <KatzenverwaltungViewDialog
          open={viewState?.entity === 'katzenverwaltung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'katzenverwaltung', record: r }); }}
          kundenverwaltungList={(data as any).kundenverwaltung ?? []}
        />
      )}
      {viewState?.entity === 'zimmerverwaltung' && (
        <ZimmerverwaltungViewDialog
          open={viewState?.entity === 'zimmerverwaltung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'zimmerverwaltung', record: r }); }}
        />
      )}
      {viewState?.entity === 'leistungsverwaltung' && (
        <LeistungsverwaltungViewDialog
          open={viewState?.entity === 'leistungsverwaltung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'leistungsverwaltung', record: r }); }}
        />
      )}
      {viewState?.entity === 'buchungsverwaltung' && (
        <BuchungsverwaltungViewDialog
          open={viewState?.entity === 'buchungsverwaltung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'buchungsverwaltung', record: r }); }}
          kundenverwaltungList={(data as any).kundenverwaltung ?? []}
          katzenverwaltungList={(data as any).katzenverwaltung ?? []}
          zimmerverwaltungList={(data as any).zimmerverwaltung ?? []}
          leistungsverwaltungList={(data as any).leistungsverwaltung ?? []}
        />
      )}
      {viewState?.entity === 'gesundheitsprotokoll' && (
        <GesundheitsprotokollViewDialog
          open={viewState?.entity === 'gesundheitsprotokoll'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'gesundheitsprotokoll', record: r }); }}
          buchungsverwaltungList={(data as any).buchungsverwaltung ?? []}
          katzenverwaltungList={(data as any).katzenverwaltung ?? []}
        />
      )}

      <BulkEditDialog
        open={!!bulkEditOpen}
        onClose={() => setBulkEditOpen(null)}
        onApply={handleBulkEdit}
        fields={bulkEditOpen ? getFieldMeta(bulkEditOpen) : []}
        selectedCount={bulkEditOpen ? selectedIds[bulkEditOpen].size : 0}
        loading={bulkLoading}
        lookupLists={bulkEditOpen ? getLookupLists(bulkEditOpen) : {}}
      />

      <ConfirmDialog
        open={!!deleteTargets}
        onClose={() => setDeleteTargets(null)}
        onConfirm={handleBulkDelete}
        title="Ausgewählte löschen"
        description={`Sollen ${deleteTargets?.ids.length ?? 0} Einträge wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
      />
    </PageShell>
  );
}