import { describe, expect, test } from "bun:test";
import { tryElementsLogoUrl } from "../lib/tryElementsLogo";

describe("tryElementsLogoUrl", () => {
  test.each([
    ["aws-cognito", "https://www.tryelements.dev/api/logos?name=aws-cognito"],
    ["Instagram", "https://www.tryelements.dev/api/logos?name=instagram"],
    ["amp", "https://www.tryelements.dev/api/logos?name=amp"],
    ["A&B logo", "https://www.tryelements.dev/api/logos?name=a%26b%20logo"],
  ])("builds the official endpoint for %s", (slug, expected) => {
    expect(tryElementsLogoUrl(slug)).toBe(expected);
  });
});
