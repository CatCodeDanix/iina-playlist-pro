const { core, menu, utils, event, playlist, console, file } = iina;

let firstMenuBuild = true;

interface PlaylistItem {
  title: string;
  path: string; // The file we ask IINA to play (External initially, then Internal)
  scanPath?: string; // The actual folder containing the media files
  count: number;
}

let onlinePlaylists: PlaylistItem[] = [];
let localPlaylists: PlaylistItem[] = [];

const onlinePath = "@data/online-playlists.json";
const localPath = "@data/local-playlists.json";

// ---------------- Helpers ----------------

function ensureUniqueName(list: PlaylistItem[], name: string): string {
  let candidate = name;
  let n = 1;
  while (list.some((p) => p.title === candidate)) {
    candidate = `${name} (${n++})`;
  }
  return candidate;
}

// Generates a safe filename for the @data folder
function getSafeInternalFilename(title: string): string {
  // Replaces non-alphanumeric chars with underscore, keeps it clean
  const safeTitle = title.replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_");
  return `@data/local_${safeTitle}.m3u8`;
}

function save(type: "online" | "local") {
  if (type === "online") {
    file.write(onlinePath, JSON.stringify(onlinePlaylists, null, 2));
  } else {
    file.write(localPath, JSON.stringify(localPlaylists, null, 2));
  }
}

function load() {
  if (file.exists(onlinePath)) {
    onlinePlaylists = JSON.parse(file.read(onlinePath) || "[]");
  }
  if (file.exists(localPath)) {
    localPlaylists = JSON.parse(file.read(localPath) || "[]");
  }
}

// ---------------- M3U Generator ----------------

function createM3UContent(files: string[]): string {
  const header = "#EXTM3U";
  const lines = files.reduce<string[]>((acc, p) => {
    acc.push(`#EXTINF:-1, ${getBasename(p)}`);
    acc.push(p);
    return acc;
  }, []);
  return [header, ...lines].join("\n");
}

// ---------------- Menu building ----------------

function rebuildMenus() {
  if (!firstMenuBuild) {
    menu.removeAllItems();
  }

  // --- Standard Actions ---
  menu.addItem(
    menu.item("Paste URLs as Playlist", playClipboardUrls, {
      keyBinding: "Meta+Alt+v",
    })
  );
  menu.addItem(
    menu.item(
      "Open folder & sub-folder contents as Playlist",
      openFolderAsPlaylist
    )
  );

  menu.addItem(menu.separator());

  // --- Online Playlists ---
  if (onlinePlaylists.length > 0) {
    const root = menu.item("Online Playlists");
    for (const pl of onlinePlaylists) {
      const entry = menu.item(pl.title, () => {
        core.open(pl.path);
      });
      entry.addSubMenuItem(
        menu.item("Play", () => {
          core.open(pl.path);
        })
      );
      entry.addSubMenuItem(
        menu.item("Rename", async () => {
          const newName = utils.prompt("Enter new name") ?? pl.title;
          if (newName) {
            pl.title = ensureUniqueName(onlinePlaylists, newName);
            save("online");
            rebuildMenus();
          }
        })
      );
      entry.addSubMenuItem(
        menu.item("Delete", async () => {
          const res = await utils.ask(
            "Are you sure you want to delete this playlist?"
          );
          if (res) {
            onlinePlaylists = onlinePlaylists.filter((p) => p.path !== pl.path);
            if (file.exists(pl.path)) file.delete(pl.path);
            save("online");
            rebuildMenus();
          }
        })
      );
      root.addSubMenuItem(entry);
    }
    menu.addItem(root);
  }

  // --- Local Playlists ---
  if (localPlaylists.length > 0) {
    const root = menu.item("Local Playlists");
    for (const pl of localPlaylists) {
      // AUTO-REFRESH LOGIC: Click updates and plays
      const entry = menu.item(`${pl.title} (${pl.count})`, () =>
        refreshAndPlayLocal(pl)
      );

      entry.addSubMenuItem(
        menu.item("Play (Auto-update)", () => refreshAndPlayLocal(pl))
      );

      entry.addSubMenuItem(
        menu.item("Rename", async () => {
          const newName = utils.prompt("Enter new name") ?? pl.title;
          if (newName) {
            pl.title = ensureUniqueName(localPlaylists, newName);
            save("local");
            rebuildMenus();
          }
        })
      );
      entry.addSubMenuItem(
        menu.item("Delete", async () => {
          const res = await utils.ask("Remove this playlist from list?");
          if (res) {
            localPlaylists = localPlaylists.filter((p) => p.path !== pl.path);
            // Only delete the file if it's inside our plugin data.
            // Never delete the user's external file.
            if (pl.path.startsWith("@data") && file.exists(pl.path)) {
              file.delete(pl.path);
            }
            save("local");
            rebuildMenus();
          }
        })
      );
      root.addSubMenuItem(entry);
    }
    menu.addItem(root);
  }

  // --- Global Management ---
  if (onlinePlaylists.length > 0 || localPlaylists.length > 0) {
    menu.addItem(menu.separator());
    const manage = menu.item("Manage Playlists");

    if (onlinePlaylists.length > 0) {
      manage.addSubMenuItem(
        menu.item("Remove All Online Playlists", async () => {
          if (await utils.ask("Delete all online playlists?")) {
            onlinePlaylists.forEach((pl) => {
              if (file.exists(pl.path)) file.delete(pl.path);
            });
            onlinePlaylists = [];
            save("online");
            rebuildMenus();
          }
        })
      );
    }

    if (localPlaylists.length > 0) {
      manage.addSubMenuItem(
        menu.item("Remove All Local Playlists", async () => {
          if (await utils.ask("Clear all local playlist entries?")) {
            localPlaylists.forEach((pl) => {
              // Only cleanup internal cache files
              if (pl.path.startsWith("@data") && file.exists(pl.path)) {
                file.delete(pl.path);
              }
            });
            localPlaylists = [];
            save("local");
            rebuildMenus();
          }
        })
      );
    }
    menu.addItem(manage);
  }

  if (!firstMenuBuild) {
    menu.forceUpdate();
  }

  firstMenuBuild = false;
}

