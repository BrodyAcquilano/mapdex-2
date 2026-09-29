import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { text, to = "en" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT;
    const key = process.env.AZURE_TRANSLATOR_KEY;
    const region = process.env.AZURE_TRANSLATOR_REGION;

    const response = await fetch(
      `${endpoint}/translate?api-version=3.0&to=${to}`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Ocp-Apim-Subscription-Region": region,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ Text: text }]),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Translator error:", errText);
      return res.status(500).json({ error: "Translation failed" });
    }

    const data = await response.json();

    const translatedText =
      data[0]?.translations[0]?.text || text;

    res.json({ translatedText });

  } catch (err) {
    console.error("Translate route error:", err);
    res.status(500).json({ error: "Translation server error" });
  }
});

export default router;