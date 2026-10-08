import { LanguageSelector, useLocale } from "../localization/i18n.jsx";
import { useContext, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SaveContext } from "../context/context";
import { tr, searchTerms, presetText, formatGemFeedback } from "../localization/zh.js";
import { getUnique, isCursed } from "../utils/upgrades";
import GemArtwork from "./GemArtwork.jsx";
import "./GemManager.css";

const NO_EFFECT = 4294967295;
const GEM_SHAPES = ["Radial", "Droplet", "Triangle", "Waning", "Circle"];

function errorText(error) {
  return typeof error === "string" ? error : error?.message || tr("操作失败，请重试。");
}

function localeSpace() { return tr("Cursed") === "Cursed" ? " " : ""; }

function gemName(gem) {
  const unique = getUnique(gem.effects?.[0]?.[0], gem.shape, gem.source);
  if (unique) return tr(unique.name);
  let name = tr(gem.info?.name || "Blood Gem");
  // Upstream labels some full-HP effects as Poorman's (the near-death family).
  // Correct this display name only; effect IDs and save values stay intact.
  if (gem.effects?.[0]?.[1]?.includes("at full HP") && gem.info?.name?.startsWith("Poorman's")) {
    name = name.replace(/^穷人/, tr("愚者")).replace(/^Poorman's/, "Fool's");
  }
  return isCursed(gem.effects || []) ? `${tr("Cursed")}${localeSpace()}${name}` : name;
}

function presetEffectsFor(preset) {
  return preset?.effects.map((id, index) => [id, preset.effectLabels[index]]) || [];
}

function EffectList({ effects }) {
  const locale = useLocale();
  const visible = (effects || []).filter(([id]) => Number(id) !== NO_EFFECT);
  return (
    <ul className="gem-manager-effects" aria-label={tr("血宝石效果")}>
      {visible.map(([id, label], index) => {
        const negative = isCursed([[id, label]]);
        return (
          <li key={`${id}-${index}`} className={negative ? "gem-manager-negative" : ""}
            title={`${tr(label)}\n${label}`}>
            {negative && <strong>{tr("负面效果：")}</strong>}{tr(label)}
          </li>
        );
      })}
      {!visible.length && <li>{tr("无效果")}</li>}
    </ul>
  );
}

function DeleteConfirmation({ gem, location, pending, error, onCancel, onConfirm }) {
  const locale = useLocale();
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={dialogRef} className="gem-manager-confirm" aria-labelledby="gem-delete-title"
      aria-describedby="gem-delete-description" aria-busy={pending}
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}>
      <div className="gem-manager-confirm-heading"><h2 id="gem-delete-title">{tr("删除这颗血宝石？")}</h2><LanguageSelector disabled={pending} /></div>
      <p id="gem-delete-description">{tr("将从")}{location}{tr("移除下方这一颗血宝石。保存存档后生效。")}</p>
      <div className="gem-manager-delete-preview">
        <div className="gem-manager-identity">
          <GemArtwork effects={gem.effects} shape={gem.shape} level={gem.info?.level}
            source={gem.source} name={gemName(gem)} large />
          <div><h3>{gemName(gem)}</h3>
            <p>{tr(gem.shape)} {tr("· 评级")} {gem.info?.rating ?? "—"}</p></div>
        </div>
        <EffectList effects={gem.effects} />
      </div>
      {error && <p className="gem-manager-error" role="alert">{tr(error)}</p>}
      <div className="gem-manager-actions">
        <button type="button" autoFocus disabled={pending} onClick={onCancel}>{tr("取消")}</button>
        <button type="button" className="gem-manager-danger" disabled={pending} onClick={onConfirm}>
          {pending ? tr("正在删除…") : tr("确认删除这一颗")}
        </button>
      </div>
    </dialog>
  );
}

