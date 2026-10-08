import { useLocale } from "../../localization/i18n.jsx";
import { tr } from "../../localization/zh.js";
import Flag from "./Flag";
import "../editor-pages.css";

function Flags() {
  const locale = useLocale();
  return (
    <div className="editor-page flags-page">
      <div className="editor-flags-grid">
        <Flag
          label={tr("恢复玛丽亚的对话")}
          offset={1083}
          values={[0, 8]}
          info={tr("恢复与玛丽亚战斗前的部分对话。")}
        />
        <Flag
          label={tr("启用人偶摇篮曲")}
          offset={6689}
          values={[8, 1]}
          info={tr("启用游戏 1.0 版本的人偶摇篮曲。")}
        />
        <Flag
          label={tr("启用嗜血状态")}
          offset={4127}
          values={[162]}
          info={
            tr("与装备“猎人”符文的玩家合作时，允许转为敌对并进行玩家对战。")
          }
        />
        {/* <Flag
          label="Enable multiplayer in Central yharnam"
          offset={4127}
          values={[162]}
          info={
            "Enables multiplayer in central yharnam when both bosses are dead."
          }
        /> */}
      </div>
      <p className="editor-inline-note">{tr("应用事件标记后，点击顶部“保存存档”写入文件。")}</p>
    </div>
  );
}

export default Flags;
