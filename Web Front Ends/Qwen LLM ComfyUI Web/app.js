function apiBase() {
  return document.getElementById("serverInput").value.replace(/\/$/, "");
}
async function loadQwenModels() {
  const res = await fetch(`${apiBase()}/object_info/CLIPLoader`)
  const data = await res.json();

  const select = document.getElementById("modelSelect");
  select.innerHTML = "";

  // Extract the model list from CLIPLoader schema
  const allModels =
    data?.CLIPLoader?.input?.required?.clip_name?.[0] || [];

  // Filter only Qwen models
  const qwenModels = allModels.filter(m =>
    m.toLowerCase().includes("qwen")
  );

  if (qwenModels.length === 0) {
    select.innerHTML = "<option>No Qwen models found</option>";
    return;
  }

  // Populate dropdown
  qwenModels.forEach(model => {
    const opt = document.createElement("option");
    opt.value = model;
    opt.textContent = model;
    select.appendChild(opt);
  });

  // Set default to qwen_3_4b.safetensors if present
  const defaultModel = "qwen_3_4b.safetensors";
  if (qwenModels.includes(defaultModel)) {
    select.value = defaultModel;
  } else {
    // fallback: select first Qwen model
    select.selectedIndex = 0;
  }
}

window.addEventListener("DOMContentLoaded", loadQwenModels);
function splitThink(text) {
  const thinkStart = text.indexOf("<think>");
  const thinkEnd = text.indexOf("</think>");

  if (thinkStart !== -1 && thinkEnd !== -1) {
    return {
      reasoning: text.substring(thinkStart + 7, thinkEnd).trim(),
      result: text.substring(thinkEnd + 8).trim()
    };
  }

  return { reasoning: "", result: text };
}

function addToHistory(promptId, promptText, reasoning, result) {
  const container = document.getElementById("historyContainer");

  const entry = document.createElement("div");
  entry.style.border = "1px solid #333";
  entry.style.marginBottom = "8px";
  entry.style.background = "#1a1a1a";

  const header = document.createElement("div");
  header.textContent = promptId;
  header.style.padding = "8px";
  header.style.cursor = "pointer";
  header.style.background = "#222";
  header.style.fontWeight = "bold";

  const body = document.createElement("div");
  body.style.display = "none";
  body.style.padding = "10px";
  body.style.whiteSpace = "pre-wrap";
  body.innerHTML =
    `<b>Prompt:</b>\n${promptText}\n\n` +
    `<b>Reasoning:</b>\n${reasoning}\n\n` +
    `<b>Result:</b>\n${result}`;

  header.addEventListener("click", () => {
    body.style.display = body.style.display === "none" ? "block" : "none";
  });

  entry.appendChild(header);
  entry.appendChild(body);

  container.prepend(entry); // newest at top
}

async function runLLM() {
  //const userPrompt = document.getElementById("promptInput").value;
  const prompt = document.getElementById("promptInput").value;
  const mlegnth = document.getElementById("maxLengthInput").value

  document.getElementById("llm_reasoning").textContent = "";
  document.getElementById("result").textContent = "";
  showProgress("Starting...");

  const workflow = {
    "5": {
      "inputs": {
        "preview": "",
        "previewMode": null,
        "source": ["7", 0]
      },
      "class_type": "PreviewAny"
    },
    "7": {
      "inputs": {
        "prompt": prompt,
        "max_length": mlegnth,
        "sampling_mode": "on",
        "sampling_mode.temperature": 0.7,
        "sampling_mode.top_k": 64,
        "sampling_mode.top_p": 0.95,
        "sampling_mode.min_p": 0.05,
        "sampling_mode.repetition_penalty": 1.05,
        "sampling_mode.seed": 0,
        "clip": ["8", 0]
      },
      "class_type": "TextGenerate"
    },
    "8": {
      "inputs": {
        "clip_name": document.getElementById("modelSelect").value,
        "type": "ltxv",
        "device": "default"
      },
      "class_type": "CLIPLoader"
    }
  };

  const res = await fetch(`${apiBase()}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow })
  });

  const data = await res.json();
  const promptId = data.prompt_id;

  pollHistory(promptId);
}

async function pollHistory(promptId) {
  const url = `${apiBase()}/history/${promptId}`;

  const interval = setInterval(async () => {
    let res, data;

    try {
      res = await fetch(url);
      data = await res.json();
    } catch (err) {
      console.warn("Polling error:", err);
      return;
    }

    const entry = data[promptId];
    if (!entry) return;

    if (entry.status?.progress !== undefined) {
      const pct = Math.floor(entry.status.progress * 100);
      showProgress(`Processing: ${pct}%`);
    }

    if (entry.outputs && entry.outputs["5"]) {
      clearInterval(interval);
      showProgress("Completed");

      const textArray = entry.outputs["5"].text;
      const text = Array.isArray(textArray) ? textArray.join("\n") : textArray;

      const { reasoning, result } = splitThink(text);

      renderOutput(text);

      addToHistory(promptId, prompt, reasoning, result);
    }
  }, 500);
}

function renderOutput(text) {
  const thinkStart = text.indexOf("<think>");
  const thinkEnd = text.indexOf("</think>");

  let reasoning = "";
  let result = text;

  if (thinkStart !== -1 && thinkEnd !== -1) {
    reasoning = text.substring(thinkStart + 7, thinkEnd).trim();
    result = text.substring(thinkEnd + 8).trim();
  }

  document.getElementById("llm_reasoning").textContent = reasoning;
  document.getElementById("result").textContent = result;
}

function showProgress(msg) {
  let bar = document.getElementById("progress");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "progress";
    bar.style.marginTop = "10px";
    bar.style.color = "#ccc";
    document.getElementById("left").appendChild(bar);
  }
  bar.textContent = msg;
}