export default function GemManager({ isStorage, onClose, onChanged }) {
  const locale = useLocale();
  const countOpen = locale === "en" ? " (" : "（";
  const countClose = locale === "en" ? ")" : "）";
  const { save, setSave } = useContext(SaveContext);
  const dialogRef = useRef(null);
  const mutationLock = useRef(false);
  const fetchVersion = useRef(0);
  const [tab, setTab] = useState("presets");
  const [query, setQuery] = useState("");
  const [shapeFilter, setShapeFilter] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [pending, setPending] = useState(false);
  const [presetId, setPresetId] = useState("");
  const [preferredShape, setPreferredShape] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedGemId, setSelectedGemId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const locationKey = isStorage ? "Storage" : "Inventory";
  const location = tr(locationKey);
  const successMessage = formatGemFeedback(success, locationKey, gemName);
  const presets = data?.presets || [];
  const search = query.trim().toLowerCase();
  const filteredPresets = presets.filter((preset) => (!shapeFilter || preset.shapes.includes(shapeFilter)) && [
    ...searchTerms(preset.name), preset.englishName, ...searchTerms(preset.category),
    ...(preset.effectLabels || []).flatMap((label) => searchTerms(label)),
  ].some((value) => String(value || "").toLowerCase().includes(search)));
  const selectedPreset = filteredPresets.find((preset) => preset.id === presetId) || filteredPresets[0];
  const shape = selectedPreset
    ? shapeFilter || (selectedPreset.shapes.includes(preferredShape) ? preferredShape : selectedPreset.shapes[0])
    : "";
  const presetEffects = presetEffectsFor(selectedPreset);
  const gems = save?.[isStorage ? "storage" : "inventory"]?.upgrades?.Gem || [];
  const filteredGems = gems.filter((gem) => !shapeFilter || gem.shape === shapeFilter);
  const selectedGem = filteredGems.find((gem) => String(gem.id) === selectedGemId) || filteredGems[0];
  const shapeCount = (value) => tab === "presets"
    ? presets.filter((preset) => !value || preset.shapes.includes(value)).length
    : gems.filter((gem) => !value || gem.shape === value).length;
  const availableSlots = Number.isSafeInteger(data?.availableSlots) && data.availableSlots >= 0
    ? data.availableSlots : null;
  const requestedQuantity = /^\d+$/.test(quantity) ? Number(quantity) : NaN;
  const isPositiveQuantity = Number.isSafeInteger(requestedQuantity) && requestedQuantity >= 1;
  const isQuantityAllowed = isPositiveQuantity && availableSlots !== null
    && requestedQuantity <= availableSlots;
  const quantityError = !isPositiveQuantity ? tr("请输入至少 1 颗的整数数量。")
    : availableSlots > 0 && requestedQuantity > availableSlots
      ? tr(`当前${location}最多可新增 ${availableSlots} 颗，请减少数量。`) : "";

  async function refreshData() {
    const version = ++fetchVersion.current;
    setLoading(true);
    setLoadError("");
    try {
      const result = await invoke("gem_manager_data", { isStorage });
      if (version !== fetchVersion.current) return;
      setData(result);
      setPresetId((current) => result.presets.some((preset) => preset.id === current)
        ? current : result.presets[0]?.id || "");
    } catch (failure) {
      if (version !== fetchVersion.current) return;
      setData((previous) => previous ? { ...previous, canAdd: false, availableSlots: null } : null);
      setLoadError(`无法刷新预设及剩余数量：${errorText(failure)}`);
    } finally {
      if (version === fetchVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    refreshData();
    return () => { ++fetchVersion.current; dialog.close(); };
  }, [isStorage]);

  async function addGem() {
    if (mutationLock.current || loading || !data?.canAdd) return;
    if (!selectedPreset || !selectedPreset.shapes.includes(shape)) {
      setError("请先选择一个预设及其可用形状。");
      return;
    }
    if (!isQuantityAllowed) {
      setError(quantityError || "当前没有足够的可用容量，请刷新数量后重试。");
      return;
    }
    mutationLock.current = true;
    setPending(true);
    setError("");
    setSuccess(null);
    try {
      const editedSave = await invoke("add_preset_gem", {
        presetId: selectedPreset.id, shape, isStorage, quantity: requestedQuantity,
      });
      setSave(editedSave);
      setSuccess({ kind: "add", quantity: requestedQuantity, preset: selectedPreset });
      onChanged?.();
      await refreshData();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }

  async function deleteGem() {
    if (mutationLock.current || !deleteTarget) return;
    mutationLock.current = true;
    setPending(true);
    setError("");
    setSuccess(null);
    try {
      const editedSave = await invoke("delete_blood_gem", { gemId: deleteTarget.id, isStorage });
      setSave(editedSave);
      setSuccess({ kind: "delete", gem: deleteTarget });
      setDeleteTarget(null);
      onChanged?.();
      await refreshData();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="gem-manager" aria-labelledby="gem-manager-title"
      aria-describedby="gem-manager-save-note" aria-busy={pending}
      onCancel={(event) => { event.preventDefault(); if (!pending && !deleteTarget) onClose(); }}>
      <header className="gem-manager-header">
        <div><h2 id="gem-manager-title">{tr("血宝石管理")}<span>· {location}</span></h2>
          <p id="gem-manager-save-note">{tr("添加或删除后，请关闭此窗口并点击“保存存档”。")}</p></div>
        <div className="gem-manager-header-actions"><LanguageSelector disabled={pending} /><button type="button" disabled={pending} onClick={onClose}>{tr("关闭")}</button></div>
      </header>
      <div className="gem-manager-toolbar">
        <div className="gem-manager-toolbar-overview">
          <div className="gem-manager-status">
            <span>{location}{tr("当前可新增：")}<strong>{loading ? tr("查询中…") : availableSlots ?? tr("待刷新")}</strong>
              {!loading && availableSlots !== null && tr(" 颗")}</span>
            <button type="button" disabled={loading || pending} onClick={refreshData}>{tr("刷新数量")}</button>
          </div>
          {!loading && !loadError && data?.reason && <p className="gem-manager-muted">{tr(data.reason)}</p>}
          <div className="gem-manager-tabs" role="group" aria-label={tr("管理内容")}>
            <button type="button" aria-pressed={tab === "presets"} disabled={pending}
              onClick={() => setTab("presets")}>{tr("选择预设并添加")}</button>
            <button type="button" aria-pressed={tab === "owned"} disabled={pending}
              onClick={() => setTab("owned")}>{location}{tr("血宝石（")}{gems.length}{countClose}</button>
          </div>
        </div>
        <div className="gem-manager-toolbar-filters">
          <div className="gem-manager-shape-filter">
            <label htmlFor="gem-shape-filter">{tr("按形状分类")}</label>
            <select id="gem-shape-filter" value={shapeFilter} disabled={pending || loading}
              onChange={(event) => { setShapeFilter(event.target.value); setError(""); }}>
              <option value="">{tr("全部形状（")}{shapeCount("")}{countClose}</option>
              {GEM_SHAPES.map((value) => <option key={value} value={value}>
                {tr(value)}{countOpen}{shapeCount(value)}{countClose}
              </option>)}
            </select>
            {tab === "presets" && <span className="gem-manager-muted">
              {shapeFilter ? tr(`添加时使用${tr(shapeFilter)}形状。`) : tr("按形状筛选后选择预设。")}
            </span>}
          </div>
          {tab === "presets" && <div className="gem-manager-toolbar-search">
            <label htmlFor="gem-preset-search">{tr("搜索名称、类型或效果（中 / 英文）")}</label>
            <input id="gem-preset-search" type="search" value={query} disabled={pending}
              placeholder={tr("例如：物理、火焰、Tempering")}
              onChange={(event) => setQuery(event.target.value)} />
          </div>}
        </div>
      </div>
      <div className="gem-manager-feedback" aria-live="polite">
        {success && <p className="gem-manager-success" role="status">{successMessage}</p>}
        {loadError && <p className="gem-manager-error" role="alert">{tr(loadError)} {success ? tr("已完成的添加或删除仍然保留。") : tr("请点击“刷新数量”重试。")}</p>}
        {error && !deleteTarget && <p className="gem-manager-error" role="alert">{tr(error)}</p>}
      </div>
      {tab === "presets" ? (
        <section className="gem-manager-body" aria-label={tr("血宝石预设")}>
          <div className="gem-manager-list-pane">
            <p id="gem-preset-list-label">{tr("预设列表 ·")}{filteredPresets.length}{tr("项")}</p>
            <ul className="gem-manager-image-list" aria-labelledby="gem-preset-list-label">
              {!filteredPresets.length && <li className="gem-manager-empty">{loading ? tr("正在读取…") : tr("没有匹配的预设")}</li>}
              {filteredPresets.map((preset) => {
                const rowShape = shapeFilter || (preset.shapes.includes(preferredShape) ? preferredShape : preset.shapes[0]);
                return <li key={preset.id}><button type="button" className="gem-manager-image-row"
                  aria-pressed={preset.id === selectedPreset?.id} disabled={pending || loading}
                  onClick={() => { setPresetId(preset.id); setError(""); }}>
                  <GemArtwork effects={presetEffectsFor(preset)} shape={rowShape} level={preset.level}
                    source={preset.sourceId} name={presetText(preset)} />
                  <span className="gem-manager-row-copy"><strong>{presetText(preset)}</strong>
                    <span>{preset.shapes.map(tr).join(" / ")} {tr("· 评级")} {preset.rating}</span></span>
                </button></li>;
              })}
            </ul>
            <p className="gem-manager-muted">{tr("精选的游戏效果组合，包含明确的负面效果；不涵盖全部随机掉落。")}</p>
          </div>
          <div className="gem-manager-detail">
            {selectedPreset ? <>
              <div className="gem-manager-identity">
                <GemArtwork effects={presetEffects} shape={shape} level={selectedPreset.level}
                  source={selectedPreset.sourceId} name={presetText(selectedPreset)} large />
                <div><h3>{presetText(selectedPreset)}</h3>
                  {locale === "zh-CN" && <p className="gem-manager-english">{selectedPreset.englishName}</p>}
                  <p>{presetText(selectedPreset, "category")} {tr("· 评级")} {selectedPreset.rating}</p>
                  {isCursed(presetEffects) && <span className="gem-manager-curse">{tr("含诅咒效果")}</span>}
                </div>
              </div>
              <div className="gem-manager-shape">
                <label htmlFor="gem-preset-shape">{tr("形状")}</label>
                <select id="gem-preset-shape" value={shape} disabled={pending || Boolean(shapeFilter)}
                  onChange={(event) => setPreferredShape(event.target.value)}>
                  {selectedPreset.shapes.map((value) => <option key={value} value={value}>{tr(value)}</option>)}
                </select>
              </div>
              <EffectList effects={presetEffects} />
              {selectedPreset.notes && <p className="gem-manager-notes">{presetText(selectedPreset, "notes")}</p>}
              {/^https?:\/\//i.test(selectedPreset.source || "") && <a className="gem-manager-source"
                href={selectedPreset.source} target="_blank" rel="noreferrer">{tr("查看预设来源 ↗")}</a>}
            </> : <p className="gem-manager-empty">{tr("从左侧列表选择一个完整预设，查看其效果和可用形状。")}</p>}
          </div>
        </section>
      ) : (
        <section className="gem-manager-body" aria-label={tr(`${location}血宝石`)}>
          <div className="gem-manager-list-pane">
            <p id="gem-owned-list-label">{tr("选择要查看或删除的血宝石 ·")}{filteredGems.length}{tr("颗")}</p>
            <ul className="gem-manager-image-list" aria-labelledby="gem-owned-list-label">
              {!filteredGems.length && <li className="gem-manager-empty">{shapeFilter ? tr(`没有${tr(shapeFilter)}的未装备血宝石`) : tr(`${location}中没有未装备的血宝石`)}</li>}
              {filteredGems.map((gem, index) => <li key={gem.id}>
                <button type="button" className="gem-manager-image-row" disabled={pending}
                  aria-pressed={gem.id === selectedGem?.id}
                  onClick={() => { setSelectedGemId(String(gem.id)); setError(""); }}>
                  <GemArtwork effects={gem.effects} shape={gem.shape} level={gem.info?.level}
                    source={gem.source} name={gemName(gem)} />
                  <span className="gem-manager-row-copy"><strong>{index + 1}. {gemName(gem)}</strong>
                    <span>{tr(gem.shape)} {tr("· 评级")} {gem.info?.rating ?? "—"}</span></span>
                </button>
              </li>)}
            </ul>
            <p className="gem-manager-muted">{tr("此处列出当前")}{location}{tr("中未装备的血宝石。删除前会再次显示所选血宝石的效果。")}</p>
          </div>
          <div className="gem-manager-detail">
            {selectedGem ? <>
              <div className="gem-manager-identity">
                <GemArtwork effects={selectedGem.effects} shape={selectedGem.shape} level={selectedGem.info?.level}
                  source={selectedGem.source} name={gemName(selectedGem)} large />
                <div><h3>{gemName(selectedGem)}</h3>
                  <p>{tr(selectedGem.shape)} {tr("· 评级")} {selectedGem.info?.rating ?? "—"}</p>
                  {isCursed(selectedGem.effects) && <span className="gem-manager-curse">{tr("含诅咒效果")}</span>}
                </div>
              </div>
              <EffectList effects={selectedGem.effects} />
            </> : <p className="gem-manager-empty">{shapeFilter ? tr("当前形状分类下没有血宝石，可切换其他形状或查看全部。") : tr("此处暂无可管理的血宝石。")}</p>}
          </div>
        </section>
      )}
      <footer className="gem-manager-footer">
        {tab === "presets" ? <div className="gem-manager-add-options">
          <div className="gem-manager-quantity">
            <label htmlFor="gem-add-quantity">{tr("添加数量")}</label>
            <input id="gem-add-quantity" type="number" inputMode="numeric" min={1}
              max={availableSlots ?? undefined} step={1} value={quantity}
              disabled={pending || loading || !data?.canAdd}
              aria-invalid={Boolean(quantityError)}
              aria-describedby={quantityError ? "gem-quantity-hint gem-quantity-error" : "gem-quantity-hint"}
              onChange={(event) => { setQuantity(event.target.value); setError(""); }} />
            <span>{tr("颗")}</span>
          </div>
          <p id="gem-quantity-hint">{tr("每颗均采用当前预设和形状；数量以")}{location}{tr("实际可用容量为准。")}</p>
          {quantityError && <p id="gem-quantity-error" className="gem-manager-quantity-error" role="alert">{quantityError}</p>}
        </div> : <p>{tr("每次只删除确认窗口中显示的 1 颗。")}</p>}
        {tab === "presets" ? <button type="button" className="gem-manager-primary"
          disabled={pending || loading || !data?.canAdd || !isQuantityAllowed || !selectedPreset || !selectedPreset.shapes.includes(shape)}
          onClick={addGem}>{pending ? tr("正在添加…")
            : isQuantityAllowed ? tr(`添加 ${requestedQuantity} 颗到${location}`) : tr("添加血宝石")}</button>
          : <button type="button" className="gem-manager-danger" disabled={pending || !selectedGem}
            onClick={() => { setError(""); setDeleteTarget(selectedGem); }}>{tr("删除所选血宝石…")}</button>}
      </footer>
      {deleteTarget && <DeleteConfirmation gem={deleteTarget} location={location} pending={pending} error={error}
        onCancel={() => { if (!mutationLock.current) { setDeleteTarget(null); setError(""); } }} onConfirm={deleteGem} />}
    </dialog>
  );
}
