import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {actions ? (
        // Pattern C & D: Title + Actions (stacks on mobile)
        <div className="flex flex-col gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-2">{description}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-center sm:justify-start">{actions}</div>
        </div>
      ) : (
        // Pattern A & B: Simple title or title + description
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
