import { Bubble } from "../bubble";
import { Vec2 } from "../math";

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

  public static override get displayName(): string {
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
