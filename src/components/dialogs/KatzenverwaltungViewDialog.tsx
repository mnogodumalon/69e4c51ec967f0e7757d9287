import type { Katzenverwaltung, Kundenverwaltung } from '@/types/app';
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

interface KatzenverwaltungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Katzenverwaltung | null;
  onEdit: (record: Katzenverwaltung) => void;
  kundenverwaltungList: Kundenverwaltung[];
}

export function KatzenverwaltungViewDialog({ open, onClose, record, onEdit, kundenverwaltungList }: KatzenverwaltungViewDialogProps) {
  function getKundenverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return kundenverwaltungList.find(r => r.record_id === id)?.fields.nachname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Katzenverwaltung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Besitzer</Label>
            <p className="text-sm">{getKundenverwaltungDisplayName(record.fields.besitzer)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Name der Katze</Label>
            <p className="text-sm">{record.fields.katze_name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rasse</Label>
            <p className="text-sm">{record.fields.rasse ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Geburtsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.geburtsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Geschlecht</Label>
            <Badge variant="secondary">{record.fields.geschlecht?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Farbe / Markierungen</Label>
            <p className="text-sm">{record.fields.farbe ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kastriert / Sterilisiert</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.kastriert ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.kastriert ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Impfungen</Label>
            <p className="text-sm">{Array.isArray(record.fields.impfstatus) ? record.fields.impfstatus.map((v: any) => v?.label ?? v).join(', ') : '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Impfpass (Foto/Scan)</Label>
            {record.fields.impfpass_foto ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.impfpass_foto} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tierarzt Vorname</Label>
            <p className="text-sm">{record.fields.tierarzt_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tierarzt Nachname</Label>
            <p className="text-sm">{record.fields.tierarzt_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tierarzt Telefon</Label>
            <p className="text-sm">{record.fields.tierarzt_telefon ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Medikamente</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.medikamente ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Allergien / Unverträglichkeiten</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.allergien ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fütterungsanweisungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.fuetterung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verhalten & Besonderheiten</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.verhalten ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Foto der Katze</Label>
            {record.fields.katze_foto ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.katze_foto} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}