---
name: frontend-impl
description: |
  Activate this skill when:
  - Building DashboardOverview.tsx
  - Writing React/TypeScript code
  - Integrating with Living Apps API
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# Frontend Implementation Skill

Build a **production-ready, domain-specific dashboard** as the app's primary workspace.

---

## Step 1: Analyze and Decide (MANDATORY — before any code)

Read `.scaffold_context` and `app_metadata.json`. Then write 1-2 sentences describing:

1. **What is the best UI paradigm for the user's core workflow?**
2. **Why is this the most natural way to interact with THIS data?**

Use this table to guide your choice:

| Data Nature | Best UI Paradigm |
|-------------|-----------------|
| Time-based / scheduled entries | Calendar, week planner, timeline |
| Status-based / workflow stages | Kanban board, progress pipeline |
| Quantitative / goal-tracking | Progress rings, gauges, trend charts |
| Hierarchical / categorized | Grouped sections, nested views |
| Sequential / step-by-step | Stepper, checklist, flow view |
| Relational / many linked items | Master-detail, linked cards |

Then implement immediately. No design_brief.md, no task lists, no planning documents.

---

## Step 2: Build DashboardOverview.tsx

**Mandatory sequence:**
1. **Read** `src/pages/DashboardOverview.tsx` using the Read tool
2. **Write** `src/pages/DashboardOverview.tsx` ONCE with the complete content

**NEVER use Bash (cat/echo/heredoc) for file operations.** If Read or Write fails, retry with the same tool.

## Step 3: Build

```bash
npm run build
```

Deployment is automatic — do NOT deploy manually. After build succeeds, STOP.

---

## What Is Pre-Generated (DO NOT touch!)

CRUD sub-pages, dialogs, routing, sidebar, shared components, and the design system are pre-generated.

**DO NOT touch:** index.css, CRUD pages, dialogs, App.tsx, PageShell.tsx, StatCard.tsx, ConfirmDialog.tsx, ChatWidget.tsx, useDashboardData.ts, enriched.ts, enrich.ts, formatters.ts, ai.ts, chat-context.ts.

**EDITABLE:** `src/config/ai-features.ts` — toggle `AI_PHOTO_SCAN['EntityName'] = true` to enable the "Foto scannen" button in that entity's create/edit dialog. Useful for entities where users may photograph documents, receipts, or business cards to auto-fill form fields.

`index.css` contains the shared design system (Plus Jakarta Sans, indigo palette, dark sidebar). All semantic tokens (`bg-primary`, `text-muted-foreground`, `bg-sidebar`, etc.) are ready to use. Do NOT edit index.css — use existing tokens in your components.

**Already available in DashboardOverview.tsx:**
- `useDashboardData()` — all entities loaded, lookup maps built, loading/error handled
- `enrichX()` — applookup fields resolved to display name strings
- `formatDate()`, `formatCurrency()` — locale-aware formatting
- Loading skeleton and error state with retry

**Lookup fields are `{ key, label }` objects** — `LivingAppsService` enriches them automatically. Access `.label` directly (e.g. `record.fields.kursart?.label`). No special formatters needed.

**AI utilities available in `src/lib/ai.ts`:**
- `chatCompletion()` — core LLM call
- `classify()` — auto-categorize text
- `extract()` — structured data from text
- `summarize()` — condense text
- `translate()` — translate text
- `analyzeImage()`, `extractFromPhoto()` — image analysis
- `analyzeDocument()` — PDF/document analysis
- `fileToDataUri()` — encode File for AI calls
- `safeJsonCompletion()`, `withRetry()` — error handling

---

## Dashboard = Primary Workspace, NOT Info Page

**The #1 mistake is building the dashboard as a passive info screen** (KPI cards + chart + recent activity). Users want to WORK with their data, not just look at it.

### The Core Interactive Component

Every dashboard needs ONE interactive component — the **reason users open the app**. This component:

- Takes up significant screen space (hero, not sidebar widget)
- Supports create, edit, delete directly (click empty slot → create dialog, click entry → edit)
- Shows data in its most natural form (the paradigm you chose in Step 1)
- Provides immediate visual feedback

The pre-generated CRUD list pages are a fallback. Users should do 90% of their work without leaving the dashboard.

**ALWAYS reuse pre-generated dialogs** — When the dashboard needs create/edit forms, import `{Entity}Dialog` from `@/components/dialogs/{Entity}Dialog`. Never build custom dialog forms from scratch — the pre-generated ones already have all field types, photo scan, validation, and applookup selects.

### Anti-Slop Checklist (if ANY true, redesign!)

- Dashboard is a passive info page — only KPI cards and charts
- No domain-specific UI — uses generic list/table for core data
- All KPI cards look identical
- Layout is a boring 2x2 or 3x3 grid
- No clear hero element
- Colors are generic blue/green/red (use the pre-configured palette tokens instead)
- Dashboard could be for ANY app

---

## Design Principles

### Theme

Font (Plus Jakarta Sans) and color palette (indigo accent, warm off-white base, dark sidebar) are pre-configured in `index.css`. Use existing semantic tokens — do NOT add custom CSS variables unless the dashboard requires truly app-specific values (e.g. `--calendar-slot-height`).

Create typography hierarchy through weight differences (font-300 vs font-700) and size jumps (text-2xl vs text-sm).

### Layout: Visual Interest Required

Every layout needs variation — size, weight, spacing, format, typography. If everything is the same size in identical cards, it's AI slop.

**Mobile:** Vertical flow, thumb-friendly, hero dominates first viewport.
**Desktop:** Use horizontal space, multi-column where appropriate. Action buttons (edit, delete, close) must always be visible — never hide them behind hover.

---

## Pre-Generated Component APIs (exact props — do NOT Read to check, do NOT guess)

