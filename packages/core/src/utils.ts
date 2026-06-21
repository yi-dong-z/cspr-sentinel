import { createHash, randomUUID } from "node:crypto";

export const createId = (prefix: string): string => `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;

export function stableHash(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export const nowIso = (): string => new Date().toISOString();

export const roundScore = (value: number): number => Math.round(Math.max(0, Math.min(100, value)));
