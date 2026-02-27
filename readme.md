# ComfyUI Workflows

A small collection of **ComfyUI workflows**, starting with a lightweight  
**Z Image Turbo image-blend workflow**.

This repository is intentionally minimal and focused on clarity, stability,
and reproducibility.

---

## Included Workflows

### Z Image Turbo – Image Blend (Early Release)

- Image-to-image blending workflow using **Z Image Turbo**
- No ControlNet
- No custom nodes required
- Designed as a clean, stable baseline

This workflow is intended as an **early release / foundation version**.
It does **not** include the custom latent blending node used in later
experimental versions.

---

## Requirements

- ComfyUI
- Z Image Turbo model properly installed

> ⚠️ Models, checkpoints, and LoRAs are **not included** in this repository.

---
### Ace Step 1.5 – Cover (Early Release)

- Music to Music using *Ace Step 1.5*
- Does require Beta Nodes from ComfyUI
- Due to bug in the way Empty Ace Step 1.5 Laten Audio handles Seconds. Removed Video Helper Suite from this workflow

This workflow works as intended. Though there are issues with the way Ace Step handles duration, which is handled by the latent. Hopefully this will be addressed in an update.

### Custom Nodes

# comfyui-latent-weighted-blend

- This is a custom latent blender that allows you to better understand the weighting when mixing latents. This also features a Z Image Turbo safe resize allowing you to set the final output size.


### Qwen LLM ComfyUI Web

- Experimental Web UI to interact with the Qwen 3 workflow from ComfyUI. Comfy v14 is required.
## Folder Structure