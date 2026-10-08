import { useLocale } from "../localization/i18n.jsx";
import { useState, useEffect, useId } from "react";
import { tr } from "../localization/zh.js";

function Stat({ stat, editedStats, setEditedStats }) {
  const locale = useLocale();
  const [value, setValue] = useState(stat.value);
  const inputId = useId();

  useEffect(() => {
    setValue(stat.value);
  }, [stat, editedStats]);

  return (
    <div className="editor-stat">
      <img
        width={32}
        height={32}
        src={`/assets/stats/${stat.name.toLowerCase()}.png`}
        alt=""
      />
      <div className="editor-stat-field">
        <label htmlFor={inputId} title={stat.name}>{tr(stat.name)}</label>
        <input
          id={inputId}
          type="number"
          min={0}
          value={value}
          onChange={(e) => {
            const { value: newValue } = e.target;
            if (newValue > 999999999) {
              setValue(999999999);

              editedStats.find((x) => x.name === stat.name).value = 999999999;
            } else {
              setValue(newValue);

              editedStats.find((x) => x.name === stat.name).value = newValue;
            }

            setEditedStats(editedStats);
          }}
        />
      </div>
    </div>
  );
}

export default Stat;
