import { ForceField } from "./force_field";
import { Vec2 } from "./math";
import { Renderer } from "./renderer";
import * as cfg from "./config";

type ToolClass = {
  new (renderer: Renderer): Tool,
};

export abstract class Tool {
  public readonly renderer: Renderer;
  protected readonly abortController: AbortController;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.abortController = new AbortController();

    this.init();
  }

  public static getFromName(name: string): ToolClass | null {
    if (name === "forceField")
      return ForceFieldTool;

    return null;
  }

  public init() {
    
  }
  public update() {
    
  }
  public clean() {
    this.abortController.abort();
  }
}

export class ForceFieldTool extends Tool {
  public currentForceField: ForceField | null = null;

  public override update() {
    const rend = this.renderer;

    if (rend.isClicking()) {
      if (this.currentForceField === null) {
        this.currentForceField = new ForceField(rend, Vec2.ZERO);
        rend.otherEntities.push(this.currentForceField);
      }

      if (rend.mousePos !== null)
        this.currentForceField.pos = rend.mousePos;
      this.currentForceField.force *= 1 + rend.dt * cfg.FORCE_FIELD_GROWTH_SPEED;
    }

    if (!rend.isClicking() && this.currentForceField !== null) {
      this.currentForceField.start();
      this.currentForceField = null;
    }
  }
}

export class DeleterTool extends Tool {
}

export class SpawnTool extends Tool {
}
