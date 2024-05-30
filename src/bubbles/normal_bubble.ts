import { KillReason } from "../bubble";
import { Vec2, clamp, expDecay, gaussianRandom, modExpDecay } from "../math";
import { BubbleColorCfg, Entity, Renderer } from "../renderer";
import * as cfg from "../config";

export type BubbleOverrides = {
  pos?: Vec2,
  radius?: number,
  life?: number,
  velocity?: Vec2,
  rotation?: number,
};

export class Bubble implements Entity {
  public started: boolean = false;

  public pos: Vec2;
  public remainingLife: number;
  public velocity: Vec2 = Vec2.ZERO;
  public rotation: number = 0;
  protected targetVelocity: Vec2;
  protected interpolatedRadius: number = 0;
  protected targetRadius: number;
  protected targetRotation: number = 0;

  #opacity: number = 1;
  protected closest: number = 9999;

  public colorCfg: BubbleColorCfg = cfg.DEFAULT_BUBBLE_COLOR;

  public constructor(
    public readonly renderer: Renderer,
    
    overrides?: BubbleOverrides,
  ) {
    const radius = overrides?.radius ??
      gaussianRandom(30, 5);
    const pos = overrides?.pos ??
      Vec2.random()
      .mul(renderer.canvas.width - radius*2, renderer.canvas.height - radius*2)
      .add(radius);
    const velocity = overrides?.velocity ??
      new Vec2(0, clamp(gaussianRandom(150, 75), 15, null));
    const life = overrides?.life ?? 99999;

    this.pos = pos;
    this.targetRadius = radius;
    this.remainingLife = life;
    this.targetVelocity = velocity;
    this.targetRotation = overrides?.rotation ?? 0;
  }

  public static get displayName(): string {
    return "bubble";
  }

  public get displayName(): string {
    // If a subclass overrides the static displayName this gets the right one
    return (this.constructor as any)?.displayName ?? "error";
  }

  get zindex(): number {
    return 0;
  }

  get maxRadius(): number {
    return this.targetRadius;
  }

  get radius(): number {
    if (!this.started) {
      return this.targetRadius;
    }
    return clamp(this.interpolatedRadius, 0, null);
  }

  get forceRadius(): number {
    return this.radius / 2;
  }

  get opacity(): number {
    return this.#opacity;
  }

  get color(): string {
    const normal = this.colorCfg.default;
    const close = this.colorCfg.close;
    const closest = clamp(this.closest, 0, 1);
    const choice = [
      normal[0] * (1 - closest) + close[0] * closest,
      normal[1] * (1 - closest) + close[1] * closest,
      normal[2] * (1 - closest) + close[2] * closest,
    ];

    return `rgba(${choice.map(Math.round).join(",")},${this.#opacity})`;
  }

  /// 0 if pos is at the surface or inside, 1 if 1 pixel from surface
  public distanceFromSurface(pos: Vec2): number {
    return clamp(this.pos.clone().sub(pos).norm() - this.radius, 0, null);
  }

  public gapBetween(other: Bubble): number {
    const diff = other.pos.clone().sub(this.pos);
    const dist = diff.norm();
    const dir = diff.clone().div(dist);

    const a = other.distanceFromSurface(this.pos);
    if (a <= 0)
      return 0;

    const possibleContactPoint = this.pos.clone()
      .add(dir.clone().mul(a));

    return this.distanceFromSurface(possibleContactPoint);
  }

  /// Apply velocities based on a close object
  protected applyObjectForce(
    dir: Vec2,
    gap: number,
    forceRadius: number,
    forceMultiplier: number,
  ): boolean {
    if (gap <= 0)
      return true;

    const sumedForceRadius = this.forceRadius + forceRadius;

    if (gap < sumedForceRadius) {
      const closness = 1 - gap / sumedForceRadius;
      this.closest = Math.max(closness, this.closest);
      let force = Math.pow(closness, 2) * forceMultiplier;
      this.velocity.add(dir.clone().mul(force));
    }

    return false;
  }

  protected updateWallsCollisions() {
    if (this.pos.y + this.radius > this.renderer.canvas.height) {
      this.kill({type:"wall",dir:new Vec2(0,1)});
    }
    if (this.pos.y - this.radius < 0) {
      this.kill({type:"wall",dir:new Vec2(0,-1)});
    }
    if (this.pos.x + this.radius > this.renderer.canvas.width) {
      this.kill({type:"wall",dir:new Vec2(1,0)});
    }
    if (this.pos.x - this.radius < 0) {
      this.kill({type:"wall",dir:new Vec2(-1,0)});
    }
  }

  protected forceMultiplierWith(_other: Bubble): number {
    return 10;
  }

  protected updateBubbleCollisions() {
    this.closest = 0;
    for (const bubble of this.renderer.bubbles) {
      if (bubble === this || bubble.isDying())
        continue;

      const diff = this.pos.clone().sub(bubble.pos);
      const dist = diff.norm();
      const dir = diff.clone().div(dist);

      const gap = this.gapBetween(bubble);

      if (this.applyObjectForce(dir, gap, bubble.forceRadius, this.forceMultiplierWith(bubble))) {
        bubble.kill({type:"bubble",bubble:this});
        this.kill({type:"bubble",bubble});
      }
    }
  }

  protected get rotationInterpolationHalfLife(): number {
    return 0.1;
  }

  protected get velocityInterpolationHalfLife(): number {
    return 0.5;
  }

  protected get radiusInterpolationHalfLife(): number {
    return 0.05;
  }

  public update() {
    if (this.isDead())
      return;
    this.started = true;

    const dt = this.renderer.dt;
    this.remainingLife -= dt;

    if (this.isDying()) {
      this.interpolatedRadius *= 1 + dt * 2;
      this.#opacity = Math.pow(this.remainingLife / cfg.BUBBLE_DYING_DURATION, 3);
      return;
    }

    this.rotation = modExpDecay(
      this.rotation, this.targetRotation,
      Math.PI * 2,
      dt, this.rotationInterpolationHalfLife
    );

    this.interpolatedRadius = expDecay(
      this.interpolatedRadius, this.targetRadius,
      dt, this.radiusInterpolationHalfLife,
    );
    this.velocity = Vec2.expDecay(
      this.velocity, this.targetVelocity,
      dt, this.velocityInterpolationHalfLife,
    );
    this.pos.add(this.velocity.clone().mul(dt));

    this.updateWallsCollisions();
    this.updateBubbleCollisions();
  }

  public applyCtxTransform() {
    const ctx = this.renderer.ctx;
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.rotation);
  }

  public draw() {
    const ctx = this.renderer.ctx;
    ctx.save();
    this.applyCtxTransform();

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0,0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  public isDead(): boolean {
    return this.remainingLife < 0;
  }

  public isDying(): boolean {
    return this.remainingLife < cfg.BUBBLE_DYING_DURATION;
  }

  public kill(reason: KillReason) {
    if (this.isDying())
      return;
    this.remainingLife = cfg.BUBBLE_DYING_DURATION;
    if (reason.type === "bubble" || reason.type == "mouse")
      this.closest = 1;
  }
}


