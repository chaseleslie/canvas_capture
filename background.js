/* Copyright (C) 2016-2017 Chase
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


"use strict";

/* global browser Utils */
/* exported sendUpdatedSettings */

const APP_NAME = browser.runtime.getManifest().name;

const activeTabs = Object.create(null);

const ICON_PATH_MAP = Object.freeze({
  "16":  "/img/icon_16.svg",
  "32":  "/img/icon_32.svg",
  "48":  "/img/icon_48.svg",
  "64":  "/img/icon_64.svg",
  "128": "/img/icon_128.svg"
});
const ICON_ACTIVE_PATH_MAP = Object.freeze({
  "16": "/img/icon_active_16.svg",
  "32": "/img/icon_active_32.svg",
  "48": "/img/icon_active_48.svg",
  "64": "/img/icon_active_64.svg",
  "128": "/img/icon_active_128.svg"
});

const TOP_FRAME_UUID = Utils.TOP_FRAME_UUID;
const ALL_FRAMES_UUID = Utils.ALL_FRAMES_UUID;

const CAPTURE_JS_PATH = "/capture/capture.js";
const BROWSER_POLYFILL_JS_PATH = "/lib/webextension-polyfill/browser-polyfill.min.js";
const CAPTURE_FRAMES_JS_PATH = "/capture/capture-frames.js";
const UTILS_JS_PATH = "/capture/utils.js";

const MessageCommands = Utils.MessageCommands;

const NOTIFICATION_DURATION = 10000;
const notifications = [];

const SETTINGS_RELOAD_TIMEOUT = 15000;

browser.browserAction.setIcon(
  {"path": ICON_PATH_MAP}
);
browser.runtime.onConnect.addListener(connected);
browser.browserAction.onClicked.addListener(onBrowserAction);
browser.runtime.onInstalled.addListener(handleInstall);

function handleInstall(details) {
  const reason = details.reason;
  switch (reason) {
    case "install": {
      const obj = {
        [Utils.MAX_VIDEO_SIZE_KEY]: Utils.DEFAULT_MAX_VIDEO_SIZE,
        [Utils.FPS_KEY]:            Utils.DEFAULT_FPS,
        [Utils.BPS_KEY]:            Utils.DEFAULT_BPS,
        [Utils.AUTO_OPEN_KEY]:      Utils.DEFAULT_AUTO_OPEN,
        "firstInstall":             true
      };
      browser.storage.local.set(obj);
    }
    break;
  }
}

function onNavigationCompleted(details) {
  const tabId = details.tabId;
  const isTopFrame = details.frameId === 0;
  const haveTab = tabId in activeTabs;
  const haveValidUrl = details.url.indexOf("http") === 0;
  const haveSettings = haveTab && Boolean(activeTabs[tabId].settingsOrphaned);

  if (isTopFrame && haveTab && haveValidUrl && haveSettings) {
    const frames = activeTabs[tabId].frames;
    const frame = frames.find((el) => el.frameUUID === TOP_FRAME_UUID);
    const frameUrl = frame.url.split("#")[0];
    if (frameUrl in activeTabs[tabId].settings) {
      onEnableTab({"id": tabId});
    }
  }
}

async function connected(port) {
  port.onMessage.addListener(onMessage);

  const sender = port.sender;
  const tab = sender.tab;
  const tabId = tab.id;
  const frameId = sender.frameId;
  const frameUUID = port.name;
  const url = sender.url;
  const frames = activeTabs[tabId].frames;
  const frame = {
    "frameUUID": frameUUID,
    "port": port,
    "url": url,
    "frameId": frameId
  };
  frames.push(frame);

  port.onDisconnect.addListener(function() {
    onDisconnectTab({
      "command": MessageCommands.DISCONNECT,
      "tabId": tabId,
      "frameUUID": frameUUID,
      "frameId": frameId
    });
  });

  port.postMessage({
    "command": MessageCommands.REGISTER,
    "tabId": tabId,
    "frameId": frameId,
    "settings": activeTabs[tabId].settings
  });

  if (frameUUID === TOP_FRAME_UUID) {
    const settings = await getSettings();

    port.postMessage({
      "command": MessageCommands.DISPLAY,
      "tabId": tabId,
      "defaultSettings": settings
    });

    const actTab = activeTabs[tabId];
    delete actTab.settings;
    delete actTab.settingsPreserve;
    delete actTab.settingsReloaded;
    delete actTab.settingsTimeout;
    delete actTab.settingsOrphaned;
  }
}

