# Quest-Start-My — Redesign Plan (May 2026)

> Owner: Theresa McFadyen · Drafted by Computer (chief-of-staff) on 2026-05-04
> Status: **DRAFT — awaiting approval before PR3 onward.**
> Source of truth for this doc lives at `docs/redesign-plan-2026-05.md`.

---

## Why we are doing this

Live UX walkthrough (2026-05-04, full report at `quest_ux_audit_report.md`) and Theresa's own words:

> "I'm not sure where to go, I want to add this or that and there isn't an option like in the year view. I want to be able to make this my go-to app for all of my ideas. My mind runs a million times a second, 24 hours. I need the app experience to be smooth, make sense, provide alternative tasks if it senses I'm struggling. I need to be asked what is absolute priority right now. Think of an ADHD person trying to focus. Also I would like notifications. I also need to know more about the task — when I see that it's added for today, it means nothing to me because I don't know what it's referring to at a glance."
>
> "Gender-neutral, professional."

The audit confirmed five killer frictions:
1. No "see everything" view
2. Raw 200-word brain dumps render as task titles in 24pt
3. No search
4. No task-level reminders or due dates
5. Three competing "+ add" flows

Plus a `/year` 404 bug, terminology inconsistency (Areas vs Projects), and orphaned context on Loose Tasks ("Ship.", "Revise.").

The chief-of-staff core (AI narrative + "why this task" + year ribbon with energy) is excellent and stays. This redesign is mostly **layout, capture flow, and one new AI helper** — not a rebuild.

---

## Visual direction (locked)

**Working palette: Slate & Sand.** Neutral, professional, easy to swap later if Stone & Sage or Paper & Terracotta wins after we see Slate live.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FAF8F4` (warm off-white) | `#0E1116` | Page background |
| `surface` | `#FFFFFF` | `#161B22` | Cards |
| `surface-2` | `#F2EEE7` | `#1E242C` | Elevated/raised surfaces |
| `border` | `#E5E0D6` | `#2A3038` | Hairlines |
| `ink` | `#1B1F26` | `#E8EAED` | Body text |
| `ink-2` | `#4B5260` | `#A4ABB6` | Secondary text |
| `muted` | `#7B8290` | `#6E7682` | Tertiary, captions |
| `accent` | `#3F5D7A` (muted slate-blue) | `#7AA0C7` | Primary CTA only |
| `accent-soft` | `#E5ECF3` | `#1F2A36` | Accent backgrounds |
| `success` | `#3E6F5C` | `#7AB59D` | Quiet green, used sparingly |
| `warn` | `#9C6A28` | `#D4A05A` | Earthy amber |
| `danger` | `#9B3B3B` | `#D27474` | Restrained red |

No gradients. No drop shadows except elevation-1 on floating UI. One accent used consistently.

**Typography (single family):** **Inter Variable** for all UI. Weights: 400 / 500 / 600 / 700.
- Display (page titles): Inter 700, 28–32px, -1.5% tracking
- H2 (section titles): Inter 600, 18px, uppercase, +5% tracking, ink-2 color
- Body: Inter 400, 14–15px, line-height 1.5
- Caption: Inter 500, 12px, ink-2

Optional pairing for editorial weight on big numbers (year view, dashboard summary tiles): **Fraunces** at ≥32px only. Not in body.

Drop the current Playfair-style serif from headings.

**Iconography:** Lucide (already in use). Stroke 1.75. No mixed icon styles.

**Motion:** 180ms ease-out for everything. No bouncy springs.

**Voice in copy:** Chief-of-staff. Decisive, neutral pronouns, no emojis in product UI (allowed in user-generated content).

---

## Information architecture (the big shift)

### Today's destinations (current)
`/today` `/inbox` `/areas` `/areas/:id` `/calendar` (with view= week/month/year/history) `/home`

Plus the buried "+ Inbox" floating pill, the "+ Add task" button below the fold, and "Add my own" link inside the plan card. Three captures, no global "all tasks," no search.

### New destinations (target)
**Top-level tabs (4):**
1. **Today** — AI plan + today's tasks, merged into one section. Always your landing page.
2. **Capture** *(replaces Inbox)* — every unscheduled idea + flat "All tasks" view + search. The trust layer.
3. **Areas** — same as today, but renamed consistently and with the year ribbon promoted to a sticky strip on top.
4. **Calendar** — week, month, year views (no history sub-tab; history moves into Capture > All > filter "completed").

