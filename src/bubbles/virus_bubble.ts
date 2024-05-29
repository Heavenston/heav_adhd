import { AntiVirusBubble, BlackholeBubble, Bubble, BubbleOverrides, KillReason } from "../bubble";
import { Vec2, clamp } from "../math";
import { Renderer } from "../renderer";
import * as cfg from "../config";

export class VirusBubble extends Bubble {
  public currentTarget: Bubble | null = null;
  public underpopulatedSince: number = 0;

  constructor(
    renderer: Renderer,
    
    overrides?: BubbleOverrides,
  ) {
    super(renderer, overrides);

    this.targetVelocity = Vec2.ZERO;
    this.colorCfg = cfg.VIRUS_BUBBLE_COLOR;
  }

  public static override get displayName(): string {
    return "virus";
  }

  protected override forceMultiplierWith(_other: Bubble): number {
    return 0;
  }

  protected override get velocityInterpolationSpeed(): number {
    return 7.5;
  }

  protected findNewTarget(blacklist = [
    BlackholeBubble,
    VirusBubble,
    AntiVirusBubble,
  ], rec = true): void {
    // slowest bubble
    let target: Bubble | null = null;
    let targetValue = -Infinity;
    for (const bubble of this.renderer.bubbles) {
      if (bubble.isDying())
        continue;
      if (bubble === this)
        continue;
      if (blacklist.some(c => bubble instanceof c))
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

    // if (!target && rec)
    //   return this.findNewTarget([], rec = false);
  }

  public override update() {
    super.update();

    if (this.currentTarget?.isDying())
      this.currentTarget = null;
    if (this.currentTarget === null)
      this.findNewTarget();
    if (this.currentTarget === null) {
      this.underpopulatedSince += this.renderer.dt;
      if (this.underpopulatedSince > cfg.UNDERPOPULATION_SUICIDE_AFTER)
        this.kill({
          type: "underpopulation_suicide",
        });

      this.targetVelocity = Vec2.ZERO;
      return;
    }
    this.underpopulatedSince = 0;

    const diff = this.currentTarget.pos.clone().sub(this.pos);
    const dist = diff.norm();
    const force = clamp(dist * 3, this.currentTarget.velocity.norm() * 2, null);
    const dir = diff.clone().div(dist);

    this.targetRotation = dir.angleDiff(Vec2.ZERO);
    this.targetVelocity = dir.mul(force);
  }

  public override draw() {
    const ctx = this.renderer.ctx;
    ctx.save();
    this.applyCtxTransform();

    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineCap = "round";
    ctx.lineWidth = 5;

    const angles = [
      0.00, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75
    ].map(v => v * Math.PI);

    ctx.beginPath();
    ctx.arc(0,0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    const outer_radius = this.radius * 1.25;
    for (const angle of angles) {
      const targeta = Vec2.rotated(angle).mul(this.radius);
      const targetb = Vec2.rotated(angle).mul(outer_radius);
      ctx.moveTo(targeta.x, targeta.y);
      ctx.lineTo(targetb.x, targetb.y);

      const sa = angle - 0.1;
      const sb = angle + 0.1;
      const target1 = Vec2.rotated(sa).mul(outer_radius);
      ctx.moveTo(target1.x, target1.y)
      ctx.arc(0,0, outer_radius, sa, sb);
    }
    ctx.stroke();

    ctx.restore();
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
    if (reason.type === "bubble" && !canKill.some(class_ => reason.bubble instanceof class_)) {
      if (!(this.currentTarget instanceof VirusBubble && reason.bubble === this.currentTarget))
        return;
    }

    super.kill(reason);
  }
}
