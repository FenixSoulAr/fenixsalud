import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n";

export interface EntityOption {
  id: string;
  label: string;
  secondary?: string;
}

export interface EntityField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "date" | "textarea";
}

interface RelatedEntityPickerProps {
  /** Current selected value (entity ID) */
  value: string;
  /** Callback when value changes */
  onValueChange: (value: string) => void;
  /** Available options */
  options: EntityOption[];
  /** Placeholder text for the picker button */
  placeholder: string;
  /** Search input placeholder */
  searchPlaceholder: string;
  /** Text shown when no results found */
  emptyText: string;
  /** Label for the "+ Add new X" action */
  addNewLabel: string;
  /** Modal title for creating new entity */
  modalTitle: string;
  /** Icon component for the modal title (optional) */
  modalIcon?: React.ReactNode;
  /** Fields to show in the create modal */
  fields: EntityField[];
  /** Callback to create the entity. Returns the new entity ID on success, null on failure */
  onCreate: (values: Record<string, string>) => Promise<string | null>;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Custom className for the trigger button */
  className?: string;
}

/**
 * A unified entity picker component with inline creation capability.
 * Uses Popover + Command for searchable dropdown, with "+ Add new" at the bottom.
 * Matches the pattern used in Appointments for Doctors and Institutions.
 */
export function RelatedEntityPicker({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  addNewLabel,
  modalTitle,
  modalIcon,
  fields,
  onCreate,
  disabled,
  className,
}: RelatedEntityPickerProps) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Get display label for current value
  const selectedOption = options.find((opt) => opt.id === value);
  const displayLabel = selectedOption?.label || placeholder;

  const resetForm = () => {
    const initialValues: Record<string, string> = {};
    fields.forEach((field) => {
      initialValues[field.key] = "";
    });
    setFormValues(initialValues);
    setError(null);
  };

  const openModal = () => {
    setOpen(false);
    resetForm();
    setModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    for (const field of fields) {
      if (field.required && !formValues[field.key]?.trim()) {
        setError(`${field.label} es obligatorio.`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const newId = await onCreate(formValues);
      if (newId) {
        // Auto-select the new entity
        onValueChange(newId);
        setModalOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error("Error creating entity:", err);
      setError(t.toast.error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
    if (error) setError(null);
  };

  const handleSelect = (optionId: string) => {
    onValueChange(optionId);
    setOpen(false);
  };

  const handleClear = () => {
    onValueChange("");
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", className)}
          >
            <span className={cn(!selectedOption && "text-muted-foreground")}>
              {displayLabel}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {/* Clear option */}
                {value && (
                  <CommandItem value="__clear__" onSelect={handleClear}>
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    <span className="text-muted-foreground">— {t.actions.cancel}</span>
                  </CommandItem>
                )}
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.label}
                    onSelect={() => handleSelect(opt.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      {opt.secondary && (
                        <span className="text-xs text-muted-foreground">{opt.secondary}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {/* Add new action at the bottom */}
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={openModal}
            >
              <Plus className="h-4 w-4 mr-2" />
              {addNewLabel}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Create entity modal */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalIcon}
              {modalTitle}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            {fields.map((field) => (
              <div key={field.key} className="form-field">
                <Label htmlFor={`picker-${field.key}`}>
                  {field.label}
                  {field.required && " *"}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={`picker-${field.key}`}
                    value={formValues[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <Input
                    id={`picker-${field.key}`}
                    type={field.type || "text"}
                    value={formValues[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    autoFocus={fields.indexOf(field) === 0}
                  />
                )}
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={isSaving}
              >
                {t.actions.cancel}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t.actions.saving : t.actions.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
