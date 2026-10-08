import { useLocale } from "../../localization/i18n.jsx";
import { invoke } from "@tauri-apps/api/core";
import { tr, messageOptions } from "../../localization/zh.js";
import * as dialog from "@tauri-apps/plugin-dialog";

function Appearance() {
  const locale = useLocale();
  return (
    <div
      style={{
        fontSize: "25px",
        marginTop: "5px",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <button
        className="buttonBg"
        style={{
          padding: "0 15px",
          fontSize: "inherit",
          backgroundSize: "100% 100%",
        }}
        onClick={async () => {
          try {
            const path = await dialog.save({
              title: tr("保存外貌文件"),
            });

            if (path) {
              const success = await invoke("export_appearance", {
                path,
              });

              await dialog.message(tr(success), messageOptions());
            }
          } catch (error) {
            console.error(error);
          }
        }}
      >{tr("导出外貌")}</button>
      <button
        className="buttonBg"
        style={{
          padding: "0 15px",
          fontSize: "inherit",
          backgroundSize: "100% 100%",
        }}
        onClick={async () => {
          try {
            const path = await dialog.open({
              title: tr("选择外貌文件"),
            });

            if (path) {
              const success = await invoke("import_appearance", {
                path,
              });

              await dialog.message(tr(success), messageOptions());
            }
          } catch (error) {
            console.error(error);
            await dialog.message(tr(error), messageOptions({
              kind: "error",
            }));
          }
        }}
      >{tr("导入外貌")}</button>
    </div>
  );
}

export default Appearance;
