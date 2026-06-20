# Playlist Pro — IINA Plugin

**Playlist Pro** is a plugin for [IINA](https://iina.io/) that allows seamless management of both Online and Local playlists. It empowers users to quickly play, rename, and delete playlists, and provides full folder scanning including nested directories for local media files.

---

## Features

### 🌍 Online Playlists

- **Smart Paste:** Instantly create playlists by parsing URLs from your clipboard.
- **Shortcut:** Use `Cmd+Opt+V` (Meta+Alt+V) to create a playlist immediately without opening the menu.

### 📂 Local Playlists (Auto-Updating)

- **Folder Scanning:** Automatically discover all playable media in a selected folder and its subfolders.
- **Auto-Refresh:** Simply click an existing playlist in the menu to re-scan the folder. If you've added or removed files, the playlist updates automatically before playing.
- **Missing Folder Recovery:** If a playlist's source folder has been moved or deleted, you'll be prompted to relocate it or remove the playlist from your list.

### 🎞️ Subtitles

- **Auto-Load:** External subtitle files (`.srt`, `.ass`, `.ssa`, `.vtt`) in the same directory as the video are automatically loaded when playback starts. Language-specific and commentary tracks are supported.

### 🛠 Management

- **Quick Actions:** Rename or delete individual playlists directly from the menu.
- **Bulk Management:** Use the "Manage Playlists" submenu to clear all local or online entries at once.

---

## Installation

To install the plugin directly from GitHub:

1. Open **IINA**.
2. From the **top menu**, select **Plugins → Manage Plugins…**.
3. Click **Install from GitHub**.
4. Enter the repository URL:

```
https://github.com/CatCodeDanix/iina-playlist-pro
```

5. The plugin will download and install automatically.

---

## Usage

### Creating an Online Playlist

1. Copy a list of video URLs (one per line).
2. Press `Cmd+Opt+V` (or select "Paste URLs as Playlist" from the plugin menu).
3. The playlist is created and starts playing immediately.

### Creating a Local Playlist

1. Select "Open folder & sub-folder contents as Playlist".
2. Choose a directory on your computer.
3. The plugin generates a unified playlist of all media files found inside.

### Updating a Local Playlist

No manual steps required! Just click the playlist name in the menu to play it. The plugin checks the folder for changes and updates the file list instantly.
If the folder can no longer be found (e.g. it was moved or renamed), the plugin will ask whether you'd like to locate it again or remove the playlist.

### ⚠️ Note on Playlist Files

To ensure that playlists can **auto-refresh** without macOS sandbox restrictions, this plugin saves the active `.m3u8` file in IINA's internal data folder (`@data/`).

- **Internal File:** The active file used by the plugin. It updates automatically when you click the playlist menu item.
- **External File:** When you first create a local playlist, a `playlist.m3u8` file is also created in your selected media folder as a backup. Please note that this external file is **static** and will **not** update automatically when you add or remove files.

---

## Supported File Types

The plugin automatically detects the following formats:

- **Video:** `mp4`, `mkv`, `avi`, `mov`, `webm`, `wmv`. `ts`
- **Audio:** `mp3`, `flac`, `m4a`

> **Note:** Local playlists include all supported files found in the selected folder and all nested subfolders.

---

## Contributing

Feel free to submit pull requests or report issues on the [GitHub repository](https://github.com/CatCodeDanix/iina-playlist-pro).
