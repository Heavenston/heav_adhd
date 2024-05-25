import { BubbleColorCfg } from "./renderer";

export const BACKGROUND_COLOR = "#202020";
export const BUBBLE_DYING_DURATION = 0.5;
export const MOUSE_CLICK_COOLDOWN = 2;

export const ANTIVIRUS_RAY_COOLDOWN = 0.25;
export const ANTIVIRUS_RAY_ANIMATION_DURATION = 1;

export const GOLD_BUBBLE_PROBABILITY = 0.01;
export const BLACKHOLE_BUBBLE_PROBABILITY = 0.001;
export const VIRUS_BUBBLE_PROBABILITY = 0.005;
export const ANTIVIRUS_BUBBLE_PROBABILITY = 0.005;

export const DEFAULT_BUBBLE_COLOR: BubbleColorCfg = {
  default: Object.freeze([100, 136, 234] as const),
  close: Object.freeze([255, 0, 0] as const),
};
export const GOLD_BUBBLE_COLOR: BubbleColorCfg = {
  default: Object.freeze([236, 189, 0] as const),
  close: Object.freeze([236, 80, 0] as const),
};
export const BLACKHOLE_BUBBLE_COLOR: BubbleColorCfg = {
  default: Object.freeze([0, 0, 0] as const),
  close: Object.freeze([255, 255, 255] as const),
};
export const VIRUS_BUBBLE_COLOR: BubbleColorCfg = {
  default: Object.freeze([119, 221, 119] as const),
  close: Object.freeze([119, 221, 119] as const),
};
export const ANTIVIRUS_BUBBLE_COLOR: BubbleColorCfg = {
  default: Object.freeze([255,255,255] as const),
  close: Object.freeze([255,255,255] as const),
};
