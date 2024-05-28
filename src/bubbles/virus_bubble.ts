import { AntiVirusBubble, BlackholeBubble, Bubble, BubbleOverrides, KillReason } from "../bubble";
import { Vec2, clamp } from "../math";
import { Renderer } from "../renderer";
import * as cfg from "../config";

export class VirusBubble extends Bubble {
  public currentTarget: Bubble | null = null;

  constructor(
    renderer: Renderer,
    
    overrides?: BubbleOverrides,
  ) {
    super(renderer, overrides);

    this.targetVelocity = Vec2.ZERO;
    this.colorCfg = cfg.VIRUS_BUBBLE_COLOR;
  }

  public override get displayName(): string {
    return "virus";
  }

  protected override forceMultiplierWith(_other: Bubble): number {
    return 0;
  }

  protected override get velocityInterpolationSpeed(): number {
    return 7.5;
  }

  protected findNewTarget() {
    // slowest bubble
    let target: Bubble | null = null;
    let targetValue = -Infinity;
    for (const bubble of this.renderer.bubbles) {
      if (bubble.isDying())
        continue;
      if (bubble === this)
        continue;
      if (bubble instanceof BlackholeBubble)
        continue;
      if (bubble instanceof VirusBubble)
        continue;
      if (bubble instanceof AntiVirusBubble)
        continue;

      const value = -bubble.velocity.norm2();
      if (value > targetValue) {
        let otherHasThisTarget = this.renderer.bubbles.some(other => (
          other instanceof VirusBubble && !other.isDying() && other.currentTarget === bubble
        ));
        if (otherHasThisTarget) {
          continue;
        }

        targetValue = value;
        target = bubble;
      }
    }
    this.currentTarget = target;
  }

  public override update() {
    super.update();

    if (this.currentTarget?.isDying())
      this.currentTarget = null;
    if (this.currentTarget === null)
      this.findNewTarget();
    if (this.currentTarget === null)
      return;

    const diff = this.currentTarget.pos.clone().sub(this.pos);
    const dist = diff.norm();
    const force = clamp(dist * 3, this.currentTarget.velocity.norm() * 2, null);
    const dir = diff.clone().div(dist);

    this.targetVelocity = dir.mul(force);
  }

  public override kill(reason: KillReason) {
    if (reason.type === "wall") {
      if (reason.dir.eq(0, 1)) {
        this.pos.y = this.renderer.canvas.height - this.radius;
        if (this.velocity.y < 0)
          this.velocity.y = 0;
      }
      if (reason.dir.eq(0, -1)) {
        this.pos.y = this.radius;
        if (this.velocity.y < 0)
          this.velocity.y = 0;
      }
      if (reason.dir.eq(1, 0)) {
        this.pos.x = this.renderer.canvas.width - this.radius;
        if (this.velocity.x > 0)
          this.velocity.x = 0;
      }
      if (reason.dir.eq(-1, 0)) {
        this.pos.x = this.radius;
        if (this.velocity.x < 0)
          this.velocity.x = 0;
      }
      return;
    }
    const canKill = [BlackholeBubble, AntiVirusBubble];
    if (reason.type === "bubble" && !canKill.some(class_ => reason.bubble instanceof class_))
      return;

    super.kill(reason);
  }
}
