# AI Image Description Plugin (Gemma 3 / Qwen Vision)

A lightweight browser extension that sends any image to ComfyUI and returns a high-quality natural-language description using **Gemma 3 Vision** or **Qwen 3 Vision** models.

Designed for creative workflows, prompt-building, dataset generation, and image-to-image/video pipelines.

---

![MMain UI](ScreenShots\main.png)
![alt text](ScreenShots\Result.png) 
![alt text](ScreenShots\history.png)
![Settings Panel](ScreenShots\Settings.png)

## ✨ Features

- Right-click any image → **“AI Image Description”**
- Sends the image to your ComfyUI server (API mode)
- Supports **Gemma 3 Vision** and **Qwen 3.5 Vision**
- Customizable prompt prefix/suffix
- Clean popup UI:
  - “Waiting for response…” state
  - Final description with **Copy to Clipboard**
- Fully configurable:
  - ComfyUI URL
  - Model selection
  - Custom prompt templates

---

## 📦 Requirements

### 1. ComfyUI (API Mode)

Start ComfyUI with:

python main.py --listen --port 8188 --enable-cors-header

The extension communicates with:

POST /prompt
GET /history/<prompt_id>

🧠 Supported Models (6 Total)
Can use any model as needed or preferred. 
You do not need to download all the models.

All models include their own vision tower + projector
➡️ No CLIP / SigLIP nodes required

### 2. Qwen 3.5 Vision Models (Supported Models)

Source:
https://huggingface.co/Comfy-Org/Qwen3.5/tree/main/text_encoders

qwen3.5_4b_bf16.safetensors
Fastest Qwen model
Good detail
Low VRAM usage

qwen3.5_9b_bf16.safetensors
Higher detail
Higher VRAM requirement

### 2. Gemma 3 Vision Models (Supported Models)

Source:
https://huggingface.co/Comfy-Org/ltx-2/tree/main/split_files/text_encoders

All models are Gemma 3 IT (vision-enabled):

gemma_3_12B_it.safetensors
Full precision
Highest quality
Heaviest model

gemma_3_12B_it_fp4_mixed.safetensors
Best balance (recommended)

gemma_3_12B_it_fp8_scaled.safetensors
Faster than FP4
Slightly lower precision

gemma_3_12B_it_fpmixed.safetensors
Between FP4 and FP8

📊 Model Comparison

| Model | VRAM | Speed | Quality | Notes |
| --- | --- | --- | --- | --- |
| Qwen 3.5 4B BF16 | ~6–8GB | Fast | Good | Best Qwen default |
| Qwen 3.5 9B BF16 | ~12–14GB | Medium | Very High | High‑end GPUs |
| Gemma 3 12B IT FP4 | ~8–10GB | Medium | Very High | Best balance |
| Gemma 3 12B IT FP8 | ~10–12GB | Medium | High | Faster than FP4 |
| Gemma 3 12B IT FPMixed | ~10–12GB | Medium | High | Between FP4 & FP8 |
| Gemma 3 12B IT Full | ~16GB+ | Slow | Ultra High | Max quality |

⭐ Recommended Defaults
Best overall: gemma_3_12B_it_fp4_mixed.safetensors
Mid-range GPUs: gemma_3_12B_it_fp8_scaled.safetensors
Fastest: qwen3.5_4b_bf16.safetensors
Highest detail: gemma_3_12B_it.safetensors

🧩 How It Works
User right-clicks an image → AI Image Description
The background service worker (not the popup) owns the request, so closing or
reopening the popup never loses an in-progress result.
- Fetches the image (URL or blob) and uploads it to ComfyUI
- Sends the request to ComfyUI using workflow JSON
- ComfyUI loads the image, encodes it with the selected vision model, and
  generates a description
- Live progress is read from ComfyUI's WebSocket (/ws), with /history polling
  as a fallback
- The result streams into the popup with a Copy button, and is saved to the
  request History tab

⚙️ Extension Settings
ComfyUI URL

Example:

http://127.0.0.1:8188
Model Selection

Choose one of the six supported models.

Custom Prompt Template

Example:

Describe this image in detail. Focus on people, objects, lighting, and environment.
Optional
Timeout / polling settings (if supported)

📁 Workflow Requirements

Your ComfyUI workflow must include:

Image Loader
Vision Model (auto-selected)
TextGenerate node
PreviewAny or SaveText node

📄 Expected Output Format
{
  "<prompt_id>": {
    "outputs": {
      "node_id": [
        { "text": "..." }
      ]
    }
  }
}

📸 Example Use Cases
Generate prompts for image-to-image/video workflows
Describe reference images for style transfer
Extract scene details for writing
Build caption datasets
Accessibility assistance

🔧 Installation
1. Clone repository
git clone <your-repo-url>
2. Load extension

Chrome / Edge

Go to chrome://extensions
Enable Developer Mode
Click Load Unpacked
Select the extension folder
3. Configure
Open Options page
Set ComfyUI URL
Select model
(Optional) Customize prompt
4. Use

Right-click any image → AI Image Description

🛠️ Troubleshooting
No response from ComfyUI
Ensure --enable-cors-header is enabled
Verify URL in settings
Check workflow validity
Model not found

Place models in:

ComfyUI/models/text_encoders/
Long delays
Large models require more VRAM
Try a smaller model

🗺️ Roadmap
✅ Auto-detect installed models (live from /object_info/CLIPLoader)
✅ Inline image preview (thumbnail in popup + history)
✅ Request history
Model-specific prompt presets
Multi-model fallback
Short / medium / long modes

📜 License

MIT License