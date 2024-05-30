
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

export function expDecay(from: number, to: number, dt: number, halfLife: number): number {
  return to + (from - to) * (2 ** (-dt / halfLife));
}

export function modExpDecay(
  from: number, to: number,
  modulo: number,
  dt: number, halfLife: number,
): number {
  to = ((to % modulo) + modulo) % modulo;
  from = ((from % modulo) + modulo) % modulo;

  if (Math.abs(to - from) > Math.PI) {
    if (to < from)
      to += modulo;
    else
      to -= modulo;
  }

  return expDecay(from, to, dt, halfLife);
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

  public eq(other: Vec2): boolean;
  public eq(val: number): boolean;
  public eq(x: number, y: number): boolean;
  public eq(other: Vec2 | number, other2?: number): boolean {
    if (other instanceof Vec2) {
      return this.x === other.x && this.y === other.y;
    }

    if (typeof other === "number" && other2 === undefined) {
      return this.x === other && this.y === other;
    }

    if (typeof other === "number" && typeof other2 === "number") {
      return this.x === other && this.y === other2;
    }

    throw new TypeError("wrong types");
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

  public static lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return a.clone().mul(1 - t)
      .add(b.clone().mul(t));
  }

  public static expDecay(a: Vec2, b: Vec2, dt: number, halfLife: number): Vec2 {
    return new Vec2(
      expDecay(a.x, b.x, dt, halfLife),
      expDecay(a.y, b.y, dt, halfLife),
    );
  }

  public rotate(angle: number): Vec2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const px = this.x;
    const py = this.y;
    this.x = px * cos - py * sin;
    this.y = px * sin + py * cos;

    return this;
  }

  public dot(other: Vec2): number {
    return this.x * other.x + this.y * other.y;
  }

  public norm2(): number {
    return this.dot(this);
  }

  public norm(): number {
    return Math.sqrt(this.norm2());
  }

  public clamp(min: Vec2 | null, max: Vec2 | null): Vec2 {
    this.x = clamp(this.x, min?.x ?? null, max?.x ?? null);
    this.y = clamp(this.y, min?.y ?? null, max?.y ?? null);
    return this;
  }

  public angleDiff(to: Vec2): number {
    return Math.atan2(this.y - to.y, this.x - to.x);
  }
}
