import { Bubble } from "./bubble";
import { Vec2, clamp, gaussianRandom } from "./math";
import { Entity, Renderer } from "./renderer";
import * as cfg from "./config";

class Particle implements Entity {
  public age = 0;
  public pos: Vec2;

  private opacity: number = 1;
  private velocity: Vec2 = Vec2.ZERO;
  private oldPoses: Vec2[] = [];
  private static OLD_POSES_COUNT = 5;
  
  constructor(
    public readonly renderer: Renderer,
    public readonly forceField: ForceField,
    public readonly maxAge: number,
  ) {
    const angle = Math.random() * Math.PI * 2;
    const distance = gaussianRandom(forceField.radius, forceField.radius / 10);
    this.pos = forceField.pos.clone().add(Vec2.rotated(angle).mul(distance));

    forceField.particleCount += 1;
  }

  afterRemove(): void {
    this.forceField.particleCount -= 1;
  }

  update(): void {
    const dt = this.renderer.dt;
    this.age += dt;
    if (this.isDead()) {
      return;
    }

    this.oldPoses.push(this.pos.clone());
    this.oldPoses.splice(0, clamp(this.oldPoses.length - Particle.OLD_POSES_COUNT, 0, null));

    if (this.forceField.started) {
      this.pos.add(this.velocity.clone().mul(this.renderer.dt));
      this.opacity -= this.renderer.dt / this.forceField.duration;
      this.opacity = clamp(this.opacity, 0, 1);

      const force = this.velocity.clone().mul(this.renderer.dt).mul(5);
      for (const bubble of this.renderer.bubbles) {
        if (bubble.distanceFromSurface(this.pos) <= 0)
          bubble.velocity.add(force);
      }
      
      return;
    }

    const diff = this.forceField.pos.clone().sub(this.pos);
    const dist = diff.norm();
    if (dist < 5) {
      this.age = this.maxAge;
      return;
    }
    const speed = Math.pow((dist / 10 + 18), 1.75);
    this.velocity = diff.div(dist).mul(speed);
    this.pos.add(this.velocity.clone().mul(this.renderer.dt));
  }

  draw(): void {
    const ctx = this.renderer.ctx;

    if (this.oldPoses.length < 3)
      return;

    const oldest = this.oldPoses[0];
    const mid = this.oldPoses[Math.floor(this.oldPoses.length / 2)];
    const last = this.oldPoses[this.oldPoses.length - 1];

    ctx.strokeStyle = `rgba(255,255,255,${this.opacity})`;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(oldest.x, oldest.y);
    ctx.bezierCurveTo(
      oldest.x, oldest.y,
      mid.x, mid.y,
      last.x, last.y
    );
    ctx.stroke();
  }

  isDead(): boolean {
    return this.age > this.maxAge || this.opacity === 0;
  }

  get zindex(): number {
    return 10;
  }
}

export class ForceField implements Entity {
  public started = false;
  public age = 0;
  #force = cfg.FORCE_FIELD_DEFAULT_FORCE;
  public particleCount = 0;

  constructor(
    public readonly renderer: Renderer,
    public pos: Vec2,
  ){}

  public get zindex() {
    return 10;
  }

  public start() {
    this.started = true;
  }

  public get force(): number {
    return this.#force;
  }

  public set force(n: number) {
    if (this.started) {
      throw new Error("Cannot change force after started");
    }
    this.#force = clamp(n, 0, cfg.FORCE_FIELD_MAX_FORCE);
  }

  public isDead(): boolean {
    return this.age > this.duration;
  }

  public update(): void {
    if (this.isDead())
      return;
    if (!this.started) {
      for (
        let i = 0;
        this.particleCount < cfg.FORCE_FIELD_MAX_PARTICLES &&
        i < Math.ceil(this.radius * cfg.FORCE_FIELD_RADIUS_TO_PARTICLE_COUNT_FACTOR);
        i++
      ) {
        this.renderer.otherEntities.push(new Particle(
          this.renderer, this, 1
        ));
      }

      return;
    }

    this.age += this.renderer.dt;

    for (const bubble of this.renderer.bubbles) {
      if (bubble.isDying())
        continue;

      bubble.velocity.add(this.getForceOn(bubble).mul(this.renderer.dt));
    }
  }

  public get duration(): number {
    return Math.pow(this.force * cfg.FORCE_FIELD_FORCE_TO_DURATION_SCALE, -0.8);
  }

  public get radius(): number {
    const rad = this.force * cfg.FORCE_FIELD_FORCE_TO_RADIUS_SCALE;
    if (!this.started)
      return rad;
    return (1 - this.opacity) * rad;
  }

  public get opacity(): number {
    if (!this.started)
      return 1;
    const age_fact = this.age / this.duration;
    return 1 - age_fact;
  }

  public get color(): string {
    return `rgba(255,255,255,${this.opacity})`;
  }

  public draw(): void {
    const ctx = this.renderer.ctx;
    if (!this.started) {
      return;
    }
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

  public getForceOn(bubble: Bubble): Vec2 {
    if (!this.started)
      return Vec2.ZERO;
    const diff = this.pos.clone().sub(bubble.pos);
    const dist = diff.norm();
    const dir = diff.clone().div(dist);
    const normalized_dist = clamp(dist - bubble.radius - this.radius, 0, null);
    if (normalized_dist > 1) {
      return Vec2.ZERO;
    }

    return dir.mul(-1).mul((this.force ** 1.5) * this.opacity);
  }
}
