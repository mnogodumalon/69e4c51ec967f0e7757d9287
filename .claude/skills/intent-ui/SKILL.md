---
name: intent-ui
description: |
  Activate this skill when:
  - Building an intent-specific UI page (src/pages/intents/*.tsx)
  - Creating multi-step task workflows that span multiple entities
  - Building wizard/stepper interfaces for complex user tasks
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# Intent UI Building Skill

Build a **multi-step task workflow** — NOT a CRUD page with different styling.

---

## What Makes an Intent UI (vs a CRUD page)

Every entity already has a CRUD page. An intent UI is fundamentally different:

| CRUD Page (already exists) | Intent UI (what you build) |
|---|---|
| Shows ONE entity's records | Orchestrates MULTIPLE entities in one flow |
| Generic table + search + dialogs | Task-specific steps with clear progression |
| Creates one record at a time | Often creates MANY records in one flow |
| No context between actions | Live feedback: totals, counts, progress |
| No clear start/end | Wizard with start → steps → completion |

**If your intent UI is just a table/list/kanban of ONE entity — you're building a CRUD page, not an intent UI. Stop and redesign.**

---

## Your Workflow

1. **Read `src/types/app.ts` FIRST** to learn the exact field names for each entity type. NEVER guess field names.
2. **Write the complete file** with `Write` tool — one shot, no read-back
3. Do NOT run `npm run build` — the orchestrator handles that

---

## Pre-Generated Shared Components (USE THESE — do NOT recreate!)

### IntentWizardShell — wizard container with all boilerplate
```tsx
import { IntentWizardShell } from '@/components/IntentWizardShell';

const [step, setStep] = useState(1);

<IntentWizardShell
  title="Event vorbereiten"
  subtitle="Schritt-für-Schritt zum perfekten Event"
  steps={[{label: 'Event'}, {label: 'Gäste'}, {label: 'Dienstleister'}, {label: 'Fertig'}]}
  currentStep={step}
  onStepChange={setStep}
  loading={loading}
  error={error}
  onRetry={fetchAll}
>
  {step === 1 && <EventSelect ... />}
  {step === 2 && <GuestInvite ... />}
  {step === 3 && <VendorBooking ... />}
  {step === 4 && <Summary ... />}
</IntentWizardShell>
```
Handles: step indicator circles, URL deep-linking (?step=N), loading/error states. Each step must provide its own action/navigation buttons (e.g., "Weiter zu Schritt 3", "Einladungen versenden").

### EntitySelectStep — reusable "pick an item" step WITH "create new" support
```tsx
import { EntitySelectStep } from '@/components/EntitySelectStep';

const [dialogOpen, setDialogOpen] = useState(false);

<EntitySelectStep
  items={events.map(e => ({
    id: e.record_id,
    title: e.fields.event_name ?? '',
    subtitle: `${formatDate(e.fields.event_datum)} · ${e.fields.event_location_name ?? ''}`,
    status: e.fields.event_status ? { key: e.fields.event_status.key, label: e.fields.event_status.label } : undefined,
    stats: [{ label: 'Gäste', value: guestCount }, { label: 'Budget', value: formatCurrency(e.fields.event_budget) }],
    icon: <IconCalendarEvent size={20} className="text-primary" />,
  }))}
  onSelect={(id) => { setSelectedEventId(id); setStep(2); }}
  createLabel="Neues Event"
  onCreateNew={() => setDialogOpen(true)}
  createDialog={
    <EventDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onSubmit={async (fields) => {
        await LivingAppsService.createEventEntry(fields);
        await fetchAll();
        setDialogOpen(false);
      }}
      enablePhotoScan={AI_PHOTO_SCAN['Event']}
    />
  }
/>
```
Provides: search input, card list with title/subtitle/status/stats, click-to-select, **"Neu erstellen" button + dialog slot**.

Props:
- `items` — array of {id, title, subtitle?, status?, stats?, icon?}
- `onSelect` — called when user picks an existing item
- `createLabel` — optional label for the "create new" button (default: "Neu erstellen")
- `onCreateNew` — optional callback to open the {Entity}Dialog
- `createDialog` — optional ReactNode for the dialog component (rendered alongside the list)

### BudgetTracker — budget progress widget
```tsx
import { BudgetTracker } from '@/components/BudgetTracker';

<BudgetTracker budget={event.fields.event_budget ?? 0} booked={totalBookedCost} />
```
Shows: progress bar (green/yellow/red), formatted currency, remaining amount.

### StatusBadge — universal status badge
```tsx
import { StatusBadge } from '@/components/StatusBadge';

<StatusBadge statusKey={record.fields.rsvp_status?.key} label={record.fields.rsvp_status?.label} />
```
Maps ALL common status keys (event/rsvp/booking/payment) to appropriate colors automatically.

---

## Custom Step Content

With the shared components above, you only need to write the **custom step content** — typically 200-300 lines instead of 800+. Each step is just a div inside IntentWizardShell's children.

---

## Pattern: Record Selection + Creation (MANDATORY for every selection step)

When a step requires the user to pick a record, ALWAYS use EntitySelectStep with the built-in create support:

```tsx
const [dialogOpen, setDialogOpen] = useState(false);

<EntitySelectStep
  items={gaeste.map(g => ({ id: g.record_id, title: g.fields.name ?? '', ... }))}
  onSelect={(id) => { setSelectedGuestId(id); setStep(3); }}
  createLabel="Neuen Gast anlegen"
  onCreateNew={() => setDialogOpen(true)}
  createDialog={
    <GaesteDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onSubmit={async (fields) => {
        await LivingAppsService.createGaesteEntry(fields);
        await fetchAll();
        setDialogOpen(false);
      }}
    />
  }
/>
```

The "Neu erstellen" button appears automatically next to the search bar AND in the empty state.
NEVER build a custom inline form — ALWAYS use the pre-generated {Entity}Dialog via `createDialog` prop.

NEVER build custom forms for record creation — ALWAYS use {Entity}Dialog. It handles all field types, validation, photo scan, and applookup fields.

---

## Pattern: Bulk Record Creation

When the user needs to create many records (e.g., invite 20 guests):

```tsx
const handleInvite = async (guestId: string) => {
  await LivingAppsService.createEinladungenEntry({
    veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEvent!),
    gast: createRecordUrl(APP_IDS.GAESTE, guestId),
    status: { key: 'eingeladen', label: 'Eingeladen' },
  });
  setInvitedGuests(prev => [...prev, guestId]);
  fetchAll(); // refresh data
};
```

**Show live feedback:**
- Counter: "12 von 40 Gästen eingeladen"
- Progress bar
- Running cost total if budget-relevant

---

## Pattern: Cross-Entity Selection

When the user picks from multiple entities to create a linked record:

```tsx
// Step 1: Select student (from Fahrschueler)
// Step 2: Select instructor (from Fahrlehrer, filtered by availability)
// Step 3: Select vehicle (from Fahrzeuge, filtered by type matching class)
// Step 4: Pick date/time
// Step 5: Confirm → creates Fahrstunde with all 3 applookup references
```

Each step narrows the options based on previous selections.

---

## Anti-Patterns (DO NOT BUILD)

- ❌ **Status kanban** for one entity → belongs on the dashboard, not an intent page
- ❌ **Filtered table** of one entity → that's the CRUD page
- ❌ **Single-entity form** with styling → that's the existing dialog
- ❌ **Read-only summary/stats** → belongs on the dashboard
- ❌ **Entity list with action buttons** → that's the CRUD page with extra buttons

---

## Technical Rules

These are MANDATORY — violation causes TypeScript build errors or runtime crashes:

- **Rules of Hooks**: ALL hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) MUST be placed BEFORE any early returns (`if (loading) return`, `if (error) return`)
- **Import hygiene**: Only import what you actually use.
- **Reuse Entity Dialogs**: For creating a single record within a step, import pre-generated `{Entity}Dialog` from `@/components/dialogs/{Entity}Dialog`. The dialog handles all field types, validation, photo scan.
- **No Bash file ops**: Use Read/Write/Edit tools only
- **No file read-back**: After Write, do NOT read the file back
- **Touch-friendly**: Never hide buttons behind hover

## Available Libraries

- **shadcn/ui**: Button, Card, Badge, Dialog, Select, Input, Tabs, Table (all in `src/components/ui/`)
- **@tabler/icons-react**: All icons prefixed with `Icon`. Use `stroke` prop, not `strokeWidth`.
- **date-fns**: `format`, `parseISO`, `isAfter`, `isBefore`, `addDays`, `differenceInDays`. Import `de` locale.

## Data Access

From `useDashboardData()` hook:
- Entity records: `Record<string, EntityType>` — use `Object.values()` to get array
- Map objects: `{entity}Map` for applookup resolution
- `fetchAll()` — refetch after creating/updating records
- `loading`, `error` — handle in the component

**CRUD operations — use ONLY pre-generated service methods with EXACT field names from src/types/app.ts:**
```typescript
await LivingAppsService.createXEntry(fields);  // fields must match the type definition exactly
await LivingAppsService.updateXEntry(recordId, fields);
await LivingAppsService.deleteXEntry(recordId);
```
Do NOT create custom service functions. Do NOT invent field names — read them from the types.

### CRITICAL: Lookup field values when writing to the API

When READING, lookup fields are enriched objects: `{ key: 'gut', label: 'Gut' }`.
When WRITING (create/update), the API expects **ONLY the plain key string**, NOT the object!

```typescript
// ❌ WRONG — API returns 400 "illegal-field-value"
await LivingAppsService.createEinladungenEntry({
  status: { key: 'eingeladen', label: 'Eingeladen' },  // dict → error!
});

// ✅ CORRECT — send plain key string
await LivingAppsService.createEinladungenEntry({
  status: 'eingeladen',  // just the key
});
```

This applies to ALL lookup/select, lookup/radio, and multiplelookup fields.
For multiplelookup, send an array of key strings: `['tag1', 'tag2']`, NOT `[{key, label}, ...]`.

The pre-generated {Entity}Dialog handles this automatically — but when you create records
directly via LivingAppsService in intent UI code, YOU must send plain keys.

## Design Tokens

Use existing CSS custom properties — do NOT create new ones:
- `bg-card`, `bg-secondary`, `bg-primary`, `bg-destructive/10`
- `text-foreground`, `text-muted-foreground`, `text-primary-foreground`
- `rounded-2xl`, `shadow-lg` for card wrappers
