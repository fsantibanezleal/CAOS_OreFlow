// Compatibility entry point for the repository's existing bootstrap workflows.
// New frontend commands use the template-owned scripts/copy-data.mjs directly.
if (process.env.OF_DERIVED?.trim() && !process.env.CAOS_DATA_ROOT?.trim()) {
  process.env.CAOS_DATA_ROOT = process.env.OF_DERIVED.trim();
}
await import('./scripts/copy-data.mjs');
