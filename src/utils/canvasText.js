import { tr } from "../localization/zh.js";

export const canvasFont = '"Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

// Canvas rows have fixed widths; use an ellipsis, with full text in the canvas title.
export function drawLocalizedText(ctx, value, x, y, maxWidth = ctx.canvas.width - x - 12) {
  let text = String(tr(value ?? "")).replace(/\s+/g, " ");
  if (ctx.measureText(text).width > maxWidth) {
    while (text.length && ctx.measureText(text + "…").width > maxWidth) {
      text = text.slice(0, -1);
    }
    text += "…";
  }
  ctx.fillText(text, x, y);
}
