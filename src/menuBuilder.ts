import { openFolderAsPlaylist, refreshAndPlayLocal } from "./localPlaylists";
import { addUrlManually, playClipboardUrls } from "./onlinePlaylists";
import { localPlaylists, onlinePlaylists, save, setPlaylists } from "./storage";
import { ensureUniqueName, safeOpen } from "./utils";
import { menu, utils, file } from "./iina";

let firstMenuBuild = true;

// ---------------- Menu building ----------------

export function rebuildMenus() {
  if (!firstMenuBuild) {
    menu.removeAllItems();
  }

  // Core actions
  const onlinePlaylistMenu = menu.item("Add an Online Playlist");
  onlinePlaylistMenu.addSubMenuItem(
    menu.item("Open URLs...", () => {
      addUrlManually();
    }),
  );
  onlinePlaylistMenu.addSubMenuItem(
    menu.item(
      "Paste URLs as Playlist",
      () => {
        playClipboardUrls();
      },
      {
        keyBinding: "Meta+Alt+v",
      },
    ),
  );

  menu.addItem(onlinePlaylistMenu);

  menu.addItem(
    menu.item("Open folder & sub-folder contents as Playlist", () => {
      openFolderAsPlaylist();
    }),
  );

  menu.addItem(menu.separator());

  // --- Online Playlists ---
  if (onlinePlaylists.length > 0) {
    const root = menu.item("Online Playlists");
    for (const pl of onlinePlaylists) {
      // Standard open, no rebuilding needed here
      const entry = menu.item(pl.title, () => {
        safeOpen(pl.path);
      });
      entry.addSubMenuItem(
        menu.item("Play", () => {
          safeOpen(pl.path);
        }),
      );

      const onlinePlaylistRenameHandler = async () => {
        const newName = utils.prompt("Enter new name") ?? pl.title;
        if (newName) {
          pl.title = ensureUniqueName(onlinePlaylists, newName);
          save("online");
          rebuildMenus();
        }
      };

      entry.addSubMenuItem(
        menu.item("Rename", () => {
          onlinePlaylistRenameHandler();
        }),
      );

      const onlinePlaylistRemoveHandler = async () => {
        const res = await utils.ask(
          "Are you sure you want to delete this playlist?",
        );
        if (res) {
          setPlaylists(
            "online",
            onlinePlaylists.filter((p) => p.path !== pl.path),
          );
          if (file.exists(pl.path)) file.delete(pl.path);
          save("online");
          rebuildMenus();
        }
      };

      entry.addSubMenuItem(
        menu.item("Delete", () => {
          onlinePlaylistRemoveHandler();
        }),
      );
      root.addSubMenuItem(entry);
    }
    menu.addItem(root);
  }

  // --- Local Playlists ---
  if (localPlaylists.length > 0) {
    const root = menu.item("Local Playlists");
    for (const pl of localPlaylists) {
      // AUTO-REFRESH LOGIC: Checks for new files, updates m3u8, then plays.
      const entry = menu.item(`${pl.title} (${pl.count})`, () => {
        refreshAndPlayLocal(pl);
      });

      entry.addSubMenuItem(
        menu.item("Play (Auto-update)", () => {
          refreshAndPlayLocal(pl);
        }),
      );

      const localPlaylistRenameHandler = async () => {
        const newName = utils.prompt("Enter new name") ?? pl.title;
        if (newName) {
          pl.title = ensureUniqueName(localPlaylists, newName);
          save("local");
          rebuildMenus();
        }
      };

      entry.addSubMenuItem(
        menu.item("Rename", () => {
          localPlaylistRenameHandler();
        }),
      );

      const removeLocalPlaylistHandler = async () => {
        const res = await utils.ask("Remove this playlist from list?");
        if (res) {
          setPlaylists(
            "local",
            localPlaylists.filter((p) => p.path !== pl.path),
          );
          // Only delete internal cache files
          if (pl.path.startsWith("@data") && file.exists(pl.path)) {
            file.delete(pl.path);
          }
          save("local");
          rebuildMenus();
        }
      };

      entry.addSubMenuItem(
        menu.item("Delete", () => {
          removeLocalPlaylistHandler();
        }),
      );
      root.addSubMenuItem(entry);
    }
    menu.addItem(root);
  }

  // --- Global Management ---
  if (onlinePlaylists.length > 0 || localPlaylists.length > 0) {
    menu.addItem(menu.separator());
    const manage = menu.item("Manage Playlists");

    const onlinePlaylistRemoveHandler = async () => {
      if (await utils.ask("Delete all online playlists?")) {
        onlinePlaylists.forEach((pl) => {
          if (file.exists(pl.path)) file.delete(pl.path);
        });
        setPlaylists("online", []);
        save("online");
        rebuildMenus();
      }
    };

    if (onlinePlaylists.length > 0) {
      manage.addSubMenuItem(
        menu.item("Remove All Online Playlists", () => {
          onlinePlaylistRemoveHandler();
        }),
      );
    }

    const localPlaylistRemoveHandler = async () => {
      if (await utils.ask("Clear all local playlist entries?")) {
        localPlaylists.forEach((pl) => {
          if (pl.path.startsWith("@data") && file.exists(pl.path)) {
            file.delete(pl.path);
          }
        });
        setPlaylists("local", []);
        save("local");
        rebuildMenus();
      }
    };

    if (localPlaylists.length > 0) {
      manage.addSubMenuItem(
        menu.item("Remove All Local Playlists", () => {
          localPlaylistRemoveHandler();
        }),
      );
    }
    menu.addItem(manage);
  }

  if (!firstMenuBuild) {
    menu.forceUpdate();
  }

  firstMenuBuild = false;
}
