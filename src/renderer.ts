import { Vec2, clamp, lerp } from "./math";
import { UserError } from "./usererror";

const TARGET_BUBBLE_COUNT = 40;
const BACKGROUND_COLOR = "#202020";
const BUBBLE_DYING_DURATION = 0.5;

class Bubble {
  public pos: Vec2;
  private life: number;
  private velocity: Vec2 = Vec2.ZERO;
  private readonly targetVelocity: Readonly<Vec2>;
  private interpolatedRadius: number = 0;
  private readonly targetRadius: number;

  private opacity: number = 1;
  private closest: number = 9999;

  public constructor(
    public readonly renderer: Renderer,
    
    pos: Vec2,
    radius: number,
    life: number,
    velocity: Vec2,
  ) {
    this.pos = pos;
    this.targetRadius = radius;
    this.life = life;
    this.targetVelocity = velocity;
  };

  get radius(): number {
    return clamp(this.interpolatedRadius, 0, null);
  }

  get forceRadius(): number {
    return this.radius / 2;
  }

  get color(): string {
    const normal = [100, 136, 234];
    const close = [255, 0, 0];
    const closest = clamp(this.closest, 0, 1);
    const choice = [
      normal[0] * (1 - closest) + close[0] * closest,
      normal[1] * (1 - closest) + close[1] * closest,
      normal[2] * (1 - closest) + close[2] * closest,
    ];

    return `rgba(${choice.map(Math.round).join(",")},${this.opacity})`;
  }

  public update() {
    if (this.isDead())
      return;

    const dt = this.renderer.dt;
    this.life -= dt;
    if (this.isDying()) {
      this.interpolatedRadius += dt * 100;
      this.opacity = Math.pow(this.life / BUBBLE_DYING_DURATION, 3);
      return;
    }
    this.interpolatedRadius = lerp(this.interpolatedRadius, this.targetRadius, clamp(dt * 10, 0, 1));
    this.velocity = this.velocity.lerp(this.targetVelocity, clamp(dt * 3, 0, 1));
    this.pos.add(this.velocity.clone().mul(dt));

    if (this.pos.y + this.radius > this.renderer.canvas.height) {
      this.kill();
    }

    let closest = 1;
    for (const bubble of this.renderer.bubbles) {
      if (bubble === this || bubble.isDying())
        continue;
      const diff = this.pos.clone().sub(bubble.pos);
      const distance = diff.norm();
      const contact_distance = distance - (this.radius + bubble.radius);

      if (contact_distance < 0) {
        this.kill();
        bubble.kill();
        return;
      }

      if (contact_distance < this.forceRadius) {
        const closness = contact_distance / this.forceRadius;
        closest = Math.min(closness, closest);
        let force = Math.pow(1 - closness, 2) * 10;
        this.velocity.add(diff.clone().div(distance).mul(force));
      }
    }
    this.closest = 1-closest;
  }

  public isDead(): boolean {
    return this.life < 0;
  }

  public isDying(): boolean {
    return this.life < BUBBLE_DYING_DURATION;
  }

  public kill() {
    this.life = BUBBLE_DYING_DURATION;
  }
}

export class Renderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public totalTime: number = 0;
  public dt: number = 0;
  public bubbles: Bubble[] = [];

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new UserError("No context?");
    this.ctx = ctx;
  }

  private spawnBalls() {
    // const delta = this.totalTime < 10 ? 10 - this.totalTime : 0;
    while (this.bubbles.length < TARGET_BUBBLE_COUNT) {
      this.bubbles.push(new Bubble(
        this,

        Vec2.random().mul(this.canvas.width, this.canvas.height),
        Math.random() * 20 + 20,

        // Math.random() * 1 + 10 - delta,
        9999,

        new Vec2(0, Math.random() * 150 + 50),
      ));
    }
  }

  private draw() {
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.fillStyle = BACKGROUND_COLOR;
    this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);


    for (const bubble of this.bubbles) {
      this.ctx.fillStyle = bubble.color;
      this.ctx.beginPath();
      this.ctx.arc(
        bubble.pos.x,
        bubble.pos.y,
        bubble.radius,
        0, Math.PI * 2,
      );
      this.ctx.fill();
    }
  }

  public update(dt: number) {
    this.totalTime += dt;
    this.dt = dt;

    const toRemove = [];
    for (const bubble of this.bubbles) {
      bubble.update();
      if (bubble.isDead()) {
        toRemove.push(bubble);
        continue;
      }
    }
    for (const byby of toRemove) {
      this.bubbles.splice(this.bubbles.indexOf(byby), 1);
    }
    this.spawnBalls();

    this.draw();
  }
}


