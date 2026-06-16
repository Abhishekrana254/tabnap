async function refresh() {
  const stats = await chrome.runtime.sendMessage({ type: "GET_STATS" });
  if (!stats) return;
  document.getElementById("activeCount").textContent = stats.active;
  document.getElementById("sleepCount").textContent = stats.sleeping;
  document.getElementById("autoEnabled").checked = stats.autoSuspendEnabled;
  document.getElementById("autoMins").value = stats.autoSuspendMins;
}

document.getElementById("napAll").addEventListener("click", async () => {
  const r = await chrome.runtime.sendMessage({ type: "SUSPEND_ALL" });
  document.getElementById("status").textContent = `Napped ${r.count} tab(s) — RAM freed`;
  refresh();
});

document.getElementById("wakeAll").addEventListener("click", async () => {
  const r = await chrome.runtime.sendMessage({ type: "WAKE_ALL" });
  document.getElementById("status").textContent = `Woke ${r.count} tab(s)`;
  refresh();
});

document.getElementById("autoEnabled").addEventListener("change", (e) => {
  chrome.storage.sync.set({ autoSuspendEnabled: e.target.checked });
});

document.getElementById("autoMins").addEventListener("change", (e) => {
  chrome.storage.sync.set({ autoSuspendMins: Number(e.target.value) || 30 });
});

refresh();
