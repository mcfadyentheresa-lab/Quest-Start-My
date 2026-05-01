import { useEffect, useRef, useState } from "react";
import { Loader2, Save, RotateCcw, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  draftWeeklyReflection,
  draftMonthlyReflection,
  type ReflectionDraft,
} from "@workspace/api-client-react";

export type ReflectionCadence = "week" | "month";

export interface ReflectionValues {
  moved: string;
  stuck: string;
  drop: string;
  nextFocus: string;
}

interface ReflectionFormProps {
  cadence: ReflectionCadence;
  // Saved value from the server. When all four fields are empty the form
  // will fetch a draft on mount.
  value: ReflectionValues;
  onSave: (next: ReflectionValues) => void | Promise<void>;
  saving?: boolean;
  saveLabel?: string;
  // Period selector — weekOf for week cadence (YYYY-MM-DD Monday),
  // monthOf for month cadence (YYYY-MM). Used to scope the draft request.
  periodKey: string;
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

const PROVENANCE_LABEL: Record<ReflectionDraft["source"], string> = {
  ai: "AI-drafted",
  rules: "Drafted from your activity",
  fallback: "Couldn't reach AI — basic draft",
};

function isAllEmpty(v: ReflectionValues): boolean {
  return !v.moved && !v.stuck && !v.drop && !v.nextFocus;
}

function valuesFromDraft(d: ReflectionDraft): ReflectionValues {
  return { moved: d.moved, stuck: d.stuck, drop: d.drop, nextFocus: d.nextFocus };
}

export function ReflectionForm({
  cadence,
  value,
  onSave,
  saving = false,
  saveLabel,
  periodKey,
}: ReflectionFormProps) {
  const [draft, setDraft] = useState<ReflectionValues>(value);
  const [draftSource, setDraftSource] = useState<ReflectionDraft["source"] | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [edited, setEdited] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const lastFetchedKey = useRef<string | null>(null);

  const idPrefix = cadence === "week" ? "weekly" : "monthly";
  const fallbackLabel = cadence === "week" ? "Save weekly reflection" : "Save monthly reflection";

  // Sync from saved value. When the server has saved content, treat it
  // as authoritative and lock to read-only on first load.
  useEffect(() => {
    setDraft(value);
    if (!isAllEmpty(value)) {
      setReadOnly(true);
      setDraftSource(null);
      setEdited(false);
    } else {
      setReadOnly(false);
    }
  }, [value.moved, value.stuck, value.drop, value.nextFocus]);

  const fetchDraft = async (bypassCache = false) => {
    setDrafting(true);
    try {
      const body = cadence === "week"
        ? { weekOf: periodKey, ...(bypassCache ? { bypassCache: true } : {}) }
        : { monthOf: periodKey, ...(bypassCache ? { bypassCache: true } : {}) };
      const drafted = cadence === "week"
        ? await draftWeeklyReflection(body)
        : await draftMonthlyReflection(body);
      setDraft(valuesFromDraft(drafted));
      setDraftSource(drafted.source);
      setEdited(false);
    } catch {
      // Silent: leave fields blank, user can still type.
    } finally {
      setDrafting(false);
    }
  };

  // Auto-draft on mount or when periodKey changes — only when nothing is saved.
  useEffect(() => {
    if (readOnly) return;
    if (!isAllEmpty(value)) return;
    if (lastFetchedKey.current === periodKey) return;
    lastFetchedKey.current = periodKey;
    void fetchDraft(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, readOnly]);

  const handleChange = (key: keyof ReflectionValues, next: string) => {
    setDraft((prev) => ({ ...prev, [key]: next }));
    setEdited(true);
  };

  const handleRegenerate = async () => {
    if (edited) {
      const ok = typeof window !== "undefined"
        ? window.confirm("Replace your edits?")
        : true;
      if (!ok) return;
    }
    await fetchDraft(true);
  };

  const handleSave = async () => {
    await onSave(draft);
    setReadOnly(true);
    setEdited(false);
  };

  if (readOnly) {
    return (
      <div className="space-y-3" data-testid="reflection-form">
        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Saved</span>
          <button
            type="button"
            onClick={() => setReadOnly(false)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="reflection-edit"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-sm">
              {field.label}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{field.helper}</span>
            </Label>
            <p className="text-sm text-foreground/80 whitespace-pre-line rounded-xl bg-muted/40 px-3 py-2">
              {draft[field.key] || <span className="italic text-muted-foreground">Empty.</span>}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="reflection-form">
      <div className="flex items-center justify-between gap-2">
        {drafting ? (
          <span
            className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/80 px-2 py-0.5 rounded-full bg-muted"
            data-testid="reflection-drafting"
          >
            Drafting your {cadence === "week" ? "week" : "month"}…
          </span>
        ) : draftSource ? (
          <span
            className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/80 px-2 py-0.5 rounded-full bg-muted"
            data-testid="reflection-provenance"
            title={PROVENANCE_LABEL[draftSource]}
          >
            {PROVENANCE_LABEL[draftSource]}
          </span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl gap-1.5 text-xs"
          onClick={handleRegenerate}
          disabled={drafting}
          data-testid="reflection-regenerate"
        >
          {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Regenerate
        </Button>
      </div>

      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-reflection-${field.key}`}>
            {field.label}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{field.helper}</span>
          </Label>
          {drafting && !draft[field.key] ? (
            <Skeleton
              className="h-14 rounded-xl"
              data-testid={`reflection-skeleton-${field.key}`}
            />
          ) : (
            <Textarea
              id={`${idPrefix}-reflection-${field.key}`}
              value={draft[field.key]}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="rounded-xl resize-none"
              rows={2}
            />
          )}
        </div>
      ))}
      <Button
        type="button"
        className="w-full rounded-xl gap-2"
        onClick={handleSave}
        disabled={saving || drafting}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saveLabel ?? fallbackLabel}
      </Button>
    </div>
  );
}
