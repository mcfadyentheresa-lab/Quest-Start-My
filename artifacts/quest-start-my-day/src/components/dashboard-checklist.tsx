import { useMemo } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPillars,
  useListMilestones,
  useListTasks,
  useListWeeklyPlans,
} from "@workspace/api-client-react";
import {
  ME_QUERY_KEY,
  shouldShowChecklist,
  useDismissChecklist,
  useMe,
} from "@/data/onboarding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  href: string;
}

export function DashboardChecklist() {
  const meQuery = useMe();
  const pillarsQuery = useListPillars();
  const milestonesQuery = useListMilestones();
  const tasksQuery = useListTasks();
  const weeklyQuery = useListWeeklyPlans();
  const dismissMutation = useDismissChecklist();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const visible = shouldShowChecklist({ user: meQuery.data });

  const items: ChecklistItem[] = useMemo(() => {
    const pillars = pillarsQuery.data ?? [];
    const milestones = milestonesQuery.data ?? [];
    const tasks = tasksQuery.data ?? [];
    const weekly = weeklyQuery.data ?? [];

    const hasPriorities = weekly.some((w) => {
      const pp = (w.pillarPriorities ?? {}) as Record<string, unknown>;
      return Object.values(pp).some((v) => v != null && v !== "");
    });

    return [
      {
        id: "create-pillar",
        label: "Create your first pillar",
        done: pillars.length > 0,
        href: "/pillars",
      },
      {
        id: "add-milestone",
        label: "Add a milestone to a pillar",
        done: milestones.length > 0,
        href: "/pillars",
      },
      {
        id: "set-priorities",
        label: "Set this week's priorities",
        done: hasPriorities,
        href: "/weekly",
      },
      {
        id: "add-task",
        label: "Add your first task",
        done: tasks.length > 0,
        href: "/",
      },
      {
        id: "visit-profile",
        label: "Visit your Profile",
        done: Boolean(meQuery.data?.dismissedChecklist) || false,
        href: "/profile",
      },
    ];
  }, [pillarsQuery.data, milestonesQuery.data, tasksQuery.data, weeklyQuery.data, meQuery.data]);

  const allDone = items.every((it) => it.done);
  const completedCount = items.filter((it) => it.done).length;

  if (!visible) return null;

  const handleDismiss = async () => {
    try {
      await dismissMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      trackEvent("checklist_dismissed");
    } catch (err) {
      toast({
        title: "Could not dismiss",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Get set up</CardTitle>
          <CardDescription>
            {allDone
              ? "Nice — you've completed setup. Dismiss when you're ready."
              : `${completedCount} of ${items.length} done. Knock out the rest when you can.`}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          aria-label="Dismiss checklist"
          disabled={dismissMutation.isPending}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-accent/40"
                data-testid={`checklist-${item.id}`}
              >
                {item.done ? (
                  <Check className="h-4 w-4 text-primary" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />
                )}
                <span className={item.done ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {allDone && (
          <Button onClick={handleDismiss} className="mt-3" disabled={dismissMutation.isPending}>
            Dismiss
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
