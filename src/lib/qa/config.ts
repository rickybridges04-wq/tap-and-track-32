// Synapse QA OS — shared config.
export const DEPTH_LIMITS = {
  quick: 5,
  standard: 15,
  deep: 40,
} as const;

export type Depth = keyof typeof DEPTH_LIMITS;
