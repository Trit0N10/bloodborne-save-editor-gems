import { useLocale } from "../../localization/i18n.jsx";
import { tr, messageOptions } from "../../localization/zh.js";
import { useContext, useState } from "react";
import { SaveContext } from "../../context/context";
import Stat from "../../components/Stat";
import { invoke } from "@tauri-apps/api/core";
import "../editor-pages.css";
import * as dialog from "@tauri-apps/plugin-dialog";

function Stats() {
  const locale = useLocale();
  const { save, setSave } = useContext(SaveContext);
  const [editedStats, setEditedStats] = useState(
    JSON.parse(JSON.stringify(save.stats)),
  );

  return (
    <div className="editor-page stats-page">
      <section className="editor-panel">
        <h2 className="editor-section-title">{tr("能力数值")}</h2>
        <div className="editor-stats-grid">
      {editedStats
        .filter(
          (x) =>
            x.name !== "Echoes" &&
            x.name !== "Insight" &&
            x.name !== "Voice" &&
            x.name !== "Gender" &&
            x.name !== "Ng" &&
            x.name !== "Origin",
        )
        .map((x, i) => (
          <Stat
            editedStats={editedStats}
            setEditedStats={setEditedStats}
            key={i}
            stat={x}
          />
        ))}
        </div>
      </section>
      <div className="editor-actions">
        <span className="editor-action-hint">{tr("确认修改后，点击顶部“保存存档”写入文件。")}</span>
        <button
          className="editor-button"
          onClick={() => {
            setEditedStats(JSON.parse(JSON.stringify(save.stats)));
          }}
        >{tr("重置")}</button>
        <button
          className="editor-button editor-button-primary"
          onClick={async () => {
            editedStats.forEach(
              async ({ rel_offset, length, times, value }, i) => {
                try {
                  if (save.stats[i].value !== value) {
                    await invoke("edit_stat", {
                      relOffset: rel_offset,
                      length,
                      times,
                      value: parseInt(value),
                    });
                  }
                } catch (error) {
                  console.error(error);
                }
              },
            );
            setSave((prev) => {
              prev.stats = JSON.parse(JSON.stringify(editedStats));
              return prev;
            });
            await dialog.message(tr("已确认修改。请点击顶部“保存存档”写入文件。"), messageOptions());
          }}
        >{tr("确认")}</button>
      </div>
    </div>
  );
}

export default Stats;
