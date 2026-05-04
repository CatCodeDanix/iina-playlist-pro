import { PlaylistItem } from "./types";
import { file } from "./iina";

export let onlinePlaylists: PlaylistItem[] = [];
export let localPlaylists: PlaylistItem[] = [];

const onlinePath = "@data/online-playlists.json";
const localPath = "@data/local-playlists.json";

export function save(type: "online" | "local") {
  if (type === "online") {
    file.write(onlinePath, JSON.stringify(onlinePlaylists, null, 2));
  } else {
    file.write(localPath, JSON.stringify(localPlaylists, null, 2));
  }
}

export function load() {
  if (file.exists(onlinePath)) {
    onlinePlaylists = JSON.parse(file.read(onlinePath) || "[]");
  }
  if (file.exists(localPath)) {
    localPlaylists = JSON.parse(file.read(localPath) || "[]");
  }
}

export function setPlaylists(
  type: "online" | "local",
  newPlayLists: PlaylistItem[],
) {
  if (type === "online") {
    onlinePlaylists = newPlayLists;
  } else if (type === "local") {
    localPlaylists = newPlayLists;
  }
}
