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
function save(type) {
    if (type === "online") {
        file.write(onlinePath, JSON.stringify(onlinePlaylists, null, 2));
    }
    else {
        file.write(localPath, JSON.stringify(localPlaylists, null, 2));
    }
    // We do NOT call rebuildMenus() here automatically if this was triggered
    // by a "Refresh" click, otherwise the menu might flicker or close.
    // We only rebuild if strictly necessary or manually called.
}
function load() {
    if (file.exists(onlinePath)) {
        onlinePlaylists = JSON.parse(file.read(onlinePath) || "[]");
    }
    if (file.exists(localPath)) {
        localPlaylists = JSON.parse(file.read(localPath) || "[]");
    }
}
// ---------------- M3U Generator (New Helper) ----------------
function createM3UContent(files) {
    const header = "#EXTM3U";
    // We create the M3U structure: Header -> (Info Line, Path Line)...
    const lines = files.flatMap((p) => [`#EXTINF:-1, ${getBasename(p)}`, p]);
    return [header, ...lines].join("\n");
}
// ---------------- Menu building ----------------
function rebuildMenus() {
    if (!firstMenuBuild) {
        menu.removeAllItems();
    }
    // --- Standard Actions ---
    menu.addItem(menu.item("Paste URLs as Playlist", playClipboardUrls, {
        keyBinding: "Meta+Alt+v",
    }));
    menu.addItem(menu.item("Open folder & sub-folder contents as Playlist", openFolderAsPlaylist));
    menu.addItem(menu.separator());
    // --- Online Playlists ---
    if (onlinePlaylists.length > 0) {
        const root = menu.item("Online Playlists");
        for (const pl of onlinePlaylists) {
            const entry = menu.item(pl.title, () => {
                utils.open(pl.path);
            });
            entry.addSubMenuItem(menu.item("Play", () => {
                utils.open(pl.path);
            }));
            entry.addSubMenuItem(menu.item("Rename", () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const newName = (_a = utils.prompt("Enter new name")) !== null && _a !== void 0 ? _a : pl.title;
                if (newName) {
                    pl.title = ensureUniqueName(onlinePlaylists, newName);
                    save("online");
                    rebuildMenus();
                }
            })));
            entry.addSubMenuItem(menu.item("Delete", () => __awaiter(this, void 0, void 0, function* () {
                const res = yield utils.ask("Are you sure you want to delete this playlist?");
                if (res) {
                    onlinePlaylists = onlinePlaylists.filter((p) => p.path !== pl.path);
                    file.delete(pl.path);
                    save("online");
                    rebuildMenus();
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
            // CHANGE 1: The main click now calls refreshAndPlayLocal
            const entry = menu.item(`${pl.title} (${pl.count})`, () => refreshAndPlayLocal(pl));
            entry.addSubMenuItem(menu.item("Play (Auto-update)", () => refreshAndPlayLocal(pl)));
            entry.addSubMenuItem(menu.item("Rename", () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const newName = (_a = utils.prompt("Enter new name")) !== null && _a !== void 0 ? _a : pl.title;
                if (newName) {
                    pl.title = ensureUniqueName(localPlaylists, newName);
                    save("local");
                    rebuildMenus();
                }
            })));
            entry.addSubMenuItem(menu.item("Delete", () => __awaiter(this, void 0, void 0, function* () {
                const res = yield utils.ask("Remove this playlist from list? (File remains)");
                if (res) {
                    localPlaylists = localPlaylists.filter((p) => p.path !== pl.path);
                    save("local");
                    rebuildMenus();
                }
            })));
            root.addSubMenuItem(entry);
        }
        menu.addItem(root);
    }
    // --- Global Management (Change 2) ---
    if (onlinePlaylists.length > 0 || localPlaylists.length > 0) {
        menu.addItem(menu.separator());
        const manage = menu.item("Manage Playlists");
        if (onlinePlaylists.length > 0) {
            manage.addSubMenuItem(menu.item("Remove All Online Playlists", () => __awaiter(this, void 0, void 0, function* () {
                if (yield utils.ask("Delete all online playlists?")) {
                    // Delete actual files
                    onlinePlaylists.forEach((pl) => {
                        if (file.exists(pl.path))
                            file.delete(pl.path);
                    });
                    onlinePlaylists = [];
                    save("online");
                    rebuildMenus();
                }
            })));
        }
        if (localPlaylists.length > 0) {
            manage.addSubMenuItem(menu.item("Remove All Local Playlists", () => __awaiter(this, void 0, void 0, function* () {
                if (yield utils.ask("Clear all local playlist entries?")) {
                    // We do not delete local M3U files as they are in user folders
                    localPlaylists = [];
                    save("local");
                    rebuildMenus();
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
        const filePath = `@data/${title}.m3u8`;
        const m3u = "#EXTM3U\n" +
            urls.map((u) => `#EXTINF:-1, ${extractTitle(u)}\n${u}`).join("\n");
        file.write(filePath, m3u);
        onlinePlaylists.push({ title, path: filePath, count: urls.length });
        save("online");
        rebuildMenus();
        utils.open(filePath);
        core.osd(`▶️ ${urls.length} items loaded`);
    });
}
// ---------------- Folder → Local playlist ----------------
// File extension check for playable content
function isPlayable(filename) {
    return /\.(mp4|mkv|avi|mov|mp3|flac|m4a|webm|wmv)$/i.test(filename);
}
// Natural sort comparator (e.g., "1" before "10")
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
// Helper to get directory from a file path
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
function countM3UItems(contents) {
    return contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")).length;
}
// CHANGE 1 (Implementation): Logic to refresh an existing playlist
function refreshAndPlayLocal(pl) {
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Identify the folder. pl.path is ".../Folder/playlist.m3u8", so we need ".../Folder"
        const folderPath = getDirectory(pl.path);
        if (!file.exists(folderPath)) {
            core.osd("❌ Original folder not found");
            return;
        }
        core.osd(`Scanning ${pl.title}...`);
        // 2. Scan for files
        const allFiles = walkDir(folderPath);
        if (allFiles.length === 0) {
            core.osd("⚠️ No files found");
            return;
        }
        // 3. Generate new content and overwrite
        const m3uContent = createM3UContent(allFiles);
        file.write(pl.path, m3uContent);
        // 4. Update internal stats
        const oldCount = pl.count;
        pl.count = allFiles.length;
        save("local"); // Persist the new count to JSON
        // 5. Open
        utils.open(pl.path);
        // 6. Feedback
        if (pl.count !== oldCount) {
            core.osd(`▶️ Updated: ${pl.count} items (was ${oldCount})`);
            rebuildMenus(); // Update the count number in the menu UI
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
        const playlistPath = joinPath(folderPath, "playlist.m3u8");
        // Even if it exists, we might want to refresh it?
        // For now, let's stick to your original logic: if exists, just load it.
        // But we now wire it up to our new refresh logic if it exists but isn't in our list.
        if (file.exists(playlistPath)) {
            const target = localPlaylists.find((item) => item.path === playlistPath);
            if (!target) {
                // It exists on disk, but not in our plugin memory. Add it.
                const content = file.read(playlistPath);
                const count = countM3UItems(content);
                const newItem = { title, count, path: playlistPath };
                localPlaylists.push(newItem);
                save("local");
                rebuildMenus();
                // We immediately run the refresh logic to ensure it's up to date
                refreshAndPlayLocal(newItem);
                return;
            }
            else {
                // It exists and is in memory. Just play (refreshing happens inside)
                refreshAndPlayLocal(target);
                return;
            }
        }
        // New creation logic
        const allFiles = walkDir(folderPath);
        if (allFiles.length === 0) {
            console.log("No playable files found!");
            return;
        }
        // REUSE helper
        const m3uContent = createM3UContent(allFiles);
        file.write(playlistPath, m3uContent);
        localPlaylists.push({ title, path: playlistPath, count: allFiles.length });
        save("local");
        rebuildMenus();
        utils.open(playlistPath);
        core.osd(`${allFiles.length} items added`);
    });
}
// ---------------- Init ----------------
load();
rebuildMenus();
