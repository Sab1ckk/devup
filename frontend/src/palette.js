const roles = ["--bg","--surface","--fg","--mut","--line","--acc","--ink","--acc-rgb"];
function isLight() {
  try { return JSON.parse(localStorage.getItem("upup-mix-palinv") || "false") === true; }
  catch { return false; }
}
function restoreSavedPalette() {
  const light = isLight();
  const colors = light
    ? ["#e6e7e9","#f4f4f5","#111111","#4b4e52","#a0a3a8","#242628","#f4f4f5","36,38,40"]
    : ["#080808","#151515","#f1f1f2","#bfc3c7","#55595f","#bfc3c7","#080808","191,195,199"];
  roles.forEach((role,index)=>document.documentElement.style.setProperty(role,colors[index]));
  document.documentElement.style.colorScheme = light ? "light" : "dark";
  document.querySelector("#pal-fab")?.setAttribute("aria-pressed", String(light));
  document.querySelector("#pal-fab")?.setAttribute("title", light ? "Тёмная тема" : "Светлая тема");
}
function initPalette() {
  const button = document.querySelector("#pal-fab");
  if (!button) return;
  button.onclick = () => {
    try { localStorage.setItem("upup-mix-palinv", JSON.stringify(!isLight())); }
    catch { /* Storage may be unavailable. */ }
    restoreSavedPalette();
  };
  restoreSavedPalette();
}
restoreSavedPalette();
export {initPalette,restoreSavedPalette};
