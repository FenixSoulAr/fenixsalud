import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  variant?: "default" | "gradient";
}

export function PageHeader({ title, description, actions, variant = "default" }: PageHeaderProps) {
  const isGradient = variant === "gradient";
  
  return (
    <div className={cn(
      "page-header",
      isGradient && "relative -mx-4 lg:-mx-8 -mt-6 lg:-mt-8 mb-8 px-4 lg:px-8 pt-6 lg:pt-8 pb-8 rounded-b-3xl overflow-hidden"
    )}>
      {isGradient && (
        <>
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-info/10 to-accent/20 dark:from-primary/20 dark:via-info/15 dark:to-accent/25" />
          {/* Animated shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        </>
      )}
      <div className={cn(
        "relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4",
        isGradient && "z-10"
      )}>
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground text-base max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}