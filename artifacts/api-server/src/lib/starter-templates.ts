// Server-side starter templates. Kept in sync with
// artifacts/quest-start-my-day/src/lib/starter-templates.ts so the wizard
// can submit just `{ templateId }` and the server expands it server-side.

export interface StarterMilestone {
  title: string;
  description?: string;
}

export interface StarterPillar {
  name: string;
  color: string;
  portfolioStatus: "Active" | "Warm" | "Dormant";
  milestones?: StarterMilestone[];
}

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  pillars: StarterPillar[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "balanced-life",
    name: "Balanced Life",
    description: "Health, family, work, home, and personal growth.",
    pillars: [
      {
        name: "Health",
        color: "#10b981",
        portfolioStatus: "Active",
        milestones: [
          { title: "Move 30 minutes a day, 5 days a week" },
          { title: "Annual physical scheduled" },
        ],
      },
      {
        name: "Family",
        color: "#f59e0b",
        portfolioStatus: "Active",
        milestones: [{ title: "Weekly family dinner without phones" }],
      },
      { name: "Work", color: "#3b82f6", portfolioStatus: "Active" },
      { name: "Home", color: "#8b5cf6", portfolioStatus: "Warm" },
      {
        name: "Personal Growth",
        color: "#ec4899",
        portfolioStatus: "Active",
        milestones: [{ title: "Read one book a month" }],
      },
    ],
  },
  {
    id: "solo-founder",
    name: "Solo Founder",
    description: "Product, customers, marketing, health, finance.",
    pillars: [
      {
        name: "Product",
        color: "#3b82f6",
        portfolioStatus: "Active",
        milestones: [{ title: "Ship the next milestone feature" }],
      },
      {
        name: "Customers",
        color: "#10b981",
        portfolioStatus: "Active",
        milestones: [{ title: "5 customer conversations this month" }],
      },
      { name: "Marketing", color: "#f97316", portfolioStatus: "Active" },
      { name: "Health", color: "#10b981", portfolioStatus: "Active" },
      {
        name: "Finance",
        color: "#6366f1",
        portfolioStatus: "Warm",
        milestones: [{ title: "Monthly P&L review" }],
      },
    ],
  },
  {
    id: "student",
    name: "Student",
    description: "Academics, career prep, health, relationships, side project.",
    pillars: [
      {
        name: "Academics",
        color: "#3b82f6",
        portfolioStatus: "Active",
        milestones: [{ title: "Maintain target GPA this term" }],
      },
      {
        name: "Career Prep",
        color: "#f59e0b",
        portfolioStatus: "Active",
        milestones: [{ title: "Apply to 3 internships this month" }],
      },
      { name: "Health", color: "#10b981", portfolioStatus: "Active" },
      { name: "Relationships", color: "#ec4899", portfolioStatus: "Warm" },
      { name: "Side Project", color: "#8b5cf6", portfolioStatus: "Warm" },
    ],
  },
  {
    id: "creative-practice",
    name: "Creative Practice",
    description: "Craft, audience, business, rest.",
    pillars: [
      {
        name: "Craft",
        color: "#ec4899",
        portfolioStatus: "Active",
        milestones: [{ title: "Daily practice block, 5 days a week" }],
      },
      { name: "Audience", color: "#f59e0b", portfolioStatus: "Active" },
      { name: "Business", color: "#3b82f6", portfolioStatus: "Warm" },
      {
        name: "Rest",
        color: "#10b981",
        portfolioStatus: "Active",
        milestones: [{ title: "One full day off the work each week" }],
      },
    ],
  },
];

export function getStarterTemplate(id: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.id === id);
}
