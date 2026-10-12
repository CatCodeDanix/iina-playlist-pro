// ---------------- Stream recorder (mpv `stream-record`) ----------------
//
// Saves the raw bytes mpv receives from an online stream to disk while it
// plays. Nothing is re-encoded, so the file is identical to the stream.

import { core, console, event, file, mpv, utils } from "./iina";
import { rebuildMenus } from "./menuBuilder";

const settingsPath = "@data/recorder-settings.json";
const DEFAULT_DIR = "~/Movies/IINA Recordings";

interface RecorderSettings {
  autoRecord: boolean;
  dir: string;
}

interface Session {
  path: string;
}

let settings: RecorderSettings = {
  autoRecord: false,
  dir: DEFAULT_DIR,
};
let session: Session | null = null;

// ---------------- Settings ----------------

export function loadRecorderSettings() {
  try {
    if (file.exists(settingsPath)) {
      settings = { ...settings, ...JSON.parse(file.read(settingsPath) || "{}") };
    }
  } catch (err) {
    console.log("Recorder: failed to read settings", err);
  }
}

function saveRecorderSettings() {
  file.write(settingsPath, JSON.stringify(settings, null, 2));
}


export const isRecording = () => session !== null;
export const isAutoRecordEnabled = () => settings.autoRecord;

export function toggleAutoRecord() {
  loadRecorderSettings();
  settings.autoRecord = !settings.autoRecord;
  saveRecorderSettings();
  rebuildMenus();
  core.osd(
    settings.autoRecord
      ? "● Auto-record online streams: ON"
      : "Auto-record online streams: OFF",
  );
}


// ---------------- Helpers ----------------

function currentUrl(): string {
  try {
    const p = mpv.getString("path");
    if (p) return p;
  } catch {
    /* fall through */
  }
  return core.status.url || "";
}

function isOnlineStream(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Builds a safe, non-colliding output path from the stream URL. */
function buildOutputPath(url: string): string {
  const dir = utils.resolvePath(settings.dir);

  let name = safeDecode(url.split("?")[0].split("/").pop() || "recording");
  name = name.replace(/[\/\\:*?"<>|]/g, "_").trim() || "recording";

  // Direct files keep their container; HLS/DASH/unknown are saved as .ts
  if (!/\.(mkv|mp4|webm|avi|mov|ts)$/i.test(name)) {
    name = name.replace(/\.[^.]+$/, "") + ".ts";
  }

  let path = `${dir}/${name}`;
  if (file.exists(path)) {
    path = path.replace(/(\.[^.]+)$/, `-${Date.now()}$1`); // never overwrite
  }
  return path;
}

async function ensureDir(): Promise<boolean> {
  const dir = utils.resolvePath(settings.dir);
  try {
    const res = await utils.exec("/bin/mkdir", ["-p", dir]);
    return res.status === 0;
  } catch (err) {
    console.log("Recorder: mkdir failed", err);
    return false;
  }
}

/** Stops the current recording. */
function endSession() {
  const s = session;
  session = null;
  try {
    mpv.set("stream-record", "");
  } catch {
    /* ignore */
  }
  return s;
}


// ---------------- Start / stop ----------------

export async function startRecording(silent = false) {
  const url = currentUrl();
  if (!isOnlineStream(url)) {
    if (!silent) core.osd("⚠️ Recording works only for online streams");
    return;
  }

  if (!(await ensureDir())) {
    return core.osd("⚠️ Could not create the recordings folder");
  }

  const path = buildOutputPath(url);
  mpv.set("stream-record", path);
  session = { path };
  rebuildMenus();
  core.osd(`● Recording → ${path.split("/").pop()}`);
}

export function stopRecording() {
  const s = endSession();
  rebuildMenus();
  core.osd(s ? `⏹ Saved ${s.path.split("/").pop()}` : "Recording stopped");
}

export function toggleRecording() {
  if (isRecording()) stopRecording();
  else startRecording();
}

export async function chooseRecordingsFolder() {
  const chosen = await utils.chooseFile("Choose recordings folder", {
    chooseDir: true,
  });
  if (!chosen) return; // cancelled

  loadRecorderSettings();
  settings.dir = chosen;
  saveRecorderSettings();
  rebuildMenus();
  core.osd(`Recordings folder: ${chosen}`);
}

export function resetRecordingsFolder() {
  loadRecorderSettings();
  settings.dir = DEFAULT_DIR;
  saveRecorderSettings();
  rebuildMenus();
  core.osd(`Recordings folder reset to ${DEFAULT_DIR}`);
}

export function openRecordingsFolder() {
  utils.exec("/usr/bin/open", [utils.resolvePath(settings.dir)]);
}

// ---------------- Events ----------------

export function initRecorder() {
  loadRecorderSettings();

  // A new item is starting. mpv keeps the option between files, so make sure
  // the previous recording is closed before anything else.
  event.on("iina.file-started", () => {
    if (session) {
      endSession();
      rebuildMenus();
    }
    loadRecorderSettings();
    if (settings.autoRecord) startRecording(true);
  });

  // The stream was closed (finished, stopped, or replaced).
  event.on("mpv.end-file", () => {
    if (session) {
      endSession();
      rebuildMenus();
    }
  });

  event.on("iina.window-will-close", () => {
    if (session) endSession();
  });
}
