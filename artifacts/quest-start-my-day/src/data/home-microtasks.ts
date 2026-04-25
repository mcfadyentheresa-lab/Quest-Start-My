export type EnergyLevel = "low" | "medium" | "high";
export type TimeMinutes = 2 | 5 | 10 | 15;
export type HomeArea = "kitchen" | "bathroom" | "laundry" | "living" | "bedroom" | "general";

export interface HomeMicroTask {
  id: string;
  title: string;
  area: HomeArea;
  energyLevel: EnergyLevel;
  timeMinutes: TimeMinutes;
  whyItMatters: string;
  doneLooksLike: string;
  suggestedNextStep: string;
}

export const HOME_MICROTASKS: HomeMicroTask[] = [
  {
    id: "k1", title: "Put dirty dishes in the sink", area: "kitchen", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Clearing the counter gives you a visible win and makes the kitchen feel usable again.",
    doneLooksLike: "All dishes on the counter are in the sink or dishwasher.",
    suggestedNextStep: "Carry one stack of dishes to the sink — that's it.",
  },
  {
    id: "k2", title: "Empty the dishwasher", area: "kitchen", energyLevel: "medium", timeMinutes: 5,
    whyItMatters: "An empty dishwasher means dirty dishes have somewhere to go — it unlocks the whole kitchen.",
    doneLooksLike: "All clean items are put away and the dishwasher is empty.",
    suggestedNextStep: "Start with the cutlery tray — it's the quickest and most satisfying.",
  },
  {
    id: "k3", title: "Load 5 dishes into the dishwasher", area: "kitchen", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Five dishes is a tiny, concrete goal — it clears the sink without feeling overwhelming.",
    doneLooksLike: "Five items are rinsed and loaded. You can stop there.",
    suggestedNextStep: "Grab the closest item and put it in. Five times.",
  },
  {
    id: "k4", title: "Wipe one kitchen counter", area: "kitchen", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "One clean counter lowers the visual noise and makes the kitchen feel manageable.",
    doneLooksLike: "One counter is wiped and clear enough to use.",
    suggestedNextStep: "Grab a cloth, clear that counter, then wipe it.",
  },
  {
    id: "k5", title: "Throw out old food from the fridge", area: "kitchen", energyLevel: "medium", timeMinutes: 5,
    whyItMatters: "A clear fridge reduces decision fatigue and makes it easier to spot what you actually have.",
    doneLooksLike: "Anything expired or clearly bad is in the trash.",
    suggestedNextStep: "Check the top shelf first — it usually has the oldest items.",
  },
  {
    id: "k6", title: "Take out the kitchen rubbish", area: "kitchen", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "An empty bin removes a background source of visual and sensory clutter.",
    doneLooksLike: "The kitchen bin is empty with a fresh liner in.",
    suggestedNextStep: "Tie the bag and carry it to the bin outside.",
  },
  {
    id: "k7", title: "Put the groceries away", area: "kitchen", energyLevel: "medium", timeMinutes: 10,
    whyItMatters: "Bags on the floor create stress and make the space feel chaotic.",
    doneLooksLike: "All grocery bags are unpacked and put away.",
    suggestedNextStep: "Start with the cold items — they have urgency, which makes starting easier.",
  },
  {
    id: "k8", title: "Clear one kitchen hotspot", area: "kitchen", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "Hotspots gather visual clutter fast. One cleared spot changes the feel of the whole room.",
    doneLooksLike: "One surface (counter corner, table end, etc.) is clear.",
    suggestedNextStep: "Pick the most cluttered spot and put 5 things away from it.",
  },
  {
    id: "b1", title: "Wipe the bathroom sink", area: "bathroom", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "A clean sink signals the whole room is cared for, even if nothing else is done.",
    doneLooksLike: "The sink basin and taps are wiped dry.",
    suggestedNextStep: "Grab a cloth and wipe around the tap and basin. One pass is enough.",
  },
  {
    id: "b2", title: "Wipe the bathroom mirror", area: "bathroom", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "A clear mirror makes the room feel cleaner and brighter instantly.",
    doneLooksLike: "The mirror is smear-free.",
    suggestedNextStep: "Use a dry cloth or paper towel with a tiny bit of glass cleaner.",
  },
  {
    id: "b3", title: "Replace the hand towel", area: "bathroom", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "A fresh towel is a simple reset that feels immediately better.",
    doneLooksLike: "A clean towel is hung and the used one is in the laundry.",
    suggestedNextStep: "Grab a fresh towel and swap it out.",
  },
  {
    id: "b4", title: "Clean the toilet seat", area: "bathroom", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "The toilet seat is the highest-impact bathroom surface for a two-minute clean.",
    doneLooksLike: "The seat and lid are wiped clean.",
    suggestedNextStep: "Use a wipe or cloth with cleaner. Top, seat, and hinge area.",
  },
  {
    id: "b5", title: "Empty the bathroom bin", area: "bathroom", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "An overflowing bin is a quiet background stressor. Emptying it takes 90 seconds.",
    doneLooksLike: "The bin is empty with a fresh liner.",
    suggestedNextStep: "Grab the bin liner, tie it, take it to the main bin.",
  },
  {
    id: "b6", title: "Put products back in their place", area: "bathroom", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "Products left out make counters feel cluttered and the room harder to clean.",
    doneLooksLike: "All products are back in drawers, shelves, or the shower.",
    suggestedNextStep: "Start with the counter — move everything that doesn't live there.",
  },
  {
    id: "l1", title: "Collect laundry from the floor", area: "laundry", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "Floor laundry is one of the biggest visual chaos signals. Getting it into a pile is a real reset.",
    doneLooksLike: "All laundry is in the hamper or in a pile ready to sort.",
    suggestedNextStep: "Do a single pass through the room and pick up anything on the floor.",
  },
  {
    id: "l2", title: "Start one load of laundry", area: "laundry", energyLevel: "medium", timeMinutes: 5,
    whyItMatters: "One load in the machine means clean clothes in an hour — without doing everything.",
    doneLooksLike: "The machine is running with a full load.",
    suggestedNextStep: "Pick the most needed category (underwear, towels, etc.) and load it.",
  },
  {
    id: "l3", title: "Move clothes from washer to dryer", area: "laundry", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Leaving clothes in the washer leads to rewashing. Two minutes prevents that.",
    doneLooksLike: "Everything is in the dryer and running.",
    suggestedNextStep: "Move everything across in one armful and start the dryer.",
  },
  {
    id: "l4", title: "Fold 5 items of clothing", area: "laundry", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "Five items is a real, finite goal. It shrinks the pile without needing to do all of it.",
    doneLooksLike: "Five items are neatly folded and stacked.",
    suggestedNextStep: "Pick the 5 easiest items (t-shirts, towels) and fold those first.",
  },
  {
    id: "l5", title: "Put away one category of clothing", area: "laundry", energyLevel: "medium", timeMinutes: 5,
    whyItMatters: "Doing one category at a time (all socks, all shirts) is more manageable than random sorting.",
    doneLooksLike: "One full category is folded and put away in its drawer.",
    suggestedNextStep: "Pick one category — socks and underwear are the fastest.",
  },
  {
    id: "l6", title: "Match socks for 2 minutes", area: "laundry", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Matching socks for 2 minutes makes a visible dent in the pile and is oddly satisfying.",
    doneLooksLike: "All matches from the pile are sorted. Unmatched ones stay for later.",
    suggestedNextStep: "Set a timer for 2 minutes and just match — stop when it goes off.",
  },
  {
    id: "v1", title: "Gather all cups and glasses", area: "living", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Stray cups are a low-effort, high-visibility reset. It takes one trip.",
    doneLooksLike: "All cups are in the kitchen, ready to wash.",
    suggestedNextStep: "Do one loop of the room and collect anything with a handle.",
  },
  {
    id: "v2", title: "Clear the coffee table", area: "living", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "The coffee table anchors the whole room. A clear table makes the living area feel reset.",
    doneLooksLike: "The table surface is clear or has only intentional items on it.",
    suggestedNextStep: "Move everything off the table. Sort it from the floor.",
  },
  {
    id: "v3", title: "Fold one blanket", area: "living", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "One folded blanket looks intentional. It changes the feel of the sofa area immediately.",
    doneLooksLike: "The blanket is folded and placed neatly on the sofa or armchair.",
    suggestedNextStep: "Just fold it in thirds and lay it over the back of the sofa.",
  },
  {
    id: "v4", title: "Put the remotes together", area: "living", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Remotes scattered around create that perpetual 'chaos' feeling. Gathering them takes seconds.",
    doneLooksLike: "All remotes are in one spot — on the table or in a holder.",
    suggestedNextStep: "Find each remote and put them in one place.",
  },
  {
    id: "v5", title: "Put 5 things back where they belong", area: "living", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "Five things is achievable and makes a real visible difference without feeling like a full tidy.",
    doneLooksLike: "Five out-of-place items are back in their home.",
    suggestedNextStep: "Pick the most obvious out-of-place item and start there.",
  },
  {
    id: "v6", title: "Clear one chair or seat", area: "living", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "A chair with stuff on it can't be sat in. Clearing it reclaims actual usable space.",
    doneLooksLike: "One chair is completely clear and usable.",
    suggestedNextStep: "Pick the most cluttered seat and move everything to a flat surface to sort.",
  },
  {
    id: "v7", title: "Throw out visible rubbish", area: "living", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Picking up the rubbish you can see gives an immediate visual reset.",
    doneLooksLike: "No obvious rubbish on floors, tables, or seats.",
    suggestedNextStep: "Walk through with one bin bag and collect anything obviously rubbish.",
  },
  {
    id: "r1", title: "Make the bed", area: "bedroom", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "A made bed anchors the whole room and creates a sense of control to start the day.",
    doneLooksLike: "Pillows are straight and the duvet is pulled up and smooth.",
    suggestedNextStep: "Pull the duvet up first, then adjust the pillows.",
  },
  {
    id: "r2", title: "Put clothes in the hamper", area: "bedroom", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Floor clothes are a major source of bedroom chaos. The hamper is usually within arm's reach.",
    doneLooksLike: "All floor clothes are in the hamper or folded.",
    suggestedNextStep: "Do one sweep of the floor and collect anything not hung or folded.",
  },
  {
    id: "r3", title: "Reset the bedside table", area: "bedroom", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "The bedside area is the last thing you see at night and first in the morning. A clear one helps.",
    doneLooksLike: "The bedside surface has only intentional items (lamp, water, phone).",
    suggestedNextStep: "Take everything off the table, wipe it, and only put back what belongs.",
  },
  {
    id: "r4", title: "Put your shoes away", area: "bedroom", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Shoes in the middle of the room are a tripping hazard and a low-level visual irritant.",
    doneLooksLike: "All shoes are in the wardrobe or on a shoe rack.",
    suggestedNextStep: "Gather all floor shoes in one trip and put them away.",
  },
  {
    id: "r5", title: "Clear one bedroom surface", area: "bedroom", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "One clear surface in a room feels intentional. It reduces visual chaos significantly.",
    doneLooksLike: "One surface (desk, dresser, windowsill) is completely clear.",
    suggestedNextStep: "Pick the smallest surface and move everything off it first.",
  },
  {
    id: "r6", title: "Hang up 3 items of clothing", area: "bedroom", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Three items hung up is a tiny specific goal that makes a real dent without needing to do all of it.",
    doneLooksLike: "Three items are hung in the wardrobe or on hooks.",
    suggestedNextStep: "Pick three items you'd wear again soon and hang those first.",
  },
  {
    id: "g1", title: "Put 5 things back where they belong", area: "general", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "This is the universal tiny reset — works in any room, needs no setup, creates visible progress.",
    doneLooksLike: "Five out-of-place items are back in their correct home.",
    suggestedNextStep: "Scan the nearest surface and move the most obvious thing first.",
  },
  {
    id: "g2", title: "Carry one item back to its room", area: "general", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "One item returned is one less piece of clutter. It also builds momentum.",
    doneLooksLike: "One thing that doesn't belong is back where it lives.",
    suggestedNextStep: "Pick up the item and take it to its room. That's the whole task.",
  },
  {
    id: "g3", title: "Throw out the rubbish you can see", area: "general", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Visible rubbish raises background stress. Removing it takes less than 2 minutes.",
    doneLooksLike: "No obvious rubbish visible in your current space.",
    suggestedNextStep: "Walk around your space once and collect anything clearly rubbish.",
  },
  {
    id: "g4", title: "Open a window", area: "general", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Fresh air physically resets the space and the feeling of the room.",
    doneLooksLike: "At least one window is open.",
    suggestedNextStep: "Open the nearest window. That's it.",
  },
  {
    id: "g5", title: "5-minute room reset", area: "general", energyLevel: "medium", timeMinutes: 5,
    whyItMatters: "A timer-based reset makes tidying feel contained and doable, not endless.",
    doneLooksLike: "The room is noticeably better than when you started — not perfect, just better.",
    suggestedNextStep: "Set a 5-minute timer. Move fast, don't think too much. Stop when it rings.",
  },
  {
    id: "g6", title: "Clear one small surface", area: "general", energyLevel: "low", timeMinutes: 5,
    whyItMatters: "One clear surface in a cluttered room is a visual anchor. It proves order is possible.",
    doneLooksLike: "One surface is completely clear.",
    suggestedNextStep: "Pick the smallest cluttered surface you can see and clear it first.",
  },
  {
    id: "g7", title: "Fill the dishwasher for 2 minutes", area: "general", energyLevel: "low", timeMinutes: 2,
    whyItMatters: "Two minutes of loading gets a meaningful number of items in — without needing to finish.",
    doneLooksLike: "You've loaded for 2 minutes. Stop there. Close the door.",
    suggestedNextStep: "Set a timer for 2 minutes and load as many items as you can. Stop when it rings.",
  },
];

