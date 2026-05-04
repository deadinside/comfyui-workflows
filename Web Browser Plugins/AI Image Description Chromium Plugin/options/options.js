document.addEventListener("DOMContentLoaded", async () => {
  const urlInput = document.getElementById("urlInput");
  const modelSelect = document.getElementById("modelSelect");
  const status = document.getElementById("status");
  const testStatus = document.getElementById("testStatus");

  // Load saved settings
  const { comfyUrl, gemmaModel } = await chrome.storage.sync.get([
    "comfyUrl",
    "gemmaModel"
  ]);

  if (comfyUrl) {
    urlInput.value = comfyUrl.replace(/\/prompt.*$/, "");
  }

  if (gemmaModel) {
    modelSelect.value = gemmaModel;
  }

  // Normalize URL into correct /prompt form
  function normalizeUrl(raw) {
    let url = raw.trim();
    url = url.replace(/\/$/, "");        // remove trailing slash
    url = url.replace(/\/prompt.*$/, ""); // remove any accidental /prompt
    return url + "/prompt";
  }

  // Save settings
  document.getElementById("saveBtn").addEventListener("click", () => {
    const cleanUrl = normalizeUrl(urlInput.value);

    chrome.storage.sync.set(
      {
        comfyUrl: cleanUrl,
        gemmaModel: modelSelect.value
      },
      () => {
        status.textContent = "Saved!";
        setTimeout(() => (status.textContent = ""), 1500);
      }
    );
  });

  // Load
const { darkMode } = await chrome.storage.sync.get("darkMode");
document.getElementById("darkModeToggle").checked = !!darkMode;

if (darkMode) {
  document.body.classList.add("dark");
}

// Save
document.getElementById("darkModeToggle").addEventListener("change", e => {
  chrome.storage.sync.set({ darkMode: e.target.checked });
});

// Load
const { customPrompt } = await chrome.storage.sync.get("customPrompt");
document.getElementById("customPrompt").value = customPrompt || "";

// Save
document.getElementById("customPrompt").addEventListener("input", e => {
  chrome.storage.sync.set({ customPrompt: e.target.value });
});
  // Test Connection
  document.getElementById("testBtn").addEventListener("click", async () => {
    const cleanUrl = normalizeUrl(urlInput.value);
    const baseUrl = cleanUrl.replace(/\/prompt$/, "");

    testStatus.style.color = "#444";
    testStatus.textContent = "Testing...";

    try {
      const res = await fetch(baseUrl + "/object_info", { method: "GET" });

      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }

      const json = await res.json();
      if (json) {
        testStatus.style.color = "green";
        testStatus.textContent = "Connected ✓";
      } else {
        throw new Error("Invalid JSON");
      }
    } catch (err) {
      testStatus.style.color = "red";
      testStatus.textContent = "Connection failed ✗";
      console.warn("Connection test error:", err);
    }
  });
});