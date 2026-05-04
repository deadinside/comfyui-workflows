document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("status");
  const output = document.getElementById("output");
  const copyBtn = document.getElementById("copyBtn");

  // Dark mode
  const { darkMode } = await chrome.storage.sync.get("darkMode");
  if (darkMode) {
    document.body.classList.add("dark");
  }

  // Pending request
  const { pendingRequest } = await chrome.storage.local.get("pendingRequest");
  if (!pendingRequest) {
    status.textContent = "No request found.";
    return;
  }

  const { imageUrl, presetId } = pendingRequest;
  chrome.storage.local.remove("pendingRequest");

  // Load settings
  const { comfyUrl, gemmaModel, customPrompt } = await chrome.storage.sync.get([
    "comfyUrl",
    "gemmaModel",
    "customPrompt"
  ]);

  const llmUrl = comfyUrl;

  // Final prompt text (custom or fallback)
  const promptText =
    customPrompt && customPrompt.trim().length > 0
      ? customPrompt.trim()
      : "Describe this image. Describe the people pictured in this image if multiple. In detail, describe the person, the background, the lighting. Stick to only the information asked and do not add extra dialogue. Provide the information back in the form of a detailed image prompt.";

  status.textContent = "Uploading image...";

  //
  // STEP 1 — Fetch the image blob
  //
  let imgBlob;
  try {
    imgBlob = await fetch(imageUrl).then(r => r.blob());
  } catch (err) {
    status.textContent = "Failed to fetch image.";
    output.textContent = err.toString();
    return;
  }

  //
  // STEP 2 — Upload the image to ComfyUI
  //
  let uploadedName;
  try {
    const form = new FormData();
    form.append("image", imgBlob, "upload.png");

    const uploadUrl = llmUrl.replace("/prompt", "/upload/image");
    console.log("UPLOAD URL:", uploadUrl);

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      body: form
    });

    const raw = await uploadRes.text();
    console.log("UPLOAD RAW:", raw);

    const uploadJson = JSON.parse(raw);
    uploadedName = uploadJson.name;

    if (!uploadedName) {
      throw new Error("Upload returned no filename.");
    }
  } catch (err) {
    status.textContent = "Image upload failed.";
    output.textContent = err.toString();
    return;
  }

  status.textContent = "Generating description, please wait...";

  //
  // STEP 3 — Build workflow payload
  //
  const payload = {
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
        "prompt": promptText,
        "max_length": 2048,
        "sampling_mode": "on",
        "sampling_mode.temperature": 0.7,
        "sampling_mode.top_k": 64,
        "sampling_mode.top_p": 0.95,
        "sampling_mode.min_p": 0.05,
        "sampling_mode.repetition_penalty": 1.05,
        "sampling_mode.seed": 0,
        "clip": ["8", 0],
        "image": ["12", 0],
        "image_type": "rgb"
      },
      "class_type": "TextGenerate"
    },
    "8": {
      "inputs": {
        "clip_name": gemmaModel,
        "type": "ltxv",
        "device": "default"
      },
      "class_type": "CLIPLoader"
    },
    "12": {
      "inputs": {
        "image": uploadedName
      },
      "class_type": "LoadImage"
    }
  };

  // Randomize seed if it's 0 (ComfyUI treats 0 as deterministic/cached)
  if (payload["7"].inputs["sampling_mode.seed"] === 0) {
    payload["7"].inputs["sampling_mode.seed"] =
      Math.floor(Math.random() * 9999) + 1;
  }

  //
  // STEP 4 — Send workflow to /prompt
  //
  let promptId;
  try {
    const response = await fetch(llmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: payload })
    });

    const json = await response.json();
    promptId = json.prompt_id;

    if (!promptId) {
      throw new Error("No prompt_id returned from ComfyUI.");
    }
  } catch (err) {
    status.textContent = "Error sending workflow.";
    output.textContent = err.toString();
    return;
  }

  //
  // STEP 5 — Poll /history/<prompt_id>
  //
  status.textContent = "Processing...";

  async function pollForResult() {
    const historyUrl = llmUrl.replace("/prompt", `/history/${promptId}`);
    console.log("HISTORY URL:", historyUrl);

    try {
      const res = await fetch(historyUrl);
      const histText = await res.text();
      console.log("HISTORY RAW:", histText);

      let hist;
      try {
        hist = JSON.parse(histText);
      } catch (err) {
        console.log("History JSON parse error:", err);
        return null;
      }

      const entry = hist[promptId];
      if (!entry) {
        await new Promise(r => setTimeout(r, 1000));
        return pollForResult();
      }

      const node5 = entry.outputs?.["5"];
      if (!node5) {
        await new Promise(r => setTimeout(r, 1000));
        return pollForResult();
      }

      const textArray = node5.text;
      const text = Array.isArray(textArray) ? textArray.join("\n") : textArray;

      if (text) {
        return { text };
      }

    } catch (err) {
      console.log("Polling error:", err);
    }

    await new Promise(r => setTimeout(r, 1000));
    return pollForResult();
  }

  const result = await pollForResult();

  //
  // STEP 6 — Extract text
  //
  const text = result?.text || "No description returned.";

  status.textContent = "Done!";
  output.textContent = text;
  copyBtn.style.display = "block";

  copyBtn.onclick = () => navigator.clipboard.writeText(text);
});