**`{Entity}Dialog`** — always this exact interface:
```tsx
<KurseDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onSubmit={async (fields) => { await LivingAppsService.createKurseEntry(fields); fetchAll(); }} // dialog closes itself on success
  defaultValues={editRecord?.fields}         // undefined = create, fields = edit
  dozentenList={dozenten}                    // list prop = {entityIdentifier}List — matches useDashboardData key exactly
  raeumeList={raeume}                        // dozenten → dozentenList, raeume → raeumeList (NOT dozentList/raumList)
  enablePhotoScan={AI_PHOTO_SCAN['Kurse']}   // import AI_PHOTO_SCAN from '@/config/ai-features'
  enablePhotoLocation={AI_PHOTO_LOCATION['Kurse']}  // import AI_PHOTO_LOCATION — extract GPS from photo EXIF for geo field auto-fill
/>
```

**Applookup `defaultValues` need full record URLs — NEVER raw IDs:**
```tsx
// ❌ WRONG — raw ID breaks the Select
defaultValues={{ kurs: selectedKursId }}

// ✅ CORRECT
import { APP_IDS } from '@/types/app';
import { createRecordUrl } from '@/services/livingAppsService';
defaultValues={{ kurs: createRecordUrl(APP_IDS.KURSE, selectedKursId) }}
```

**`StatCard`** — `icon` must be rendered JSX, NOT a component reference:
```tsx
// ✅ CORRECT
<StatCard title="Kurse" value="42" description="Gesamt" icon={<IconBook size={18} className="text-muted-foreground" />} />
// ❌ WRONG — causes runtime error
<StatCard icon={IconBook} />
```

**`ConfirmDialog`** — uses `onClose` (not `onCancel`):
```tsx
<ConfirmDialog
  open={!!deleteTarget}
  title="Eintrag löschen"
  description="Wirklich löschen?"
  onConfirm={handleDelete}
  onClose={() => setDeleteTarget(null)}
/>
```

## Critical Implementation Rules

### Import Hygiene
Only import what you use. TypeScript strict mode **errors on unused imports and variables**. Every `import`, prop, and const must be referenced. Double-check before running `npm run build`.

### Type Imports
```typescript
// ❌ WRONG
import { Workout } from '@/types/app';
// ✅ CORRECT
import type { Workout } from '@/types/app';
```

### extractRecordId Null Check
```typescript
const id = extractRecordId(record.fields.relation);
if (!id) return;
```

### Dates Without Seconds
```typescript
const dateForAPI = formData.date + 'T12:00'; // YYYY-MM-DDTHH:MM only
```

### Select Never Empty Value
```typescript
// ❌ <SelectItem value="">None</SelectItem>
// ✅ <SelectItem value="none">None</SelectItem>
```

---

## Completeness Checklist

### Core Component
- [ ] Interactive component implements the chosen UI paradigm
- [ ] Users can create, edit, delete directly from the dashboard
- [ ] Component takes significant screen space (hero element)

### Technical
- [ ] `npm run build` passes
- [ ] Empty state handled (loading/error are pre-generated)
- [ ] No hardcoded demo data
- [ ] Responsive: mobile and desktop layouts

---

## Living Apps API Reference

### Date Formats (STRICT!)

| Field Type | Format | Example |
|------------|--------|---------|
| `date/date` | `YYYY-MM-DD` | `2025-11-06` |
| `date/datetimeminute` | `YYYY-MM-DDTHH:MM` | `2025-11-06T12:00` |

NO seconds for `datetimeminute`!

### applookup Fields

Store full URLs: `https://my.living-apps.de/rest/apps/{app_id}/records/{record_id}`

```typescript
import { extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';

const recordId = extractRecordId(record.fields.category);
if (!recordId) return;

const data = { category: createRecordUrl(APP_IDS.CATEGORIES, selectedId) };
```

### API Response Format

Returns **object**, NOT array. Use `Object.entries()` to extract `record_id`.

---

## Data Access (pre-generated — do NOT rewrite)

All data fetching, lookup maps, and enrichment are pre-generated. In DashboardOverview.tsx:

```typescript
// Already in the skeleton — just use the data:
const { kurse, anmeldungen, dozentenMap, loading, error, fetchAll } = useDashboardData();
const enrichedKurse = enrichKurse(kurse, dozentenMap, raeumeMap);

// Lookup fields are pre-enriched { key, label } objects — access .label directly:
record.fields.kursart?.label           // → "Restorative"
record.fields.tags?.map(v => v.label)  // → ["Alpha", "Beta"]
```

For CRUD after user actions:

```typescript
const handleCreate = async (fields) => {
  await LivingAppsService.createKurseEntry(fields);
  fetchAll();
};

const handleDelete = async (id: string) => {
  await LivingAppsService.deleteKurseEntry(id);
  fetchAll();
};
```

## Chart Pattern (recharts)

```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <XAxis dataKey="name" stroke="var(--muted-foreground)" />
    <YAxis stroke="var(--muted-foreground)" />
    <Tooltip contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }} />
    <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

## Available Libraries

- **shadcn/ui** — all components in `src/components/ui/`
- **recharts** — LineChart, BarChart, PieChart, AreaChart
- **@tabler/icons-react** — icons (all prefixed with `Icon`, e.g. `IconPlus`, `IconMapPin`; use `stroke` not `strokeWidth`)
- **date-fns** — date formatting with `de` locale

## Formatting (pre-generated — just import)

```typescript
import { formatDate, formatCurrency } from '@/lib/formatters';

formatDate(record.fields.startdatum);     // "06.11.2025" or "Nov 6, 2025"
formatCurrency(record.fields.preis);      // "199,00 €" or "$199.00"
```
