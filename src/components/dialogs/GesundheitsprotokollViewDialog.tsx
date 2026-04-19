import type { Gesundheitsprotokoll, Buchungsverwaltung, Katzenverwaltung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface GesundheitsprotokollViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Gesundheitsprotokoll | null;
  onEdit: (record: Gesundheitsprotokoll) => void;
  buchungsverwaltungList: Buchungsverwaltung[];
  katzenverwaltungList: Katzenverwaltung[];
}

export function GesundheitsprotokollViewDialog({ open, onClose, record, onEdit, buchungsverwaltungList, katzenverwaltungList }: GesundheitsprotokollViewDialogProps) {
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

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gesundheitsprotokoll anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Buchung</Label>
            <p className="text-sm">{getBuchungsverwaltungDisplayName(record.fields.buchung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Katze</Label>
            <p className="text-sm">{getKatzenverwaltungDisplayName(record.fields.katze)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Datum der Beobachtung</Label>
            <p className="text-sm">{formatDate(record.fields.protokoll_datum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fressverhalten</Label>
            <Badge variant="secondary">{record.fields.fressverhalten?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Aktivitätslevel</Label>
            <Badge variant="secondary">{record.fields.aktivitaet?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Allgemeines Befinden</Label>
            <Badge variant="secondary">{record.fields.befinden?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Medikamente verabreicht</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.medikamente_verabreicht ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.medikamente_verabreicht ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notiz zu Medikamenten</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.medikamente_notiz ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Besondere Beobachtungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.beobachtungen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Foto (optional)</Label>
            {record.fields.protokoll_foto ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.protokoll_foto} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}