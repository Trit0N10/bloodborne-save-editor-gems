import { useLocale } from "../../localization/i18n.jsx";
import { tr, messageOptions } from "../../localization/zh.js";
import "../editor-pages.css";
import { useContext, useState } from "react";
import { SaveContext } from "../../context/context";
import Stat from "../../components/Stat";
import { invoke } from "@tauri-apps/api/core";
import Playtime from "./Playtime";
import { represent } from "../../utils/playtime";
import CharacterInfo from "./CharacterInfo";
import Appearance from "./Appearance";
import IszGlitch from "./IszGlitch";
import Coordinates from "./Coordinates";
import Teleport from "./Teleport";
import * as dialog from "@tauri-apps/plugin-dialog";

function Character() {
  const locale = useLocale();
  const { save, setSave } = useContext(SaveContext);
  const [username, setUsername] = useState(save.username.string);
  const [editedStats, setEditedStats] = useState(
    JSON.parse(JSON.stringify(save.stats)),
  );
  const [editedPlaytime, setEditedPlaytime] = useState(save.playtime);
  const [editedCoordinates, setEditedCoordinates] = useState(
    save.position.coordinates,
  );

  return (
    <div className="editor-page character-page">
      <div className="editor-character-grid">
        <section className="editor-panel character-identity">
          <h2 className="editor-section-title">{tr("角色资料")}</h2>
        <div className="editor-form-row">
          <label htmlFor="username">{tr("姓名：")}</label>
          <input
            id="username"
            type="text"
            autoComplete="off"
            spellCheck="false"
            maxLength={16}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
            }}
          />
        </div>
        <div id="currency" className="editor-currency">
          <Stat
            editedStats={editedStats}
            setEditedStats={setEditedStats}
            stat={save.stats.find((x) => x.name === "Echoes")}
          />

          <Stat
            editedStats={editedStats}
            setEditedStats={setEditedStats}
            stat={save.stats.find((x) => x.name === "Insight")}
          />
        </div>
        <div className="character-selects">
          <CharacterInfo
            editedStats={editedStats}
            setEditedStats={setEditedStats}
          />
        </div>
        <div className="character-detail character-playtime">
          <Playtime ms={editedPlaytime} setMs={setEditedPlaytime} />
        </div>
        </section>
        <section className="editor-panel character-location">
          <h2 className="editor-section-title">{tr("位置与传送")}</h2>
          <div className="character-detail character-coordinates">
          <Coordinates
            coordinates={editedCoordinates}
            setCoordinates={setEditedCoordinates}
          />
          </div>
          <div className="character-detail character-teleport">
          <Teleport
            setSave={setSave}
            setEditedCoordinates={setEditedCoordinates}
          />
          </div>
        </section>
        <section className="editor-panel character-extras">
          <h2 className="editor-section-title">{tr("外貌与伊兹状态")}</h2>
          <div className="character-detail character-appearance"><Appearance /></div>
          <div className="character-detail character-isz"><IszGlitch /></div>
        </section>
      </div>
      {/* Buttons */}
      <div className="editor-actions">
        <span className="editor-action-hint">{tr("确认修改后，点击顶部“保存存档”写入文件。")}</span>
        <button
          className="editor-button"
          onClick={() => {
            setEditedStats(JSON.parse(JSON.stringify(save.stats)));
            setEditedPlaytime(save.playtime);
            setEditedCoordinates(save.position.coordinates);
            setUsername(save.username.string);
          }}
        >{tr("重置")}</button>

        <button
          className="editor-button editor-button-primary"
          onClick={async () => {
            try {
              editedStats.forEach(
                async ({ rel_offset, length, times, value }) => {
                  await invoke("edit_stat", {
                    relOffset: rel_offset,
                    length,
                    times,
                    value: parseInt(value),
                  });
                },
              );

              if (username.length > 0 && username !== save.username.string) {
                await invoke("set_username", {
                  newUsername: username,
                });
              } else {
                setUsername(save.username.string);
              }
              await invoke("set_playtime", {
                newPlaytime: represent(editedPlaytime),
              });

              await invoke("edit_coordinates", {
                x: +editedCoordinates.x,
                y: +editedCoordinates.y,
                z: +editedCoordinates.z,
              });

              await dialog.message(tr("已确认修改。请点击顶部“保存存档”写入文件。"), messageOptions());

              setSave((prev) => {
                prev.position.coordinates = JSON.parse(
                  JSON.stringify(editedCoordinates),
                );
                prev.stats = JSON.parse(JSON.stringify(editedStats));
                prev.playtime = editedPlaytime;
                prev.username.string = username;

                return prev;
              });
            } catch (error) {
              console.error(error);
            }
          }}
        >{tr("确认")}</button>
      </div>
    </div>
  );
}

export default Character;
