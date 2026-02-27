Perfect. Below is a **clean, professional, open-source release README** suitable for GitHub.
It’s structured, clear, contributor-friendly, and written like a proper public repo release.

---

# ComfyUI Qwen LLM Web Interface

A lightweight local web application that connects to **ComfyUI’s Qwen workflows** via API and provides a simple browser-based interface for interacting with Vision-Language Models (VLM).

This project is designed to stay minimal, local-first, and dependency-light while giving users a clean way to communicate with ComfyUI’s Qwen text encoder workflows.

---

## ✨ Features

* Local web interface (no cloud services)
* Direct API communication with ComfyUI
* Built specifically for Qwen-based workflows
* Works with ComfyUI Desktop and Portable
* Embedded Python launch option
* Standalone Python launch option
* Configurable ComfyUI Server URL (no code editing required)
* Lightweight and easy to modify

---

## 📋 Requirements

### 1️⃣ ComfyUI Version

You must be running:

* **ComfyUI v14 or higher**

Works with:

* Desktop version
* Portable version

Update before installing.

---

### 2️⃣ Required Model

Currently confirmed working with:

`qwen_3_4b.safetensors`

Download from:

Hugging Face
[https://huggingface.co/Comfy-Org/flux2-klein/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors](https://huggingface.co/Comfy-Org/flux2-klein/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors)

Place the file in:

```
ComfyUI/models/text_encoders/
```

Other Qwen variants may work, but only this model has been verified.

---

## ⚙ ComfyUI Configuration

To allow browser-based API interaction, the following must be enabled:

### 🔹 Developer Mode

In ComfyUI:

```
Settings → Enable Developer Mode
```

---

### 🔹 CORS Support

Required for browser communication.

**Desktop Version**

```
Settings → Enable CORS
```

**Portable Version**
Launch with:

```
--enable-cors-header
```

Example:

```
run_nvidia_gpu.bat --enable-cors-header
```

Without CORS enabled, the web UI will not connect.

---

## 🚀 Installation & Launch

This project contains no external Python dependencies beyond what is already available in standard Python.

Folder contents:

```
index.html
app.js
favicon.ico
StartServerComfyEmbeddedPython.bat
StartServerPythonStandalone.bat
```

---

# Launch Options

## 🅰 Option A — Embedded Python (Portable ComfyUI)

Recommended for ComfyUI Portable users.

Place the project folder at the same level as:

```
python_embedded/
ComfyUI/
```

Example:

```
ComfyUI_Portable/
├── ComfyUI/
├── python_embedded/
├── Qwen LLM ComfyUI Web/
│   ├── index.html
│   ├── app.js
│   ├── favicon.ico
│   ├── StartServerComfyEmbeddedPython.bat
│   └── StartServerPythonStandalone.bat
```

Launch:

```
StartServerComfyEmbeddedPython.bat
```

Server runs at:

```
http://localhost:8081
```

---

## 🅱 Option B — Standalone Python

Requirements:

* Python 3.9+
* Python added to PATH

You may place the project folder anywhere.

Launch:

```
StartServerPythonStandalone.bat
```

Then open:

```
http://localhost:8081
```

---

## 🌐 Connecting to ComfyUI

The web interface includes a field labeled:

**ComfyUI Server URL**

This allows users to configure the target ComfyUI instance dynamically.

Default:

```
http://127.0.0.1:8188
```

You may change it to:

```
http://localhost:8188
http://192.168.1.50:8188
```

There is **no need to edit `app.js`** when changing ports or hosts.

---

## 🔄 Workflow Requirements

Your ComfyUI workflow must:

* Use the Qwen text encoder
* Accept prompt input via API
* Be compatible with ComfyUI queue execution

If the workflow is not structured for API execution, it will not respond properly.

---

## 🔐 Security Notice

This project:

* Runs locally
* Does not implement authentication
* Is not hardened for public exposure

If you expose ComfyUI beyond localhost:

* Anyone on that network can execute workflows
* No authentication layer is present
* Use firewall protection and caution

Do not expose directly to the public internet without securing it properly.

---

## 🛠 Troubleshooting

### “Failed to fetch”

Most common causes:

* Developer Mode disabled
* CORS not enabled
* Wrong ComfyUI Server URL
* ComfyUI not running

---

### Model Not Found

Verify:

```
models/text_encoders/qwen_3_4b.safetensors
```

Spelling must match exactly.

---

### Server Does Not Start

Standalone Python:

```
python --version
```

Embedded:

* Ensure correct folder placement
* Ensure `python_embedded` exists

---

## 📦 Architecture Overview

Browser
↓
Local Web Server (Port 8081)
↓
ComfyUI API (Default Port 8188)
↓
Qwen Workflow Execution

Everything runs locally.

No cloud calls.
No telemetry.
No external APIs.

---

## 📌 Roadmap

Potential improvements:

* Multi-model Qwen support
* Workflow auto-detection
* Preset server profiles
* Session memory
* UI polish
* Cross-platform launch scripts
* Linux/macOS support scripts

---

## 🤝 Contributing

Contributions are welcome.

If submitting pull requests:

* Keep dependencies minimal
* Maintain local-first philosophy
* Avoid adding unnecessary frameworks
* Document new features clearly

---

## 📄 License

Add your preferred license here (MIT recommended for maximum flexibility).

---

## ✅ Quick Setup Checklist

* [ ] ComfyUI v14+
* [ ] qwen_3_4b.safetensors installed
* [ ] Developer Mode enabled
* [ ] CORS enabled
* [ ] ComfyUI running
* [ ] Launch web server
* [ ] Open [http://localhost:8081](http://localhost:8081)
* [ ] Set ComfyUI Server URL
* [ ] Test workflow

