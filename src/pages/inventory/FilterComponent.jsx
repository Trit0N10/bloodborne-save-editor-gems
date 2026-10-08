import { useLocale } from "../../localization/i18n.jsx";
import { tr } from "../../localization/zh.js";
import InventoryRow from "./InventoryRow";
import { Virtuoso } from "react-virtuoso";

const filters = [
  "Consumable", "Material", "Key", "RightHand", "LeftHand",
  "Armor", "Gem", "Rune", "Chalice",
];

function FilterComponent({ inventory, selectedFilter = 0, selectedIndex }) {
  const locale = useLocale();
  const all = { ...inventory.articles, ...inventory.upgrades };
  const items = String(selectedFilter) === "0"
    ? Object.values(all).flat()
    : all[filters[Number(selectedFilter) - 1]] ?? [];

  return (
    <div className="inventory-results">
      <div className="inventory-results-heading">
        <span>{tr("物品列表")}</span>
        <span>{items.length}{tr("件物品")}</span>
      </div>
      {items.length ? (
        <Virtuoso
          className="inventory-list"
          style={{ flex: 1, minHeight: 0 }}
          data={items}
          itemContent={(i, item) => (
            <InventoryRow
              selected={selectedIndex === i}
              index={i + 1}
              item={item}
            />
          )}
          overscan={{ main: 900, reverse: 900 }}
        />
      ) : (
        <div className="inventory-empty">
          <strong>{tr("此分类暂无物品")}</strong>
          <span>{tr("切换其他分类，或通过右侧“添加物品”继续。")}</span>
        </div>
      )}
    </div>
  );
}

export default FilterComponent;
