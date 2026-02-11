import torch
import torch.nn.functional as F

class LatentWeightedBlendResize:
    """
    Weighted latent blend with forced resize.
    Turbo / SD3 / Flux / Video safe.
    No batch logic.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "samples1": ("LATENT",),
                "samples2": ("LATENT",),
                "weight1": (
                    "FLOAT",
                    {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01},
                ),
                "weight2": (
                    "FLOAT",
                    {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01},
                ),
                "width": (
                    "INT",
                    {"default": 1024, "min": 64, "max": 8192, "step": 8},
                ),
                "height": (
                    "INT",
                    {"default": 1024, "min": 64, "max": 8192, "step": 8},
                ),
            }
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "blend"
    CATEGORY = "latent"

    def blend(self, samples1, samples2, weight1, weight2, width, height):
        latent1 = samples1["samples"]
        latent2 = samples2["samples"]

        # --- Safety checks ---
        if latent1.shape[1] != latent2.shape[1]:
            raise ValueError(
                f"Latent channel mismatch: {latent1.shape[1]} vs {latent2.shape[1]}"
            )

        # --- Compute target latent size ---
        latent_h = height // 8
        latent_w = width // 8

        # --- Resize BOTH latents BEFORE blending ---
        latent1 = F.interpolate(
            latent1,
            size=(latent_h, latent_w),
            mode="nearest"
        )

        latent2 = F.interpolate(
            latent2,
            size=(latent_h, latent_w),
            mode="nearest"
        )

        # --- Normalize weights (optional but recommended) ---
        total = weight1 + weight2
        if total > 0:
            weight1 /= total
            weight2 /= total

        # --- Blend ---
        blended = (latent1 * weight1) + (latent2 * weight2)

        return ({"samples": blended},)


NODE_CLASS_MAPPINGS = {
    "LatentWeightedBlendResize": LatentWeightedBlendResize
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LatentWeightedBlendResize": "Latent Weighted Blend (Resize, Turbo Safe)"
}
