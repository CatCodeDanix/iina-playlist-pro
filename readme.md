# Playlist Pro — IINA Plugin

**Playlist Pro** is a plugin for [IINA](https://iina.io/) that allows seamless management of both Online and Local playlists. It empowers users to quickly play, rename, and delete playlists, and provides full folder scanning including nested directories for local media files.

---

## Features

### 🌍 Online Playlists

- **Smart Paste:** Instantly create playlists by parsing URLs from your clipboard.
- **Shortcut:** Use `Cmd+Opt+V` (Meta+Alt+V) to create a playlist immediately without opening the menu.

### 📂 Local Playlists (Auto-Updating)

- **Folder Scanning:** Automatically discover all playable media in a selected folder and its subfolders.
- **Auto-Refresh:** Simply click an existing playlist in the menu to re-scan the folder. If you've added or removed files from your computer, the playlist updates automatically before playing.

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

---

## Supported File Types

The plugin automatically detects the following formats:

- **Video:** `mp4`, `mkv`, `avi`, `mov`, `webm`, `wmv`
- **Audio:** `mp3`, `flac`, `m4a`

> **Note:** Local playlists include all supported files found in the selected folder and all nested subfolders.

---

## Contributing

Feel free to submit pull requests or report issues on the [GitHub repository](https://github.com/CatCodeDanix/iina-playlist-pro).
