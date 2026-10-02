/**
 * Manual comparison run. Not part of CI.
 * node --import tsx scripts/ai-eval/run.mjs --provider <name> --model <id>
 */
const provider = process.argv.find((arg, index) => process.argv[index - 1] === "--provider");
if (!provider) {
  console.log("Manual only. Pass --provider and --model to grade the Dholuo test set later. Not part of CI.");
  process.exit(0);
}
console.error("The graded test set ships with smart search. This script does not call a provider in CI.");
process.exit(1);