export const SPRINT_PRESETS = {
  fiveMinuteReset: {
    label: "5-min reset",
    description: "2–3 tiny low-effort tasks",
    count: 3,
    energyFilter: "low" as EnergyLevel,
    maxTimePerTask: 2 as TimeMinutes,
  },
  tenMinuteSprint: {
    label: "10-min sprint",
    description: "3–4 medium tasks",
    count: 3,
    energyFilter: "medium" as EnergyLevel,
    maxTimePerTask: 5 as TimeMinutes,
  },
  oneSongCleanup: {
    label: "One-song cleanup",
    description: "One medium task, done before the song ends",
    count: 1,
    energyFilter: "medium" as EnergyLevel,
    maxTimePerTask: 5 as TimeMinutes,
  },
} as const;

export function pickMicroTasks(
  tasks: HomeMicroTask[],
  filters: { energy?: EnergyLevel; maxMinutes?: number; area?: HomeArea },
  count: number,
  seed?: number
): HomeMicroTask[] {
  let pool = [...tasks];
  if (filters.energy) pool = pool.filter(t => t.energyLevel === filters.energy);
  if (filters.maxMinutes !== undefined) {
    const maxMinutes = filters.maxMinutes;
    pool = pool.filter(t => t.timeMinutes <= maxMinutes);
  }
  if (filters.area) pool = pool.filter(t => t.area === filters.area);
  if (pool.length === 0) pool = [...tasks];

  const shuffled = pool.sort(() => {
    const s = seed ?? Date.now();
    return Math.sin(s + pool.indexOf(pool[0])) - 0.5;
  });
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
