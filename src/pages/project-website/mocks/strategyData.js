export const initialStrategyMeta = {
  conceptTitle: "Modern Minimalist Workspace",
  conceptDescription: "A clean, distraction-free environment utilizing natural light and sustainable materials to boost productivity.",
  progress: 40,
  updatedAt: "2026-03-24T12:00:00Z"
};

export const initialStrategyBlocks = [
  {
    id: "b-persona-1",
    type: "persona",
    data: {
      profileName: "Tech Entrepreneur (30s)",
      traits: ["Values efficiency", "Prefers clean aesthetics"],
    },
    order: 0
  },
  {
    id: "b-issue-1",
    type: "issue",
    data: {
      title: "Space Constraints",
      description: "15sqm too small for a proper meeting area.",
      status: "open"
    },
    order: 1
  },
  {
    id: "b-issue-2",
    type: "issue",
    data: {
      title: "Poor Lighting",
      description: "Only one north-facing window, gets dark in the afternoon.",
      status: "open"
    },
    order: 2
  }
];
