import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  P1: { label: "P1", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800" },
  P2: { label: "P2", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800" },
  P3: { label: "P3", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200 dark:border-sky-800" },
  P4: { label: "P4", className: "bg-muted text-muted-foreground border border-border" },
};

const priorityLegend: { level: string; label: string }[] = [
  { level: "P1", label: "Must move now" },
  { level: "P2", label: "Important, not urgent" },
  { level: "P3", label: "Warm / exploratory" },
  { level: "P4", label: "Parked / inactive" },
];

export function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
  const config = priorityConfig[priority] ?? priorityConfig.P4;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${config.className} ${className}`}>
      {config.label}
    </span>
  );
}

export function PriorityHelp({ className = "" }: { className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What do P1–P4 mean?"
            className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-popover text-popover-foreground border border-border shadow-md p-3 max-w-xs">
          <ul className="space-y-1 text-xs">
            {priorityLegend.map(({ level, label }) => (
              <li key={level} className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{level}</span>
                <span className="text-muted-foreground">{label}</span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
