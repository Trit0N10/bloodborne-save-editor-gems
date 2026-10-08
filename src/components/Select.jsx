import { useLocale } from "../localization/i18n.jsx";
import { useState, useContext, useEffect } from "react";
import { SaveContext } from "../context/context";
import { tr } from "../localization/zh.js";

function Select({ options, name, setEditedStats, editedStats }) {
  const locale = useLocale();
  const { save } = useContext(SaveContext);
  const [value, setValue] = useState(
    save.stats.find((y) => y.name === name)?.value,
  );

  function handleChange(e) {
    const { target } = e;
    setValue(target.value);
    editedStats.find((x) => x.name === name).value = target.value;

    setEditedStats(editedStats);
  }

  useEffect(() => {
    setValue(editedStats.find((x) => x.name === name).value);
  }, [editedStats]);

  return (
    <div className="select-wrapper" data-label={tr(name)}>
      <select value={value} name={name} aria-label={tr(name)} title={tr(name)} onChange={handleChange}>
        {options.map((x, i) => {
          const label = x.label ?? x;
          const value = x.value ?? i;

          return (
            <option key={i} value={value}>
              {tr(label)}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export default Select;
