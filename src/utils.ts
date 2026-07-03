// ---------------- Helpers ----------------
import { utils, file, console } from "./iina";

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

// ---------------- Media Validation ----------------

export async function isPlayableMedia(
  filename: string,
  fullPath: string,
): Promise<boolean> {
  const isMediaExt = /\.(mp4|mkv|avi|mov|mp3|flac|m4a|webm|wmv|ts)$/i.test(
    filename,
  );
  if (!isMediaExt) return false;

  // Conflict resolution: TypeScript vs MPEG-TS
  if (filename.toLowerCase().endsWith(".ts")) {
    let handle;
    try {
      // Open the file natively and read just the first 4KB
      handle = file.handle(fullPath, "read");
      const buffer = handle.read(4096);

      // If the file is smaller than a single standard TS packet, it's not a valid video
      if (!buffer || buffer.length < 188) return false;

      // Scan for the 0x47 (71 in decimal) sync byte pattern.
      // Valid MPEG-TS packets are typically 188, 192, or 204 bytes long.
      const packetSizes = [188, 192, 204];

      for (let i = 0; i <= buffer.length - 188; i++) {
        if (buffer[i] === 0x47) {
          for (const size of packetSizes) {
            if (i + size < buffer.length && buffer[i + size] === 0x47) {
              // We found two sync bytes spaced perfectly.
              // If the file is big enough, check for a 3rd to be absolutely certain.
              if (i + size * 2 < buffer.length) {
                if (buffer[i + size * 2] === 0x47) {
                  return true;
                }
              } else {
                return true;
              }
            }
          }
        }
      }

      return false;
    } catch (err) {
      console.log(`Native byte check failed for ${filename}:`, err);

      const isDevPath = /\/(node_modules|\.git|src|dist|build)\//i.test(
        fullPath,
      );
      return !isDevPath;
    } finally {
      if (handle) {
        try {
          handle.close();
        } catch (closeErr) {
          console.log(`Failed to close file handle for ${filename}:`, closeErr);
        }
      }
    }
  }

  return true;
}
