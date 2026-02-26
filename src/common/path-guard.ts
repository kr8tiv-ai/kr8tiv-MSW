import path from "node:path";

/**
 * Resolve a requested path and ensure it stays within a trusted base directory.
 * Returns null when input is invalid or escapes the base.
 */
export function resolvePathWithinBase(baseDir: string, requestedPath: string): string | null {
  if (!baseDir || !requestedPath) {
    return null;
  }
  if (requestedPath.includes("\x00")) {
    return null;
  }

  const normalizedBase = path.resolve(path.normalize(baseDir));
  const normalizedRequested = path.normalize(requestedPath);
  const candidate = path.isAbsolute(normalizedRequested)
    ? path.resolve(normalizedRequested)
    : path.resolve(normalizedBase, normalizedRequested);

  const relative = path.relative(normalizedBase, candidate);
  if (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  ) {
    return candidate;
  }

  return null;
}
