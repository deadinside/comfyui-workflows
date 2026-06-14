# Ollama + ComfyUI Chat

A self-hosted, single-page chat interface that combines **Ollama** (LLM) with **ComfyUI** (Flux Klein 2 4B image generation) into one seamless UI. Chat normally, ask for images, upload photos for img2img editing, and manage everything through a built-in settings panel — no build step, no server required.

---

## Features

- **Streaming chat** via Ollama with full conversation history
- **Automatic image generation** — say "generate", "draw", "create", or "edit" and the AI triggers ComfyUI automatically
- **img2img with dual image slots** — load a BASE image (edit target) and an optional REF image (secondary reference)
- **Drag-and-drop** with a split zone: drop left for img2img, drop right to attach to chat
- **Chat history** — sessions are saved to localStorage with images preserved; reload any past conversation
- **Generated image history** — ComfyUI output images are saved per-session and restored when you revisit a conversation
- **Settings panel** — all config persisted in localStorage, no config files needed
- **Model dropdowns** — Ollama models and ComfyUI models/LoRAs are fetched live from their APIs
- **Master prompt editor** — edit or reset the AI system prompt from within the UI
- **Image zoom** — click any image (attached or generated) for a fullscreen lightbox
- **WebP / format support** — all images are normalized to JPEG before sending to Ollama
- **Feed generated images to Ollama** — optional: inject generated images back into the conversation so a vision-capable model can reference them
- **Configurable response timeout** — tune for slower hardware
- Works over LAN (HTTP) via a `crypto.randomUUID` polyfill for non-secure contexts

---

## Requirements

| Service | Notes |
|---|---|
| [Ollama](https://ollama.com/) | Any model; vision models supported |
| [ComfyUI](https://github.com/comfyanonymous/ComfyUI) | API server enabled (default port 8188) |

### ComfyUI Models

These need to be present in your ComfyUI model folders:

| Type | Default filename | Folder |
|---|---|---|
| Diffusion (UNet) | `flux-2-klein-4b-fp8.safetensors` | `models/unet/` |
| CLIP | `qwen_3_4b.safetensors` | `models/clip/` |
| VAE | `flux2-vae.safetensors` | `models/vae/` |

> The model dropdowns in Settings are populated live from ComfyUI — you can switch to any model you have installed.

---

## Setup

**1. Pull an Ollama model**
```
ollama pull <your-model>
```

**2. Start ComfyUI** with the API enabled (it is by default).

**3. Open the app** — just open `index.html` directly in a browser, or serve the folder over HTTP for LAN access:
```
npx serve .
# or
python -m http.server 8080
```

**4. Configure** — open the sidebar (☰) → **Settings** tab and set your Ollama and ComfyUI URLs if they differ from the defaults. Model dropdowns will populate automatically when both services are reachable.

---

## Usage

### Chat
Type normally and press Enter (or Shift+Enter for a new line). The AI responds via Ollama streaming.

### Generating Images
Use any natural language trigger in your message:

> *"generate an image of a sunset over the ocean"*  
> *"draw a portrait of a knight in armor"*  
> *"create a photo of a cat on a windowsill"*  
> *"edit the photo to add snow falling"*

The AI writes a detailed prompt and sends it to ComfyUI automatically. The result appears inline in the chat.

### img2img / Photo Editing

1. Click the **pink image button** in the toolbar to load a BASE image (the edit target — output size matches this image).
2. Optionally click the **green image button** to load a REF image (secondary reference fed alongside the base).
3. Drag thumbnails between BASE and REF slots to swap them.
4. Ask the AI to edit, change, or add something to the photo.

You can also drag and drop images directly onto the window — a split overlay lets you choose between dropping to img2img or attaching to chat.

### File Attachments
Click the **+** button or drag files to the right drop zone to attach images or text files to your next message.

---

## Settings Reference

Open via the **☰** button → **Settings** tab.

### Server Configuration

| Setting | Default | Description |
|---|---|---|
| Ollama Base URL | `http://127.0.0.1:11434` | URL of your Ollama instance |
| ComfyUI Base URL | `http://127.0.0.1:8188` | URL of your ComfyUI instance |
| Ollama Model | *(first available)* | Dropdown populated from your Ollama install |
| Response Timeout | `300` seconds | Increase for slower hardware or large models |
| Feed generated images to Ollama | Off | When enabled, injects generated images back into the conversation context so a vision-capable model can reference them on follow-ups |

### ComfyUI Models

Dropdowns are populated live from ComfyUI's API. Select any model you have installed.

### LoRA Configuration

Up to 4 LoRAs can be chained. All slots are optional — leave them blank (select `— none —`) to skip. Populated from ComfyUI's available LoRA list.

> **Important:** Only use LoRAs trained for the **4B** variant of Flux Klein 2. LoRAs trained on the 9B model are **incompatible** and will not work correctly with the 4B model.

### Generation Defaults

| Setting | Default | Description |
|---|---|---|
| Width | `1024` | Output width for txt2img (img2img uses the source image size) |
| Height | `1024` | Output height for txt2img |
| Steps | `4` | Sampling steps — 4 is fast; increase for quality |

### Generated Image Label
Text shown as an overlay badge on generated images. Leave blank to hide it entirely.

### Master Prompt
View and edit the AI system prompt that controls generation behavior. Shows **Original** or **Custom** status. Use the editor to customize, or restore the default at any time.

---

## Chat History

Conversations are saved automatically to `localStorage` (up to 50 sessions). Open the **☰** sidebar and click the **History** tab to reload any past session. Generated images are restored from ComfyUI output URLs (requires ComfyUI to be running). Attached images you sent are stored as compressed JPEG thumbnails.

---

## File Structure

```
/
├── index.html          — app shell (HTML only, no inline scripts or styles)
├── README.md
├── css/
│   └── style.css       — all styles
└── js/
    └── app.js          — all application logic
```

---

## Notes

- **LAN / HTTP access** — the app works over plain HTTP on a local network. A polyfill handles `crypto.randomUUID()` which browsers restrict to HTTPS-only contexts.
- **Image formats** — attached images (including WebP, AVIF, etc.) are automatically converted to JPEG before being sent to Ollama for maximum compatibility.
- **Vision models** — any Ollama model with vision support can describe attached images and (with "Feed generated images" enabled) reference generated output. Text-only models will ignore image data.
- **Storage** — if `localStorage` quota is exceeded when saving a session, the app automatically falls back to stripping images from that session while preserving the text history.

---

## License

MIT