**Universal capture button (floating, every screen, bottom-right):** one button, one sheet, smart routing. Replaces all three current add flows.

**Settings (profile menu):** account, notifications, focus reminders, palette.

### Terminology lock
- "Areas" everywhere (drop "Projects" alias). The nav, the page title, the breadcrumbs all say Areas.
- "Goals" stays for milestones (already consistent).
- "Loose tasks" → "Other tasks in this area" (less mechanical).
- "Inbox" → "Capture" (active verb, matches the floating button).
- "WARM" status → tooltip explains, plus inline help text "Active areas get AI focus this week. Warm areas are paused but not archived."

---

## PR sequence

Each PR is independently mergeable, tests + typechecks green before merge, live-verified after deploy. Smallest safe diff each time.

### PR3 — Universal capture + AI brain-dump cleaner *(highest impact, no schema change)*

**Goal:** End the three-buttons confusion. Stop letting paragraphs render as task titles.

Changes:
- New `<UniversalCapture />` component — a single floating button, present on every page, opens a sheet:
  ```
  What's on your mind?
  [ multi-line text area, autofocus ]

  When?     [ Today | Later (default) ]
  Area?     [ smart-default: current page's area, else last used ]

  [ Save ]   [ Save & open another ]
  ```
- New API endpoint `POST /api/capture` (server-side):
  1. If text length > 60 chars OR contains 2+ sentences → call AI (Claude Haiku) to extract:
     - 3–7 word `title`
     - `whyItMatters` (one short sentence on why this matters, drawn from the dump)
     - `doneLooksLike` (one short sentence on what done looks like, if inferable; else null)
     - flag `needsReview: true`
  2. If short → use as title verbatim, `needsReview: false`.
  3. Insert task with the cleaned shape.
- Today's Plan and Today's tasks rendering: if `task.needsReview === true`, show the title + a "Review draft" chip + the original dump as expandable notes. Never render a paragraph in the title slot.
- Remove the three current add buttons from `/today`. Remove "+ Inbox" pill. Remove "+ Add task" inline. Remove "Add my own" inside plan card. They all become the one floating button.
- Add `taskSource = "capture"` and `taskSource = "capture-cleaned"` to track AI cleanups for later review.

Schema: add `needsReview: boolean` (default false), add `originalDump: text` (nullable, stores the raw text when AI cleans).

Tests:
- Unit: brain-dump cleaner with mocked LLM (snapshot of cleaned shape).
- Integration: POST /api/capture short text → no AI call. Long text → AI called once, fields populated, task created.
- Frontend: Capture sheet renders, submits, closes, today list refreshes.

Live verification: drop a 200-word stream-of-consciousness into Capture → confirm short title + notes show, confirm "Review draft" chip appears.

---

### PR4 — All Tasks view + search

**Goal:** The "trust layer." Theresa can see everything she's ever captured, search it, filter it.

Changes:
- New page at `/capture` (replaces `/inbox` — old route 301-redirects).
- Three sub-tabs: **Unprocessed** (everything with `date IS NULL` or `needsReview = true`), **All tasks** (flat list of every task ever, default sort = recently created), **Completed** (status = done).
- Search bar at top (full-text `ILIKE` on title + whyItMatters + doneLooksLike + originalDump). Debounced 200ms. Keyboard shortcut `/` focuses it.
- Filters (chips): Area, Status, Has-recurring, Has-due-date, Energy (added in PR5).
- Each row: title, area chip, status, age. Click → opens the same task detail sheet used from /today.

Schema: no changes (full-text via existing columns is fine for v1; can add `tsvector` later if slow).

Tests: list returns all, search filters, filters compose, recurring task instances appear under correct filters.

Live: capture 5 things, switch to /capture, search for one word, confirm narrows correctly.

---

### PR5 — Energy tag + "Right now" mode

**Goal:** Theresa's "ask me what's heavy right now" feature, framed as an offering not an interrogation.

Changes:
- Schema: add `energy` column, enum `quick | medium | deep` (nullable; null means unset).
- Capture sheet: optional energy picker (3 chips: ⚡ Quick · 🔥 Medium · 🚀 Deep). Skippable.
- Task detail: edit energy inline.
- Today's Plan: a new pill at the top of the task list — **"Feeling scattered? See 3 quick wins."** Only appears when there are ≥3 tasks marked Quick that are still pending today. Click → filters today's list to just Quick.
- Year ribbon: stays. The "energy legend" already there is system-level (busy month vs quiet month) and is unchanged.

