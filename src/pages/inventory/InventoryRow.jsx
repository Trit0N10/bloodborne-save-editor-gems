import { useLocale } from "../../localization/i18n.jsx";
import { useRef } from "react";
import Item from "../../components/Item";
import GemArtwork from "../../components/GemArtwork";
import { tr } from "../../localization/zh";
import { getRunePath, getUnique, isCursed } from "../../utils/upgrades";

function localeWordSpace() { return tr("Cursed") === "Cursed" ? " " : ""; }

export function inventoryItemName(item) {
  const info = item?.info ?? {};
  let name = tr(info.item_name ?? info.name ?? "未命名物品");
  if (item?.upgrade_type === "Gem") {
    const unique = getUnique(item.effects?.[0]?.[0], item.shape, item.source);
    if (unique) return tr(unique.name);
    if (isCursed(item.effects ?? [])) name = `${tr("Cursed")}${localeWordSpace()}${name}`;
  }
  const extra = info.extra_info;
  if (extra?.imprint) name = `${tr(extra.imprint)} ${name}`;
  if (extra?.upgrade_level > 0) name += ` +${extra.upgrade_level}`;
  return name;
}

function itemSummary(item) {
  const info = item.info ?? {};
  const extra = info.extra_info;
  if (item.upgrade_type === "Gem") {
    const effect = item.effects?.find(([id]) => Number(id) !== 4294967295)?.[1];
    return [tr(item.shape), tr(`评级 ${info.rating ?? "—"}`), tr(effect)].filter(Boolean).join(" · ");
  }
  if (extra?.damage) {
    const d = extra.damage;
    return tr(`物理 ${d.physical} · 血质 ${d.blood} · 秘法 ${d.arcane} · 火焰 ${d.fire} · 雷电 ${d.bolt}`);
  }
  if (extra?.physicalDefense) {
    const d = extra.physicalDefense;
    const e = extra.elementalDefense ?? {};
    return tr(`物理 ${d.physical} · 钝击 ${d.blunt} · 突刺 ${d.thrust} · 血质 ${d.blood} · 秘法 ${e.arcane} · 火焰 ${e.fire} · 雷电 ${e.bolt}`);
  }
  if (extra?.depth != null) return tr(`深度 ${extra.depth} · ${tr(extra.area)}`);
  return tr(info.item_desc ?? info.note ?? item.effects?.[0]?.[1] ?? "");
}

export default function InventoryRow({ item, index, selected }) {
  const locale = useLocale();
  const rowRef = useRef(null);
  const name = inventoryItemName(item);
  const description = itemSummary(item);
  const info = item.info ?? {};
  const imagePath = item.upgrade_type === "Rune" && info.name
    ? getRunePath(info.name, item.shape, info.rating)
    : `/assets/itemImages/${info.item_img || "empty.png"}`;

  return (
    <div className="inventory-dom-row" ref={rowRef}>
      <button
        type="button"
        className={`inventory-row-button${selected ? " is-selected" : ""}`}
        aria-pressed={selected}
        title={[name, description, ...(item.effects ?? []).map(([, effect]) => tr(effect))].filter(Boolean).join("\n")}
        onClick={(event) => {
          if (event.target.tagName === "CANVAS") return;
          // Keep the original canvas selection/editing contract. The canvas is
          // a sibling of this button, so its click cannot recurse into here.
          rowRef.current?.querySelector("canvas")?.click();
        }}
      >
        <span className="inventory-row-art">
          {item.upgrade_type === "Gem" ? (
            <GemArtwork effects={item.effects} shape={item.shape} level={info.level} source={item.source} name={name} />
          ) : (
            <img src={imagePath} alt="" loading="lazy" onError={(event) => {
              if (!event.currentTarget.src.endsWith("/empty.png")) event.currentTarget.src = "/assets/itemImages/empty.png";
            }} />
          )}
        </span>
        <span className="inventory-row-copy">
          <span className="inventory-row-name">{name}</span>
          <span className="inventory-row-description">{description || tr("选择以查看可用操作")}</span>
        </span>
        {item.amount != null && <span className="inventory-row-quantity">×{item.amount}</span>}
      </button>
      <div className="inventory-canvas-bridge" hidden aria-hidden="true">
        <Item item={item} index={index} tabIndex={-1} />
      </div>
    </div>
  );
}
