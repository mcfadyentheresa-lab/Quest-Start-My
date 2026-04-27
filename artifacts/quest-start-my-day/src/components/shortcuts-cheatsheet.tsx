import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SHORTCUTS,
  useOpenCheatsheetListener,
} from "@/hooks/use-keyboard-shortcuts";

export function ShortcutsCheatsheet() {
  const [open, setOpen] = useState(false);
  useOpenCheatsheetListener(() => setOpen(true));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-2xl max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press{" "}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">?</kbd>{" "}
            anytime to reopen.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 space-y-1.5">
          {SHORTCUTS.map((s) => (
            <li
              key={s.keys}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/40"
            >
              <span className="text-sm text-foreground">{s.description}</span>
              <span className="flex items-center gap-1">
                {s.keys.split(" ").map((k, i) => (
                  <kbd
                    key={`${s.keys}-${i}`}
                    className="rounded border bg-muted px-2 py-0.5 text-xs font-mono"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
