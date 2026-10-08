import { useLocale } from "../../localization/i18n.jsx";
import { tr } from "../../localization/zh.js";
const categories = [
  ["0", "全部", null],
  ["1", "消耗品", "consumables"],
  ["2", "材料", "materials"],
  ["3", "重要物品", "key"],
  ["4", "右手武器", "right_hand"],
  ["5", "左手武器", "left_hand"],
  ["6", "服装", "armor"],
  ["7", "血宝石", "gems"],
  ["8", "卡尔符文", "runes"],
  ["9", "圣杯", "chalices"],
];

function FilterButtons({ selectedFilter, onFilterChange }) {
  const locale = useLocale();
  return (
    <div className="inventory-filters" role="group" aria-label={tr("物品分类")}>
      {categories.map(([index, label, icon]) => (
        <button
          key={index}
          type="button"
          data-index={index}
          title={tr(label)}
          aria-pressed={String(selectedFilter) === index}
          className="inventory-filter"
          onClick={() => onFilterChange(index)}
        >
          {icon ? (
            <img src={`/assets/filters/${icon}.png`} alt="" />
          ) : (
            <span className="inventory-filter-all" aria-hidden="true">◇</span>
          )}
          <span>{tr(label)}</span>
        </button>
      ))}
    </div>
  );
}

export default FilterButtons;
