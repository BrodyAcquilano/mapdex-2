import express from "express";

const router = express.Router();

router.get("/token", async (req, res) => {
  try {
    const endpoint = process.env.AZURE_SPEECH_ENDPOINT.replace(/\/$/, "");
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!endpoint || !key || !region) {
      return res.status(500).json({ error: "Speech env vars missing" });
    }

    const response = await fetch(
      `${endpoint}/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": "0",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Azure token error:", text);
      return res.status(500).json({ error: "Failed to obtain speech token" });
    }

    const token = await response.text();

    res.json({
      token,
      region,
    });

  } catch (err) {
    console.error("Token route error:", err);
    res.status(500).json({ error: "Speech token error" });
  }
});

export default router;