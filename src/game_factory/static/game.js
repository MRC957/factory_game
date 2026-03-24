// Legacy compatibility loader.
// Prefer including js/state.js, js/utils.js, js/render.js, js/actions.js, js/boot.js directly.
(function loadFactoryGameModules() {
  const scriptOrder = [
    "js/state.js",
    "js/utils.js",
    "js/render.js",
    "js/actions.js",
    "js/boot.js",
  ];

  const current = document.currentScript;
  if (!current?.src) {
    return;
  }

  const base = current.src.replace(/game\.js(?:\?.*)?$/, "");

  let index = 0;
  const loadNext = () => {
    if (index >= scriptOrder.length) {
      return;
    }
    const script = document.createElement("script");
    script.src = base + scriptOrder[index];
    index += 1;
    script.onload = loadNext;
    document.head.appendChild(script);
  };

  loadNext();
})();