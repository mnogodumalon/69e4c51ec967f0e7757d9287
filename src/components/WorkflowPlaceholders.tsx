export function WorkflowPlaceholders() {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="border border-dashed border-muted-foreground/25 rounded-xl p-4 opacity-60" data-intent="workflow-1">
          <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
          <span className="text-xs text-muted-foreground">Wird generiert…</span>
        </div>
        <div className="border border-dashed border-muted-foreground/25 rounded-xl p-4 opacity-60" data-intent="workflow-2">
          <div className="h-4 w-32 bg-muted animate-pulse rounded mb-2" />
          <span className="text-xs text-muted-foreground">Wird generiert…</span>
        </div>
        <div className="border border-dashed border-muted-foreground/25 rounded-xl p-4 opacity-60" data-intent="workflow-3">
          <div className="h-4 w-28 bg-muted animate-pulse rounded mb-2" />
          <span className="text-xs text-muted-foreground">Wird generiert…</span>
        </div>
      </div>
    </div>
  );
}
