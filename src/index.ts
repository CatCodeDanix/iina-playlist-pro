import { console, event } from "./iina";
import { rebuildMenus } from "./menuBuilder";
import { load } from "./storage";

// ---------------- Event Listeners ----------------

// Keep track of whether this is the window's first time gaining focus
let isFirstFocus = true;

event.on("iina.window-main.changed", (isMain: boolean) => {
  console.log("it works! pluginjs");
  if (isMain) {
    if (isFirstFocus) {
      // Skip the redundant update on startup
      isFirstFocus = false;
      return;
    }

    // We just switched back to this window from somewhere else.
    // Fetch the latest JSON data and rebuild.

    load();
    rebuildMenus();
  }
});

// ---------------- Init ----------------

// Build the menus immediately when the script loads,
// even if the window opens in the background.
load();
rebuildMenus();
