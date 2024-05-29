import { ForceField } from "./force_field";
import { Vec2 } from "./math";
import { Renderer } from "./renderer";
import * as cfg from "./config";
import { bubbleClasses, createBubble } from "./bubble";

type ToolClass = {
  new (renderer: Renderer): Tool,
};

export abstract class Tool {
  public readonly renderer: Renderer;
  protected readonly abortController: AbortController;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.abortController = new AbortController();
  }

  public static getFromName(name: string): ToolClass | null {
    if (name === "forceField")
      return ForceFieldTool;
    if (name === "deleter")
      return DeleterTool;
    if (name === "spawn")
      return SpawnTool;

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
  public override update() {
    const rend = this.renderer;

    if (!rend.isClicking())
      return;
    const mp = rend.mousePos;
    if (!mp)
      return;

    for (const bubble of rend.bubbles) {
      if (bubble.distanceFromSurface(mp) <= 0) {
        bubble.kill({
          type: "mouse",
        });
      }
    }
  }
}

export class SpawnTool extends Tool {
  public lastPlace: number = -Infinity;
  public cfgElement: HTMLDivElement;

  constructor(renderer: Renderer) {
    super(renderer);
    const el = document.getElementById("toolConfig");
    if (el === null || !(el instanceof HTMLDivElement))
      throw new Error("Could not find config element");
    this.cfgElement = el;
  }

  public override init() {
    const options = Object.entries(bubbleClasses).map(([name, val]) => {
      const displayName = val.class_.displayName.split(" ")
        .map(d => d[0].toUpperCase() + d.slice(1))
        .join(" ");
      return `<option value="${name}">${displayName}</option>`;
    });
    this.cfgElement.innerHTML = `
      <label>
        <span>Spawn bubble type: </span>
        <select id="spawner-tool-type">
          <option value="random">Random</option>
          ${options.join("")}
        </select>
      </label>
    `;
  }

  public override clean() {
    this.cfgElement.innerHTML = "";
  }

  private get spawnerTypeInput(): HTMLSelectElement | null {
    const el = document.getElementById("spawner-tool-type");
    if (!el || !(el instanceof HTMLSelectElement))
      return null;
    return el;
  }

  public override update() {
    const rend = this.renderer;

    if ((this.renderer.totalTime - this.lastPlace) < cfg.SPAWN_TOOL_COOLDOWN)
      return;

    if (!rend.isClicking())
      return;
    const mp = rend.mousePos;
    if (!mp)
      return;

    const kind = this.spawnerTypeInput?.value ?? "random";

    let bubble;
    if (kind === "random") {
      bubble = createBubble(rend, { pos: mp });
    }
    else {
      const i = bubbleClasses[<keyof typeof bubbleClasses>kind];
      bubble = new i.class_(rend, { pos: mp });
    }

    if (this.renderer.trySpawnBall(bubble)) {
      this.lastPlace = this.renderer.totalTime;
    }
  }
}
