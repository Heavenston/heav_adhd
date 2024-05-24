import * as cfg from "./config";
import { Vec2, clamp, gaussianRandom, lerp } from "./math";
import { BubbleColorCfg, Entity, Renderer } from "./renderer";

export function createBubble(
  renderer: Renderer,
): Bubble {
  const radius = gaussianRandom(30, 5);
  // Use radius to prevent touching the sides
  const pos = Vec2.random()
    .mul(renderer.canvas.width - radius*2, renderer.canvas.height - radius*2)
    .add(radius);

  const vel = new Vec2(0, clamp(gaussianRandom(150, 75), 15, null));

  if (Math.random() < cfg.GOLD_BUBBLE_PROBABILITY) {
    return new GoldBubble(renderer, pos, radius, 99999, vel);
  }

  // A blackhole fills a lot of bubbles, increasing the spawn rate
  // thus making spawning a new blackhole more probable
  // so to avoid a vicious-cycle we half the probability for each already existing
  // blackhole
  let bh_brop = cfg.BLACKHOLE_BUBBLE_PROBABILITY;
  for (const b of renderer.bubbles) {
    if (b instanceof BlackholeBubble) {
      bh_brop /= 2;
    }
  }
  if (Math.random() < bh_brop) {
    return new BlackholeBubble(renderer, pos, radius, 10, vel);
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

  /// Apply velocities based on a close object
  protected objectAt(
    diff: Vec2,
    size: number,
    forceSize: number,
    forceMultiplier: number = 10,
  ): boolean {
    const distance = diff.norm();
    const contact_distance = distance - (this.radius + size);

    if (contact_distance < 0)
      return true;

    const forceRadius = this.forceRadius + forceSize;

    if (contact_distance < forceRadius) {
      const closness = 1 - contact_distance / forceRadius;
      this.closest = Math.max(closness, this.closest);
      let force = Math.pow(closness, 2) * forceMultiplier;
      this.velocity.add(diff.clone().div(distance).mul(force));
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

  protected updateBubbleCollisions() {
    this.closest = 0;
    for (const bubble of this.renderer.bubbles) {
      if (bubble === this || bubble.isDying())
        continue;

      const diff = this.pos.clone().sub(bubble.pos);
      if (this.objectAt(diff, bubble.radius, bubble.forceRadius)) {
        bubble.kill({type:"bubble",bubble:this});
        this.kill({type:"bubble",bubble});
      }
    }
  }

  protected updateMouseCollision() {
    if (this.renderer.mousePos === null)
      return;
    if (this.renderer.timeSinceLastClick() < cfg.MOUSE_CLICK_COOLDOWN)
      return;
    const mul = this.renderer.mouseSpeed?.norm() ?? 0;

    if (this.objectAt(
      this.pos.clone().sub(this.renderer.mousePos),
      10, 50,
      clamp(mul, 10, 500),
    )) {
      this.kill({type:"mouse"});
    }
  }

  protected updateForceFieldCollisions() {
    const dt = this.renderer.dt;
    for (const ff of this.renderer.forceFields) {
      this.velocity.add(ff.getForceOn(this).div(dt));
    }
  }

  public update() {
    if (this.isDead())
      return;

    const dt = this.renderer.dt;
    this.remainingLife -= dt;

    if (this.isDying()) {
      this.interpolatedRadius += dt * 100;
      this.opacity = Math.pow(this.remainingLife / cfg.BUBBLE_DYING_DURATION, 3);
      return;
    }

    this.interpolatedRadius = lerp(this.interpolatedRadius, this.targetRadius, clamp(dt * 10, 0, 1));
    this.velocity = this.velocity.lerp(this.targetVelocity, clamp(dt * 3, 0, 1));
    this.pos.add(this.velocity.clone().mul(dt));

    this.updateWallsCollisions();
    this.updateBubbleCollisions();
    this.updateMouseCollision();
    this.updateForceFieldCollisions();
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

  public override get zindex() {
    return super.zindex + 1;
  }

  private findPair() {
    for (const bubble of this.renderer.bubbles) {
      if (!(bubble instanceof GoldBubble))
        continue;
      if (bubble === this)
        continue;
      if (bubble.isDying())
        continue;

      if (bubble.pair === null) {
        this.pair = bubble;
        bubble.pair = this;
      }
    }
  }

  protected override updateBubbleCollisions() {
    this.closest = 0;
    for (const bubble of this.renderer.bubbles) {
      if (bubble === this || bubble.isDying())
        continue;

      const diff = this.pos.clone().sub(bubble.pos);
      if (this.objectAt(diff, bubble.radius, bubble.forceRadius, this.pair === bubble ? 0 : undefined)) {
        bubble.kill({type:"bubble",bubble:this});
        // ignored if required
        this.kill({type:"bubble",bubble});
      }
    }
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
    const can_kill = [GoldBubble, BlackholeBubble];
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

    if (reason.type === "mouse")
      return;

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

      const diff = this.pos.clone().sub(bubble.pos);
      const dist = diff.norm();

      const force = 20_000_000 / Math.pow(dist, 1.5);
      const forceV = diff.clone().div(dist).mul(force);

      bubble.velocity.add(forceV.mul(dt));
    }
  }

  public override kill(reason: KillReason) {
    if (reason.type === "mouse")
      return;
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
