import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getGetOutcomeMetricsQueryOptions } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeekKey, shiftDateString } from "@/lib/time";

export const SPARKLINE_WEEK_COUNT = 6;

export function getCurrentWeekStart(): string {
  return getWeekKey();
}

export function shiftWeek(weekOf: string, delta: number): string {
  return shiftDateString(weekOf, delta * 7);
}

export function PillarSparkline({
  rates,
  weeks,
  label,
}: {
  rates: number[];
  weeks: string[];
  label?: string;
}) {
  const barCount = rates.length;
  const barWidth = 8;
  const barGap = 3;
  const maxH = 28;
  const svgW = barCount * barWidth + (barCount - 1) * barGap;

  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      <svg width={svgW} height={maxH} className="overflow-visible">
        {rates.map((rate, i) => {
          const barH = Math.max(2, Math.round(rate * maxH));
          const x = i * (barWidth + barGap);
          const y = maxH - barH;
          const isLast = i === barCount - 1;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={2}
                className={isLast ? "fill-emerald-500" : "fill-muted-foreground/25"}
              />
              <title>{weeks[i] ? `Week of ${weeks[i]}: ${Math.round(rate * 100)}%` : `${Math.round(rate * 100)}%`}</title>
            </g>
          );
        })}
      </svg>
      <span className="text-[10px] text-muted-foreground leading-none">
        {label ?? `last ${barCount}w`}
      </span>
    </div>
  );
}

export function PillarSparklineWidget({ pillarId }: { pillarId: number }) {
  const sparklineWeeks = useMemo(() => {
    const current = getCurrentWeekStart();
    const weeks: string[] = [];
    let cursor = current;
    for (let i = 0; i < SPARKLINE_WEEK_COUNT; i++) {
      weeks.unshift(cursor);
      cursor = shiftWeek(cursor, -1);
    }
    return weeks;
  }, []);

  const weeklyOutcomeResults = useQueries({
    queries: sparklineWeeks.map(week => ({
      ...getGetOutcomeMetricsQueryOptions({ weekOf: week }),
    })),
  });

  const isLoading = weeklyOutcomeResults.some(r => r.isLoading);

  const sparklineData = useMemo(() => {
    const rates: number[] = new Array(SPARKLINE_WEEK_COUNT).fill(0);
    let hasAnyData = false;
    sparklineWeeks.forEach((week, i) => {
      const data = weeklyOutcomeResults[i]?.data;
      if (!data) return;
      const pm = data.pillarMetrics.find(p => p.pillarId === pillarId);
      if (pm) {
        rates[i] = pm.completionRate;
        hasAnyData = true;
      }
    });
    return hasAnyData ? { rates, weeks: sparklineWeeks } : null;
  }, [weeklyOutcomeResults, sparklineWeeks, pillarId]);

  if (isLoading) {
    return <Skeleton className="h-7 w-16 rounded" />;
  }
  if (!sparklineData) return null;
  return <PillarSparkline rates={sparklineData.rates} weeks={sparklineData.weeks} label={`${SPARKLINE_WEEK_COUNT}w trend`} />;
}
