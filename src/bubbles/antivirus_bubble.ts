import { BlackholeBubble, Bubble, BubbleOverrides, KillReason, VirusBubble } from "../bubble";
import { Vec2, clamp, gaussianRandom, lerp } from "../math";
import { Entity, Renderer } from "../renderer";
import * as cfg from "../config";

class AntiBody implements Entity {
  #target: Bubble | null = null;
  
  public opacity: number = 0;
  public relativePosition: Vec2;
  public position: Vec2;
  public rotation: number;

  private speed: number = 0;

  public dead: boolean = false;

  public get target(): Bubble | null {
    return this.#target;
  }

  public get started(): boolean {
    return this.#target !== null;
  }

  constructor(
    public readonly renderer: Renderer,
    public readonly antivirus: AntiVirusBubble,
  ) {
    this.relativePosition = Vec2.random().mul(2).sub(1).mul(antivirus.radius - 20);
    this.position = antivirus.pos.clone().add(this.relativePosition);
    this.rotation = Math.random() * Math.PI * 2;
  }

  public start(target: Bubble) {
    if (this.#target)
      throw new Error("Already a bubble");
    this.#target = target;
  }
  
  update(): void {
    if (this.isDead())
      return;
    this.opacity = clamp(this.opacity + this.renderer.dt * 5, 0, 1);

    if (!this.started) {
      this.opacity = Math.min(this.opacity, this.antivirus.opacity);
      this.position = this.antivirus.pos.clone().add(this.relativePosition);
      return;
    }
    if (this.#target === null)
      return;

    const diff = this.#target.pos.clone().sub(this.position);
    const dist = diff.norm();
    const dir = diff.clone().div(dist);

    this.rotation = dir.angleDiff(Vec2.ZERO) - Math.PI/2;

    const dist_surf = this.#target.distanceFromSurface(this.position);
    if (dist_surf < 10) {
      this.#target.kill({
        type: "other",
        message: "antibody",
      });
      this.dead = true;
      return;
    }

    this.speed = lerp(this.speed, cfg.ANTIVIRUS_ANTIBODY_SPEED, clamp(this.renderer.dt, 0, 1));

    this.position.add(dir.clone()
      .mul(this.speed)
      .mul(this.renderer.dt));
  }

  get zindex(): number {
    return this.antivirus.zindex;
  }

  draw(): void {
    const ctx = this.renderer.ctx;
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.rotation);

    const lowerSize = 20;
    const topSize = lowerSize / 2;
    const lineWidth = 3;
    const middleSep = 2;
    const topSep = 2;
    const angle = (30 / 180) * Math.PI;

    ctx.strokeStyle = `rgba(255,255,255,${this.opacity})`;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    const bottom = new Vec2(0, lowerSize);

    ctx.beginPath();
    const drawSide = (inv: 1 | -1) => {
      const x_diff = (lineWidth/2 + middleSep/2) * inv;
      ctx.moveTo(bottom.x + x_diff, bottom.y);
      ctx.lineTo(bottom.x + x_diff, 0);

      const topLeftAngle = -(-angle * inv + Math.PI/2);
      ctx.moveTo(x_diff, 0);
      ctx.lineTo(Math.cos(topLeftAngle) * topSize + x_diff, Math.sin(topLeftAngle) * topSize);
      const dy = lineWidth / 2 + topSep;
      ctx.moveTo(Math.cos(topLeftAngle) * lineWidth + x_diff + dy * inv, Math.sin(topLeftAngle) * lineWidth + dy);
      ctx.lineTo(Math.cos(topLeftAngle) * topSize + x_diff + dy * inv, Math.sin(topLeftAngle) * topSize + dy);
    };
    drawSide(1);
    drawSide(-1);
    ctx.stroke();

    ctx.restore();
  }

  isDead(): boolean {
    return (!this.started && this.antivirus.isDead()) || this.dead || !!this.#target?.isDead();
  }
}

type TargetBubble = VirusBubble | BlackholeBubble;

