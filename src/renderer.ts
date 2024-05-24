import { Vec2, clamp, lerp } from "./math";
import { UserError } from "./usererror";

const BACKGROUND_COLOR = "#202020";
const BUBBLE_DYING_DURATION = 0.5;
const ENABLE_TOP_COLLISIONS = false;
const MOUSE_CLICK_COOLDOWN = 2;

interface Entity {
  update(): void;
  draw(): void;

  isDead(): boolean;
}

class Bubble implements Entity {
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
      return;
    }
    if (this.pos.y - this.radius < 0 && ENABLE_TOP_COLLISIONS) {
      this.kill();
      return;
    }
    if (this.pos.x + this.radius > this.renderer.canvas.width) {
      this.kill();
      return;
    }
    if (this.pos.x - this.radius < 0) {
      this.kill();
      return;
    }

    this.closest = 0;
    for (const bubble of this.renderer.bubbles) {
      if (bubble === this || bubble.isDying())
        continue;
      const diff = this.pos.clone().sub(bubble.pos);
      if (this.objectAt(diff, bubble.radius, 0)) {
        bubble.kill(true);
        this.kill(true);
      }
    }

    if (this.renderer.mousePos !== null && this.renderer.timeSinceLastClick() > MOUSE_CLICK_COOLDOWN) {
      const mul = this.renderer.mouseSpeed?.norm() ?? 0;
      if (this.objectAt(
        this.pos.clone().sub(this.renderer.mousePos),
        10, 50,
        clamp(mul, 10, 500),
      )) {
        this.kill(true);
      }
    }

    for (const ff of this.renderer.forceFields) {
      this.velocity.add(ff.getForceOn(this).div(dt));
    }
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
    return this.life < 0;
  }

  public isDying(): boolean {
    return this.life < BUBBLE_DYING_DURATION;
  }

  public kill(color: boolean = false) {
    this.life = BUBBLE_DYING_DURATION;
    if (color) {
      this.closest = 1;
    }
  }
}

class ForceField implements Entity {
  private started = false;
  public age = 0;
  #force = 100;

  constructor(
    public readonly renderer: Renderer,
    public pos: Vec2,
  ){}

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
    this.#force = n;
  }

  public isDead(): boolean {
    return this.age > this.duration;
  }

  public update(): void {
    if (this.isDead())
      return;
    if (!this.started)
      return;
    this.age += this.renderer.dt;
  }

  public get duration(): number {
    return 20 * Math.pow(this.force, -0.8);
  }

  public get radius(): number {
    return (1 - this.opacity) * this.force;
  }

  public get opacity(): number {
    const age_fact = this.age / this.duration;
    return 1 - age_fact;
  }

  public get color(): string {
    return `rgba(255,255,255,${this.opacity})`;
  }

  public draw(): void {
    if (!this.started) {
      return;
    }
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

  public getForceOn(bubble: Bubble): Vec2 {
    if (!this.started)
      return Vec2.ZERO;
    const diff = bubble.pos.clone().sub(this.pos);
    const dist = diff.norm();
    const normalized_dist = clamp(dist - bubble.radius - this.radius, 0, null);
    if (normalized_dist > 1) {
      return Vec2.ZERO;
    }

    return diff.clone().div(dist).mul((1 - normalized_dist) * 20 * this.opacity);
  }
}

type EventClick = {
  time: number,
  pos: Vec2,
};

export class Renderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public totalTime: number = 0;
  public dt: number = 0;
  public bubbles: Bubble[] = [];
  public forceFields: ForceField[] = [];

  private mouseLastPos: Vec2 | null = null;
  public mousePos: Vec2 | null = null;
  public mouseSpeed: Vec2 | null = null;

  public lastMouseDown: EventClick | null = null;
  public lastMouseUp: EventClick | null = null;

  public currentForceField: ForceField | null = null;

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

    this.canvas.addEventListener("mousedown", () => {
      if (this.mousePos === null)
        return;
      this.lastMouseDown = {
        pos: this.mousePos.clone(),
        time: this.totalTime,
      };
    });

    this.canvas.addEventListener("mouseup", () => {
      if (this.mousePos === null)
        return;
      this.lastMouseUp = {
        pos: this.mousePos.clone(),
        time: this.totalTime,
      };
    });
  }

  public isClicking(): boolean {
    if (this.lastMouseDown === null)
      return false;
    if (this.lastMouseUp && this.lastMouseUp.time > this.lastMouseDown.time)
      return false;
    return true;
  }

  public lastClickDuration(): number {
    if (this.lastMouseDown === null)
      return 0;
    return (this.lastMouseUp?.time ?? this.totalTime) - this.lastMouseDown.time;
  }

  public timeSinceLastClick(): number {
    if (this.lastMouseDown === null)
      return this.totalTime;
    if (this.isClicking())
      return 0;
    return this.totalTime - (this.lastMouseUp?.time ?? this.totalTime);
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

      const radius = Math.random() * 20 + 20;
      // Use radius to prevent touching the sides
      const pos = Vec2.random()
        .mul(this.canvas.width - radius*2, this.canvas.height - radius*2)
        .add(radius);
      this.trySpawnBall(new Bubble(
        this,

        pos, radius,

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

    for (const ff of this.forceFields) {
      ff.draw();
    }
    for (const bubble of this.bubbles) {
      bubble.draw();
    }

    const text = `balls, count: ${this.bubbles.length}, target: ${this.targetBubbleCount} (use scroll wheel)`;
    const fontSize = 20;
    this.ctx.fillStyle = "white";
    this.ctx.font = `${fontSize}px sans`;
    this.ctx.fillText(text, 5, 5 + fontSize);
  }

  private updateEntities(entities: Entity[]) {
    const toRemove = [];
    for (const entity of entities) {
      entity.update();
      if (entity.isDead()) {
        toRemove.push(entity);
        continue;
      }
    }
    for (const byby of toRemove) {
      entities.splice(entities.indexOf(byby), 1);
    }
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

    if (this.isClicking()) {
      if (this.currentForceField === null) {
        this.currentForceField = new ForceField(this, Vec2.ZERO);
        this.forceFields.push(this.currentForceField);
      }

      this.currentForceField.pos = this.mouseLastPos ?? Vec2.ZERO;
      this.currentForceField.force += dt * 50;
    }
    if (!this.isClicking() && this.currentForceField !== null) {
      this.currentForceField.start();
      this.currentForceField = null;
    }

    this.updateEntities(this.bubbles);
    this.spawnBalls();
    this.updateEntities(this.forceFields);

    this.draw();

    this.mouseLastPos = this.mousePos;
  }
}
