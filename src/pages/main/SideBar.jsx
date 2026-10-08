import { useLocale } from "../../localization/i18n.jsx";
import { tr } from "../../localization/zh.js";
import { useContext } from "react";
import { NavLink } from "react-router-dom";
import { SaveContext } from "../../context/context";
import Icon from "../../components/Icon";
const groups = [
  { label: "物品与装备", links: [["/", "物品栏", "inventory"], ["/storage", "仓库", "storage"]] },
  { label: "猎人档案", links: [["/stats", "能力", "stats"], ["/character", "角色", "character"]] },
  { label: "世界进度", links: [["/bosses", "头目", "bosses"], ["/flags", "事件标记", "flags"]] },
];
export default function SideBar() {
  const locale = useLocale();
  const { save } = useContext(SaveContext);
  return <aside className="app-sidebar">
    <div className="sidebar-profile"><div className="profile-icon"><Icon name="character" size={23} /></div><div><strong>{save?.username?.string || tr("猎人档案")}</strong><small>{save ? tr("角色存档已载入") : tr("等待载入角色")}</small></div></div>
    <nav aria-label={tr("编辑器导航")}>{groups.map(group => <div className="sidebar-group" key={group.label}><p>{tr(group.label)}</p>{group.links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === "/"} onClick={e => { if (!save) e.preventDefault(); }} aria-disabled={!save} tabIndex={save ? 0 : -1} className={({ isActive }) => `sidebar-link ${save && isActive ? "is-active" : ""}`}><Icon name={icon} size={19} /><span>{tr(label)}</span></NavLink>)}</div>)}</nav>
    <div className="sidebar-foot"><span className="sidebar-edition">{tr("简体中文增强版")}</span><p>{tr("修改完成后，请保存存档。")}</p><span className="zoom-hint">{tr("Ctrl + / − 缩放 · Ctrl 0 复原")}</span></div>
  </aside>;
}