Tests: schema, capture with/without energy, filter logic.

Live: tag 3 things Quick, refresh today, confirm the "Feeling scattered?" pill appears and filters.

---

### PR6 — Visual refresh (Slate & Sand + Inter)

**Goal:** Make the whole app look like it was designed by one person on the same day.

Changes:
- Add Inter Variable (self-hosted woff2 in /public/fonts), update `index.html` font preload.
- Replace the Playfair-style heading font in all `font-serif` Tailwind classes with Inter at the appropriate weight.
- Update Tailwind theme tokens to the Slate & Sand palette table above.
- Audit every page for color/font usage. Anything off-token → fix.
- Replace decorative drop shadows with simple borders + bg `surface-2`.
- Tighten: card border-radius from 16px to 12px (less "soft," more "professional").
- Bug-bash: every screen at 375px / 768px / 1280px / 1920px.

This PR is the biggest one visually but smallest data-wise. Done after PR3-5 so the new components are styled correctly from the jump.

---

### PR7 — Reminders + notifications (opt-in)

**Goal:** "Notifications" Theresa asked for, done right (off by default).

Changes:
- Schema: add `dueAt: timestamptz` (nullable) on tasks. Add `notification_prefs` table (one row per user) with `taskRemindersEnabled`, `dailyBriefingTime`, `endpoint` (web push subscription JSON).
- Capture sheet + task detail: optional "Remind me" picker — "Today afternoon" / "Tonight" / "Tomorrow morning" / "Pick time" / "No reminder" (default).
- Browser push notifications via standard Web Push API. Service worker. Permission only requested when user toggles it on in Settings.
- Daily briefing email (existing? check) at `dailyBriefingTime`. If not existing, skip and add later.
- Settings panel gets new section: Notifications.

Tests: schema, CRUD on prefs, due-time picker UI, push subscription flow (mocked).

Live: turn on notifications, schedule a task 2 minutes out, confirm the push fires.

---

### PR2.5 (tiny pre-PR) — `/year` 404 fix + terminology pass

**Smallest possible.** Ships before PR3:
- Add `<Route path="/year">{() => <Redirect to="/calendar?view=year" />}</Route>` to `App.tsx`.
- Find/replace "Projects" in nav and page titles → "Areas." Audit string by string.
- Add a tooltip to "WARM" status chip explaining it.
- Truncated phase labels in year view: replace `text-overflow: ellipsis` with a `title=` tooltip + a 2-line clamp.
- Tighten Loose Tasks empty fallback: when title is < 4 words and has no notes, show "(no description)" italic underneath rather than letting "Ship." hang there alone.

One 30-line PR. No risk. Lands today.

---

## Sequence + rough sizing

| PR | Size | Risk | Ships when |
|---|---|---|---|
| PR2.5 — bug fixes | XS | None | Today |
| PR3 — Universal capture + AI cleaner | M | Low (AI prompt needs tuning) | This week |
| PR4 — All Tasks + search | M | Low | This week |
| PR5 — Energy + Right now | S | None | Next week |
| PR6 — Visual refresh | M-L | Medium (touches every screen) | Next week |
| PR7 — Reminders + notifications | M | Medium (push setup) | Following week |

Total: 4 small/medium PRs over ~2 weeks of evening work. No big-bang rewrite. Each PR independently improves the app.

---

## Open questions (flag before PR6)

1. **Palette confirmation.** Slate & Sand is the working pick. Once PR3-5 are live, mock the same screen in Stone & Sage and Paper & Terracotta and pick.
2. **Email vs push for daily briefing.** Defer to PR7.
3. **Search backend.** ILIKE for now. If task count crosses ~5000 we add a pg `tsvector` column. Not a v1 concern.
4. **Mobile.** This whole plan assumes desktop-first. Responsive checks in PR6. Native mobile is a separate conversation.

---

## Truthfulness rule (carried from PR1/PR2 work)

> "Do not claim anything is fixed, shipped, present, or working unless you verify it directly in the actual code or live app."

Every PR in this plan ships with: typecheck pass, tests pass, build pass, live URL verification post-deploy. No "should work."
