import { useState, useEffect } from 'react';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import type { Katzenverwaltung, Kundenverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconTrash, IconPlus, IconSearch, IconArrowsUpDown, IconArrowUp, IconArrowDown, IconFileText } from '@tabler/icons-react';
import { KatzenverwaltungDialog } from '@/components/dialogs/KatzenverwaltungDialog';
import { KatzenverwaltungViewDialog } from '@/components/dialogs/KatzenverwaltungViewDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageShell } from '@/components/PageShell';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

export default function KatzenverwaltungPage() {
  const [records, setRecords] = useState<Katzenverwaltung[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Katzenverwaltung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Katzenverwaltung | null>(null);
  const [viewingRecord, setViewingRecord] = useState<Katzenverwaltung | null>(null);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [kundenverwaltungList, setKundenverwaltungList] = useState<Kundenverwaltung[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, kundenverwaltungData] = await Promise.all([
        LivingAppsService.getKatzenverwaltung(),
        LivingAppsService.getKundenverwaltung(),
      ]);
      setRecords(mainData);
      setKundenverwaltungList(kundenverwaltungData);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(fields: Katzenverwaltung['fields']) {
    await LivingAppsService.createKatzenverwaltungEntry(fields);
    await loadData();
    setDialogOpen(false);
  }

  async function handleUpdate(fields: Katzenverwaltung['fields']) {
    if (!editingRecord) return;
    await LivingAppsService.updateKatzenverwaltungEntry(editingRecord.record_id, fields);
    await loadData();
    setEditingRecord(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await LivingAppsService.deleteKatzenverwaltungEntry(deleteTarget.record_id);
    setRecords(prev => prev.filter(r => r.record_id !== deleteTarget.record_id));
    setDeleteTarget(null);
  }

  function getKundenverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return kundenverwaltungList.find(r => r.record_id === id)?.fields.nachname ?? '—';
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
      title="Katzenverwaltung"
      subtitle={`${records.length} Katzenverwaltung im System`}
      action={
        <Button onClick={() => setDialogOpen(true)} className="shrink-0 rounded-full shadow-sm">
          <IconPlus className="h-4 w-4 mr-2" /> Hinzufügen
        </Button>
      }
    >
      <div className="relative w-full max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Katzenverwaltung suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="rounded-[27px] bg-card shadow-lg overflow-hidden">
        <Table className="[&_tbody_td]:px-6 [&_tbody_td]:py-2 [&_tbody_td]:text-base [&_tbody_td]:font-medium [&_tbody_tr:first-child_td]:pt-6 [&_tbody_tr:last-child_td]:pb-10">
          <TableHeader className="bg-secondary">
            <TableRow className="border-b border-input">
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('besitzer')}>
                <span className="inline-flex items-center gap-1">
                  Besitzer
                  {sortKey === 'besitzer' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('katze_name')}>
                <span className="inline-flex items-center gap-1">
                  Name der Katze
                  {sortKey === 'katze_name' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('rasse')}>
                <span className="inline-flex items-center gap-1">
                  Rasse
                  {sortKey === 'rasse' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('geburtsdatum')}>
                <span className="inline-flex items-center gap-1">
                  Geburtsdatum
                  {sortKey === 'geburtsdatum' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('geschlecht')}>
                <span className="inline-flex items-center gap-1">
                  Geschlecht
                  {sortKey === 'geschlecht' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('farbe')}>
                <span className="inline-flex items-center gap-1">
                  Farbe / Markierungen
                  {sortKey === 'farbe' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('kastriert')}>
                <span className="inline-flex items-center gap-1">
                  Kastriert / Sterilisiert
                  {sortKey === 'kastriert' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('impfstatus')}>
                <span className="inline-flex items-center gap-1">
                  Impfungen
                  {sortKey === 'impfstatus' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('impfpass_foto')}>
                <span className="inline-flex items-center gap-1">
                  Impfpass (Foto/Scan)
                  {sortKey === 'impfpass_foto' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('tierarzt_vorname')}>
                <span className="inline-flex items-center gap-1">
                  Tierarzt Vorname
                  {sortKey === 'tierarzt_vorname' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('tierarzt_nachname')}>
                <span className="inline-flex items-center gap-1">
                  Tierarzt Nachname
                  {sortKey === 'tierarzt_nachname' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('tierarzt_telefon')}>
                <span className="inline-flex items-center gap-1">
                  Tierarzt Telefon
                  {sortKey === 'tierarzt_telefon' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('medikamente')}>
                <span className="inline-flex items-center gap-1">
                  Medikamente
                  {sortKey === 'medikamente' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('allergien')}>
                <span className="inline-flex items-center gap-1">
                  Allergien / Unverträglichkeiten
                  {sortKey === 'allergien' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('fuetterung')}>
                <span className="inline-flex items-center gap-1">
                  Fütterungsanweisungen
                  {sortKey === 'fuetterung' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('verhalten')}>
                <span className="inline-flex items-center gap-1">
                  Verhalten & Besonderheiten
                  {sortKey === 'verhalten' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('katze_foto')}>
                <span className="inline-flex items-center gap-1">
                  Foto der Katze
                  {sortKey === 'katze_foto' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="w-24 uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortRecords(filtered).map(record => (
              <TableRow key={record.record_id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return; setViewingRecord(record); }}>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getKundenverwaltungDisplayName(record.fields.besitzer)}</span></TableCell>
                <TableCell className="font-medium">{record.fields.katze_name ?? '—'}</TableCell>
                <TableCell>{record.fields.rasse ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(record.fields.geburtsdatum)}</TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{record.fields.geschlecht?.label ?? '—'}</span></TableCell>
                <TableCell>{record.fields.farbe ?? '—'}</TableCell>
                <TableCell><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${record.fields.kastriert ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{record.fields.kastriert ? 'Ja' : 'Nein'}</span></TableCell>
                <TableCell>{Array.isArray(record.fields.impfstatus) ? record.fields.impfstatus.map((v: any) => v?.label ?? v).join(', ') : '—'}</TableCell>
                <TableCell>{record.fields.impfpass_foto ? <div className="relative h-8 w-8 rounded bg-muted overflow-hidden"><div className="absolute inset-0 flex items-center justify-center"><IconFileText size={14} className="text-muted-foreground" /></div><img src={record.fields.impfpass_foto} alt="" className="relative h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /></div> : '—'}</TableCell>
                <TableCell>{record.fields.tierarzt_vorname ?? '—'}</TableCell>
                <TableCell>{record.fields.tierarzt_nachname ?? '—'}</TableCell>
                <TableCell>{record.fields.tierarzt_telefon ?? '—'}</TableCell>
                <TableCell className="max-w-xs"><span className="truncate block">{record.fields.medikamente ?? '—'}</span></TableCell>
                <TableCell className="max-w-xs"><span className="truncate block">{record.fields.allergien ?? '—'}</span></TableCell>
                <TableCell className="max-w-xs"><span className="truncate block">{record.fields.fuetterung ?? '—'}</span></TableCell>
                <TableCell className="max-w-xs"><span className="truncate block">{record.fields.verhalten ?? '—'}</span></TableCell>
                <TableCell>{record.fields.katze_foto ? <div className="relative h-8 w-8 rounded bg-muted overflow-hidden"><div className="absolute inset-0 flex items-center justify-center"><IconFileText size={14} className="text-muted-foreground" /></div><img src={record.fields.katze_foto} alt="" className="relative h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /></div> : '—'}</TableCell>
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
                <TableCell colSpan={18} className="text-center py-16 text-muted-foreground">
                  {search ? 'Keine Ergebnisse gefunden.' : 'Noch keine Katzenverwaltung. Jetzt hinzufügen!'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <KatzenverwaltungDialog
        open={dialogOpen || !!editingRecord}
        onClose={() => { setDialogOpen(false); setEditingRecord(null); }}
        onSubmit={editingRecord ? handleUpdate : handleCreate}
        defaultValues={editingRecord?.fields}
        kundenverwaltungList={kundenverwaltungList}
        enablePhotoScan={AI_PHOTO_SCAN['Katzenverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Katzenverwaltung']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Katzenverwaltung löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />

      <KatzenverwaltungViewDialog
        open={!!viewingRecord}
        onClose={() => setViewingRecord(null)}
        record={viewingRecord}
        onEdit={(r) => { setViewingRecord(null); setEditingRecord(r); }}
        kundenverwaltungList={kundenverwaltungList}
      />
    </PageShell>
  );
}