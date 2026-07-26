import { cn } from "@/lib/utils";

interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

export function AppCard({ title, description, children, className, ...props }: AppCardProps) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6", className)} {...props}>
      {(title || description) && (
        <div className="mb-4 space-y-1">
          {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
