import { AntiVirusBubble, Bubble, BubbleOverrides, GoldBubble, KillReason } from "../bubble";
import { Vec2, gaussianRandom } from "../math";
import { Renderer } from "../renderer";
import * as cfg from "../config";

export class BlackholeBubble extends Bubble {
  public pair: GoldBubble | null = null;

  constructor(
    renderer: Renderer,
    
    overrides?: BubbleOverrides,
  ) {
    super(renderer, {
      life: gaussianRandom(10, 3),
      ...overrides,
    });

    this.targetVelocity = Vec2.ZERO;
    this.colorCfg = cfg.BLACKHOLE_BUBBLE_COLOR;
  }

  public static override get displayName(): string {
    return "black hole";
  }

  public override get zindex() {
    return super.zindex + 2;
  }

  protected override updateBubbleCollisions() {
    this.closest = 0;
    const dt = this.renderer.dt;

    for (const bubble of this.renderer.bubbles) {
      if (bubble === this)
        continue;
      if (bubble.isDying())
        continue;
      if (bubble instanceof BlackholeBubble)
        continue;
      if (bubble instanceof AntiVirusBubble)
        continue;

      const diff = this.pos.clone().sub(bubble.pos);
      const dist = diff.norm();

      const force = 20_000_000 / Math.pow(dist, 1.5);
      const forceV = diff.clone().div(dist).mul(force);

      bubble.velocity.add(forceV.mul(dt));
    }
  }

  public override kill(reason: KillReason) {
    if (reason.type === "wall") {
      if (reason.dir.eq(0, 1)) {
        this.pos.y = this.renderer.canvas.height - this.radius;
      }
      if (reason.dir.eq(0, -1)) {
        this.pos.y = this.radius;
      }
      if (reason.dir.eq(1, 0)) {
        this.pos.x = this.renderer.canvas.width - this.radius;
      }
      if (reason.dir.eq(-1, 0)) {
        this.pos.x = this.radius;
      }
      return;
    }
    if (reason.type === "bubble") {
      this.targetRadius += 1;
      return;
    }

    super.kill(reason);
  }
}
