import type { Zimmerverwaltung } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';

interface ZimmerverwaltungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Zimmerverwaltung | null;
  onEdit: (record: Zimmerverwaltung) => void;
}

export function ZimmerverwaltungViewDialog({ open, onClose, record, onEdit }: ZimmerverwaltungViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zimmerverwaltung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zimmername / -nummer</Label>
            <p className="text-sm">{record.fields.zimmer_name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zimmertyp</Label>
            <Badge variant="secondary">{record.fields.zimmer_typ?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kapazität (Anzahl Katzen)</Label>
            <p className="text-sm">{record.fields.kapazitaet ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tagespreis (€)</Label>
            <p className="text-sm">{record.fields.tagespreis ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.beschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ausstattung</Label>
            <p className="text-sm">{Array.isArray(record.fields.ausstattung) ? record.fields.ausstattung.map((v: any) => v?.label ?? v).join(', ') : '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="secondary">{record.fields.zimmer_status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Foto des Zimmers</Label>
            {record.fields.zimmer_foto ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.zimmer_foto} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}