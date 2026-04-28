// Starter areas offered in the first-run onboarding wizard.
// Areas are lightweight categories — users can skip and add their own later.

export interface StarterArea {
  name: string;
  description: string;
  color: string;
  category: "business" | "creative" | "wellness";
}

export const STARTER_AREAS: StarterArea[] = [
  {
    name: "Operations",
    description: "Day-to-day running of your work and life",
    color: "#8eafc0",
    category: "business",
  },
  {
    name: "Family",
    description: "Time and attention for the people you live with",
    color: "#c2a49e",
    category: "wellness",
  },
  {
    name: "Health",
    description: "Movement, rest, and how you take care of yourself",
    color: "#a8b89c",
    category: "wellness",
  },
  {
    name: "Creative",
    description: "Projects you make for the love of making",
    color: "#b49ac4",
    category: "creative",
  },
  {
    name: "Growth",
    description: "Learning, reading, and longer-term curiosity",
    color: "#d4a77a",
    category: "creative",
  },
];