function onBrowserAction(tab) {
  const tabId = tab.id;

  if (tabId in activeTabs) {
    onDisableTab(tabId);
  } else {
    onEnableTab(tab);
  }
}

function onEnableTab(tab) {
  const tabId = tab.id;

  browser.tabs.executeScript(tabId, {
    "file": BROWSER_POLYFILL_JS_PATH,
    "frameId": 0
  }).then(function() {
    return browser.tabs.executeScript(tabId, {
      "file": UTILS_JS_PATH,
      "frameId": 0
    });
  }).then(function() {
    browser.tabs.executeScript(tabId, {
      "file": CAPTURE_JS_PATH,
      "frameId": 0
    });
  });

  if (!browser.webNavigation.onCompleted.hasListener(onNavigationCompleted)) {
    browser.webNavigation.onCompleted.addListener(onNavigationCompleted);
  }

  if (!browser.tabs.onRemoved.hasListener(onTabRemoved)) {
    browser.tabs.onRemoved.addListener(onTabRemoved);
  }

  if (tabId in activeTabs) {
    activeTabs[tabId].settingsReloaded = true;
    clearTimeout(activeTabs[tabId].settingsTimeout);
    activeTabs[tabId].frames = [];
  } else {
    activeTabs[tabId] = {"frames": [], "tabId": tabId};
  }

  browser.browserAction.setIcon(
    {"path": ICON_ACTIVE_PATH_MAP, "tabId": tabId}
  );
}

function onTabRemoved(tabId) {
  if (tabId in activeTabs) {
    delete activeTabs[tabId];
  }

  const keys = Object.keys(activeTabs);
  if (!keys.length && browser.tabs.onRemoved.hasListener(onTabRemoved)) {
    browser.tabs.onRemoved.removeListener(onTabRemoved);
  }
}

function onDisableTab(tabId) {
  const frames = activeTabs[tabId].frames;
  const topFrame = frames.find((el) => el.frameUUID === TOP_FRAME_UUID);
  frames.forEach(function(el) {
    if (el.frameUUID !== TOP_FRAME_UUID) {
      el.port.postMessage({
        "command": MessageCommands.DISABLE,
        "tabId": tabId
      });
    }
  });
  topFrame.port.postMessage({
    "command": MessageCommands.DISABLE,
    "tabId": tabId
  });
}

function onDisconnectTab(msg) {
  const tabId = msg.tabId;
  const frameUUID = msg.frameUUID;

  if (!(tabId in activeTabs) || activeTabs[tabId].settingsOrphaned) {
    return;
  }

  if (frameUUID === TOP_FRAME_UUID) {
    if (activeTabs[tabId].settingsPreserve) {
      activeTabs[tabId].settingsOrphaned = true;
    } else {
      delete activeTabs[tabId];
    }

    browser.browserAction.setIcon(
      {"path": ICON_PATH_MAP, "tabId": tabId}
    );
    if (
      !Object.keys(activeTabs).length &&
      browser.webNavigation.onCompleted.hasListener(onNavigationCompleted)
    ) {
      browser.webNavigation.onCompleted.removeListener(onNavigationCompleted);
    }
  } else {
    const frames = activeTabs[tabId].frames;
    const topFrame = frames.find((el) => el.frameUUID === TOP_FRAME_UUID);
    let frameIndex = -1;

    for (let k = 0, n = frames.length; k < n; k += 1) {
      const frame = frames[k];
      if (frame.frameUUID === frameUUID) {
        frameIndex = k;
        break;
      }
    }

    if (frameIndex >= 0) {
      frames.splice(frameIndex, 1);
    }

    topFrame.port.postMessage({
      "command": MessageCommands.DISCONNECT,
      "tabId": tabId,
      "frameUUID": frameUUID
    });
  }
}

