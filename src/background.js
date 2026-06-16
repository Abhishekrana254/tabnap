const DEFAULTS = {
  autoSuspendMins: 30,
  autoSuspendEnabled: true,
  whitelist: ["mail.google.com", "docs.google.com", "meet.google.com"],
  totalSuspended: 0,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULTS, (cur) => {
    chrome.storage.sync.set({ ...DEFAULTS, ...cur });
  });
  chrome.alarms.create("check-tabs", { periodInMinutes: 5 });
});

function isWhitelisted(url, whitelist) {
  if (!url || url.startsWith("chrome")) return true;
  return whitelist.some((d) => url.includes(d));
}

async function suspendTab(tab) {
  if (!tab.id || tab.active || tab.discarded || tab.audible) return false;
  if (isWhitelisted(tab.url, (await chrome.storage.sync.get(DEFAULTS)).whitelist)) return false;
  try {
    await chrome.tabs.discard(tab.id);
    return true;
  } catch {
    return false;
  }
}

async function suspendInactiveTabs() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  if (!data.autoSuspendEnabled) return 0;

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const now = Date.now();
  const threshold = data.autoSuspendMins * 60 * 1000;
  let count = 0;

  for (const tab of tabs) {
    if (tab.active || tab.pinned) continue;
    const last = tab.lastAccessed || now;
    if (now - last < threshold) continue;
    if (await suspendTab(tab)) count++;
  }

  if (count > 0) {
    await chrome.storage.sync.set({ totalSuspended: data.totalSuspended + count });
  }
  return count;
}

async function suspendAllExceptActive() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabs = await chrome.tabs.query({ currentWindow: true });
  let count = 0;
  for (const tab of tabs) {
    if (tab.id === active?.id || tab.pinned) continue;
    if (await suspendTab(tab)) count++;
  }
  const { totalSuspended = 0 } = await chrome.storage.sync.get({ totalSuspended: 0 });
  await chrome.storage.sync.set({ totalSuspended: totalSuspended + count });
  return count;
}

async function wakeAllTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true, discarded: true });
  for (const tab of tabs) {
    if (tab.id) await chrome.tabs.reload(tab.id);
  }
  return tabs.length;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "check-tabs") suspendInactiveTabs();
});

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.type === "SUSPEND_ALL") {
    suspendAllExceptActive().then((n) => sendResponse({ count: n }));
    return true;
  }
  if (msg.type === "WAKE_ALL") {
    wakeAllTabs().then((n) => sendResponse({ count: n }));
    return true;
  }
  if (msg.type === "GET_STATS") {
    chrome.tabs.query({ currentWindow: true }).then(async (tabs) => {
      const discarded = tabs.filter((t) => t.discarded).length;
      const data = await chrome.storage.sync.get(DEFAULTS);
      sendResponse({
        total: tabs.length,
        sleeping: discarded,
        active: tabs.length - discarded,
        ...data,
      });
    });
    return true;
  }
  return false;
});
