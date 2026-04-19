interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
        {icon}
      </div>
      <p className="text-2xl sm:text-3xl font-bold mt-2 truncate">{value}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>
      )}
    </div>
  );
}