import { toJSONSchema, type ZodType } from "zod/v4";

/**
 * Keywords accepted by Gemini generateContent `responseJsonSchema`.
 * The structured-output guide (ai.google.dev, updated 2026-09-02) lists
 * type, title, description, properties, required, additionalProperties,
 * enum, format, minimum, maximum, items, prefixItems, minItems, and maxItems.
 * `anyOf` is included because Zod emits it for `.nullable()` and Google's
 * structured-output examples use it for conditional schemas.
 * `const` is not in that set. It is rewritten to a one-value `enum` before the check.
 * Not accepted here: oneOf, $ref, $defs, patternProperties, if, then, else,
 * default, pattern, minLength, maxLength, multipleOf, and uniqueItems.
 */
export const GEMINI_SCHEMA_KEYWORDS = [
  "type",
  "title",
  "description",
  "properties",
  "required",
  "additionalProperties",
  "enum",
  "format",
  "minimum",
  "maximum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "anyOf",
] as const;

const SCHEMA_KEYS = new Set<string>(GEMINI_SCHEMA_KEYWORDS);

/** Zod JSON Schema reduced to the Gemini subset. The Zod schema still validates the parsed response. */
export function toProviderJsonSchema(schema: ZodType): Record<string, unknown> {
  return walkSchema(rewriteConst(toJSONSchema(schema))) as Record<string, unknown>;
}

/** Keyword names in a provider schema. Property names under `properties` are not keywords. */
export function jsonSchemaKeywords(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) jsonSchemaKeywords(item, found);
    return found;
  }
  if (!node || typeof node !== "object") return found;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key !== "properties") found.push(key);
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const child of Object.values(value as Record<string, unknown>)) jsonSchemaKeywords(child, found);
      continue;
    }
    jsonSchemaKeywords(value, found);
  }
  return found;
}

function rewriteConst(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rewriteConst);
  if (!node || typeof node !== "object") return node;
  const record = { ...(node as Record<string, unknown>) };
  if (Object.prototype.hasOwnProperty.call(record, "const")) {
    const value = record.const;
    delete record.const;
    if (!Array.isArray(record.enum)) record.enum = [value];
    if (record.type === undefined) record.type = typeForConst(value);
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      const props: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(value as Record<string, unknown>)) props[name] = rewriteConst(child);
      record[key] = props;
      continue;
    }
    if (key === "enum" || key === "required" || key === "type" || key === "additionalProperties" || key === "description" || key === "title" || key === "format") {
      continue;
    }
    record[key] = rewriteConst(value);
  }
  return record;
}

function typeForConst(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return "string";
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
    if (key === "enum" || key === "required" || key === "type" || key === "additionalProperties" || key === "description" || key === "title" || key === "format") {
      out[key] = value;
      continue;
    }
    out[key] = walkSchema(value);
  }
  return out;
}
