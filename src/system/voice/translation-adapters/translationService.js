// system/voice/translationService.js

import api from "../../../api/axios.js";

export async function translateText(text, targetLang = "en") {
  try {
    const res = await api.post("/api/translate", {
      text,
      to: targetLang,
    });

    return res.data?.translatedText || text;
  } catch (err) {
    const message =
      err.response?.data?.error || "Translation failed";
    throw new Error(message);
  }
}