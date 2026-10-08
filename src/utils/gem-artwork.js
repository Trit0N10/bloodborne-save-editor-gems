import { getGemPath, getUnique } from "./upgrades.js";
import imagePaths from "./gem-image-paths.js";

// Resolve the same local artwork as the existing inventory editor. Unknown
// combinations get a visible fallback rather than an unrelated gem picture.
export function gemArtworkPath(effects, shape, level, source) {
  if (!Array.isArray(effects) || !effects.length || !Number.isInteger(level)) return null;
  if (!effects.every((entry) => Array.isArray(entry) && typeof entry[1] === "string")) return null;
  if (!["Radial", "Triangle", "Waning", "Circle", "Droplet"].includes(shape)) return null;
  const path = getGemPath(effects, shape, level, getUnique(effects[0][0], shape, source));
  return imagePaths.has(path) ? path : null;
}
