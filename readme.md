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

### Z Image Turbo – Image Blend Weighted Blend Node Version

- Image-to-image blending workflow using **Z Image Turbo**
- No ControlNet
- Uses a custom node (latent-weighted-blend) here: https://github.com/deadinside/comfyui-custom-nodes/tree/main/comfyui-latent-weighted-blend
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


## Folder Structure