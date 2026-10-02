/**
 * Manual smoke test. Not part of CI.
 * node --import tsx scripts/ai-eval/smoke.mjs --provider gemini|openai|openai_compat
 */
const provider = process.argv.find((arg, index) => process.argv[index - 1] === "--provider");
if (!provider) {
  console.log("Manual only. Pass --provider gemini|openai|openai_compat when a real key is set. Not part of CI.");
  process.exit(0);
}
console.error(`Live smoke for ${provider} is not run from the test script. Set the provider key and call runAi from a shell when keys exist.`);
process.exit(1);
