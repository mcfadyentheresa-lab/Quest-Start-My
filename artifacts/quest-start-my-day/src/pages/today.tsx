// Today is the home: greeting, today's plan, and the capture entry point.
// The page composition lives in `dashboard.tsx`; this module re-exports it so
// the route name matches the bottom-nav label without duplicating the tree.
//
// The day-detail "priorities + past plans" form that previously lived here
// now renders inside Calendar's Day view (see `calendar.tsx`), reachable as
// `/calendar?view=day`.
export { default } from "@/pages/dashboard";
