import { useLocale } from "../../localization/i18n.jsx";
import { tr } from "../../localization/zh.js";
import { useContext, useState } from "react";
import { SaveContext } from "../../context/context";
import Item from "../../components/Item";
import { invoke } from "@tauri-apps/api/core";

function ChangeGemScreen({
  article,
  setArticle,
  setSelected,
  setScreen,
  slotIndex,
  isStorage,
}) {
  const locale = useLocale();
  const { save, setSave } = useContext(SaveContext);
  const gems = isStorage
    ? [...(save.storage.upgrades.Gem ?? [])]
    : [...(save.inventory.upgrades.Gem ?? [])];

  const [hoverIndex, setHoverIndex] = useState(null);
  const [selectedGem, setSelectedGem] = useState(null);
  const dummy = {
    number: -1,
    id: 0,
    source: 0,
    upgrade_type: "Gem",
    shape: "",
    effects: [
      [4294967295, "No Effect"],
      [4294967295, "No Effect"],
      [4294967295, "No Effect"],
      [4294967295, "No Effect"],
      [4294967295, "No Effect"],
      [4294967295, "No Effect"],
    ],
    info: {
      name: "Unequip gem",
      effect: "",
      rating: 0,
      level: 0,
      note: "",
    },
    index: 2,
  };
  gems.unshift(dummy);

  return (
    <>
      <div
        className="change-gem-overlay"
        style={{
          position: "fixed",
          inset: 0,
          background: "#121619f7",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          justifyContent: "safe center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "803px",
            maxWidth: "calc(100% - 40px)",
            minHeight: "200px",
            maxHeight: "calc(100% - 149px)",
            overflowX: "auto",
            overflowY: "scroll",
          }}
        >
          <div
            id="hoverReplacement"
            style={{
              display: hoverIndex == null ? "none" : "block",
              top: `${hoverIndex * 91}px`,
            }}
          ></div>
          {gems.map((x, i) => (
            <Item
              item={x}
              index={i + 1}
              isSmall={false}
              onClick={() => {
                setHoverIndex(i);
                setSelectedGem(x);
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <button
            className="ui-button"
            style={{ marginRight: "1rem" }}
            onClick={() => setScreen(false)}
          >{tr("取消")}</button>
          <button
            className="ui-button ui-button--primary"
            onClick={async () => {
              if (selectedGem.number === -1) {
                const edited = await invoke("unequip_gem", {
                  articleType: article.article_type,
                  articleIndex: article.index,
                  slotIndex: slotIndex,
                  isStorage: isStorage,
                });

                setSave(edited);
                setArticle((prev) => {
                  const copy = JSON.parse(JSON.stringify(prev));
                  copy.slots[slotIndex].gem = null;
                  return copy;
                });

                setSelected(null);

                setScreen(false);
              } else {
                // Unequip the current gem before trying to equip the selected one
                if (article.slots[slotIndex]?.gem !== null) {
                  await invoke("unequip_gem", {
                    articleType: article.article_type,
                    articleIndex: article.index,
                    slotIndex: slotIndex,
                    isStorage: isStorage,
                  });
                }

                const edited = await invoke("equip_gem", {
                  upgradeIndex: selectedGem.index,
                  articleType: article.article_type,
                  articleIndex: article.index,
                  slotIndex: slotIndex,
                  isStorage: isStorage,
                });

                setSave(edited);
                setArticle((prev) => {
                  const copy = JSON.parse(JSON.stringify(prev));
                  copy.slots[slotIndex].gem = selectedGem;
                  return copy;
                });

                setSelected(null);

                setScreen(false);
              }
            }}
            disabled={
              !selectedGem ||
              (selectedGem?.number === -1 &&
                article.slots[slotIndex]?.gem === null)
            }
          >{tr("确认")}</button>
        </div>
      </div>
    </>
  );
}

export default ChangeGemScreen;
