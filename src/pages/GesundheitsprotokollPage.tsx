import { useState, useEffect } from 'react';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import type { Gesundheitsprotokoll, Buchungsverwaltung, Katzenverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconTrash, IconPlus, IconSearch, IconArrowsUpDown, IconArrowUp, IconArrowDown, IconFileText } from '@tabler/icons-react';
import { GesundheitsprotokollDialog } from '@/components/dialogs/GesundheitsprotokollDialog';
import { GesundheitsprotokollViewDialog } from '@/components/dialogs/GesundheitsprotokollViewDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageShell } from '@/components/PageShell';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

export default function GesundheitsprotokollPage() {
  const [records, setRecords] = useState<Gesundheitsprotokoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Gesundheitsprotokoll | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Gesundheitsprotokoll | null>(null);
  const [viewingRecord, setViewingRecord] = useState<Gesundheitsprotokoll | null>(null);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [buchungsverwaltungList, setBuchungsverwaltungList] = useState<Buchungsverwaltung[]>([]);
  const [katzenverwaltungList, setKatzenverwaltungList] = useState<Katzenverwaltung[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, buchungsverwaltungData, katzenverwaltungData] = await Promise.all([
        LivingAppsService.getGesundheitsprotokoll(),
        LivingAppsService.getBuchungsverwaltung(),
        LivingAppsService.getKatzenverwaltung(),
      ]);
      setRecords(mainData);
      setBuchungsverwaltungList(buchungsverwaltungData);
      setKatzenverwaltungList(katzenverwaltungData);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(fields: Gesundheitsprotokoll['fields']) {
    await LivingAppsService.createGesundheitsprotokollEntry(fields);
    await loadData();
    setDialogOpen(false);
  }

  async function handleUpdate(fields: Gesundheitsprotokoll['fields']) {
    if (!editingRecord) return;
    await LivingAppsService.updateGesundheitsprotokollEntry(editingRecord.record_id, fields);
    await loadData();
    setEditingRecord(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await LivingAppsService.deleteGesundheitsprotokollEntry(deleteTarget.record_id);
    setRecords(prev => prev.filter(r => r.record_id !== deleteTarget.record_id));
    setDeleteTarget(null);
  }

  function getBuchungsverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return buchungsverwaltungList.find(r => r.record_id === id)?.fields.buchungsnummer ?? '—';
  }

  function getKatzenverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return katzenverwaltungList.find(r => r.record_id === id)?.fields.katze_name ?? '—';
  }

  const filtered = records.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return Object.values(r.fields).some(v => {
      if (v == null) return false;
      if (Array.isArray(v)) return v.some(item => typeof item === 'object' && item !== null && 'label' in item ? String((item as any).label).toLowerCase().includes(s) : String(item).toLowerCase().includes(s));
      if (typeof v === 'object' && 'label' in (v as any)) return String((v as any).label).toLowerCase().includes(s);
      return String(v).toLowerCase().includes(s);
    });
  });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <PageShell
      title="Gesundheitsprotokoll"
      subtitle={`${records.length} Gesundheitsprotokoll im System`}
      action={
        <Button onClick={() => setDialogOpen(true)} className="shrink-0 rounded-full shadow-sm">
          <IconPlus className="h-4 w-4 mr-2" /> Hinzufügen
        </Button>
      }
    >
      <div className="relative w-full max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Gesundheitsprotokoll suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="rounded-[27px] bg-card shadow-lg overflow-hidden">
        <Table className="[&_tbody_td]:px-6 [&_tbody_td]:py-2 [&_tbody_td]:text-base [&_tbody_td]:font-medium [&_tbody_tr:first-child_td]:pt-6 [&_tbody_tr:last-child_td]:pb-10">
          <TableHeader className="bg-secondary">
            <TableRow className="border-b border-input">
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('buchung')}>
                <span className="inline-flex items-center gap-1">
                  Buchung
                  {sortKey === 'buchung' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('katze')}>
                <span className="inline-flex items-center gap-1">
                  Katze
                  {sortKey === 'katze' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('protokoll_datum')}>
                <span className="inline-flex items-center gap-1">
                  Datum der Beobachtung
                  {sortKey === 'protokoll_datum' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('fressverhalten')}>
                <span className="inline-flex items-center gap-1">
                  Fressverhalten
                  {sortKey === 'fressverhalten' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('aktivitaet')}>
                <span className="inline-flex items-center gap-1">
                  Aktivitätslevel
                  {sortKey === 'aktivitaet' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('befinden')}>
                <span className="inline-flex items-center gap-1">
                  Allgemeines Befinden
                  {sortKey === 'befinden' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('medikamente_verabreicht')}>
                <span className="inline-flex items-center gap-1">
                  Medikamente verabreicht
                  {sortKey === 'medikamente_verabreicht' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('medikamente_notiz')}>
                <span className="inline-flex items-center gap-1">
                  Notiz zu Medikamenten
                  {sortKey === 'medikamente_notiz' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('beobachtungen')}>
                <span className="inline-flex items-center gap-1">
                  Besondere Beobachtungen
                  {sortKey === 'beobachtungen' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('protokoll_foto')}>
                <span className="inline-flex items-center gap-1">
                  Foto (optional)
                  {sortKey === 'protokoll_foto' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="w-24 uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortRecords(filtered).map(record => (
              <TableRow key={record.record_id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return; setViewingRecord(record); }}>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getBuchungsverwaltungDisplayName(record.fields.buchung)}</span></TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getKatzenverwaltungDisplayName(record.fields.katze)}</span></TableCell>
                <TableCell className="text-muted-foreground">{formatDate(record.fields.protokoll_datum)}</TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{record.fields.fressverhalten?.label ?? '—'}</span></TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{record.fields.aktivitaet?.label ?? '—'}</span></TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{record.fields.befinden?.label ?? '—'}</span></TableCell>
                <TableCell><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${record.fields.medikamente_verabreicht ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{record.fields.medikamente_verabreicht ? 'Ja' : 'Nein'}</span></TableCell>
                <TableCell className="max-w-xs"><span className="truncate block">{record.fields.medikamente_notiz ?? '—'}</span></TableCell>
                <TableCell className="max-w-xs"><span className="truncate block">{record.fields.beobachtungen ?? '—'}</span></TableCell>
                <TableCell>{record.fields.protokoll_foto ? <div className="relative h-8 w-8 rounded bg-muted overflow-hidden"><div className="absolute inset-0 flex items-center justify-center"><IconFileText size={14} className="text-muted-foreground" /></div><img src={record.fields.protokoll_foto} alt="" className="relative h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /></div> : '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingRecord(record)}>
                      <IconPencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(record)}>
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-16 text-muted-foreground">
                  {search ? 'Keine Ergebnisse gefunden.' : 'Noch keine Gesundheitsprotokoll. Jetzt hinzufügen!'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <GesundheitsprotokollDialog
        open={dialogOpen || !!editingRecord}
        onClose={() => { setDialogOpen(false); setEditingRecord(null); }}
        onSubmit={editingRecord ? handleUpdate : handleCreate}
        defaultValues={editingRecord?.fields}
        buchungsverwaltungList={buchungsverwaltungList}
        katzenverwaltungList={katzenverwaltungList}
        enablePhotoScan={AI_PHOTO_SCAN['Gesundheitsprotokoll']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Gesundheitsprotokoll']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Gesundheitsprotokoll löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />

      <GesundheitsprotokollViewDialog
        open={!!viewingRecord}
        onClose={() => setViewingRecord(null)}
        record={viewingRecord}
        onEdit={(r) => { setViewingRecord(null); setEditingRecord(r); }}
        buchungsverwaltungList={buchungsverwaltungList}
        katzenverwaltungList={katzenverwaltungList}
      />
    </PageShell>
  );
}