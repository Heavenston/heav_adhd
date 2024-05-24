
export function clamp(val: number, min: number | null, max: number | null): number {
  if (min !== null && val < min)
    return min;
  if (max !== null && val > max)
    return max;
  return val;
}

export function lerp(from: number, to: number, t: number): number {
  return (from * (1-t)) + (to * t);
}

// From stack overflow :)
export function gaussianRandom(mean=0, stdev=1): number {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

export class Vec2 {
  public constructor(
    public x: number,
    public y: number,
  ) {}

  public static splat(val: number): Vec2 {
    return new Vec2(val, val);
  }

  public static random(): Vec2 {
    return new Vec2(Math.random(), Math.random());
  }

  public static rotated(angle: number): Vec2 {
    return new Vec2(Math.cos(angle), Math.sin(angle));
  }

  public static get ZERO(): Readonly<Vec2> {
    return Vec2.splat(0);
  }

  public clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  public with_x(val: number): Vec2 {
    this.x = val;
    return this;
  }

  public with_y(val: number): Vec2 {
    this.y = val;
    return this;
  }

  public add(other: Vec2): Vec2;
  public add(val: number): Vec2;
  public add(x: number, y: number): Vec2;
  public add(other: Vec2 | number, other2?: number): Vec2 {
    if (other instanceof Vec2) {
      this.x += other.x;
      this.y += other.y;
      return this;
    }

    if (typeof other === "number" && other2 === undefined) {
      this.x += other;
      this.y += other;
      return this;
    }

    if (typeof other === "number" && typeof other2 === "number") {
      this.x += other;
      this.y += other2;
      return this;
    }

    throw new TypeError("wrong types");
  }

  public sub(other: Vec2): Vec2;
  public sub(val: number): Vec2;
  public sub(x: number, y: number): Vec2;
  public sub(other: Vec2 | number, other2?: number): Vec2 {
    if (other instanceof Vec2) {
      this.x -= other.x;
      this.y -= other.y;
      return this;
    }

    if (typeof other === "number" && other2 === undefined) {
      this.x -= other;
      this.y -= other;
      return this;
    }

    if (typeof other === "number" && typeof other2 === "number") {
      this.x -= other;
      this.y -= other2;
      return this;
    }

    throw new TypeError("wrong types");
  }

  public mul(other: Vec2): Vec2;
  public mul(val: number): Vec2;
  public mul(x: number, y: number): Vec2;
  public mul(other: Vec2 | number, other2?: number): Vec2 {
    if (other instanceof Vec2) {
      this.x *= other.x;
      this.y *= other.y;
      return this;
    }

    if (typeof other === "number" && other2 === undefined) {
      this.x *= other;
      this.y *= other;
      return this;
    }

    if (typeof other === "number" && typeof other2 === "number") {
      this.x *= other;
      this.y *= other2;
      return this;
    }

    throw new TypeError("wrong types");
  }

  public div(other: Vec2): Vec2;
  public div(val: number): Vec2;
  public div(x: number, y: number): Vec2;
  public div(other: Vec2 | number, other2?: number): Vec2 {
    if (other instanceof Vec2) {
      this.x /= other.x;
      this.y /= other.y;
      return this;
    }

    if (typeof other === "number" && other2 === undefined) {
      this.x /= other;
      this.y /= other;
      return this;
    }

    if (typeof other === "number" && typeof other2 === "number") {
      this.x /= other;
      this.y /= other2;
      return this;
    }

    throw new TypeError("wrong types");
  }

  public lerp(other: Vec2, t: number): Vec2 {
    return this.clone().mul(1 - t)
      .add(other.clone().mul(t));
  }

  public norm(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
}
