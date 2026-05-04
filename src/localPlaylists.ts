// ---------------- Folder → Local playlist ----------------
import { rebuildMenus } from "./menuBuilder";
import { localPlaylists, save } from "./storage";
import { PlaylistItem } from "./types";
import {
  createM3UContent,
  ensureUniqueName,
  getSafeInternalFilename,
  safeOpen,
} from "./utils";
import { console, core, utils, file } from "./iina";

function isPlayable(filename: string): boolean {
  return /\.(mp4|mkv|avi|mov|mp3|flac|m4a|webm|wmv)$/i.test(filename);
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function joinPath(parent: string, child: string): string {
  if (parent.endsWith("/")) return parent + child;
  return `${parent}/${child}`;
}

function getDirectory(filePath: string): string {
  return filePath.substring(0, filePath.lastIndexOf("/"));
}

function walkDir(dirPath: string): string[] {
  const pathStr = String(dirPath);

  if (!file.exists(pathStr)) return [];

  let entries;
  try {
    entries = file.list(pathStr, { includeSubDir: false });
  } catch (err) {
    console.log(`walkDir: ERROR listing "${pathStr}" ->`, err);
    return [];
  }

  let dirs = [];
  let files = [];
  try {
    dirs = entries
      .filter((e) => e.isDir)
      .sort((a, b) => naturalCompare(a.filename, b.filename));
    files = entries
      .filter((e) => !e.isDir && isPlayable(e.filename))
      .sort((a, b) => naturalCompare(a.filename, b.filename));
  } catch (err) {
    console.log(`walkDir: ERROR filtering/sorting "${pathStr}" ->`, err);
    return [];
  }

  let collected: string[] = [];
  try {
    collected = files.map((f) => joinPath(pathStr, f.filename));
  } catch (err) {
    console.log(`walkDir: ERROR mapping files in "${pathStr}" ->`, err);
  }

  for (const d of dirs) {
    const subPath = joinPath(pathStr, d.filename);
    try {
      const sub = walkDir(subPath);
      collected.push(...sub);
    } catch (err) {
      console.log(`walkDir: ERROR in recursion for "${subPath}" ->`, err);
    }
  }

  return collected;
}

export function refreshAndPlayLocal(pl: PlaylistItem) {
  // 1. Identify where to scan
  let folderPath = pl.scanPath;
  if (!folderPath) {
    folderPath = getDirectory(pl.path);
    console.log(`Migrating playlist scan path to: ${folderPath}`);
  }

  if (!file.exists(folderPath)) {
    core.osd("❌ Original folder not found");
    return;
  }

  core.osd(`Scanning ${pl.title}...`);

  const allFiles = walkDir(folderPath);

  if (allFiles.length === 0) {
    core.osd("⚠️ No files found");
    return;
  }

  // 3. Write to @data to guarantee permissions
  const targetInternalPath = getSafeInternalFilename(pl.title);
  const m3uContent = createM3UContent(allFiles);

  try {
    file.write(targetInternalPath, m3uContent);
  } catch (e) {
    console.log("Write error:", e);
    core.osd("❌ Cache write failed");
    return;
  }

  // 4. Update stored stats
  const oldCount = pl.count;
  pl.count = allFiles.length;
  pl.path = targetInternalPath;
  pl.scanPath = folderPath;
  save("local");

  // 5. Play immediately
  safeOpen(targetInternalPath);

  // 6. Only rebuild menu if the count CHANGED (Prevents crash)
  if (pl.count !== oldCount) {
    core.osd(`▶️ Updated: ${pl.count} items`);
    rebuildMenus();
  } else {
    core.osd(`▶️ Loaded ${pl.count} items`);
  }
}

export async function openFolderAsPlaylist() {
  const folderPath = await utils.chooseFile("Choose contents directory", {
    chooseDir: true,
  });

  if (!folderPath) return;

  const title = ensureUniqueName(
    localPlaylists,
    folderPath.split("/").pop() || "Folder",
  );

  const allFiles = walkDir(folderPath);
  if (allFiles.length === 0) {
    core.osd("⚠️ No playable files found!");
    return;
  }
  const m3uContent = createM3UContent(allFiles);

  // Backup to external (best effort)
  const externalPath = joinPath(folderPath, "playlist.m3u8");
  try {
    file.write(externalPath, m3uContent);
  } catch (e) {
    console.log("Skipping external backup (sandbox)");
  }

  // Save to internal
  const internalPath = getSafeInternalFilename(title);
  file.write(internalPath, m3uContent);

  const newItem: PlaylistItem = {
    title,
    path: internalPath,
    scanPath: folderPath,
    count: allFiles.length,
  };

  localPlaylists.push(newItem);
  save("local");
  safeOpen(internalPath);
  rebuildMenus();
  core.osd(`${allFiles.length} items added`);
}
