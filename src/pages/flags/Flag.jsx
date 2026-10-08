import { useLocale } from "../../localization/i18n.jsx";
import { tr, messageOptions } from "../../localization/zh.js";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";

function Flag({ label, offset, values, info, isMask = false }) {
  const locale = useLocale();
  const tipRef = useRef();
  const [top, setTop] = useState(0);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (tipRef.current) {
      setTop(tipRef.current.getBoundingClientRect().height);
    }
  }, [locale, info]);

  async function setFlag() {
    for (let i = 0; i < values.length; i++) {
      await invoke("set_flag", {
        offset: offset + i,
        newValue: values[i],
      });
    }
    await message(tr("事件标记已应用。请点击顶部“保存存档”写入文件。"), messageOptions());
  }

  async function applyMask() {
    await invoke("apply_mask", {
      offset: offset,
      mask: values[0],
    });
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        position: "relative",
      }}
    >
      {/* Tooltip info */}
      <div
        className="tooltip"
        style={{
          opacity: showTip ? 1 : 0,
          top: `-${top + 5}px`,
        }}
        ref={tipRef}
      >
        {info}
      </div>

      {/* Tooltip hover and label */}
      <div
        style={{
          position: "relative",
          paddingLeft: 25,
        }}
      >
        <div
          className="tooltip-hover"
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
        >
          ?
        </div>
        <label>{label}</label>
      </div>

      <button
        style={{
          padding: "0rem 1rem",
          backgroundSize: "100% 100%",
        }}
        className="buttonBg"
        onClick={isMask ? applyMask : setFlag}
      >{tr("应用")}</button>
    </div>
  );
}

export default Flag;
