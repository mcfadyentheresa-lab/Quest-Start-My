import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type ReflectionCadence = "week" | "month";

export interface ReflectionValues {
  moved: string;
  stuck: string;
  drop: string;
  nextFocus: string;
}

interface ReflectionFormProps {
  cadence: ReflectionCadence;
  value: ReflectionValues;
  onSave: (next: ReflectionValues) => void | Promise<void>;
  saving?: boolean;
  saveLabel?: string;
}

const FIELDS: {
  key: keyof ReflectionValues;
  label: string;
  helper: string;
  placeholder: string;
}[] = [
  {
    key: "moved",
    label: "Moved",
    helper: "What moved forward.",
    placeholder: "What made real progress.",
  },
  {
    key: "stuck",
    label: "Stuck",
    helper: "What's still stuck.",
    placeholder: "What feels blocked or stalled.",
  },
  {
    key: "drop",
    label: "Drop",
    helper: "What to drop or pause.",
    placeholder: "What to let go of or set down for now.",
  },
  {
    key: "nextFocus",
    label: "Next focus",
    helper: "What gets attention next.",
    placeholder: "One sentence on the next north star.",
  },
];

export function ReflectionForm({
  cadence,
  value,
  onSave,
  saving = false,
  saveLabel,
}: ReflectionFormProps) {
  const [draft, setDraft] = useState<ReflectionValues>(value);

  useEffect(() => {
    setDraft(value);
  }, [value.moved, value.stuck, value.drop, value.nextFocus]);

  const handleChange = (key: keyof ReflectionValues, next: string) => {
    setDraft((prev) => ({ ...prev, [key]: next }));
  };

  const idPrefix = cadence === "week" ? "weekly" : "monthly";
  const fallbackLabel = cadence === "week" ? "Save weekly reflection" : "Save monthly reflection";

  return (
    <div className="space-y-3" data-testid="reflection-form">
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-reflection-${field.key}`}>
            {field.label}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{field.helper}</span>
          </Label>
          <Textarea
            id={`${idPrefix}-reflection-${field.key}`}
            value={draft[field.key]}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="rounded-xl resize-none"
            rows={2}
          />
        </div>
      ))}
      <Button
        type="button"
        className="w-full rounded-xl gap-2"
        onClick={() => onSave(draft)}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saveLabel ?? fallbackLabel}
      </Button>
    </div>
  );
}
