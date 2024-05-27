import * as cfg from "./config";
import { Vec2, clamp, gaussianRandom, lerp } from "./math";
import { BubbleColorCfg, Entity, Renderer } from "./renderer";

export function createBubble(
  renderer: Renderer,
  pos?: Vec2,
): Bubble {
  const radius = gaussianRandom(30, 5);
  // Use radius to prevent touching the sides
  pos = pos ?? Vec2.random()
    .mul(renderer.canvas.width - radius*2, renderer.canvas.height - radius*2)
    .add(radius);

  const vel = new Vec2(0, clamp(gaussianRandom(150, 75), 15, null));

  if (Math.random() < cfg.GOLD_BUBBLE_PROBABILITY) {
    return new GoldBubble(renderer, pos, radius, 99999, vel);
  }

  if (Math.random() < cfg.VIRUS_BUBBLE_PROBABILITY) {
    return new VirusBubble(renderer, pos, radius, 99999, vel);
  }

  if (Math.random() < cfg.ANTIVIRUS_BUBBLE_PROBABILITY) {
    return new AntiVirusBubble(renderer, pos, radius * 2, gaussianRandom(4, 1), vel);
  }

  if (Math.random() < cfg.BLACKHOLE_BUBBLE_PROBABILITY) {
    return new BlackholeBubble(renderer, pos, radius, 10, vel);
  }

  if (Math.random() < cfg.SQUARE_BUBBLE_PROBABILITY) {
    return new SquareBubble(renderer, pos, radius, 99999, vel);
  }

  return new Bubble(renderer, pos, radius, 99999, vel);
}

type KillReason = {
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
};

export class Bubble implements Entity {
  public pos: Vec2;
  public remainingLife: number;
  public velocity: Vec2 = Vec2.ZERO;
  protected targetVelocity: Vec2;
  protected interpolatedRadius: number = 0;
  protected targetRadius: number;

  protected opacity: number = 1;
  protected closest: number = 9999;

  public colorCfg: BubbleColorCfg = cfg.DEFAULT_BUBBLE_COLOR;

  public constructor(
    public readonly renderer: Renderer,
    
    pos: Vec2,
    radius: number,
    life: number,
    velocity: Vec2,
  ) {
    this.pos = pos;
    this.targetRadius = radius;
    this.remainingLife = life;
    this.targetVelocity = velocity;
  }

  public get displayName(): string {
    return "bubble";
  }

  get zindex(): number {
    return 0;
  }

  get maxRadius(): number {
    return this.targetRadius;
  }

  get radius(): number {
    return clamp(this.interpolatedRadius, 0, null);
  }

  get forceRadius(): number {
    return this.radius / 2;
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

    return `rgba(${choice.map(Math.round).join(",")},${this.opacity})`;
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

  protected get velocityInterpolationSpeed(): number {
    return 5;
  }

  protected get radiusInterpolationSpeed(): number {
    return 10;
  }

  public update() {
    if (this.isDead())
      return;

    const dt = this.renderer.dt;
    this.remainingLife -= dt;

    if (this.isDying()) {
      this.interpolatedRadius *= 1 + dt * 2;
      this.opacity = Math.pow(this.remainingLife / cfg.BUBBLE_DYING_DURATION, 3);
      return;
    }

    this.interpolatedRadius = lerp(
      this.interpolatedRadius,
      this.targetRadius,
      clamp(dt * this.radiusInterpolationSpeed, 0, 1)
    );
    this.velocity = Vec2.lerp(
      this.velocity,
      this.targetVelocity,
      clamp(dt * this.velocityInterpolationSpeed, 0, 1)
    );
    this.pos.add(this.velocity.clone().mul(dt));

    this.updateWallsCollisions();
    this.updateBubbleCollisions();
  }

  public draw() {
    const ctx = this.renderer.ctx;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(
      this.pos.x,
      this.pos.y,
      this.radius,
      0, Math.PI * 2,
    );
    ctx.fill();
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

export class SquareBubble extends Bubble {
  public override draw() {
    const ctx = this.renderer.ctx;

    ctx.fillStyle = this.color;
    ctx.fillRect(
      this.pos.x - this.radius,
      this.pos.y - this.radius,
      this.radius * 2,
      this.radius * 2,
    );
  }

  public override get displayName(): string {
    return "square";
  }

  public minPos(): Vec2 {
    return new Vec2(
      this.pos.x - this.radius,
      this.pos.y - this.radius,
    );
  }

  public maxPos(): Vec2 {
    return new Vec2(
      this.pos.x + this.radius,
      this.pos.y + this.radius,
    );
  }

  public isInside(pos: Vec2): boolean {
    const max = this.maxPos();
    const min = this.minPos();
    return pos.x < max.x && pos.y < max.y && pos.x > min.x && pos.y > min.y;
  }

  public override distanceFromSurface(pos: Vec2): number {
    if (this.isInside(pos))
      return 0;

    const clamped = pos.clone().clamp(this.minPos(), this.maxPos());
    return clamped.sub(pos).norm();
  }
}

export class GoldBubble extends Bubble {
  public pair: GoldBubble | null = null;

  constructor(
    renderer: Renderer,
    
    pos: Vec2,
    radius: number,
    life: number,
    velocity: Vec2,
  ) {
    super(renderer, pos, radius, life, velocity);

    this.colorCfg = cfg.GOLD_BUBBLE_COLOR;
  }

  public override get displayName(): string {
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

    if (this.pair !== null && (this.pair.isDying() || !this.renderer.bubbles.includes(this.pair)))
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
    const can_kill = [GoldBubble, VirusBubble, BlackholeBubble];
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

export class BlackholeBubble extends Bubble {
  public pair: GoldBubble | null = null;

  constructor(
    renderer: Renderer,
    
    pos: Vec2,
    radius: number,
    life: number,
    velocity: Vec2,
  ) {
    super(renderer, pos, radius, life, velocity);

    this.targetVelocity = Vec2.ZERO;
    this.colorCfg = cfg.BLACKHOLE_BUBBLE_COLOR;
  }

  public override get displayName(): string {
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

export class VirusBubble extends Bubble {
  public currentTarget: Bubble | null = null;

  constructor(
    renderer: Renderer,
    
    pos: Vec2,
    radius: number,
    life: number,
    velocity: Vec2,
  ) {
    super(renderer, pos, radius, life, velocity);

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

export class AntiVirusBubble extends Bubble {
  private rays: { age: number, target: Vec2 }[] = [];
  private lastRay: number;

  constructor(
    renderer: Renderer,
    
    pos: Vec2,
    radius: number,
    life: number,
    velocity: Vec2,
  ) {
    super(renderer, pos, radius, life, velocity);

    this.targetVelocity = Vec2.ZERO;
    this.colorCfg = cfg.ANTIVIRUS_BUBBLE_COLOR;

    this.lastRay = renderer.totalTime;
  }

  public override get displayName(): string {
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
