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
    rebuildMenus();
}
function load() {
    if (file.exists(onlinePath)) {
        onlinePlaylists = JSON.parse(file.read(onlinePath) || "[]");
    }
    if (file.exists(localPath)) {
        localPlaylists = JSON.parse(file.read(localPath) || "[]");
    }
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
                }
            })));
            entry.addSubMenuItem(menu.item("Delete", () => __awaiter(this, void 0, void 0, function* () {
                const res = yield utils.ask("Are you sure you want to delete this playlist?");
                if (res) {
                    onlinePlaylists = onlinePlaylists.filter((p) => p.path !== pl.path);
                    file.delete(pl.path);
                    save("online");
                }
            })));
            root.addSubMenuItem(entry);
        }
        menu.addItem(root);
    }
    if (localPlaylists.length > 0) {
        const root = menu.item("Local Playlists");
        for (const pl of localPlaylists) {
            const entry = menu.item(pl.title, () => utils.open(pl.path));
            entry.addSubMenuItem(menu.item("Play", () => utils.open(pl.path)));
            entry.addSubMenuItem(menu.item("Rename", () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const newName = (_a = utils.prompt("Enter new name")) !== null && _a !== void 0 ? _a : pl.title;
                if (newName) {
                    pl.title = ensureUniqueName(localPlaylists, newName);
                    save("local");
                }
            })));
            entry.addSubMenuItem(menu.item("Delete", () => __awaiter(this, void 0, void 0, function* () {
                const res = yield utils.ask("Are you sure you want to delete this playlist?");
                if (res) {
                    localPlaylists = localPlaylists.filter((p) => p.path !== pl.path);
                    save("local");
                }
            })));
            root.addSubMenuItem(entry);
        }
        menu.addItem(root);
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
        utils.open(filePath);
        core.osd(`▶️ ${urls.length} items loaded`);
    });
}
// ---------------- Folder → Local playlist ----------------
// File extension check for playable content
function isPlayable(filename) {
    return /\.(mp4|mkv|avi|mov|mp3|flac|m4a)$/i.test(filename);
}
// Natural sort comparator (e.g., "1" before "10")
function naturalCompare(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
// Extract the filename from a full path
function getBasename(path, { withExtension = true } = {
    withExtension: true,
}) {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    if (withExtension)
        return name;
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex === -1)
        return name; // no extension
    return name.slice(0, dotIndex);
}
function joinPath(parent, child) {
    // Safely join parent + child into a proper path
    if (parent.endsWith("/"))
        return parent + child;
    return `${parent}/${child}`;
}
function walkDir(dirPath) {
    const pathStr = String(dirPath); // ensure plain JS string
    let entries;
    try {
        entries = file.list(pathStr, { includeSubDir: false });
    }
    catch (err) {
        console.log(`walkDir: ERROR listing "${pathStr}" ->`, err);
        return [];
    }
    // Separate dirs and playable files, with natural sort
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
        collected = files.map((f) => {
            const filePath = joinPath(pathStr, f.filename); // full path
            return filePath;
        });
    }
    catch (err) {
        console.log(`walkDir: ERROR mapping files in "${pathStr}" ->`, err);
    }
    // Recurse into subdirectories
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
        .split(/\r?\n/) // split by lines
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")).length; // ignore comments, blank lines
}
function openFolderAsPlaylist() {
    return __awaiter(this, void 0, void 0, function* () {
        const folderPath = yield utils.chooseFile("Choose contents directory", {
            chooseDir: true,
        });
        const title = ensureUniqueName(localPlaylists, folderPath.split("/").pop() || "Folder");
        const playlistPath = joinPath(folderPath, "playlist.m3u8");
        if (file.exists(playlistPath)) {
            console.log("Playlist file exists!");
            utils.open(playlistPath);
            const target = localPlaylists.find((item) => item.path === playlistPath);
            const content = file.read(playlistPath);
            const count = countM3UItems(content);
            if (!target) {
                localPlaylists.push({
                    title,
                    count,
                    path: playlistPath,
                });
                save("local");
            }
            return;
        }
        if (!folderPath.toString()) {
            console.log("Folder path corrupted!");
            return;
        }
        const allFiles = walkDir(folderPath);
        if (allFiles.length === 0) {
            console.log("No playable files found in the selected folder!");
            return;
        }
        const header = "#EXTM3U";
        const lines = allFiles.flatMap((p) => [`#EXTINF:-1, ${getBasename(p)}`, p]);
        const m3uContent = [header, ...lines].join("\n");
        file.write(playlistPath, m3uContent);
        localPlaylists.push({ title, path: playlistPath, count: allFiles.length });
        save("local");
        utils.open(playlistPath);
        core.osd(`${allFiles.length} items added`);
    });
}
// ---------------- Init ----------------
load();
rebuildMenus();
