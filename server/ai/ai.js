// routes/ai.js

import express from "express";
import { ClientSecretCredential } from "@azure/identity";

const router = express.Router();

const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID,
  process.env.AZURE_CLIENT_ID,
  process.env.AZURE_CLIENT_SECRET
);

router.post("/interpret-command", async (req, res) => {
  try {
    const { capturedInput, availableCommands } = req.body ?? {};

    if (typeof capturedInput !== "string" || !Array.isArray(availableCommands)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload.",
      });
    }

    const cleanedCommands = availableCommands
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        command: typeof item.command === "string" ? item.command.trim() : "",
        aliases: Array.isArray(item.aliases)
          ? item.aliases.filter((alias) => typeof alias === "string")
          : [],
      }))
      .filter((item) => item.command.length);

    if (!cleanedCommands.length) {
      return res.status(400).json({
        success: false,
        message: "No valid commands provided.",
      });
    }

    const token = await credential.getToken("https://ai.azure.com/.default");

    if (!token?.token) {
      console.error("[AI INTERPRETER] Failed to acquire Azure access token.");
      return res.status(500).json({
        success: false,
        message: "AI command interpretation failed.",
      });
    }

    const response = await fetch(process.env.FOUNDRY_RESPONSES_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.token}`,
      },
      body: JSON.stringify({
        input: JSON.stringify({
          capturedInput,
          availableCommands: cleanedCommands,
        }),
      }),
    });

    let data = null;
    let rawText = "";

    try {
      rawText = await response.text();
      data = rawText ? JSON.parse(rawText) : null;
    } catch (parseError) {
      console.error("[AI INTERPRETER] Failed to parse Foundry response:", {
        status: response.status,
        statusText: response.statusText,
        parseError: parseError?.message,
        rawText,
      });

      return res.status(502).json({
        success: false,
        message: "AI command interpretation failed.",
      });
    }

    if (!response.ok) {
      console.error("[AI INTERPRETER] Foundry request failed:", {
        status: response.status,
        statusText: response.statusText,
        error: data?.error || null,
        data,
      });

      return res.status(502).json({
        success: false,
        message: "AI command interpretation failed.",
      });
    }

    const output = data?.output?.[0]?.content?.[0]?.text?.trim?.() || "";

    const validCommands = new Set(
      cleanedCommands
        .map((item) => item.command)
        .filter((value) => typeof value === "string" && value.length)
    );

    const command = validCommands.has(output)
      ? output
      : "command not recognized";

    return res.json({
      success: true,
      command,
    });
  } catch (error) {
    console.error("[AI INTERPRETER] Unexpected server error:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });

    return res.status(500).json({
      success: false,
      message: "AI command interpretation failed.",
    });
  }
});

export default router;