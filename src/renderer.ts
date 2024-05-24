import { Vec2, clamp, lerp } from "./math";
import { UserError } from "./usererror";

interface Entity {
  update(): void;
  draw(): void;

  isDead(): boolean;
}

type Color = readonly [number, number, number];

type BubbleColorCfg = Readonly<{
  default: Color,
  close: Color,
}>;

const BACKGROUND_COLOR = "#202020";
const BUBBLE_DYING_DURATION = 0.5;
const MOUSE_CLICK_COOLDOWN = 2;

const GOLD_BUBBLE_PROBABILITY = 0.01;

const DEFAULT_BUBBLE_COLOR: BubbleColorCfg = {
  default: Object.freeze([100, 136, 234] as const),
  close: Object.freeze([255, 0, 0] as const),
};
const GOLD_BUBBLE_COLOR: BubbleColorCfg = {
  default: Object.freeze([236, 189, 0] as const),
  close: Object.freeze([236, 45, 0] as const),
};

class Bubble implements Entity {
  public pos: Vec2;
  private life: number;
  private velocity: Vec2 = Vec2.ZERO;
  private targetVelocity: Vec2;
  private interpolatedRadius: number = 0;
  private readonly targetRadius: number;

  private opacity: number = 1;
  private closest: number = 9999;

  public isGolden: boolean = false;
  public colorCfg: BubbleColorCfg = DEFAULT_BUBBLE_COLOR;

  public goldPair: Bubble | null = null;

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

    if (Math.random() < GOLD_BUBBLE_PROBABILITY) {
      this.isGolden = true;
      this.colorCfg = GOLD_BUBBLE_COLOR;
    }
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
      this.goldPair = null;
      return;
    }
    this.interpolatedRadius = lerp(this.interpolatedRadius, this.targetRadius, clamp(dt * 10, 0, 1));
    this.velocity = this.velocity.lerp(this.targetVelocity, clamp(dt * 3, 0, 1));
    this.pos.add(this.velocity.clone().mul(dt));

    if (this.pos.y + this.radius > this.renderer.canvas.height) {
      if (this.isGolden) {
        if (this.targetVelocity.y > 0)
          this.targetVelocity.y *= -1;
      }
      else {
        this.kill();
        return;
      }
    }
    if (this.pos.y - this.radius < 0) {
      if (this.isGolden) {
        if (this.targetVelocity.y < 0)
          this.targetVelocity.y *= -1;
      }
      else {
        this.kill();
        return;
      }
    }
    if (this.pos.x + this.radius > this.renderer.canvas.width) {
      if (this.isGolden) {
        this.pos.x = this.renderer.canvas.width - this.radius;
      }
      else {
        this.kill();
        return;
      }
    }
    if (this.pos.x - this.radius < 0) {
      if (this.isGolden) {
        this.pos.x = this.radius;
      }
      else {
        this.kill();
        return;
      }
    }

    this.closest = 0;
    let foundPair = false;
    for (const bubble of this.renderer.bubbles) {
      if (bubble === this || bubble.isDying())
        continue;

      if (this.isGolden && this.goldPair === null && bubble.isGolden && bubble.goldPair === null) {
        this.goldPair = bubble;
        bubble.goldPair = this;
      }
      foundPair = foundPair || (bubble === this.goldPair);

      const diff = this.pos.clone().sub(bubble.pos);
      if (this.objectAt(diff, bubble.radius, 0, bubble === this.goldPair ? 0 : undefined)) {
        const both = bubble.isGolden && this.isGolden;
        if (!bubble.isGolden || both)
          bubble.kill(true);
        if (!this.isGolden || both)
          this.kill(true);
      }
    }
    if (!foundPair) {
      this.goldPair = null;
    }

    if (this.renderer.mousePos !== null && this.renderer.timeSinceLastClick() > MOUSE_CLICK_COOLDOWN) {
      const mul = this.renderer.mouseSpeed?.norm() ?? 0;
      if (this.objectAt(
        this.pos.clone().sub(this.renderer.mousePos),
        10, 50,
        clamp(mul, 10, 500),
      ) && !this.isGolden) {
        this.kill(true);
      }
    }

    for (const ff of this.renderer.forceFields) {
      this.velocity.add(ff.getForceOn(this).div(dt));
    }

    if (this.goldPair !== null) {
      const diff = this.pos.clone().sub(this.goldPair.pos);
      const dist = diff.norm();
      const force = diff.clone().div(dist)
        .mul(clamp(dist, 50, null))
        .mul(-1);
      this.velocity.add(force.mul(dt));
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

    if (this.goldPair !== null) {
      const target = this.pos.clone().sub(this.goldPair.pos).mul(0.5).add(this.goldPair.pos);

      console.log("gold");
      ctx.strokeStyle = this.color;
      ctx.lineCap = "round";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }
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
  private particles: {pos: Vec2, vel: Vec2}[] = [];

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
    if (!this.started) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        pos: this.pos.clone().add(Vec2.rotated(angle).mul(this.force - 50)),
        vel: Vec2.ZERO,
      });

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
    const ctx = this.renderer.ctx;
    if (!this.started) {
      ctx.strokeStyle = "white";
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

    for (const bubble of this.bubbles) {
      if (!bubble.isGolden)
        bubble.draw();
    }
    for (const bubble of this.bubbles) {
      if (bubble.isGolden)
        bubble.draw();
    }
    for (const ff of this.forceFields) {
      ff.draw();
    }

    const golden = this.bubbles.filter(b => b.isGolden).length;
    const text = `balls, count: ${this.bubbles.length}${golden > 0 ? ` (${golden} golden)` : ""}, target: ${this.targetBubbleCount} (use scroll wheel)`;
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
