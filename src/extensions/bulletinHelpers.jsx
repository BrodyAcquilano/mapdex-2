import React from "react";

const LINK_PATTERN =
  /(https?:\/\/[^\s<>"')\]}]+|www\.[^\s<>"')\]}]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{6,}\d)/g;

function trimTrailingPunctuation(value) {
  if (!value) return value;

  let cleaned = value;
  let trailing = "";

  while (/[),.!?:;]+$/.test(cleaned)) {
    trailing = cleaned.slice(-1) + trailing;
    cleaned = cleaned.slice(0, -1);
  }

  return { cleaned, trailing };
}

function isLikelyUrl(value) {
  return /^https?:\/\/[^\s]+$/i.test(value) || /^www\.[^\s]+$/i.test(value);
}

function isLikelyEmail(value) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i.test(value);
}

function isLikelyPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function buildHref(value) {
  if (isLikelyUrl(value)) {
    return value.startsWith("http") ? value : `https://${value}`;
  }

  if (isLikelyEmail(value)) {
    return `mailto:${value}`;
  }

  if (isLikelyPhone(value)) {
    const normalized = value.replace(/[^\d+]/g, "");
    return `tel:${normalized}`;
  }

  return null;
}

export function renderBulletinText(text) {
  if (!text || typeof text !== "string") return text || "";

  const matches = [...text.matchAll(LINK_PATTERN)];
  if (matches.length === 0) return text;

  const parts = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const fullMatch = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    const { cleaned, trailing } = trimTrailingPunctuation(fullMatch);
    const href = buildHref(cleaned);

    if (href) {
      parts.push(
        <a
          key={`bulletin-link-${index}`}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="bulletin-message-inline-link"
        >
          {cleaned}
        </a>,
      );
    } else {
      parts.push(cleaned);
    }

    if (trailing) {
      parts.push(trailing);
    }

    lastIndex = start + fullMatch.length;
  });

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}