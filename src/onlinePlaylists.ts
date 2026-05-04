// ---------------- Clipboard → Online playlist ----------------

import { rebuildMenus } from "./menuBuilder";
import { onlinePlaylists, save } from "./storage";
import { ensureUniqueName, getSafeInternalFilename, safeOpen } from "./utils";
import { utils, core, file } from "./iina";

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

export function addUrlManually() {
  const input = utils.prompt("Paste the URLs you want to add:");

  // If the user cancels the prompt or leaves it blank, just do nothing
  if (!input) return;

  const urls = extractUrls(input);
  if (!urls.length) return core.osd("⚠️ No valid URLs found");

  const title = ensureUniqueName(onlinePlaylists, extractTitle(urls[0]));
  const filePath = getSafeInternalFilename(title);

  const m3u =
    "#EXTM3U\n" +
    urls.map((u) => `#EXTINF:-1, ${extractTitle(u)}\n${u}`).join("\n");
  file.write(filePath, m3u);

  onlinePlaylists.push({ title, path: filePath, count: urls.length });
  save("online");
  safeOpen(filePath);
  rebuildMenus();
  core.osd(`▶️ ${urls.length} items loaded`);
}

export async function playClipboardUrls() {
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
  safeOpen(filePath);
  rebuildMenus();
  core.osd(`▶️ ${urls.length} items loaded`);
}
