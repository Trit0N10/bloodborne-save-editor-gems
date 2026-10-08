import { useLocale } from "../localization/i18n.jsx";
import { useContext, useMemo, useState } from "react";
import { tr, searchTerms } from "../localization/zh.js";
import { ItemsContext } from "../context/itemsContext";

/**
 *
 * @param {Object} props
 * @param {"item" | "armor" | "weapon" | "key"} props.type
 * @param {Function} props.onChange
 * @returns
 */
function SearchAllitems({ type, onChange, title }) {
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [hoverIndex, setHoverIndex] = useState(null);
  const { weapons, items, armors, all } = useContext(ItemsContext);

  const replacements = useMemo(() => {
    let source;
    switch (type) {
      case "weapon":
        source = weapons;
        break;
      case "chalice":
      case "item":
        source = items;
        break;
      case "key":
        source = items.filter((y) => y.article_type.toLowerCase() === type);
        break;
      case "armor":
        source = armors;
        break;
      default:
        source = all;
        break;
    }
    return source.filter(x => searchTerms(x.info.item_name).some(name => name.toLowerCase().includes(search.toLowerCase())));
  }, [type, weapons, items, armors, all, search]);

  return (
    <div className="item-search-panel">
      <div>
        <h2>{title || tr("选择要添加的物品")}</h2>

        <input
          onChange={(e) => {
            const { target } = e;
            setSearch(target.value);
            setHoverIndex(null);
          }}
          value={search}
          type="text"
          aria-label={tr("搜索物品")}
          placeholder={tr(`搜索${tr(type)}（中文或英文）`)}
        />
      </div>
      {/* List of items */}
      <div className="item-search-results">
        {replacements?.map((x, i) => (
          <button type="button" className="item-search-row" aria-pressed={hoverIndex === i}
            onClick={() => {
              if (typeof onChange == "function") {
                onChange(x);
              }
              setHoverIndex(i);
            }}
            key={i}
          ><img src={`/assets/itemImages/${x.info.item_img || "empty.png"}`} alt="" /><span><strong>{tr(x.info.item_name)}</strong><small>{tr(x.info.item_desc)}</small></span></button>
        ))}
        {!replacements.length && <p className="item-search-empty">{tr("没有找到匹配的物品。")}</p>}
      </div>
    </div>
  );
}

export default SearchAllitems;
