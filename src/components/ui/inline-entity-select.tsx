import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslations } from "@/i18n";

export interface EntityOption {
  id: string;
  label: string;
}

export interface InlineEntityField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "date";
}

interface InlineEntitySelectProps {
  /** Current selected value (entity ID) */
  value: string;
  /** Callback when value changes */
  onValueChange: (value: string) => void;
  /** Available options */
  options: EntityOption[];
  /** Placeholder text for the select */
  placeholder: string;
  /** Label for the field */
  label?: string;
  /** Entity type name for the "+ Add new X" button */
  entityLabel: string;
  /** Modal title for creating new entity */
  modalTitle: string;
  /** Fields to show in the create modal */
  fields: InlineEntityField[];
  /** Callback to create the entity. Returns the new entity ID on success, null on failure */
  onCreate: (values: Record<string, string>) => Promise<string | null>;
  /** Custom className for the container */
  className?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
}

/**
 * A select component with inline entity creation capability.
 * When the user clicks "+ Add new X", a modal opens to create a new entity
 * without leaving the current form. On save, the new entity is automatically selected.
 */
export function InlineEntitySelect({
  value,
  onValueChange,
  options,
  placeholder,
  entityLabel,
  modalTitle,
  fields,
  onCreate,
  className,
  disabled,
}: InlineEntitySelectProps) {
  const t = useTranslations();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const resetForm = () => {
    const initialValues: Record<string, string> = {};
    fields.forEach((field) => {
      initialValues[field.key] = "";
    });
    setFormValues(initialValues);
    setError(null);
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleCreate = async () => {
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

  // Get display label for current value
  const selectedLabel = options.find((opt) => opt.id === value)?.label;

  return (
    <div className={className}>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {selectedLabel || placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" className="z-[200]">
          <SelectItem value="none">—</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 h-8 px-2 text-muted-foreground hover:text-foreground w-full sm:w-auto justify-start"
        onClick={openModal}
        disabled={disabled}
      >
        <Plus className="h-4 w-4 mr-1" />
        + {entityLabel}
      </Button>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {fields.map((field) => (
              <div key={field.key} className="form-field">
                <Label htmlFor={`inline-${field.key}`}>
                  {field.label}
                  {field.required && " *"}
                </Label>
                <Input
                  id={`inline-${field.key}`}
                  type={field.type || "text"}
                  value={formValues[field.key] || ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  autoFocus={fields.indexOf(field) === 0}
                />
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isSaving}
            >
              {t.actions.cancel}
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? t.actions.saving : t.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