function isTargetBubble(b: Bubble): b is TargetBubble {
  return (b instanceof VirusBubble) || (b instanceof BlackholeBubble);
}

export class AntiVirusBubble extends Bubble {
  private antibodyToSpawnCount: number;
  private antibodies: AntiBody[] = [];
  private lastRay: number;
  private lastRayTarget: Bubble | null = null;
  private lastRayAntibody: AntiBody | null = null;

  private static targetedViruses: WeakMap<VirusBubble | BlackholeBubble, AntiBody> = new WeakMap();

  constructor(
    renderer: Renderer,
    
    overrides?: BubbleOverrides & { antibodies?: number },
  ) {
    super(renderer, {
      radius: gaussianRandom(40, 3),
      life: gaussianRandom(30, 5),
      ...overrides,
    });

    this.targetVelocity = Vec2.ZERO;
    this.colorCfg = cfg.ANTIVIRUS_BUBBLE_COLOR;

    this.lastRay = renderer.totalTime - 999;

    this.antibodyToSpawnCount = overrides?.antibodies ?? 3;
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
    ctx.lineWidth = 6;
    ctx.lineCap = "round";

    ctx.beginPath();
    const lastRay = (this.renderer.totalTime - this.lastRay) / cfg.ANTIVIRUS_RAY_ANIMATION_DURATION;
    if (lastRay < 1 &&this.lastRayTarget && this.lastRayAntibody) {
      const diff = this.pos.clone().sub(this.lastRayTarget.pos);

      const angle = diff.angleDiff(Vec2.ZERO) + Math.PI;
      const anim = Math.sin(Math.PI * lastRay);
      const opening = anim * (Math.PI / 4);

      if (lastRay > 0.25 && !this.lastRayAntibody.started) {
        this.lastRayAntibody.start(this.lastRayTarget);
      }

      ctx.arc(
        this.pos.x, this.pos.y,
        this.radius,
        angle + opening, Math.PI * 2 + angle - opening,
      );
    }
    else {
      ctx.arc(
        this.pos.x, this.pos.y,
        this.radius,
        0, Math.PI * 2,
      );
    }
    ctx.stroke();
  }

  private findTarget(): TargetBubble | null {
    const range2 = (cfg.ANTIVIRUS_RAY_RANGE * this.radius) ** 2;
    for (const bubble of this.renderer.bubbles) {
      if (bubble === this)
        continue;
      if (bubble.isDying())
        continue;
      if (!isTargetBubble(bubble))
        continue;
      if (AntiVirusBubble.targetedViruses.has(bubble))
        continue;

      const dist2 = bubble.pos.clone().sub(this.pos).norm2();
      if (dist2 > range2)
        continue;

      return bubble;
    }
    return null;
  }

  public override update() {
    super.update();

    if (this.antibodyToSpawnCount > 0 && Math.abs(this.radius - this.targetRadius) < 5) {
      const antibody = new AntiBody(this.renderer, this);
      this.antibodies.push(antibody);
      this.renderer.otherEntities.push(antibody);

      this.antibodyToSpawnCount -= 1;
    }

    if (this.isDying())
      return;

    const freeAntibodies = this.antibodies.length;
    if (freeAntibodies > 0 && this.renderer.totalTime - this.lastRay > cfg.ANTIVIRUS_RAY_COOLDOWN) {
      const target = this.findTarget();
      if (target) {
        const antibody_i = this.antibodies.findIndex(a => !a.started);
        this.lastRayAntibody = this.antibodies[antibody_i];
        this.antibodies.splice(antibody_i, 1);
        this.lastRay = this.renderer.totalTime;
        this.lastRayTarget = target;
        AntiVirusBubble.targetedViruses.set(target, this.lastRayAntibody);
      }
    }

    if (freeAntibodies === 0 && this.antibodyToSpawnCount === 0)
      this.kill({
        type: "other",
        message: "no antibodies left",
      });
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
    if (reason.type === "bubble" && !(reason.bubble instanceof BlackholeBubble))
      return;

    super.kill(reason);
  }
}
