import { useState } from 'react';
import type { Action, InputSchema, InputSchemaProperty } from '@/lib/actions-agent';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

interface ActionInputDialogProps {
  action: Action;
  schema: InputSchema;
  options?: Record<string, Array<{ value: string; label: string }>> | null;
  onSubmit: (inputs: Record<string, unknown>, files: File[]) => void;
  onCancel: () => void;
}

export function ActionInputDialog({ action, schema, options, onSubmit, onCancel }: ActionInputDialogProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fileMap, setFileMap] = useState<Record<string, File>>({});
  const [error, setError] = useState<string | null>(null);

  const properties = Object.entries(schema.properties || {});
  const requiredSet = new Set(schema.required || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    for (const [key] of properties) {
      if (requiredSet.has(key)) {
        const prop = schema.properties[key];
        if (prop.format === 'file') {
          if (!fileMap[key]) {
            setError(`"${prop.title || key}" ist erforderlich.`);
            return;
          }
        } else if (!values[key] && values[key] !== 0 && values[key] !== false) {
          setError(`"${prop.title || key}" ist erforderlich.`);
          return;
        }
      }
    }

    const files: File[] = [];
    const finalInputs = { ...values };
    for (const [key, file] of Object.entries(fileMap)) {
      if (file.size > MAX_UPLOAD_SIZE) {
        setError(`"${file.name}": Datei überschreitet das Limit von 10 MB.`);
        return;
      }
      files.push(file);
      finalInputs[key] = file.name;
    }

    onSubmit(finalInputs, files);
  };

  const renderField = (key: string, prop: InputSchemaProperty) => {
    const dynamicOptions = options?.[key];
    if (dynamicOptions) {
      return (
        <Select
          value={(values[key] as string) ?? ''}
          onValueChange={v => setValues(prev => ({ ...prev, [key]: v }))}
        >
          <SelectTrigger className="w-full">
            <span className="truncate"><SelectValue placeholder="Auswählen..." /></span>
          </SelectTrigger>
          <SelectContent className="max-w-[calc(100vw-3rem)]">
            {dynamicOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} title={opt.label}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (prop.enum) {
      return (
        <Select
          value={(values[key] as string) ?? ''}
          onValueChange={v => setValues(prev => ({ ...prev, [key]: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Auswählen..." />
          </SelectTrigger>
          <SelectContent>
            {prop.enum.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (prop.format === 'file') {
      return (
        <Input
          id={key}
          type="file"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) setFileMap(prev => ({ ...prev, [key]: f }));
          }}
        />
      );
    }

    if (prop.format === 'date') {
      return (
        <Input
          id={key}
          type="date"
          value={(values[key] as string) ?? ''}
          onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value }))}
        />
      );
    }

    if (prop.format === 'textarea') {
      return (
        <Textarea
          id={key}
          value={(values[key] as string) ?? ''}
          onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value }))}
          rows={4}
        />
      );
    }

    if (prop.type === 'number') {
      return (
        <Input
          id={key}
          type="number"
          value={values[key] != null ? String(values[key]) : ''}
          onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : '' }))}
        />
      );
    }

    if (prop.type === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={key}
            checked={!!values[key]}
            onCheckedChange={v => setValues(prev => ({ ...prev, [key]: v }))}
          />
          <Label htmlFor={key} className="font-normal">
            {prop.title || key}
            {requiredSet.has(key) && <span className="text-destructive ml-1">*</span>}
          </Label>
        </div>
      );
    }

    return (
      <Input
        id={key}
        type="text"
        value={(values[key] as string) ?? ''}
        onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value }))}
      />
    );
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{action.title || action.identifier}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {properties.map(([key, prop]) => (
            <div key={key} className="space-y-2">
              {prop.type !== 'boolean' && (
                <Label htmlFor={key}>
                  {prop.title || key}
                  {requiredSet.has(key) && <span className="text-destructive ml-1">*</span>}
                </Label>
              )}
              {renderField(key, prop)}
              {prop.description && (
                <p className="text-xs text-muted-foreground">{prop.description}</p>
              )}
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
            <Button type="submit">Ausführen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
