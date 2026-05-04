AI Image Description Plugin (Gemma 3 / Qwen 3.5 Vision)
A lightweight browser extension that sends any image to ComfyUI and returns a high‑quality natural‑language description using Gemma 3 Vision or Qwen 3.5 Vision models.
Designed for creative workflows, prompt‑building, dataset generation, and image‑to‑image/video pipelines.

✨ Features
Right‑click any image → “AI Image Description”

Sends the image to your ComfyUI server in API mode

Supports Gemma 3 Vision and Qwen 3.5 Vision models

Customizable prompt prefix/suffix for tailored descriptions

Clean popup UI:

“Waiting for response…” state

Final description with Copy to Clipboard

Fully configurable:

ComfyUI URL

Model selection

Custom prompt templates

📦 Requirements
1. ComfyUI running in API mode
Start ComfyUI with:

Code
python main.py --listen --port 8188 --enable-cors-header
The extension communicates with:

POST /prompt

GET /history/<prompt_id>

🧠 Supported Models (6 Total)
Your plugin supports six vision‑capable models — two Qwen 3.5 Vision and four Gemma 3 Vision — all compatible with ComfyUI’s TextGenerate node.

All models include their own vision tower + projector, so no CLIP/SigLIP nodes are required.

Qwen 3.5 Vision Models
Source:
https://huggingface.co/Comfy-Org/Qwen3.5/tree/main/text_encoders

qwen3.5_4b_bf16.safetensors  
Fastest Qwen model, good detail, low VRAM requirement.

qwen3.5_9b_bf16.safetensors  
Higher detail, requires more VRAM.

Gemma 3 Vision Models
Source:
https://huggingface.co/Comfy-Org/ltx-2/tree/main/split_files/text_encoders

All four of these are Gemma 3 IT (vision‑enabled) models:

12B Models
gemma_3_12B_it.safetensors  
Full‑precision 12B — highest quality, heaviest model.

gemma_3_12B_it_fp4_mixed.safetensors  
FP4 mixed precision — excellent balance of speed + quality.

gemma_3_12B_it_fp8_scaled.safetensors  
FP8 scaled — faster than FP4, slightly lower precision, great for mid‑range GPUs.

gemma_3_12B_it_fpmixed.safetensors  
Mixed precision variant — sits between FP4 and FP8 in performance/quality.

Model Comparison Table
Model	VRAM	Speed	Quality	Notes
Qwen 3.5 4B BF16	~6–8GB	Fast	Good	Best Qwen default
Qwen 3.5 9B BF16	~12–14GB	Medium	Very High	High‑end GPUs
Gemma 3 12B IT FP4	~8–10GB	Medium	Very High	Best balance
Gemma 3 12B IT FP8	~10–12GB	Medium	High	Faster than FP4
Gemma 3 12B IT FPMixed	~10–12GB	Medium	High	Between FP4 & FP8
Gemma 3 12B IT Full	~16GB+	Slow	Ultra High	Max quality


Recommended Defaults
Best overall: gemma_3_12B_it_fp4_mixed.safetensors

Best for mid‑range GPUs: gemma_3_12B_it_fp8_scaled.safetensors

Fastest: qwen3.5_4b_bf16.safetensors

Highest detail: gemma_3_12B_it.safetensors

🧩 How It Works
User right‑clicks an image → selects AI Image Description

The extension fetches the image URL or blob

Sends it to ComfyUI using your configured workflow JSON

ComfyUI:

Loads the image

Encodes it using the selected Gemma/Qwen Vision Tower

Generates a natural‑language description

The extension polls /history/<id> until output is ready

The popup displays the final description with a Copy button

⚙️ Extension Settings
The Options page allows you to configure:

ComfyUI URL
Example:
http://127.0.0.1:8188

Model Selection
Choose one of the six supported models.

Custom Prompt Template
Example:

Code
Describe this image in detail. Focus on people, objects, lighting, and environment.
Timeout / Polling Settings
(If included in your build)

📁 Workflow Requirements
Your ComfyUI workflow must include:

Image loader

Gemma/Qwen Vision Tower (automatically selected by model)

TextGenerate node

PreviewAny or SaveText output node

Expected Output Format
The plugin expects ComfyUI’s standard history format:

json
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
Generate prompts for image‑to‑image or video workflows

Describe reference images for style transfer

Extract scene details for creative writing

Build datasets with consistent captions

Assist with accessibility workflows

🔧 Installation
1. Clone this repository
Code
git clone <your-repo-url>
2. Load the extension
Chrome / Edge:

Go to chrome://extensions

Enable Developer Mode

Click Load Unpacked

Select the extension folder

3. Configure settings
Open the extension Options page

Set your ComfyUI URL

Select your model

(Optional) Customize your prompt template

4. Use it
Right‑click any image → AI Image Description

🛠️ Troubleshooting
No response from ComfyUI
Ensure ComfyUI is running with --enable-cors-header

Verify the URL in the Options page

Check that the workflow is valid

Model not found
Place .safetensors files in:

Code
ComfyUI/models/text_encoders/
Long delays
Large models (Gemma 12B Full, Qwen 9B) require more VRAM

Try switching to a smaller model

🗺️ Roadmap
Auto‑detect installed models

Model‑specific prompt presets

Multi‑model fallback (if VRAM is insufficient)

Inline preview of the image being described

Optional “short / medium / long” description modes

📜 License
MIT License 

