// system/voice/VoicePipeline.js

import { createVoice } from "./CreateVoice";
import { translateText } from "./translation-adapters/translationService";
import { aiApi } from "../../api/aiApi";

function isEnglishLanguageTag(lang) {
  return typeof lang === "string" && lang.toLowerCase().startsWith("en");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function findDirectCommandMatch(input, commands) {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return null;

  for (const cmd of commands) {
    const canonical =
      typeof cmd.command === "string" ? cmd.command.trim() : "";
    if (!canonical) continue;

    if (normalizeText(canonical) === normalizedInput) {
      return canonical;
    }

    if (Array.isArray(cmd.aliases)) {
      const matchedAlias = cmd.aliases.find(
        (alias) =>
          typeof alias === "string" &&
          normalizeText(alias) === normalizedInput
      );

      if (matchedAlias) {
        return canonical;
      }
    }
  }

  return null;
}

export function createVoicePipeline({
  system,
  plan = "free",
  language = "auto",
}) {
  let pipelinePlan = plan;

  const voice = createVoice({ system, plan });

  voice.setAdapterLanguage?.(language);

  voice.setTranscriptHandler(async (payload) => {
    const { text, language: detectedLang } =
      typeof payload === "string"
        ? { text: payload, language: "en-US" }
        : payload;

    let processedText = text;

    system.notify(`Heard: ${text}`);

    const commands = voice.getCommands();

    const directRawMatch = findDirectCommandMatch(processedText, commands);
    if (directRawMatch) {
      processedText = directRawMatch;

      const handled = voice.executeCommand(processedText);
      if (!handled) {
        system.notify("Command not recognized.");
      }

      return;
    }

    if (pipelinePlan === "paid") {
      if (detectedLang && !isEnglishLanguageTag(detectedLang)) {
        try {
          processedText = await translateText(text, "en");
          system.notify(`Translated: ${processedText}`);
        } catch {
          system.notify("Translation failed.");
        }
      }

      const directTranslatedMatch = findDirectCommandMatch(
        processedText,
        commands
      );

      if (directTranslatedMatch) {
        processedText = directTranslatedMatch;
      } else {
        try {
          const availableCommands = commands
            .filter(
              (cmd) => typeof cmd.command === "string" && cmd.command.length
            )
            .map(({ command, aliases }) => ({
              command,
              aliases: Array.isArray(aliases) ? aliases : [],
            }));

          const { success, data, message } = await aiApi.interpretCommand({
            capturedInput: processedText,
            availableCommands,
          });

          if (
            success &&
            typeof data?.command === "string" &&
            data.command.trim()
          ) {
            processedText = data.command.trim();
            system.notify(`Interpreted: ${processedText}`);
          } else if (!success) {
            system.notify(message || "AI command interpretation failed.");
          }
        } catch {
          system.notify("AI command interpretation failed.");
        }
      }
    }

    const handled = voice.executeCommand(processedText);

    if (!handled) {
      system.notify("Command not recognized.");
    }
  });

  return {
    ...voice,
    setLanguage(lang) {
      voice.setAdapterLanguage?.(lang);
    },
    setPlan(nextPlan) {
      pipelinePlan = nextPlan;
      voice.setPlan?.(nextPlan);
    },
    getLanguageOptions() {
      return voice.getLanguageOptions?.() || [];
    },
    getAutoDetectLanguages() {
      return voice.getAutoDetectLanguages?.() || [];
    },
  };
}