# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-12-19

### Added

- **Auto-Refresh for Local Playlists:** Clicking a local playlist now automatically scans the original folder for new or deleted files and updates the playlist file (`.m3u8`) and item count before playing.
- **Secure Storage:** Active playlist files are now stored in the plugin's internal data folder to ensure consistent write permissions for updates.
- **Backup Creation:** A static `playlist.m3u8` backup file is created in the source folder when a playlist is first added.
- **Manage Playlists Menu:** A new submenu at the bottom of the plugin list to handle bulk actions.
- **Remove All Options:** - Added option to remove all **Online** playlists (clears list and deletes cached files).
  - Added option to remove all **Local** playlists (clears list only; preserves user files).

### Changed

- **Menu Behavior:** Local playlist menu items now display the file count dynamically after the refresh triggered by clicking them.

## [1.1.0]

### Added

- **Keyboard Shortcut:** Added `Meta+Alt+V` to quickly paste URLs from the clipboard as a new playlist.
- **Item Playback:** Selecting an individual item inside a playlist menu now directly plays that specific file/URL.

## [1.0.0]

### Added

- Initial release.
- Feature: Create local playlists by scanning folder contents (recursive).
- Feature: Create online playlists by parsing URLs from the system clipboard.
- Basic JSON persistence for playlist tracking.
