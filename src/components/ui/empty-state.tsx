import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <Card className="border-dashed border-2 bg-muted/30">
      <div className="empty-state animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5">
          <Icon className="w-8 h-8 text-info" strokeWidth={1.75} />
        </div>
        <h3 className="empty-state-title">{title}</h3>
        <p className="empty-state-description">{description}</p>
        {action && (
          <Button onClick={action.onClick} size="lg">
            {action.label}
          </Button>
        )}
        {children}
      </div>
    </Card>
  );
}
