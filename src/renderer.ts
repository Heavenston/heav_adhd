import { Vec2, clamp, lerp } from "./math";
import { UserError } from "./usererror";

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

  private objectAt(
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

    this.closest = 0;
    for (const bubble of this.renderer.bubbles) {
      if (bubble === this || bubble.isDying())
        continue;
      const diff = this.pos.clone().sub(bubble.pos);
      if (this.objectAt(diff, bubble.radius, 0)) {
        bubble.kill();
        this.kill();
      }
    }

    if (this.renderer.mousePos !== null) {
      const mul = this.renderer.mouseSpeed?.norm() ?? 0;
      if (this.objectAt(
        this.pos.clone().sub(this.renderer.mousePos),
        10, 50,
        clamp(mul, 10, 500),
      )) {
        this.kill();
      }
    }
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

  private mouseLastPos: Vec2 | null = null;
  public mousePos: Vec2 | null = null;
  public mouseSpeed: Vec2 | null = null;

  public targetBubbleCount: number = 40;

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new UserError("No context?");
    this.ctx = ctx;

    this.canvas.addEventListener("mousemove", e => {
      this.mousePos = new Vec2(e.clientX, e.clientY);
    });
    this.canvas.addEventListener("mouseleave", () => {
      this.mousePos = null;
    });

    this.canvas.addEventListener("wheel", e => {
      if (e.deltaY > 0) {
        this.targetBubbleCount -= 1;
        if (this.targetBubbleCount < 1)
          this.targetBubbleCount = 1;
      }
      else if (e.deltaY < 1) {
        this.targetBubbleCount += 1;
      }
    });
  }

  private trySpawnBall(ball: Bubble): boolean {
    for (const other of this.bubbles) {
      if (other.pos.clone().sub(ball.pos).norm() < other.maxRadius + ball.maxRadius) {
        return false;
      }
    }
    this.bubbles.push(ball);
    return true;
  }

  private spawnBalls() {
    // const delta = this.totalTime < 10 ? 10 - this.totalTime : 0;
    // let max_try = (TARGET_BUBBLE_COUNT - this.bubbles.length) * 2;
    let max_try = 5;
    while (max_try > 0 && this.bubbles.length < this.targetBubbleCount) {
      max_try -= 1;
      this.trySpawnBall(new Bubble(
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

    const text = `balls, count: ${this.bubbles.length}, target: ${this.targetBubbleCount} (use scroll wheel)`;
    const fontSize = 20;
    this.ctx.fillStyle = "white";
    this.ctx.font = `${fontSize}px sans`;
    this.ctx.fillText(text, 5, 5 + fontSize);
  }

  public update(dt: number) {
    this.totalTime += dt;
    this.dt = dt;

    if (this.mousePos !== null && this.mouseLastPos !== null) {
      this.mouseSpeed = this.mousePos.clone().sub(this.mouseLastPos).div(dt);
    }
    else {
      this.mouseSpeed = null;
    }

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

    this.mouseLastPos = this.mousePos;
  }
}
