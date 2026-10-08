import { useLocale } from "../localization/i18n.jsx";
import { useEffect, useRef } from "react";
import { tr } from "../localization/zh.js";
import useDraw from "../utils/useDraw";

function Item({ index, item, isSmall, className, ...props }) {
  const locale = useLocale();
  const canvasRef = useRef(null);
  const { drawCanvas } = useDraw();
  const name = item.info?.item_name ?? item.info?.name ?? "";
  const note = item.info?.item_desc ?? item.info?.note ?? "";
  const details = [tr(name), name, tr(note), ...(item.effects ?? []).map((effect) => tr(effect[1]))]
    .filter(Boolean).join("\n");

  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return;
    const ctx = canvasRef.current.getContext("2d");
    drawCanvas(ctx, item, isSmall);
  }, [item, isSmall, locale]);

  return isSmall ? (
    <canvas
      title={details}
      aria-label={tr(name)}
      data-index={index}
      data-item-id={item.id}
      data-item={JSON.stringify(item)}
      width={526}
      height={90}
      ref={canvasRef}
      style={{ display: "block", marginBottom: "1px" }}
      {...props}
    ></canvas>
  ) : (
    <div className={className}>
      <canvas
        title={details}
        aria-label={tr(name)}
        data-index={index}
        data-item-id={item.id}
        data-item-type={
          item?.article_type?.toLowerCase() || item.upgrade_type.toLowerCase()
        }
        data-item={JSON.stringify(item)}
        width={795}
        height={90}
        ref={canvasRef}
        style={{ display: "block", marginBottom: "1px" }}
        {...props}
      ></canvas>
    </div>
  );
}

export default Item;