function injectFrameContentScripts(tabId, frameId) {
  browser.tabs.executeScript(tabId, {
    "file": BROWSER_POLYFILL_JS_PATH,
    "frameId": frameId
  })
  .then(function() {
    return browser.tabs.executeScript(tabId, {
      "file": UTILS_JS_PATH,
      "frameId": frameId
    });
  }).then(function() {
    return browser.tabs.executeScript(tabId, {
      "file": CAPTURE_FRAMES_JS_PATH,
      "frameId": frameId
    });
  }).then(function() {
    const frames = activeTabs[tabId].frames;
    const topFrame = frames.find((el) => el.frameUUID === TOP_FRAME_UUID);
    const port = topFrame.port;
    port.postMessage({
      "command": MessageCommands.UPDATE_CANVASES,
      "tabId": tabId,
      "frameUUID": Utils.BG_FRAME_UUID,
      "targetFrameUUID": TOP_FRAME_UUID
    });
  });
}

async function handleIframeNavigated(msg) {
  const frameUrl = msg.frameUrl.split("#")[0];
  const tabId = msg.tabId;

  if (frameUrl.indexOf("http") !== 0 && frameUrl.indexOf("data") !== 0) {
    return;
  }

  for (let k = 0, n = activeTabs[tabId].frames.length; k < n; k += 1) {
    const frame = activeTabs[tabId].frames[k];
    const url = frame.url.split("#")[0];

    if (frameUrl === url) {
      return;
    }
  }

  const frames = (await getAllFramesForTab(tabId)).filter(function(el) {
    if (el.frameId === 0) {
      return false;
    }

    for (let k = 0, n = activeTabs[tabId].frames.length; k < n; k += 1) {
      const frame = activeTabs[tabId].frames[k];
      const url = frame.url.split("#")[0];

      if (el.url === url) {
        return false;
      }
    }

    return true;
  });

  for (let k = 0, n = frames.length; k < n; k += 1) {
    const frame = frames[k];
    injectFrameContentScripts(tabId, frame.frameId);
  }
}

function onMessage(msg) {
  switch (msg.command) {
    case MessageCommands.CAPTURE_START:
    case MessageCommands.CAPTURE_STOP:
    case MessageCommands.DELAY:
    case MessageCommands.DOWNLOAD:
    case MessageCommands.HIGHLIGHT: {
      const tabId = msg.tabId;
      const frames = activeTabs[tabId].frames;
      const targetFrameUUID = msg.targetFrameUUID;
      const targetFrame = frames.find((el) => el.frameUUID === targetFrameUUID);

      if (targetFrame) {
        targetFrame.port.postMessage(msg);
      }
    }
    break;

    case MessageCommands.DISPLAY:
    case MessageCommands.UPDATE_CANVASES: {
      const tabId = msg.tabId;
      const frames = activeTabs[tabId].frames;
      const targetFrameUUID = msg.targetFrameUUID;
      const frameUUID = msg.frameUUID;
      const targetFrame = frames.find((el) => el.frameUUID === targetFrameUUID);
      if (targetFrameUUID === ALL_FRAMES_UUID && frameUUID === TOP_FRAME_UUID) {
        for (let k = 0, n = frames.length; k < n; k += 1) {
          const frame = frames[k];
          if (frame.frameUUID !== TOP_FRAME_UUID) {
            const obj = JSON.parse(JSON.stringify(msg));
            obj.targetFrameUUID = frame.frameUUID;
            frame.port.postMessage(obj);
          }
        }
      } else if (targetFrame) {
        targetFrame.port.postMessage(msg);
      }
    }
    break;

    case MessageCommands.DISCONNECT:
      onDisconnectTab(msg);
    break;

    case MessageCommands.NOTIFY:
      onTabNotify(msg);
    break;

    case MessageCommands.DISABLE:
      onDisableTab(msg.tabId);
    break;

    case MessageCommands.UPDATE_SETTINGS:
      updateSettings(msg);
    break;

    case MessageCommands.IFRAME_NAVIGATED:
      handleIframeNavigated(msg);
    break;
  }
}

