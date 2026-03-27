import * as React from "react";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  /** Optional footer with action buttons (Cancel/Save). If not provided, buttons should be in children */
  footer?: React.ReactNode;
  /** Maximum width for desktop dialog */
  maxWidth?: "sm" | "md" | "lg";
}

/**
 * A responsive modal component that renders as:
 * - Drawer (bottom sheet) on mobile with scrollable content
 * - Dialog on desktop with max-height and scrollable content
 * 
 * Both variants have a fixed header and optional fixed footer,
 * with the body content scrollable when it exceeds viewport.
 */
export function ResponsiveFormModal({
  open,
  onOpenChange,
  title,
  children,
  footer,
  maxWidth = "md",
}: ResponsiveFormModalProps) {
  const isMobile = useIsMobile();

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  }[maxWidth];

  if (isMobile) {
    return (
      <Drawer 
        open={open} 
        onOpenChange={onOpenChange}
        dismissible={true}
      >
        <DrawerContent 
          className="flex flex-col"
          style={{ maxHeight: "var(--visual-viewport-height, 90vh)" }}
          onPointerDownOutside={(e) => {
            // Allow clicks on select popovers
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-select-content]') || target.closest('[role="listbox"]')) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            // Allow interactions with select popovers
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-select-content]') || target.closest('[role="listbox"]')) {
              e.preventDefault();
            }
          }}
        >
          <DrawerHeader className="flex-shrink-0 border-b pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerClose asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 overscroll-contain">
            {children}
          </div>
          {footer && (
            <div className="flex-shrink-0 border-t p-4 bg-background">
              {footer}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col max-h-[90vh] p-0",
          maxWidthClass
        )}
      >
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0 border-t p-6 pt-4 bg-background">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
