import { clamp } from "./math";
import { Renderer } from "./renderer";
import { UserError } from "./usererror";

function init() {
  const canvas = document.getElementById("canvas");
  if (!canvas || !(canvas instanceof HTMLCanvasElement))
    throw new Error("no");

  let onError: ((e: unknown) => void) | null = null;
  const promise = new Promise((_res, rej) => {onError = rej;});

  const renderer = new Renderer(canvas);

  let lastT = 0;
  let animationFrame: number | null = null;
  const frame = (time: number) => {
    try {
      time /= 1000;

      renderer.update(clamp(time - lastT, 0, 0.5));
      lastT = time;

      if (animationFrame != null)
        cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(frame);
    }
    catch(e) {
      onError?.(e);
    }
  };

  const resizeCanvas = () => {
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
    frame(lastT);
  };

  resizeCanvas();
  new ResizeObserver(resizeCanvas).observe(document.body);

  return promise;
}

(async () => {
  try {
    await init();
  }
  catch(e) {
    console.error(e);
    if (e instanceof UserError) {
      alert("User error !: " + e.message);
    }
    else if (e instanceof Error) {
      alert("Just error !: " + e.message);
    }
  }
})();