// ---------------- Clipboard → Online playlist ----------------

function extractUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^https?:\/\//i.test(s));
}

function extractTitle(url: string): string {
  const clean = url.split("?")[0];
  const last = clean.split("/").pop() || "playlist";
  return last.replace(/\.[^.]+$/, "");
}

async function readClipboard(): Promise<string> {
  const res = await utils.exec("/usr/bin/pbpaste", []);
  return res?.stdout?.trim() || "";
}

async function playClipboardUrls() {
  const text = await readClipboard();
  const urls = extractUrls(text);
  if (!urls.length) return core.osd("⚠️ No valid URLs found");

  const title = ensureUniqueName(onlinePlaylists, extractTitle(urls[0]));
  const filePath = getSafeInternalFilename(title);

  const m3u =
    "#EXTM3U\n" +
    urls.map((u) => `#EXTINF:-1, ${extractTitle(u)}\n${u}`).join("\n");
  file.write(filePath, m3u);

  onlinePlaylists.push({ title, path: filePath, count: urls.length });
  save("online");
  rebuildMenus();

  core.open(filePath);
  core.osd(`▶️ ${urls.length} items loaded`);
}

// ---------------- Folder → Local playlist ----------------

function isPlayable(filename: string): boolean {
  return /\.(mp4|mkv|avi|mov|mp3|flac|m4a|webm|wmv)$/i.test(filename);
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function getBasename(
  path: string,
  { withExtension = true }: { withExtension?: boolean } = {
    withExtension: true,
  }
): string {
  const parts = path.split("/");
  const name = parts[parts.length - 1];
  if (withExtension) return name;

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) return name;
  return name.slice(0, dotIndex);
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

// --- The Robust Auto-Refresh Logic ---
async function refreshAndPlayLocal(pl: PlaylistItem) {
  // 1. Identify where to scan
  // If we have a stored scanPath, use it. If not (old playlist), infer it from the old path.
  let folderPath = pl.scanPath;
  if (!folderPath) {
    folderPath = getDirectory(pl.path);
    console.log(`Migrating playlist scan path to: ${folderPath}`);
  }

  // 2. Scan (Read-only usually works fine)
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

  // 3. Write to @data (The Fix)
  // Even if the playlist started externally, we update it in @data to guarantee no permission errors.
  const targetInternalPath = getSafeInternalFilename(pl.title);
  const m3uContent = createM3UContent(allFiles);

  try {
    file.write(targetInternalPath, m3uContent);
  } catch (e) {
    console.log("Write error:", e);
    core.osd("❌ Cache write failed");
    return;
  }

  // 4. Update the stored object
  const oldCount = pl.count;
  pl.count = allFiles.length;
  pl.path = targetInternalPath; // Point to the safe internal file from now on
  pl.scanPath = folderPath; // Ensure we never lose track of the source
  save("local");

  // 5. Play
  core.open(targetInternalPath);

  if (pl.count !== oldCount) {
    core.osd(`▶️ Updated: ${pl.count} items`);
    rebuildMenus();
  } else {
    core.osd(`▶️ Loaded ${pl.count} items`);
  }
}

async function openFolderAsPlaylist() {
  const folderPath = await utils.chooseFile("Choose contents directory", {
    chooseDir: true,
  });

  if (!folderPath) return;

  const title = ensureUniqueName(
    localPlaylists,
    folderPath.split("/").pop() || "Folder"
  );

  const allFiles = walkDir(folderPath);
  if (allFiles.length === 0) {
    core.osd("⚠️ No playable files found!");
    return;
  }
  const m3uContent = createM3UContent(allFiles);

  // Requirement: "Add the playlist in the external path too"
  // We try to write to the external folder initially (usually allowed via chooseFile)
  const externalPath = joinPath(folderPath, "playlist.m3u8");
  try {
    file.write(externalPath, m3uContent);
    console.log("Created external backup:", externalPath);
  } catch (e) {
    console.log("Could not write external file (sandbox), skipping backup.");
  }

  // Requirement: "Name files in data folder correctly"
  // We use the internal path for the plugin's main tracking to ensure future updates work.
  // (Alternatively, we could track the external path initially, but the first refresh
  //  would migrate it anyway. Starting internal is cleaner for the plugin logic).
  const internalPath = getSafeInternalFilename(title);
  file.write(internalPath, m3uContent);

  const newItem: PlaylistItem = {
    title,
    path: internalPath, // Use internal path for reliability
    scanPath: folderPath, // Store source for scanning
    count: allFiles.length,
  };

  localPlaylists.push(newItem);
  save("local");
  rebuildMenus();

  core.open(internalPath);
  core.osd(`${allFiles.length} items added`);
}

// ---------------- Init ----------------

load();
rebuildMenus();
