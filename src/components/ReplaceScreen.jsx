import { useLocale } from "../localization/i18n.jsx";
import { tr } from "../localization/zh.js";
import { useContext, useState } from "react";
import Item from "./Item";
import { invoke } from "@tauri-apps/api/core";
import { SaveContext } from "../context/context";
import SearchAllitems from "./SearchAllitems";
import { getType } from "../utils/upgrades";

function ReplaceScreen({
  setSelected,
  selected,
  setReplaceScreen,
  isStorage,
  selectedRef,
}) {
  const locale = useLocale();
  const [replacement, setReplacement] = useState(null);
  const { setSave } = useContext(SaveContext);

  async function handleConfirm() {
    try {
      const edited = await invoke("transform_item", {
        index: selected.index,
        id: selected.id,
        newId: parseInt(replacement.id),
        articleType: selected.article_type,
        isStorage,
      }).catch((e) => console.log(e));

      setSave(edited);

      setSelected(null);

      setReplaceScreen(false);
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <div id="replaceScreen">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 3rem",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "start",
            height: "495px",
          }}
        >
          {/* To replace */}
          <div>
            <span>{tr("替换此物品：")}</span>
            <Item item={selected} isSmall={true} />
          </div>
          <div>
            <button
              onClick={() => setReplaceScreen(false)}
              style={{ marginRight: "50px" }}
              id="cancelReplace"
            >{tr("取消")}</button>
            <button id="confirmReplace" onClick={handleConfirm}>{tr("确认")}</button>
          </div>
        </div>
        {/* List and input */}
        <SearchAllitems
          type={getType(selected.article_type)}
          onChange={(x) => setReplacement(x)}
          title={tr("选择替换后的物品")}
        />
      </div>
    </div>
  );
}

export default ReplaceScreen;
