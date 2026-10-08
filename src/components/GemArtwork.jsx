import { useLocale } from "../localization/i18n.jsx";
import { tr } from "../localization/zh.js";
import { useState } from "react";
import { gemArtworkPath } from "../utils/gem-artwork.js";

export default function GemArtwork({ effects, shape, level, source, name, large = false }) {
  const locale = useLocale();
  const path = gemArtworkPath(effects, shape, level, source);
  const [failedPath, setFailedPath] = useState(null);
  const available = path && failedPath !== path;
  return <span className={`gem-artwork${large ? " gem-artwork-large" : ""}`}>
    {available
      ? <img src={path} alt={large ? tr(`${name} · 外观`) : ""} loading={large ? "eager" : "lazy"}
          decoding="async" onError={() => setFailedPath(path)} />
      : <span className="gem-artwork-unavailable" role="img" aria-label={tr("暂无对应宝石图片")}>{tr("暂无图")}</span>}
  </span>;
}
