import { useLocale } from "../../localization/i18n.jsx";
import { tr } from "../../localization/zh.js";
import { useContext } from "react";
import { useLocation, Routes, Route } from "react-router-dom";
import SideBar from "./SideBar";
import Inventory from "../inventory/Inventory";
import Stats from "../stats/Stats";
import Character from "../character/Character";
import { SaveContext } from "../../context/context";
import { ItemsProvider } from "../../context/itemsContext";
import { ImagesContext } from "../../context/imagesContext";
import EquippedGems from "./EquippedGems";
import Bosses from "../bosses/Bosses";
import Flags from "../flags/Flags";
import Icon from "../../components/Icon";
const pages = {
  "/": ["物品栏", "管理随身物品、武器与血宝石。"],
  "/storage": ["仓库", "查看与调整仓库中的收藏。"],
  "/stats": ["能力", "调整猎人的能力数值，确认后保存。"],
  "/character": ["角色", "管理姓名、血之回响与角色信息。"],
  "/bosses": ["头目", "查看与调整头目的进度标记。"],
  "/flags": ["事件标记", "调整角色存档中的特定事件。"],
  "/equippedGems": ["镶嵌血宝石", "查看武器插槽，调整已装备的血宝石。"],
};
export default function Main({ save, setSave, loading, onOpen }) {
  const locale = useLocale();
  const { pathname } = useLocation();
  const { loading: loadingImages } = useContext(ImagesContext);
  const [title, description] = (pages[pathname] || pages["/"]).map(value => tr(value));
  const isInventory = pathname === "/" || pathname === "/storage";
  return <SaveContext.Provider value={{ save, setSave }}><main className="app-main">
    <SideBar />
    <section className={`workspace ${!save ? "workspace--welcome" : ""}`} aria-label={tr("存档编辑区")}>
      {loading || loadingImages ? <div className="workspace-loading" role="status"><div className="spinner" /><p>{loading ? tr("正在读取角色存档…") : tr("正在准备物品图鉴…")}</p></div> : save ? <>
        <div className="workspace-heading"><div><span className="eyebrow">{tr("猎人档案 /")} {title}</span><h1>{title}</h1><p>{description}</p></div><span className="workspace-note">{tr("修改后需点击右上角保存")}</span></div>
        <div className={`workspace-content ${isInventory ? "workspace-content--inventory" : ""}`}>
          <Routes>
            <Route path="/" element={<ItemsProvider><Inventory key="inventory" inv={save.inventory} isStorage={false} /></ItemsProvider>} />
            <Route path="/storage" element={<ItemsProvider><Inventory key="storage" inv={save.storage} isStorage={true} /></ItemsProvider>} />
            <Route path="/stats" element={<Stats />} /><Route path="/character" element={<Character />} />
            <Route path="/equippedGems" element={<ItemsProvider><EquippedGems /></ItemsProvider>} />
            <Route path="/bosses" element={<Bosses />} /><Route path="/flags" element={<Flags />} />
          </Routes>
        </div>
      </> : <div className="welcome-layout">
        <div className="welcome-hero"><span className="eyebrow">BLOODBORNE · SAVE EDITOR</span><h1>{tr("整备猎人，")}<br />{tr("继续未竟的狩猎。")}</h1><p>{tr("整理物品与血宝石，调整角色能力，")}<br />{tr("让下一次出发准备得更从容。")}</p><button className="ui-button ui-button--primary welcome-open" onClick={onOpen}><Icon name="folder" />{tr("打开角色存档")}<Icon name="arrow" size={17} /></button><span className="welcome-file">{tr("支持已解密的角色文件，例如 userdata0000")}</span></div>
        <div className="welcome-guide"><h2>{tr("从一份角色存档开始")}</h2><ol><li><span>01</span><div><strong>{tr("打开存档")}</strong><p>{tr("先退出游戏，再选择要编辑的角色文件。")}</p></div></li><li><span>02</span><div><strong>{tr("整理与编辑")}</strong><p>{tr("从左侧选择物品、能力或世界进度。")}</p></div></li><li><span>03</span><div><strong>{tr("保存修改")}</strong><p>{tr("编辑完成后，通过右上角保存到文件。")}</p></div></li></ol><p className="welcome-tip">{tr("userdata0010 是系统数据，请选择角色文件。建议保留一份原始备份。")}</p><a href="https://github.com/Noxde/Bloodborne-save-editor/wiki/" target="_blank" rel="noreferrer">{tr("存档格式与解密说明")}<span aria-hidden="true">↗</span></a></div>
        <div className="welcome-features"><div><Icon name="inventory" /><strong>{tr("物品与装备")}</strong><p>{tr("数量、强化与仓库管理")}</p></div><div><Icon name="gem" /><strong>{tr("血宝石图鉴")}</strong><p>{tr("按形状查找与添加预设")}</p></div><div><Icon name="character" /><strong>{tr("猎人与世界")}</strong><p>{tr("能力、角色与进度调整")}</p></div></div>
      </div>}
    </section>
  </main></SaveContext.Provider>;
}
