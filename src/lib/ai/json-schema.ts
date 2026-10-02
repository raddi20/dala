import { toJSONSchema, type ZodType } from "zod/v4";

const SCHEMA_KEYS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "anyOf",
  "description",
]);

/**
 * Zod JSON Schema with provider-unsafe keywords removed.
 * Throws if a feature schema uses a keyword Gemini strict mode and OpenAI strict mode do not share.
 */
export function toProviderJsonSchema(schema: ZodType): Record<string, unknown> {
  return walkSchema(toJSONSchema(schema)) as Record<string, unknown>;
}

function walkSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(walkSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "$schema") continue;
    if (!SCHEMA_KEYS.has(key)) throw new Error(`Unsupported JSON Schema keyword "${key}".`);
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      const props: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(value as Record<string, unknown>)) props[name] = walkSchema(child);
      out[key] = props;
      continue;
    }
    if (key === "enum" || key === "required" || key === "type" || key === "additionalProperties" || key === "description") {
      out[key] = value;
      continue;
    }
    out[key] = walkSchema(value);
  }
  return out;
}

export function unsupportedKeywords(schema: ZodType): string[] {
  try {
    toProviderJsonSchema(schema);
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const match = /"([^"]+)"/.exec(message);
    return match ? [match[1]] : ["unknown"];
  }
}
