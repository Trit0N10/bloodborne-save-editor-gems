import { useLocale } from "../../localization/i18n.jsx";
import { tr } from "../../localization/zh.js";
import { useContext, useEffect, useRef } from "react";
import { SaveContext } from "../../context/context";
import { invoke } from "@tauri-apps/api/core";
import "../editor-pages.css";
import Boss from "./Boss";

function Bosses() {
  const locale = useLocale();
  const { save, setSave } = useContext(SaveContext);
  const { bosses } = save;
  const scrollDiv = useRef(null);


  async function handleChange(e, i) {
    e.forEach(async (x) => {
      await invoke("set_flag", {
        offset: x.rel_offset,
        newValue: x.current_value,
      });
    });

    bosses[i].flags = e;
    setSave((prev) => {
      prev.bosses = bosses;
      return prev;
    });
  }

  useEffect(() => {
    if (scrollDiv?.current) {
      scrollDiv.current.scroll(0, -999);
    }
  }, [scrollDiv]); // Correct scroll

  return (
    <div
      ref={scrollDiv}
      className="editor-page bosses-page"
    >
      <div className="editor-boss-grid">
      {bosses.map((x, i) => {
        return (
          <Boss key={x.name ?? i} boss={x} onChange={async (e) => await handleChange(e, i)} />
        );
      })}
      </div>
      <p className="editor-inline-note">{tr("选择首领状态后，点击顶部“保存存档”写入文件。")}</p>
    </div>
  );
}

export default Bosses;
