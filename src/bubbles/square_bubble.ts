import { Bubble, BubbleOverrides } from "../bubble";
import { Vec2 } from "../math";
import { Renderer } from "../renderer";

export class SquareBubble extends Bubble {
  constructor(
    renderer: Renderer,

    overrides?: BubbleOverrides,
  ) {
    super(renderer, {
      rotation: Math.random() * Math.PI * 2,
      ...overrides
    });
  }

  public override draw() {
    const ctx = this.renderer.ctx;
    ctx.save();
    this.applyCtxTransform();

    ctx.fillStyle = this.color;
    ctx.fillRect(
      - this.radius,
      - this.radius,
      this.radius * 2,
      this.radius * 2,
    );

    ctx.restore();
  }

  public static override get displayName(): string {
    return "square";
  }

  public isInside(pos: Vec2): boolean {
    pos = pos.clone().sub(this.pos).rotate(-this.rotation);
    const hs = this.radius;
    return pos.x < hs && pos.y < hs && pos.x > -hs && pos.y > -hs;
  }

  public override distanceFromSurface(pos: Vec2): number {
    if (this.isInside(pos))
      return 0;

    pos = pos.clone().sub(this.pos).rotate(-this.rotation);

    const hs = this.radius;
    const clamped = pos.clone().clamp(Vec2.splat(-hs), Vec2.splat(hs));
    return clamped.sub(pos).norm();
  }
}