function onTabNotify(msg) {
  const notifyId = msg.notification;
  if (!notifyId) {
    return;
  }

  const notifyOpts = {
    "type": "basic",
    "message": msg.notification,
    "title": APP_NAME,
    "iconUrl": ICON_ACTIVE_PATH_MAP["32"]
  };

  for (let k = 0, n = notifications.length; k < n; k += 1) {
    const notify = notifications[k];
    if (notify.message === notifyOpts.message) {
      return;
    }
  }
  notifications.push(notifyOpts);

  browser.notifications.create(notifyId, notifyOpts);
  setTimeout(function() {
    browser.notifications.clear(notifyId);
    for (let k = 0, n = notifications.length; k < n; k += 1) {
      const notify = notifications[k];
      if (notify.message === notifyOpts.message) {
        notifications.splice(k, 1);
      }
    }
  }, NOTIFICATION_DURATION);
}

async function getAllFramesForTab(tabId) {
  const tabFrames = [];

  await browser.webNavigation.getAllFrames({"tabId": tabId})
  .then(function(frames) {
    tabFrames.push(...frames);
  });

  return tabFrames;
}

async function getSettings() {
  let maxVideoSize = Utils.DEFAULT_MAX_VIDEO_SIZE;
  let fps = Utils.DEFAULT_FPS;
  let bps = Utils.DEFAULT_BPS;
  let autoOpen = Utils.DEFAULT_AUTO_OPEN;

  await browser.storage.local.get(Utils.MAX_VIDEO_SIZE_KEY)
  .then(function(setting) {
    maxVideoSize = setting[Utils.MAX_VIDEO_SIZE_KEY] || Utils.DEFAULT_MAX_VIDEO_SIZE;

    return browser.storage.local.get(Utils.FPS_KEY);
  }).then(function(setting) {
    fps = setting[Utils.FPS_KEY] || Utils.DEFAULT_FPS;

    return browser.storage.local.get(Utils.BPS_KEY);
  }).then(function(setting) {
    bps = setting[Utils.BPS_KEY] || Utils.DEFAULT_BPS;

    return browser.storage.local.get(Utils.AUTO_OPEN_KEY);
  }).then(function(setting) {
    autoOpen = setting[Utils.AUTO_OPEN_KEY] || Utils.DEFAULT_AUTO_OPEN;
  });

  return {
    [Utils.MAX_VIDEO_SIZE_KEY]: maxVideoSize,
    [Utils.FPS_KEY]:            fps,
    [Utils.BPS_KEY]:            bps,
    [Utils.AUTO_OPEN_KEY]:      autoOpen
  };
}

/* Receive updated per-canvas settings from top frame on page unload */
function updateSettings(msg) {
  const tabId = msg.tabId;
  const tab = activeTabs[tabId];

  tab.settings = msg.settings;
  tab.settingsPreserve = true;
  tab.settingsReloaded = false;
  tab.settingsTimeout = setTimeout(function() {
    if (!tab.settingsReloaded) {
      delete activeTabs[tabId];
    }
  }, SETTINGS_RELOAD_TIMEOUT);
}

/* Send updated settings to top frames */
async function sendUpdatedSettings() {
  const settings = await getSettings();

  for (const tabId of Object.keys(activeTabs)) {
    const tab = activeTabs[tabId];
    const topFrame = tab.frames.find((el) => el.frameUUID === TOP_FRAME_UUID);
    const port = topFrame.port;

    port.postMessage({
      "command":          MessageCommands.UPDATE_SETTINGS,
      "tabId":            tabId,
      "defaultSettings":  settings
    });
  }
}
