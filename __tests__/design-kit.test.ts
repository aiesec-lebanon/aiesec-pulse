import { describe, expect, it } from "vitest";

import { splitOnWord } from "@/components/ui/DisplayTitle";
import { initialsOf, tokensForKind, TOPIC_TONE } from "@/lib/topics-shared";

describe("splitOnWord", () => {
  it("accents a whole word and keeps the rest of the headline intact", () => {
    const parts = splitOnWord("Four hundred volunteers rebuilt a river town", "rebuilt");
    expect(parts.before).toBe("Four hundred volunteers ");
    expect(parts.accent).toBe("rebuilt");
    expect(parts.after).toBe(" a river town");
  });

  it("never accents the middle of a longer word", () => {
    // "on" inside "months" is the failure this guards: an italic fragment
    // mid-word reads as a rendering fault, not as emphasis.
    expect(splitOnWord("Seven months of handover", "on").accent).toBeNull();
  });

  it("matches the first occurrence, and matches case-insensitively", () => {
    const parts = splitOnWord("Reach, and what reach costs", "Reach");
    expect(parts.before).toBe("");
    expect(parts.accent).toBe("Reach");
    expect(parts.after).toBe(", and what reach costs");
  });

  it("takes a word followed by punctuation", () => {
    expect(splitOnWord("One model, copied four times over", "model").accent).toBe("model");
  });

  it("leaves the headline whole when the word is absent or empty", () => {
    // A stale accent after an edit has to be harmless, or every edit becomes a
    // chance to italicise nothing in the middle of a sentence.
    for (const word of ["missing", "", "   ", undefined, null]) {
      const parts = splitOnWord("A headline with no accent", word);
      expect(parts.accent, String(word)).toBeNull();
      expect(parts.before + parts.after, String(word)).toBe("A headline with no accent");
    }
  });

  it("does not let a word of regex punctuation break the match", () => {
    expect(splitOnWord("What (really) changed", "(really)").accent).toBe("(really)");
  });
});

describe("topic colour", () => {
  it("gives every kind its own tone", () => {
    expect(new Set(Object.values(TOPIC_TONE)).size).toBe(Object.keys(TOPIC_TONE).length);
  });

  it("names the four tokens a tone carries", () => {
    expect(tokensForKind("PROGRAMME")).toEqual({
      accent: "var(--topic-programme)",
      fill: "var(--topic-programme-fill)",
      on: "var(--topic-programme-on)",
      text: "var(--topic-programme-text)",
    });
  });
});

describe("initialsOf", () => {
  it("drops the AIESEC prefix, which every entity shares", () => {
    // "AI" on every plate in the network would be a colour code with no code.
    expect(initialsOf("AIESEC in Brazil")).toBe("BR");
    expect(initialsOf("AIESEC Tunisia")).toBe("TU");
  });

  it("takes one letter from each of the first two words", () => {
    expect(initialsOf("AIESEC in Kuala Lumpur")).toBe("KL");
  });

  it("falls back to the first two letters of a single word", () => {
    expect(initialsOf("Egypt")).toBe("EG");
  });
});
