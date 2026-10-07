import { z } from "zod";
import { randomUUID } from "node:crypto";

export const VERSION = "1.0.0";
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export class SiftError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const limitsSchema = z.object({
  pages: z.number().int().min(1).max(500).default(50),
  depth: z.number().int().min(0).max(6).default(3),
  concurrency: z.number().int().min(1).max(2).default(2),
  retention: z.number().int().min(2).max(20).default(2),
});
export const sourceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().url().max(2048),
  allowed_paths: z
    .array(
      z
        .string()
        .min(1)
        .max(500)
        .refine(
          (p) => p.startsWith("/") && !/[?#\\]/.test(p),
          "Use absolute URL paths without query, fragment or backslash",
        ),
    )
    .min(1)
    .max(20),
  version: z.string().trim().min(1).max(100).nullable().optional(),
  limits: limitsSchema.default({
    pages: 50,
    depth: 3,
    concurrency: 2,
    retention: 2,
  }),
});
export type SourceInput = z.infer<typeof sourceSchema>;
export type Source = SourceInput & {
  id: string;
  collection_id: string;
  origin: string;
  created_at: string;
  last_checked: string | null;
  last_success: string | null;
  status: string;
  version_provenance: string | null;
};
export const searchSchema = z.object({
  collection_id: z.string().uuid(),
  query: z.string().trim().min(1).max(500),
  source_id: z.string().uuid().optional(),
  version: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(20).default(10),
  cursor: z.string().max(1000).optional(),
});
export const readSchema = z.object({
  collection_id: z.string().uuid(),
  document_id: z.string().uuid(),
  revision_id: z.string().uuid().optional(),
  cursor: z.string().max(1000).optional(),
  max_chars: z.number().int().min(100).max(20000).default(12000),
});
export const changesSchema = z.object({
  collection_id: z.string().uuid(),
  since: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(30),
  cursor: z.string().max(1000).optional(),
});
export function safeMessage(e: unknown): string {
  if (e instanceof SiftError) return e.message;
  if (e instanceof z.ZodError)
    return e.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join(";");
  const message = e instanceof Error ? e.message : String(e);
  if (/locked|busy/i.test(message))
    return "Database is busy. Retry after the current operation finishes.";
  if (/full|ENOSPC/i.test(message))
    return "Disk is full. Free space before retrying. The operation did not complete.";
  return "Operation failed. Run sift doctor and check local permissions and available disk space.";
}
