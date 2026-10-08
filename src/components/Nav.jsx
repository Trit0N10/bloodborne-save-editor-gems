import { LanguageSelector, useLocale } from "../localization/i18n.jsx";
import { invoke } from "@tauri-apps/api/core";
import { basename } from "@tauri-apps/api/path";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { tr, messageOptions } from "../localization/zh.js";
import * as dialog from "@tauri-apps/plugin-dialog";
import Icon from "./Icon";
function Nav({ setLoading, loading, setSave, save, openButton }) {
  const locale = useLocale();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  async function readFile() {
    try {
      const selectedPath = await dialog.open({ multiple: false, title: tr("打开角色存档（userdata0000 等）") });
      if (!selectedPath) return;
      setSave(null); setName(""); setLoading(true);
      const parsedSave = await invoke("make_save", { path: selectedPath });
      setName(await basename(selectedPath)); setSave(parsedSave); navigate("/");
    } catch (error) {
      console.error(error);
      await dialog.message(tr("无法读取文件。请选择已解密的角色存档（例如 userdata0000），不要选择系统数据或整个文件夹。"), messageOptions({ title: tr("读取存档失败"), kind: "error" }));
    } finally { setLoading(false); }
  }
  async function saveChanges() {
    setSaving(true);
    try {
      const path = await dialog.save({ title: tr("保存修改"), defaultPath: name });
      if (!path) return;
      const saved = await invoke("save", { save: JSON.stringify(save), path });
      await dialog.message(tr(saved), messageOptions());
    } catch (error) {
      console.error(error);
      await dialog.message(tr("存档未能保存，请检查目标文件是否被占用，以及文件夹是否可写。"), messageOptions({ title: tr("保存失败"), kind: "error" }));
    } finally { setSaving(false); }
  }
  return <header className="app-toolbar">
    <div className="app-brand"><span className="app-mark"><Icon name="gem" size={25} /></span><div><strong>{tr("血源诅咒")}</strong><span>{tr("BLOODBORNE · 存档编辑器")}</span></div></div>
    <div className="open-file-status"><span className={`status-dot ${save ? "is-loaded" : ""}`} /><span>{loading ? tr("正在读取角色存档…") : save ? name : tr("尚未打开存档")}</span></div>
    <div className="toolbar-actions"><LanguageSelector disabled={loading || saving} /><button ref={openButton} className="ui-button" id="openSave" onClick={readFile} disabled={loading || saving}><Icon name="folder" size={17} />{tr("打开存档")}</button><button className="ui-button ui-button--primary" disabled={!save || loading || saving} onClick={saveChanges}><Icon name="save" size={17} />{saving ? tr("正在保存…") : tr("保存存档")}</button></div>
  </header>;
}
export default Nav;
