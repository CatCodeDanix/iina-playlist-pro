var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { core, menu, utils, event, playlist, console, file } = iina;
let firstMenuBuild = true;
let onlinePlaylists = [];
let localPlaylists = [];
const onlinePath = "@data/online-playlists.json";
const localPath = "@data/local-playlists.json";
// ---------------- Helpers ----------------
function ensureUniqueName(list, name) {
    let candidate = name;
    let n = 1;
    while (list.some((p) => p.title === candidate)) {
        candidate = `${name} (${n++})`;
    }
    return candidate;
}
// Generates a safe filename for the @data folder
function getSafeInternalFilename(title) {
    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_");
    return `@data/local_${safeTitle}.m3u8`;
}
function save(type) {
    if (type === "online") {
        file.write(onlinePath, JSON.stringify(onlinePlaylists, null, 2));
    }
    else {
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
// ---------------- Safe Open Helper ----------------
function safeOpen(path) {
    // Resolve full path and use utils.open to behave like a standard file open
    // This prevents the "closing all windows" crash/behavior.
    const fullPath = utils.resolvePath(path);
    utils.open(fullPath);
}
// ---------------- M3U Generator ----------------
function createM3UContent(files) {
    const header = "#EXTM3U";
    const lines = files.reduce((acc, p) => {
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
    // Core actions
    menu.addItem(menu.item("Paste URLs as Playlist", playClipboardUrls, {
        keyBinding: "Meta+Alt+v",
    }));
    menu.addItem(menu.item("Open folder & sub-folder contents as Playlist", openFolderAsPlaylist));
    menu.addItem(menu.separator());
    // --- Online Playlists ---
    if (onlinePlaylists.length > 0) {
        const root = menu.item("Online Playlists");
        for (const pl of onlinePlaylists) {
            // Standard open, no rebuilding needed here
            const entry = menu.item(pl.title, () => {
                safeOpen(pl.path);
            });
            entry.addSubMenuItem(menu.item("Play", () => {
                safeOpen(pl.path);
            }));
            entry.addSubMenuItem(menu.item("Rename", () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const newName = (_a = utils.prompt("Enter new name")) !== null && _a !== void 0 ? _a : pl.title;
                if (newName) {
                    pl.title = ensureUniqueName(onlinePlaylists, newName);
                    save("online");
                    setTimeout(() => rebuildMenus(), 50);
                }
            })));
            entry.addSubMenuItem(menu.item("Delete", () => __awaiter(this, void 0, void 0, function* () {
                const res = yield utils.ask("Are you sure you want to delete this playlist?");
                if (res) {
                    onlinePlaylists = onlinePlaylists.filter((p) => p.path !== pl.path);
                    if (file.exists(pl.path))
                        file.delete(pl.path);
                    save("online");
                    setTimeout(() => rebuildMenus(), 50);
                }
            })));
            root.addSubMenuItem(entry);
        }
        menu.addItem(root);
    }
    // --- Local Playlists ---
    if (localPlaylists.length > 0) {
        const root = menu.item("Local Playlists");
        for (const pl of localPlaylists) {
            // AUTO-REFRESH LOGIC: Checks for new files, updates m3u8, then plays.
            const entry = menu.item(`${pl.title} (${pl.count})`, () => refreshAndPlayLocal(pl));
            entry.addSubMenuItem(menu.item("Play (Auto-update)", () => refreshAndPlayLocal(pl)));
            entry.addSubMenuItem(menu.item("Rename", () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const newName = (_a = utils.prompt("Enter new name")) !== null && _a !== void 0 ? _a : pl.title;
                if (newName) {
                    pl.title = ensureUniqueName(localPlaylists, newName);
                    save("local");
                    setTimeout(() => rebuildMenus(), 50);
                }
            })));
            entry.addSubMenuItem(menu.item("Delete", () => __awaiter(this, void 0, void 0, function* () {
                const res = yield utils.ask("Remove this playlist from list?");
                if (res) {
                    localPlaylists = localPlaylists.filter((p) => p.path !== pl.path);
                    // Only delete internal cache files
                    if (pl.path.startsWith("@data") && file.exists(pl.path)) {
                        file.delete(pl.path);
                    }
                    save("local");
                    setTimeout(() => rebuildMenus(), 50);
                }
            })));
            root.addSubMenuItem(entry);
        }
        menu.addItem(root);
    }
    // --- Global Management ---
    if (onlinePlaylists.length > 0 || localPlaylists.length > 0) {
        menu.addItem(menu.separator());
        const manage = menu.item("Manage Playlists");
        if (onlinePlaylists.length > 0) {
            manage.addSubMenuItem(menu.item("Remove All Online Playlists", () => __awaiter(this, void 0, void 0, function* () {
                if (yield utils.ask("Delete all online playlists?")) {
                    onlinePlaylists.forEach((pl) => {
                        if (file.exists(pl.path))
                            file.delete(pl.path);
                    });
                    onlinePlaylists = [];
                    save("online");
                    setTimeout(() => rebuildMenus(), 50);
                }
            })));
        }
        if (localPlaylists.length > 0) {
            manage.addSubMenuItem(menu.item("Remove All Local Playlists", () => __awaiter(this, void 0, void 0, function* () {
                if (yield utils.ask("Clear all local playlist entries?")) {
                    localPlaylists.forEach((pl) => {
                        if (pl.path.startsWith("@data") && file.exists(pl.path)) {
                            file.delete(pl.path);
                        }
                    });
                    localPlaylists = [];
                    save("local");
                    setTimeout(() => rebuildMenus(), 50);
                }
            })));
        }
        menu.addItem(manage);
    }
    if (!firstMenuBuild) {
        menu.forceUpdate();
    }
    firstMenuBuild = false;
}
// ---------------- Clipboard → Online playlist ----------------
function extractUrls(text) {
    return text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => /^https?:\/\//i.test(s));
}
function extractTitle(url) {
    const clean = url.split("?")[0];
    const last = clean.split("/").pop() || "playlist";
    return last.replace(/\.[^.]+$/, "");
}
function readClipboard() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const res = yield utils.exec("/usr/bin/pbpaste", []);
        return ((_a = res === null || res === void 0 ? void 0 : res.stdout) === null || _a === void 0 ? void 0 : _a.trim()) || "";
    });
}
function playClipboardUrls() {
    return __awaiter(this, void 0, void 0, function* () {
        const text = yield readClipboard();
        const urls = extractUrls(text);
        if (!urls.length)
            return core.osd("⚠️ No valid URLs found");
        const title = ensureUniqueName(onlinePlaylists, extractTitle(urls[0]));
        const filePath = getSafeInternalFilename(title);
        const m3u = "#EXTM3U\n" +
            urls.map((u) => `#EXTINF:-1, ${extractTitle(u)}\n${u}`).join("\n");
        file.write(filePath, m3u);
        onlinePlaylists.push({ title, path: filePath, count: urls.length });
        save("online");
        setTimeout(() => rebuildMenus(), 50);
        safeOpen(filePath);
        core.osd(`▶️ ${urls.length} items loaded`);
    });
}
// ---------------- Folder → Local playlist ----------------
function isPlayable(filename) {
    return /\.(mp4|mkv|avi|mov|mp3|flac|m4a|webm|wmv)$/i.test(filename);
}
function naturalCompare(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
function getBasename(path, { withExtension = true } = {
    withExtension: true,
}) {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    if (withExtension)
        return name;
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex === -1)
        return name;
    return name.slice(0, dotIndex);
}
function joinPath(parent, child) {
    if (parent.endsWith("/"))
        return parent + child;
    return `${parent}/${child}`;
}
function getDirectory(filePath) {
    return filePath.substring(0, filePath.lastIndexOf("/"));
}
function walkDir(dirPath) {
    const pathStr = String(dirPath);
    if (!file.exists(pathStr))
        return [];
    let entries;
    try {
        entries = file.list(pathStr, { includeSubDir: false });
    }
    catch (err) {
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
    }
    catch (err) {
        console.log(`walkDir: ERROR filtering/sorting "${pathStr}" ->`, err);
        return [];
    }
    let collected = [];
    try {
        collected = files.map((f) => joinPath(pathStr, f.filename));
    }
    catch (err) {
        console.log(`walkDir: ERROR mapping files in "${pathStr}" ->`, err);
    }
    for (const d of dirs) {
        const subPath = joinPath(pathStr, d.filename);
        try {
            const sub = walkDir(subPath);
            collected.push(...sub);
        }
        catch (err) {
            console.log(`walkDir: ERROR in recursion for "${subPath}" ->`, err);
        }
    }
    return collected;
}
function refreshAndPlayLocal(pl) {
    return __awaiter(this, void 0, void 0, function* () {
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
        }
        catch (e) {
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
            // We use setTimeout to decouple the UI update from the click event
            setTimeout(() => rebuildMenus(), 100);
        }
        else {
            core.osd(`▶️ Loaded ${pl.count} items`);
        }
    });
}
function openFolderAsPlaylist() {
    return __awaiter(this, void 0, void 0, function* () {
        const folderPath = yield utils.chooseFile("Choose contents directory", {
            chooseDir: true,
        });
        if (!folderPath)
            return;
        const title = ensureUniqueName(localPlaylists, folderPath.split("/").pop() || "Folder");
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
        }
        catch (e) {
            console.log("Skipping external backup (sandbox)");
        }
        // Save to internal
        const internalPath = getSafeInternalFilename(title);
        file.write(internalPath, m3uContent);
        const newItem = {
            title,
            path: internalPath,
            scanPath: folderPath,
            count: allFiles.length,
        };
        localPlaylists.push(newItem);
        save("local");
        setTimeout(() => rebuildMenus(), 50);
        safeOpen(internalPath);
        core.osd(`${allFiles.length} items added`);
    });
}
// ---------------- Init ----------------
load();
rebuildMenus();
