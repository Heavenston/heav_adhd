import { BlackholeBubble, Bubble, BubbleOverrides, KillReason, VirusBubble } from "../bubble";
import { Vec2, gaussianRandom } from "../math";
import { Renderer } from "../renderer";
import * as cfg from "../config";

export class AntiVirusBubble extends Bubble {
  private rays: { age: number, target: Vec2 }[] = [];
  private lastRay: number;

  constructor(
    renderer: Renderer,
    
    overrides?: BubbleOverrides,
  ) {
    super(renderer, {
      radius: gaussianRandom(40, 3),
      life: gaussianRandom(4, 1),
      ...overrides,
    });

    this.targetVelocity = Vec2.ZERO;
    this.colorCfg = cfg.ANTIVIRUS_BUBBLE_COLOR;

    this.lastRay = renderer.totalTime;
  }

  public static override get displayName(): string {
    return "antivirus";
  }

  protected override forceMultiplierWith(_other: Bubble): number {
    return 0;
  }

  protected override get radiusInterpolationSpeed(): number {
    return 5;
  }

  public override get zindex() {
    return super.zindex + 5;
  }

  public override draw() {
    const ctx = this.renderer.ctx;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.radius / 5;
    ctx.lineCap = "round";

    const angles = [
      Math.PI,
      - Math.PI / 5,
        Math.PI / 5,
    ].map(v => v - Math.PI / 2);

    ctx.beginPath();
    for (const angle of angles) {
      ctx.moveTo(this.pos.x, this.pos.y);
      const to = this.pos.clone().add(Vec2.rotated(angle).mul(this.radius));
      ctx.lineTo(to.x, to.y);
    }
    ctx.moveTo(this.pos.x + this.radius, this.pos.y);
    ctx.arc(
      this.pos.x, this.pos.y,
      this.radius,
      0, Math.PI * 2,
    );
    ctx.stroke();

    if (this.isDying())
      return;

    for (const ray of this.rays) {
      const animation_t = (ray.age / cfg.ANTIVIRUS_RAY_ANIMATION_DURATION);
      ctx.strokeStyle = `rgba(255,255,255,${1-animation_t})`;
      ctx.lineWidth = animation_t * 20 + 5;
      ctx.lineCap = "round";

      ctx.beginPath();
      const diff = ray.target.clone().sub(this.pos);
      const dir = diff.div(diff.norm());
      const start = this.pos.clone().add(dir.mul(this.radius));
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(ray.target.x, ray.target.y);
      ctx.stroke();
    }
  }

  private findTarget(): Bubble | null {
    const range = cfg.ANTIVIRUS_RAY_RANGE * this.radius;
    for (const bubble of this.renderer.bubbles) {
      if (bubble === this)
        continue;
      if (bubble.isDying())
        continue;

      const dist2 = bubble.pos.clone().sub(this.pos).norm2();

      if (dist2 > range ** 2)
        continue;
        
      if (bubble instanceof VirusBubble)
        return bubble;
      if (bubble instanceof BlackholeBubble)
        return bubble;
    }
    return null;
  }

  public override update() {
    super.update();
    const dt = this.renderer.dt;

    if (this.isDying())
      return;

    if (this.renderer.totalTime - this.lastRay > cfg.ANTIVIRUS_RAY_COOLDOWN) {
      this.lastRay = this.renderer.totalTime;
      const target = this.findTarget();
      if (target) {
        target.kill({type: "antivirus_ray", antivirus: this});
        this.rays.push({
          age: 0,
          target: target.pos,
        });
      }
    }

    for (const ray of this.rays) {
      ray.age += dt;
    }
    
    this.rays = this.rays.filter(ray => ray.age < cfg.ANTIVIRUS_RAY_ANIMATION_DURATION);
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
    if (reason.type === "bubble")
      return;

    super.kill(reason);
  }
}
