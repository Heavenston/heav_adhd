import { AntiVirusBubble, BlackholeBubble, Bubble, BubbleOverrides, KillReason, VirusBubble } from "../bubble";
import { clamp } from "../math";
import { Renderer } from "../renderer";
import * as cfg from "../config";

export class GoldBubble extends Bubble {
  public pair: GoldBubble | null = null;

  constructor(
    renderer: Renderer,
    
    overrides?: BubbleOverrides,
  ) {
    super(renderer, overrides);

    this.colorCfg = cfg.GOLD_BUBBLE_COLOR;
  }

  public static override get displayName(): string {
    return "golden";
  }

  public override get zindex() {
    return super.zindex + 1;
  }

  private findPair() {
    if (this.pair !== null) {
      this.pair.pair = null;
      this.pair = null;
    }

    const range = cfg.GOLD_BUBBLE_RAY_RANGE * this.radius;
    for (const bubble of this.renderer.bubbles) {
      if (!(bubble instanceof GoldBubble))
        continue;
      if (bubble === this)
        continue;
      if (bubble.isDying())
        continue;

      const dist = bubble.pos.clone().sub(this.pos).norm2();
      if (dist > range ** 2)
        continue;

      if (bubble.pair === null) {
        this.pair = bubble;
        bubble.pair = this;
      }
    }
  }

  protected override forceMultiplierWith(other: Bubble): number {
    if (other === this.pair)
      return 0;
    return super.forceMultiplierWith(other);
  }

  public override update() {
    super.update();
    const dt = this.renderer.dt;

    if (this.isDying()) {
      this.pair = null;
      return;
    }

    if (this.pair !== null && (this.pair.isDying() || !this.renderer.bubbles.includes(this.pair) || this.pair.pair !== this))
      this.pair = null;
    if (this.pair === null)
      this.findPair();

    if (this.pair !== null) {
      const diff = this.pos.clone().sub(this.pair.pos);
      const dist = diff.norm();
      const force = diff.clone().div(dist)
        .mul(clamp(dist, 50, null))
        .mul(-1);
      this.velocity.add(force.mul(dt));
    }
  }

  public override draw() {
    super.draw();
    const ctx = this.renderer.ctx;

    if (this.pair !== null) {
      const target = this.pos.clone().sub(this.pair.pos).mul(0.5).add(this.pair.pos);

      ctx.strokeStyle = this.color;
      ctx.lineCap = "round";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }
  }

  public override kill(reason: KillReason) {
    const can_kill = [GoldBubble, VirusBubble, BlackholeBubble, AntiVirusBubble];
    if (reason.type === "bubble" && !can_kill.some(class_ => reason.bubble instanceof class_))
      return;

    if (reason.type === "wall") {
      if (reason.dir.x === 0) {
        this.targetVelocity.y = Math.abs(this.targetVelocity.y) * Math.sign(-reason.dir.y);
      }
      if (reason.dir.eq(1, 0)) {
        this.pos.x = this.renderer.canvas.width - this.radius;
      }
      if (reason.dir.eq(-1, 0)) {
        this.pos.x = this.radius;
      }
      return;
    }

    super.kill(reason);
  }
}
