// ── Keyboard shortcut: Enter on Advance Time ────────────────────────────
document.getElementById("hours-input").addEventListener("keydown", e => {
  if (e.key === "Enter") doAdvanceTime();
});

// ── Boot ────────────────────────────────────────────────────────────────
// Immediately-invoked async IIFE: fetch the initial state and paint the UI.
(async () => {
  try {
    const langSelect = document.getElementById("lang-select");
    langSelect.value = currentLang;
    applyTranslations();
    applyInventorySidebarState();
    setSelectedMarketItem(selectedMarketItem);
    const s = await api("/api/state");
    render(s);
    updateRecipeInfo();
  } catch (err) {
    log("❌ Could not reach the game server: " + err.message, "log-err");
    log("Make sure Flask is running: PYTHONPATH=src python main.py", "log-err");
  }
})();
