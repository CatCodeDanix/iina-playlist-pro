// ---------------- Folder → Local playlist ----------------
import { rebuildMenus } from "./menuBuilder";
import { localPlaylists, save, setPlaylists } from "./storage";
import { PlaylistItem } from "./types";
import {
  createM3UContent,
  ensureUniqueName,
  getSafeInternalFilename,
  safeOpen,
  isPlayableMedia,
} from "./utils";
import { console, core, utils, file } from "./iina";

const BLACKLISTED_DIRS = ["node_modules", ".git", "src", "dist", "build"];

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

async function walkDir(dirPath: string): Promise<string[]> {
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
  let validFiles: string[] = [];

  try {
    dirs = entries
      .filter(
        (e) => e.isDir && !BLACKLISTED_DIRS.includes(e.filename.toLowerCase()),
      )
      .sort((a, b) => naturalCompare(a.filename, b.filename));

    const files = entries.filter((e) => !e.isDir);
    const filePromises = files.map(async (f) => {
      const isPlayable = await isPlayableMedia(
        f.filename,
        joinPath(pathStr, f.filename),
      );
      return isPlayable ? f.filename : null;
    });

    const fileResults = await Promise.all(filePromises);
    for (const result of fileResults) {
      if (result !== null) validFiles.push(result);
    }

    validFiles.sort((a, b) => naturalCompare(a, b));
  } catch (err) {
    console.log(`walkDir: ERROR filtering/sorting "${pathStr}" ->`, err);
    return [];
  }

  let collected: string[] = [];
  try {
    collected = validFiles.map((f) => joinPath(pathStr, f));
  } catch (err) {
    console.log(`walkDir: ERROR mapping files in "${pathStr}" ->`, err);
  }

  const dirPromises = dirs.map(async (d) => {
    const subPath = joinPath(pathStr, d.filename);
    try {
      return await walkDir(subPath);
    } catch (err) {
      console.log(`walkDir: ERROR in recursion for "${subPath}" ->`, err);
      return [];
    }
  });

  const dirResults = await Promise.all(dirPromises);
  for (const sub of dirResults) {
    collected.push(...sub);
  }

  return collected;
}

export async function refreshAndPlayLocal(pl: PlaylistItem) {
  // 1. Identify which folder to scan
  let folderPath = pl.scanPath;
  if (!folderPath) {
    folderPath = getDirectory(pl.path);
    console.log(`Migrating playlist scan path to: ${folderPath}`);
  }

  // Handle missing folder interactively
  if (!file.exists(folderPath)) {
    // Ask user what to do
    const locate = await utils.ask(
      `The folder for playlist "${pl.title}" can no longer be found at:\n` +
        `${folderPath}\n\n` +
        `Would you like to locate it again?`,
    );

    if (locate) {
      // Open directory picker
      const newPath = await utils.chooseFile(
        "Select the new location for this playlist’s folder",
        { chooseDir: true },
      );
      if (!newPath) {
        core.osd("❌ Cancelled – playlist location not updated.");
        return;
      }
      // Update and save the new scan path
      pl.scanPath = newPath;
      save("local");
      folderPath = newPath;
      // Continue to scan the new folder below
    } else {
      // User doesn't want to locate – offer deletion
      const del = await utils.ask(
        `Do you want to remove the playlist "${pl.title}" from the list?`,
      );
      if (del) {
        // Remove from stored array
        setPlaylists(
          "local",
          localPlaylists.filter((p) => p.path !== pl.path),
        );
        // Delete the cached .m3u8 file if it’s inside @data
        if (pl.path.startsWith("@data") && file.exists(pl.path)) {
          file.delete(pl.path);
        }
        save("local");
        rebuildMenus();
        core.osd(`🗑 Playlist "${pl.title}" removed.`);
      } else {
        core.osd("ℹ️ Playlist location unchanged.");
      }
      return; // Stop here – nothing to play
    }
  }

  // 2. Folder exists (original or newly chosen): scan and create M3U
  core.osd(`Scanning ${pl.title}...`);

  const allFiles = await walkDir(folderPath);
  if (allFiles.length === 0) {
    core.osd("⚠️ No files found");
    return;
  }

  const targetInternalPath = getSafeInternalFilename(pl.title);
  const m3uContent = createM3UContent(allFiles);

  try {
    file.write(targetInternalPath, m3uContent);
  } catch (e) {
    console.log("Write error:", e);
    core.osd("❌ Cache write failed");
    return;
  }

  const oldCount = pl.count;
  pl.count = allFiles.length;
  pl.path = targetInternalPath;
  pl.scanPath = folderPath;
  save("local");

  safeOpen(targetInternalPath);

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

  const allFiles = await walkDir(folderPath);
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
