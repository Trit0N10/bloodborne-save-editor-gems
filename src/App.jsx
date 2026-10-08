import { useLocale } from "./localization/i18n.jsx";
import "./App.css";
import { LocaleProvider } from "./localization/i18n.jsx";
import { useEffect, useRef, useState } from "react";
import Nav from "./components/Nav";
import { BrowserRouter as Router } from "react-router-dom";
import Main from "./pages/main/Main";
import { ImagesProvider } from "./context/imagesContext";
function App() {
  const locale = useLocale();
  const [save, setSave] = useState(null);
  const [loading, setLoading] = useState(false);
  const openButton = useRef(null);
  useEffect(() => {
    let zoom = 1;
    function onKey(event) {
      if (!event.ctrlKey || !["Equal", "Minus", "Digit0", "NumpadAdd", "NumpadSubtract"].includes(event.code)) return;
      event.preventDefault();
      zoom = event.code === "Digit0" ? 1 : Math.max(0.8, Math.min(1.5, Math.round((zoom + (["Equal", "NumpadAdd"].includes(event.code) ? 0.1 : -0.1)) * 10) / 10));
      document.body.style.zoom = zoom;
      document.documentElement.style.setProperty("--ui-zoom", zoom);
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.zoom = ""; document.documentElement.style.removeProperty("--ui-zoom"); };
  }, []);
  return <LocaleProvider><div className="App"><Router>
    <Nav setLoading={setLoading} loading={loading} save={save} setSave={setSave} openButton={openButton} />
    <ImagesProvider><Main save={save} setSave={setSave} loading={loading} onOpen={() => openButton.current?.click()} /></ImagesProvider>
  </Router></div></LocaleProvider>;
}
export default App;
