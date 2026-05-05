import { core, file, console } from "./iina";

/** Subtitle extensions to look for, sorted by preference */
const SUB_EXTENSIONS = [".srt", ".ass", ".ssa", ".vtt"];

/**
 * Given a video file path, find all matching subtitle files in the same directory.
 * A "match" means the subtitle file starts with the video's base name.
 *
 * The subs are sorted so that the exact match (baseName.ext) comes last,
 * making it the default active track when loaded in reverse order.
 */
export function loadSubtitlesFromCurrentDir(url?: string) {
  const currentUrl = url ?? core.status.url;
  if (!currentUrl) return;

  // Only act on local files
  if (!currentUrl.startsWith("file://")) return;

  const filePath = decodeURIComponent(currentUrl.slice(7));
  const lastSlash = filePath.lastIndexOf("/");
  if (lastSlash === -1) return;

  const dir = filePath.substring(0, lastSlash);
  const fullName = filePath.substring(lastSlash + 1);
  const baseName = fullName.replace(/\.[^.]+$/, "");

  // List all entries in the directory
  let entries;
  try {
    entries = file.list(dir, { includeSubDir: false });
  } catch (err) {
    console.log(`subtitleLoader: Cannot list directory "${dir}" -> ${err}`);
    return;
  }

  // Find subtitles that belong to this video
  const matchingSubs: string[] = [];

  for (const entry of entries) {
    if (entry.isDir) continue;

    const entryName = entry.filename;
    const ext = entryName.substring(entryName.lastIndexOf(".")).toLowerCase();

    // Must be a subtitle extension
    if (!SUB_EXTENSIONS.includes(ext)) continue;

    // Must start with the video's base name
    if (!entryName.startsWith(baseName)) continue;

    // What remains after the base name must be either:
    //   - nothing (exact match: "Movie.srt")
    //   - a separator followed by a suffix ("Movie.en.srt", "Movie.commentary.ass")
    const remainder = entryName.substring(baseName.length);
    const isValidRemainder =
      remainder === ext || // exact match: remainder is just ".srt"
      /^[.\-_ ]/.test(remainder); // starts with separator like .en.srt or -commentary.ass

    if (isValidRemainder) {
      matchingSubs.push(`${dir}/${entryName}`);
    }
  }

  if (matchingSubs.length === 0) return;

  // Sort: exact matches LAST (so they're loaded last and become default)
  // Exact match = the filename is exactly baseName + extension
  matchingSubs.sort((a, b) => {
    const nameA = a.substring(a.lastIndexOf("/") + 1);
    const nameB = b.substring(b.lastIndexOf("/") + 1);
    const aIsExact = SUB_EXTENSIONS.some(
      (ext) => nameA === `${baseName}${ext}`,
    );
    const bIsExact = SUB_EXTENSIONS.some(
      (ext) => nameB === `${baseName}${ext}`,
    );

    if (aIsExact && !bIsExact) return 1; // a (exact) goes after b
    if (!aIsExact && bIsExact) return -1; // b (exact) goes after a
    return nameA.localeCompare(nameB); // otherwise alphabetical
  });

  console.log(`Loading ${matchingSubs.length} subtitle(s) for "${fullName}":`);
  for (const subPath of matchingSubs) {
    console.log(`  - ${subPath}`);
    core.subtitle.loadTrack(subPath);
  }

  // Reset subtitle delay
  core.subtitle.delay = 0;
}
