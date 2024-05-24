import { BlackholeBubble, Bubble, createBubble, GoldBubble } from "./bubble";
import { BACKGROUND_COLOR } from "./config";
import { ForceField } from "./force_field";
import { Vec2 } from "./math";
import { UserError } from "./usererror";

export interface Entity {
  update(): void;
  draw(): void;

  isDead(): boolean;

  get zindex(): number;
}

export type Color = readonly [number, number, number];

export type BubbleColorCfg = Readonly<{
  default: Color,
  close: Color,
}>;

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
    let count = this.bubbles.reduce(
      (count, b) => count + +!b.isDying(), 0
    );
    let max_try = (this.targetBubbleCount - count) * 2;

    while (max_try > 0 && count < this.targetBubbleCount) {
      max_try -= 1;

      count += this.trySpawnBall(createBubble(this)) ? 1 : 0;
    }
  }

  private draw() {
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.fillStyle = BACKGROUND_COLOR;
    this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);

    const entities: Entity[] = [...this.bubbles, ...this.forceFields];
    entities.sort((a, b) => a.zindex - b.zindex);
    for (const ent of entities) {
      ent.draw();
    }

    const count = this.bubbles.reduce(
      (count, b) => count + +!b.isDying(), 0
    );
    const golden = this.bubbles.reduce(
      (count, b) => count + +(!b.isDying() && b instanceof GoldBubble), 0
    );
    const bh = this.bubbles.reduce(
      (count, b) => count + +(!b.isDying() && b instanceof BlackholeBubble), 0
    );

    const text = `balls, count: ${count}${golden > 0 ? ` (${golden} golden)` : ""}${bh> 0 ? ` (${bh} black hole${bh > 1 ? "s" : ""})` : ""}, target: ${this.targetBubbleCount} (use scroll wheel)`;
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
