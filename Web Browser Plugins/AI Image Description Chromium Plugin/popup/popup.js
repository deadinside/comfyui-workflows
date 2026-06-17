// ===========================================================================
// Popup — a VIEW only. All work happens in background.js; the popup reads
// `activeRequest` from storage and live-updates via storage.onChanged, so it
// can be closed and reopened mid-request without losing anything.
// ===========================================================================

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  els.status = document.getElementById("status");
  els.output = document.getElementById("output");
  els.copyBtn = document.getElementById("copyBtn");
  els.thumb = document.getElementById("thumb");
  els.progressWrap = document.getElementById("progressWrap");
  els.progressBar = document.getElementById("progressBar");
  els.historyList = document.getElementById("historyList");

  // Dark mode
  const { darkMode } = await chrome.storage.sync.get("darkMode");
  if (darkMode) document.body.classList.add("dark");

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Initial render
  const { activeRequest } = await chrome.storage.local.get("activeRequest");
  renderCurrent(activeRequest);
  renderHistory();

  // Live updates while the popup is open
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.activeRequest) {
      renderCurrent(changes.activeRequest.newValue);
    }
    if (area === "local" && changes.history) {
      renderHistory();
    }
  });
});

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === name)
  );
  document.getElementById("panel-current").classList.toggle("hidden", name !== "current");
  document.getElementById("panel-history").classList.toggle("hidden", name !== "history");
}

// ---------------------------------------------------------------------------
// Current request
// ---------------------------------------------------------------------------

function renderCurrent(req) {
  if (!req) {
    els.status.textContent = "No request yet. Right-click an image → AI Image Description.";
    els.output.textContent = "";
    els.output.style.display = "none";
    els.thumb.style.display = "none";
    els.progressWrap.style.display = "none";
    els.copyBtn.style.display = "none";
    return;
  }

  // Thumbnail
  if (req.thumbnail) {
    els.thumb.src = req.thumbnail;
    els.thumb.style.display = "block";
  } else {
    els.thumb.style.display = "none";
  }

  els.status.textContent = req.statusText || req.status;
  els.status.classList.toggle("error", req.status === "error");

  // Progress bar
  const inFlight = req.status === "uploading" || req.status === "queued" || req.status === "running";
  els.progressWrap.style.display = inFlight ? "block" : "none";
  if (inFlight) {
    if (req.progress && req.progress.max) {
      const pct = Math.round((req.progress.value / req.progress.max) * 100);
      els.progressBar.classList.remove("indeterminate");
      els.progressBar.style.width = pct + "%";
    } else {
      els.progressBar.classList.add("indeterminate");
    }
  }

  // Output — only shown once there's a result or an error to display.
  if (req.status === "error") {
    els.output.textContent = req.error || "Something went wrong.";
    els.output.classList.add("error");
    els.output.style.display = "block";
    els.copyBtn.style.display = "none";
  } else if (req.status === "done") {
    els.output.textContent = req.result || "No description returned.";
    els.output.classList.remove("error");
    els.output.style.display = "block";
    els.copyBtn.style.display = "block";
    els.copyBtn.onclick = () => copyText(els.copyBtn, req.result || "");
  } else {
    els.output.textContent = "";
    els.output.classList.remove("error");
    els.output.style.display = "none";
    els.copyBtn.style.display = "none";
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

async function renderHistory() {
  const { history = [] } = await chrome.storage.local.get("history");
  els.historyList.innerHTML = "";

  if (history.length === 0) {
    els.historyList.innerHTML = '<div class="hist-empty">No history yet.</div>';
    return;
  }

  for (const item of history) {
    els.historyList.appendChild(buildHistoryItem(item));
  }
}

function buildHistoryItem(item) {
  const wrap = document.createElement("div");
  wrap.className = "hist-item";

  const head = document.createElement("div");
  head.className = "hist-head";

  const img = document.createElement("img");
  img.className = "hist-thumb";
  if (item.thumbnail) img.src = item.thumbnail;
  head.appendChild(img);

  const meta = document.createElement("div");
  meta.className = "hist-meta";
  meta.innerHTML =
    `<div class="model">${escapeHtml(prettyModel(item.model))}</div>` +
    `<div>${formatDate(item.finishedAt || item.startedAt)}</div>` +
    `<div>${escapeHtml(truncate(item.prompt, 70))}</div>`;
  head.appendChild(meta);
  wrap.appendChild(head);

  const snippet = document.createElement("div");
  snippet.className = "hist-snippet hist-result";
  snippet.textContent = item.result || "(no result)";
  snippet.title = "Click to expand / collapse";
  snippet.addEventListener("click", () => snippet.classList.toggle("expanded"));
  wrap.appendChild(snippet);

  const actions = document.createElement("div");
  actions.className = "hist-actions";

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => copyText(copyBtn, item.result || ""));

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => deleteHistory(item.id));

  actions.appendChild(copyBtn);
  actions.appendChild(delBtn);
  wrap.appendChild(actions);

  return wrap;
}

async function deleteHistory(id) {
  const { history = [] } = await chrome.storage.local.get("history");
  await chrome.storage.local.set({ history: history.filter(h => h.id !== id) });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("clearBtn").addEventListener("click", async () => {
    await chrome.storage.local.set({ history: [] });
  });
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = original), 1200);
  });
}

function prettyModel(model) {
  if (!model) return "Unknown model";
  return model.replace(/\.safetensors$/, "");
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
