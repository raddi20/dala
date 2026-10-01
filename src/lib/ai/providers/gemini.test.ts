import test from "node:test";
import { assertAdapterContract } from "@/lib/ai/providers/contract";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";

test("gemini adapter maps HTTP fixtures", async () => {
  await assertAdapterContract((fetchImpl) => createGeminiProvider({ apiKey: "test", fetchImpl }), {
    url: "generateContent",
    usage: { input: 10, output: 5 },
  });
});
