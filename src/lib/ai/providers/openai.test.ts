import test from "node:test";
import { assertAdapterContract } from "@/lib/ai/providers/contract";
import { createOpenAIProvider } from "@/lib/ai/providers/openai";

test("openai adapter maps HTTP fixtures", async () => {
  await assertAdapterContract((fetchImpl) => createOpenAIProvider({ apiKey: "test", fetchImpl }), {
    url: "/responses",
    usage: { input: 10, output: 5 },
  });
});
