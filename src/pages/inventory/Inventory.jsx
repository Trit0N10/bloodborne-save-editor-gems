import { useLocale } from "../../localization/i18n.jsx";
import "./inventory.css";
import { canvasFont, drawLocalizedText } from "../../utils/canvasText";
import { useEffect, useRef, useState, useContext } from "react";
import { SaveContext } from "../../context/context";
import { invoke } from "@tauri-apps/api/core";
import ReplaceScreen from "../../components/ReplaceScreen";
import { getType } from "../../utils/upgrades";
import FilterButtons from "./FilterButtons";
import FilterComponent from "./FilterComponent";
import EditUpgrade from "../../components/EditUpgrade";
import AddScreen from "./AddScreen";
import GemManager from "../../components/GemManager";
import { ImagesContext } from "../../context/imagesContext";
import { useNavigate } from "react-router-dom";
import { tr } from "../../localization/zh";
import { inventoryItemName } from "./InventoryRow";

function Inventory({ inv, isStorage }) {
  const locale = useLocale();
  const inventoryRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [quantity, setQuantity] = useState(0);
  const [level, setLevel] = useState(0);
  const [replaceScreen, setReplaceScreen] = useState(false);
  const [editScreen, setEditScreen] = useState(false);
  const [addScreen, setAddScreen] = useState(false);
  const [gemManagerOpen, setGemManagerOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("0");
  const nav = useNavigate();
  const {
    images: { items, backgrounds },
  } = useContext(ImagesContext);

  const { save, setSave } = useContext(SaveContext);

  useEffect(() => {
    const invCurrent = inventoryRef.current;
    function manageSelect(e) {
      const { target } = e;
      const { nodeName } = target;

      if (nodeName === "CANVAS") {
        const { item: itemRaw, index } = target.dataset;
        const item = JSON.parse(itemRaw);

        setSelectedIndex(index - 1); // TODO: show selected item

        selectedRef.current = target;
        setSelected(item);
        setQuantity(item.amount);
      }
    }

    if (save) {
      inventoryRef?.current?.addEventListener("click", manageSelect);
    }

    return () => {
      if (invCurrent) {
        invCurrent.removeEventListener("click", manageSelect);
      }
    };
  }, [inventoryRef, save]);

  useEffect(() => {
    if (!selected) {
      selectedRef.current = null;
      setSelectedIndex(null);
    }
  }, [selected]);

  return (
    <>
      {/* Optional modal like screens */}
      {gemManagerOpen ? (
        <GemManager
          isStorage={isStorage}
          onClose={() => setGemManagerOpen(false)}
          onChanged={() => {
            setSelected(null);
            setSelectedFilter("7");
          }}
        />
      ) : null}
      {addScreen ? (
        <AddScreen
          type="item"
          setAddScreen={setAddScreen}
          isStorage={isStorage}
        />
      ) : null}
      {replaceScreen ? (
        <ReplaceScreen
          setSelected={setSelected}
          selected={selected}
          selectedRef={selectedRef}
          setReplaceScreen={setReplaceScreen}
          isStorage={isStorage}
        />
      ) : null}
      {editScreen ? (
        <EditUpgrade
          setSelected={setSelected}
          selected={selected}
          selectedRef={selectedRef}
          setEditScreen={setEditScreen}
          isStorage={isStorage}
        />
      ) : null}
      {/* Inventory */}
      <section className="inventory-browser" ref={inventoryRef} aria-label={isStorage ? tr("仓库物品") : tr("背包物品")}>
        <div className="inventory-browser-heading">
          <h2>{isStorage ? tr("仓库物品") : tr("背包物品")}</h2>
          <span>{tr("选择物品后，在右侧编辑")}</span>
        </div>
        <FilterButtons
          selectedFilter={selectedFilter}
          onFilterChange={(index) => {
            setSelected(null);
            setSelectedFilter((prev) => prev === index ? "0" : index);
          }}
        />
        <FilterComponent
          inventory={inv}
          selectedFilter={selectedFilter}
          selectedIndex={selectedIndex}
        />
      </section>
      {/* Right side buttons */}
      <aside className="inventory-editor" aria-label={tr("物品操作")}>
        <section className="inventory-editor-section inventory-quick-actions">
          <h2>{tr("快捷操作")}</h2>
          <div className="inventory-quick-buttons">
            <button className="buttonBg inventory-btn inventory-add-button" onClick={() => setAddScreen(true)}>
              <span aria-hidden="true">＋</span>{tr("添加物品")}</button>
            <button className="buttonBg inventory-btn" onClick={() => setGemManagerOpen(true)}>{tr("血宝石管理")}</button>
          </div>
        </section>
        <section className="inventory-editor-section inventory-selected-actions">
        <h2>{tr("所选物品")}</h2>
        <div className="inventory-selection" aria-live="polite">
          <strong>{selected ? inventoryItemName(selected) : tr("尚未选择物品")}</strong>
          <p>{selected ? tr(selected.info?.item_desc || selected.info?.note || "可在下方调整此物品。") : tr("从左侧列表选择一件物品，查看详情与可用操作。")}</p>
        </div>
        <label htmlFor="inventory-quantity">{tr("物品数量")}</label>
        <div className="editQuantity">
          <input
            id="inventory-quantity"
            type="number"
            value={quantity || 0}
            max={isStorage ? 600 : 99}
            min={0}
            disabled={getType(selected?.article_type) !== "item" ? true : false}
            onChange={(e) => {
              const { value } = e.target;
              if (value.length > 1 && value[0] === "0") {
                e.target.value = value.slice(1);
              }
              // Check if the item should be capped at 600 or not
              if (
                (!isStorage ||
                  (isStorage &&
                    selected.article_type !== "Material" &&
                    !["Quicksilver Bullets", "Blood Vial"].includes(
                      selected.info.item_name,
                    ))) &&
                value > 99
              ) {
                setQuantity(99);
              } else if (isStorage && value > 600) {
                setQuantity(600);
              } else {
                setQuantity(parseInt(value));
              }
            }}
          />
          <button
            className="buttonBg"
            onClick={async () => {
              console.log(selected);
              const editedSave = await invoke("edit_quantity", {
                number: selected.number,
                id: selected.id,
                value: quantity,
                isStorage,
              });
              setSave(editedSave);
              const canvas = selectedRef.current;
              const ctx = canvas.getContext("2d");
              const itemImage = backgrounds["item.png"];
              ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
              await drawItem(ctx, selected.info, quantity, itemImage, items);
            }}
            disabled={
              getType(selected?.article_type) === "item" && quantity > 0
                ? false
                : true
            }
          >{tr("设定")}</button>
        </div>
        <label htmlFor="inventory-level">{tr("武器强化等级")}<span className="inventory-field-hint">0–10</span></label>
        <div className="editQuantity">
          <input
            id="inventory-level"
            type="number"
            value={level || 0}
            max={10}
            min={0}
            disabled={
              getType(selected?.article_type) !== "weapon" ? true : false
            }
            onChange={(e) => {
              const { value } = e.target;
              if (value.length > 1 && value[0] === "0") {
                e.target.value = value.slice(1);
              }

              if (value > 10) {
                setLevel(10);
              } else {
                setLevel(parseInt(value));
              }
            }}
          />
          <button
            className="buttonBg"
            onClick={async () => {
              const { save: editedSave, weapon } = await invoke(
                "change_weapon_level",
                {
                  articleType: selected.article_type,
                  articleIndex: selected.index,
                  slotIndex: selected.number,
                  isStorage,
                  level,
                },
              );
              setSave(editedSave);
              setSelected(weapon);
            }}
            disabled={
              getType(selected?.article_type) === "weapon" && quantity > 0
                ? false
                : true
            }
          >{tr("设定")}</button>
        </div>
        <button
          className="buttonBg inventory-btn"
          disabled={selected?.article_type === undefined}
          onClick={async () => {
            setReplaceScreen(true);
          }}
        >{tr("替换物品")}</button>
        <button
          className="buttonBg inventory-btn"
          disabled={!selected?.upgrade_type}
          onClick={async () => {
            setEditScreen(true);
          }}
        >{tr("编辑宝石 / 符文")}</button>
        <button
          className="buttonBg inventory-btn"
          disabled={
            getType(selected?.article_type) !== "weapon" &&
            getType(selected?.article_type) !== "armor"
          }
          onClick={() =>
            nav("/equippedGems", {
              state: {
                selected,
                isStorage,
              },
            })
          }
        >{tr("查看镶嵌血宝石")}</button>
        </section>
      </aside>
    </>
  );
}

async function drawItem(ctx, item, amount, img, items) {
  const { x, y } = {
    x: 9,
    y: 6,
  };

  const size = 73;
  const { item_name: name, item_img: image, item_desc: note } = item;

  const thumbnail = items[image];

  ctx.font = `18px ${canvasFont}`;
  ctx.drawImage(img, 0, 0);
  ctx.drawImage(thumbnail, x, y, x + size, y + size);

  // Set up text
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.shadowColor = "black";
  ctx.fillStyle = "#ab9e87";
  drawLocalizedText(ctx, name, 107, 28);
  drawLocalizedText(ctx, note, 104, 69);

  ctx.font = `24px ${canvasFont}`;
  ctx.fillStyle = "#FFFF";
  if (amount > 9) {
    ctx.fillText(amount, 60, 85);
  } else {
    ctx.fillText(amount, 75, 83);
  }
}

export default Inventory;
