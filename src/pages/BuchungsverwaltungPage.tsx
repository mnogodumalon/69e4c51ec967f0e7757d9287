import { useState, useEffect } from 'react';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import type { Buchungsverwaltung, Kundenverwaltung, Katzenverwaltung, Zimmerverwaltung, Leistungsverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconTrash, IconPlus, IconSearch, IconArrowsUpDown, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { BuchungsverwaltungDialog } from '@/components/dialogs/BuchungsverwaltungDialog';
import { BuchungsverwaltungViewDialog } from '@/components/dialogs/BuchungsverwaltungViewDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageShell } from '@/components/PageShell';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

export default function BuchungsverwaltungPage() {
  const [records, setRecords] = useState<Buchungsverwaltung[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Buchungsverwaltung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Buchungsverwaltung | null>(null);
  const [viewingRecord, setViewingRecord] = useState<Buchungsverwaltung | null>(null);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [kundenverwaltungList, setKundenverwaltungList] = useState<Kundenverwaltung[]>([]);
  const [katzenverwaltungList, setKatzenverwaltungList] = useState<Katzenverwaltung[]>([]);
  const [zimmerverwaltungList, setZimmerverwaltungList] = useState<Zimmerverwaltung[]>([]);
  const [leistungsverwaltungList, setLeistungsverwaltungList] = useState<Leistungsverwaltung[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, kundenverwaltungData, katzenverwaltungData, zimmerverwaltungData, leistungsverwaltungData] = await Promise.all([
        LivingAppsService.getBuchungsverwaltung(),
        LivingAppsService.getKundenverwaltung(),
        LivingAppsService.getKatzenverwaltung(),
        LivingAppsService.getZimmerverwaltung(),
        LivingAppsService.getLeistungsverwaltung(),
      ]);
      setRecords(mainData);
      setKundenverwaltungList(kundenverwaltungData);
      setKatzenverwaltungList(katzenverwaltungData);
      setZimmerverwaltungList(zimmerverwaltungData);
      setLeistungsverwaltungList(leistungsverwaltungData);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(fields: Buchungsverwaltung['fields']) {
    await LivingAppsService.createBuchungsverwaltungEntry(fields);
    await loadData();
    setDialogOpen(false);
  }

  async function handleUpdate(fields: Buchungsverwaltung['fields']) {
    if (!editingRecord) return;
    await LivingAppsService.updateBuchungsverwaltungEntry(editingRecord.record_id, fields);
    await loadData();
    setEditingRecord(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await LivingAppsService.deleteBuchungsverwaltungEntry(deleteTarget.record_id);
    setRecords(prev => prev.filter(r => r.record_id !== deleteTarget.record_id));
    setDeleteTarget(null);
  }

  function getKundenverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return kundenverwaltungList.find(r => r.record_id === id)?.fields.nachname ?? '—';
  }

  function getKatzenverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return katzenverwaltungList.find(r => r.record_id === id)?.fields.katze_name ?? '—';
  }

  function getZimmerverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return zimmerverwaltungList.find(r => r.record_id === id)?.fields.zimmer_name ?? '—';
  }

  function getLeistungsverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return leistungsverwaltungList.find(r => r.record_id === id)?.fields.leistung_name ?? '—';
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
      title="Buchungsverwaltung"
      subtitle={`${records.length} Buchungsverwaltung im System`}
      action={
        <Button onClick={() => setDialogOpen(true)} className="shrink-0 rounded-full shadow-sm">
          <IconPlus className="h-4 w-4 mr-2" /> Hinzufügen
        </Button>
      }
    >
      <div className="relative w-full max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buchungsverwaltung suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="rounded-[27px] bg-card shadow-lg overflow-hidden">
        <Table className="[&_tbody_td]:px-6 [&_tbody_td]:py-2 [&_tbody_td]:text-base [&_tbody_td]:font-medium [&_tbody_tr:first-child_td]:pt-6 [&_tbody_tr:last-child_td]:pb-10">
          <TableHeader className="bg-secondary">
            <TableRow className="border-b border-input">
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('buchungsnummer')}>
                <span className="inline-flex items-center gap-1">
                  Buchungsnummer
                  {sortKey === 'buchungsnummer' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('buchungsstatus')}>
                <span className="inline-flex items-center gap-1">
                  Buchungsstatus
                  {sortKey === 'buchungsstatus' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('anreise')}>
                <span className="inline-flex items-center gap-1">
                  Anreisedatum
                  {sortKey === 'anreise' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('abreise')}>
                <span className="inline-flex items-center gap-1">
                  Abreisedatum
                  {sortKey === 'abreise' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('kunde')}>
                <span className="inline-flex items-center gap-1">
                  Kunde
                  {sortKey === 'kunde' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('katzen')}>
                <span className="inline-flex items-center gap-1">
                  Katze
                  {sortKey === 'katzen' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('zimmer')}>
                <span className="inline-flex items-center gap-1">
                  Zimmer
                  {sortKey === 'zimmer' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('zusatzleistungen')}>
                <span className="inline-flex items-center gap-1">
                  Zusatzleistung
                  {sortKey === 'zusatzleistungen' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('gesamtpreis')}>
                <span className="inline-flex items-center gap-1">
                  Gesamtpreis (€)
                  {sortKey === 'gesamtpreis' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('anzahlung')}>
                <span className="inline-flex items-center gap-1">
                  Anzahlung (€)
                  {sortKey === 'anzahlung' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('zahlungsstatus')}>
                <span className="inline-flex items-center gap-1">
                  Zahlungsstatus
                  {sortKey === 'zahlungsstatus' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('buchungshinweise')}>
                <span className="inline-flex items-center gap-1">
                  Besondere Hinweise zur Buchung
                  {sortKey === 'buchungshinweise' ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                </span>
              </TableHead>
              <TableHead className="w-24 uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortRecords(filtered).map(record => (
              <TableRow key={record.record_id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return; setViewingRecord(record); }}>
                <TableCell className="font-medium">{record.fields.buchungsnummer ?? '—'}</TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{record.fields.buchungsstatus?.label ?? '—'}</span></TableCell>
                <TableCell className="text-muted-foreground">{formatDate(record.fields.anreise)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(record.fields.abreise)}</TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getKundenverwaltungDisplayName(record.fields.kunde)}</span></TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getKatzenverwaltungDisplayName(record.fields.katzen)}</span></TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getZimmerverwaltungDisplayName(record.fields.zimmer)}</span></TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getLeistungsverwaltungDisplayName(record.fields.zusatzleistungen)}</span></TableCell>
                <TableCell>{record.fields.gesamtpreis ?? '—'}</TableCell>
                <TableCell>{record.fields.anzahlung ?? '—'}</TableCell>
                <TableCell><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{record.fields.zahlungsstatus?.label ?? '—'}</span></TableCell>
                <TableCell className="max-w-xs"><span className="truncate block">{record.fields.buchungshinweise ?? '—'}</span></TableCell>
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
                <TableCell colSpan={13} className="text-center py-16 text-muted-foreground">
                  {search ? 'Keine Ergebnisse gefunden.' : 'Noch keine Buchungsverwaltung. Jetzt hinzufügen!'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <BuchungsverwaltungDialog
        open={dialogOpen || !!editingRecord}
        onClose={() => { setDialogOpen(false); setEditingRecord(null); }}
        onSubmit={editingRecord ? handleUpdate : handleCreate}
        defaultValues={editingRecord?.fields}
        kundenverwaltungList={kundenverwaltungList}
        katzenverwaltungList={katzenverwaltungList}
        zimmerverwaltungList={zimmerverwaltungList}
        leistungsverwaltungList={leistungsverwaltungList}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungsverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungsverwaltung']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Buchungsverwaltung löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />

      <BuchungsverwaltungViewDialog
        open={!!viewingRecord}
        onClose={() => setViewingRecord(null)}
        record={viewingRecord}
        onEdit={(r) => { setViewingRecord(null); setEditingRecord(r); }}
        kundenverwaltungList={kundenverwaltungList}
        katzenverwaltungList={katzenverwaltungList}
        zimmerverwaltungList={zimmerverwaltungList}
        leistungsverwaltungList={leistungsverwaltungList}
      />
    </PageShell>
  );
}