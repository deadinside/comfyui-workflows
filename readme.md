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
- No custom nodes required, only beta nodes

This workflow works as intended. Though there appears to be issues with comfy and ace and I am forced into lowvram for this. I had built this 2 days ago, but figured it was some issue with floating that duration, but it in fact is a problem with my machine/comfyui or something when it comes to Ace Step and memory.

## Folder Structure