chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "AIDescribe",
    title: "AI Image Description",
    contexts: ["image"]
  });

  chrome.contextMenus.create({
    id: "preset1",
    title: "Img 2 Img Prompt",
    contexts: ["action"]
  });

  chrome.contextMenus.create({
    id: "preset4",
    title: "AI Image Error Detection",
    contexts: ["action"]
  });

  chrome.contextMenus.create({
    id: "preset2",
    title: "Img 2 Motion Aware Video Prompt",
    contexts: ["action"]
  });

  chrome.contextMenus.create({
    id: "preset3",
    title: "OCR Text Reader",
    contexts: ["action"]
  });

  chrome.contextMenus.create({
    id: "Custom",
    title: "Custom Prompt - Set in Options",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Handle preset selection
  if (info.menuItemId === "preset1") {
    chrome.storage.sync.set({
      customPrompt:
        "Describe this image in extreme detail, including subject appearance, clothing, pose, expression, background elements, lighting, camera angle, composition, color palette, and overall aesthetic style. Use precise, descriptive language suitable for AI image generation prompts. Do not use vague terms. Only return the prompts itself."
    });
    return;
  }

  if (info.menuItemId === "preset2") {
    chrome.storage.sync.set({
      customPrompt:
        "Analyze this image as the starting frame for an image-to-video sequence. Do not restate or reinterpret the static elements already visible. Instead, describe the most natural next movements and micro-actions that would occur in the next five to ten seconds based strictly on posture, gaze direction, physical context, and environmental cues. Describe how the subject transitions from stillness into motion, including subtle gestures, shifts in weight, head movement, or changes in expression. Specify how the camera should behave-such as a slow push-in, a handheld follow, or a slight pan-using clear cinematic language. Describe the lighting continuity, atmosphere, and any natural environmental motion such as drifting dust, flickering light, or moving reflections. If relevant, describe ambient audio cues such as room tone, wind, footsteps, or environmental noise, but do not add dialogue. Provide the final output as a single, flowing, motion-aware video prompt written in present tense, with no extra commentary or reasoning. Tips for the prompt: What Works Well: Cinematic compositions Wide, medium, and close-up shots with thoughtful lighting, shallow depth of field, and natural motion.Emotive human moments: Strong single-subject emotional expressions, subtle gestures, and facial nuance. Atmosphere & setting: Fog, mist, golden-hour light, rain, reflections, ambient textures. Clear camera language: Explicit instructions like “slow dolly in” or “handheld tracking”. Stylized aesthetics: Painterly, noir, analog film, fashion editorial, pixelated animation. Lighting & mood control: Backlighting, color palettes, rim light, flickering lamps. What to Avoid: Internal emotional states: Use visual cues instead of labels like “sad” or “confused”. Text and logos: Readable text is not currently reliable. Complex physics: Chaotic motion can introduce artifacts (dancing is OK). Overloaded scenes: Too many characters or actions reduce clarity. Conflicting lighting: Mixed light logic confuses scene interpretation. Overcomplicated prompts: Start simple and layer complexity gradually. Present the prompt instructions only."
    });
    return;
  }

  if (info.menuItemId === "preset3") {
    chrome.storage.sync.set({
      customPrompt:
        "Read all visible text in this image exactly as written. Preserve line breaks, punctuation, headings, and formatting where possible. Do not summarize, interpret, or add commentary. If the text is partially cut off or unclear, transcribe only the readable portion without guessing. Return the result as a clean, plain-text transcription."
    });
    return;
  }

    if (info.menuItemId === "preset4") {
    chrome.storage.sync.set({
      customPrompt:
        "You are an image‑analysis model. Examine the provided image and detect AI‑generation mistakes with strict visual grounding. Focus on human anatomy issues such as incorrect finger count, fused or missing fingers, distorted hands or limbs, unnatural joint angles, facial asymmetry, misaligned eyes, or proportion errors. Also check for general AI artifacts including warped or duplicated objects, repeating textures, impossible reflections or shadows, distorted backgrounds, broken perspective, or clothing and texture glitches. Report only what is visibly confirmed in the image and avoid speculation or artistic description. If mistakes are present, list them clearly under ‘Mistakes:’ using bullet points; if none are found, output only ‘No mistakes detected.’ Follow this format exactly and do not add commentary or suggestions."
    });
    return;
  }


  // Custom preset: do NOT overwrite customPrompt
  if (info.menuItemId === "Custom") {
    // Nothing to set — user’s saved custom prompt stays as-is
    return;
  }

  // Handle the actual image request
  if (info.menuItemId === "AIDescribe") {
    const imageUrl = info.srcUrl;
    const { llmUrl } = await chrome.storage.sync.get("llmUrl");

    await chrome.storage.local.set({
      pendingRequest: {
        imageUrl,
        llmUrl,
        presetId: info.menuItemId // pass through for popup.js
      }
    });

    chrome.action.openPopup();
  }
});