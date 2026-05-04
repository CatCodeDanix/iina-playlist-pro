// ---------------- Helpers ----------------
import { utils } from "./iina";

import { PlaylistItem } from "./types";

export function ensureUniqueName(list: PlaylistItem[], name: string): string {
  let candidate = name;
  let n = 1;
  while (list.some((p) => p.title === candidate)) {
    candidate = `${name} (${n++})`;
  }
  return candidate;
}

// Generates a safe filename for the @data folder
export function getSafeInternalFilename(title: string): string {
  const safeTitle = title.replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_");
  return `@data/local_${safeTitle}.m3u8`;
}

// ---------------- Safe Open Helper ----------------

export function safeOpen(path: string) {
  // Resolve full path and use utils.open to behave like a standard file open
  // This prevents the "closing all windows" crash/behavior.
  const fullPath = utils.resolvePath(path);
  utils.open(fullPath);
}

// ---------------- M3U Generator ----------------

function getBasename(
  path: string,
  { withExtension = true }: { withExtension?: boolean } = {
    withExtension: true,
  },
): string {
  const parts = path.split("/");
  const name = parts[parts.length - 1];
  if (withExtension) return name;

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) return name;
  return name.slice(0, dotIndex);
}

export function createM3UContent(files: string[]): string {
  const header = "#EXTM3U";
  const lines = files.reduce<string[]>((acc, p) => {
    acc.push(`#EXTINF:-1, ${getBasename(p)}`);
    acc.push(p);
    return acc;
  }, []);
  return [header, ...lines].join("\n");
}
