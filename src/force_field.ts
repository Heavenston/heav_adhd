import { Bubble } from "./bubble";
import { Vec2, clamp, gaussianRandom } from "./math";
import { Entity, Renderer } from "./renderer";

export class ForceField implements Entity {
  private started = false;
  public age = 0;
  #force = 10;
  private particles: {pos: Vec2, vel: Vec2}[] = [];

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
    this.#force = clamp(n, 0, 150);
  }

  public isDead(): boolean {
    return this.age > this.duration;
  }

  public update(): void {
    if (this.isDead())
      return;
    if (!this.started) {
      for (let i = 0; i < Math.ceil(this.#force / 25); i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = gaussianRandom(this.radius, 1);
        this.particles.push({
          pos: this.pos.clone().add(Vec2.rotated(angle).mul(distance)),
          vel: Vec2.ZERO,
        });
      }

      const toRemove = [];
      for (const particle of this.particles) {
        const diff = particle.pos.clone().sub(this.pos);
        const dist = diff.norm();
        if (dist < 5) {
          toRemove.push(particle);
        }
        const speed = Math.pow((dist / 10 + 18), 1.75);
        particle.vel = diff.div(dist).mul(speed);
        particle.pos.sub(particle.vel.clone().mul(this.renderer.dt));
      }
      for (const tr of toRemove) {
        this.particles.splice(this.particles.indexOf(tr), 1);
      }

      return;
    }
    this.particles = [];
    this.age += this.renderer.dt;
  }

  public get duration(): number {
    return 5 * Math.pow(this.force, -0.8);
  }

  public get radius(): number {
    const rad = this.force * 5;
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
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      for (const particle of this.particles) {
        ctx.beginPath();
        ctx.moveTo(particle.pos.x, particle.pos.y);
        ctx.lineTo(particle.pos.x + particle.vel.x / 25, particle.pos.y + particle.vel.y / 25);
        ctx.stroke();
      }
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
    const diff = bubble.pos.clone().sub(this.pos);
    const dist = diff.norm();
    const normalized_dist = clamp(dist - bubble.radius - this.radius, 0, null);
    if (normalized_dist > 1) {
      return Vec2.ZERO;
    }

    return diff.clone().div(dist).mul(this.force * this.opacity);
  }
}
