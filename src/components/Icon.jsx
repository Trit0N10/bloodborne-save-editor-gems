import { useLocale } from "../localization/i18n.jsx";
const paths = {
  folder: "M3 7V5h6l2 2h10v12H3Z M3 10h18",
  save: "M4 3h13l3 3v15H4Z M8 3v6h8V3 M8 21v-8h8v8",
  inventory: "M4 7h16v14H4Z M8 7V3h8v4 M4 12h16 M9 12v3h6v-3",
  storage: "M3 4h18v5H3Z M5 9v12h14V9 M9 13h6",
  stats: "M5 20V10 M12 20V4 M19 20v-7 M3 20h18",
  character: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 6 0 0 1 16 0v3",
  bosses: "m4 3 16 18 M20 3 4 21 M3 14l7 7 M14 21l7-7",
  flags: "M5 22V3 M5 3h14l-3 5 3 5H5",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  gem: "m12 2 9 8-9 12L3 10Z M3 10h18 M8 3l4 19 4-19",
};
export default function Icon({ name, size = 20, ...props }) {
  const locale = useLocale();
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.inventory} /></svg>;
}
