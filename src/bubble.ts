import * as cfg from "./config";
import { Vec2 } from "./math";
import { Renderer } from "./renderer";

export { Bubble, BubbleOverrides } from "./bubbles/normal_bubble";
import { Bubble, BubbleOverrides } from "./bubbles/normal_bubble";
export { GoldBubble } from "./bubbles/gold_bubble";
import { GoldBubble } from "./bubbles/gold_bubble";
export { SquareBubble } from "./bubbles/square_bubble";
import { SquareBubble } from "./bubbles/square_bubble";
export { BlackholeBubble } from "./bubbles/blackhole_bubble";
import { BlackholeBubble } from "./bubbles/blackhole_bubble";
export { VirusBubble } from "./bubbles/virus_bubble";
import { VirusBubble } from "./bubbles/virus_bubble";
export { AntiVirusBubble } from "./bubbles/antivirus_bubble";
import { AntiVirusBubble } from "./bubbles/antivirus_bubble";

export type KillReason = {
  type: "mouse",
} | {
  type: "wall",
  dir: Vec2,
} | {
  type: "bubble",
  bubble: Bubble,
} | {
  type: "antivirus_ray",
  antivirus: AntiVirusBubble,
} | {
  // Kills itself because there isn't anyone, used by bubbles that can't die
  // if nobody is here so they don't just sit there
  type: "underpopulation_suicide"
} | {
  type: "other",
  message: string,
};

export const bubbleClasses = {
  "bubble": {
    class_: Bubble,
    probability: cfg.NORMAL_BUBBLE_PROBABILITY,
  },
  "square": {
    class_: SquareBubble,
    probability: cfg.SQUARE_BUBBLE_PROBABILITY,
  },
  "golden": {
    class_: GoldBubble,
    probability: cfg.GOLD_BUBBLE_PROBABILITY,
  },
  "blackhole": {
    class_: BlackholeBubble,
    probability: cfg.BLACKHOLE_BUBBLE_PROBABILITY,
  },
  "virus": {
    class_: VirusBubble,
    probability: cfg.VIRUS_BUBBLE_PROBABILITY,
  },
  "antivirus": {
    class_: AntiVirusBubble,
    probability: cfg.ANTIVIRUS_BUBBLE_PROBABILITY,
  },
} as const;

export function createBubble(
  renderer: Renderer,
  overrides?: BubbleOverrides,
): Bubble {
  let possibilities = Object.values(bubbleClasses).map(v => ({...v}));
  const sum = possibilities.reduce((sum, p) => sum + p.probability, 0);
  for (const p of possibilities)
    p.probability /= sum;
  possibilities.sort((a, b) => b.probability - a.probability);

  let prob = Math.random();
  for (const poss of possibilities) {
    if (poss.probability < prob) {
      prob -= poss.probability;
      continue;
    }

    return new poss.class_(renderer, overrides);
  }
  throw new Error("Could not attribute a bubble");
}
