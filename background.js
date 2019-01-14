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

/* global browser */
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

const CAPTURE_JS_PATH = "/capture/capture.js";
const BROWSER_POLYFILL_JS_PATH = "/lib/webextension-polyfill/browser-polyfill.min.js";
const CAPTURE_FRAMES_JS_PATH = "/capture/capture-frames.js";
const TOP_FRAME_UUID = "top";
const BG_FRAME_UUID = "background";
const ALL_FRAMES_UUID = "*";

const MAX_VIDEO_SIZE_KEY = "maxVideoSize";
const DEFAULT_MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024;

const FPS_KEY = "fps";
const DEFAULT_FPS = 30;

const BPS_KEY = "bps";
const DEFAULT_BPS = 2500000;

const MessageCommands = Object.freeze({
  "CAPTURE_START":   0,
  "CAPTURE_STOP":    1,
  "DELAY":           2,
  "DISABLE":         3,
  "DISCONNECT":      4,
  "DISPLAY":         5,
  "DOWNLOAD":        6,
  "HIGHLIGHT":       7,
  "NOTIFY":          8,
  "REGISTER":        9,
  "UPDATE_CANVASES": 10,
  "UPDATE_SETTINGS": 11
});

const NOTIFICATION_DURATION = 10000;
const notifications = [];

browser.browserAction.setIcon(
  {"path": ICON_PATH_MAP}
).then(nullifyError).catch(nullifyError);
browser.runtime.onConnect.addListener(connected);
browser.browserAction.onClicked.addListener(onBrowserAction);

if ("onInstalled" in browser.runtime) {
  /* New browser version support runtime.onInstalled */
  browser.runtime.onInstalled.addListener(handleInstall);
} else {
  /* Fallback for older browser versions first install */
  browser.storage.local.get("firstInstall").then(function(setting) {
    if (Array.isArray(setting)) {
      setting = setting[0];
    }
    if (!("firstInstall" in setting)) {
      handleInstall({"reason": "install"});
    }
  }).catch(function() {
    handleInstall({"reason": "install"});
  });
}

function handleInstall(details) {
  const reason = details.reason;
  switch (reason) {
    case "install": {
      const obj = {
        [MAX_VIDEO_SIZE_KEY]: DEFAULT_MAX_VIDEO_SIZE,
        [FPS_KEY]: DEFAULT_FPS,
        [BPS_KEY]: DEFAULT_BPS,
        "firstInstall": true
      };
      browser.storage.local.set(obj);
    }
    break;
  }
}

function onNavigationCompleted(details) {
  const tabId = details.tabId;
  const frameId = details.frameId;

  if (
    frameId === 0 ||
    !(tabId in activeTabs) ||
    details.url.indexOf("http") !== 0
  ) {
    return;
  }

  browser.tabs.executeScript({
    "file": BROWSER_POLYFILL_JS_PATH,
    "frameId": frameId
  }).then(function() {
    return browser.tabs.executeScript({
      "file": CAPTURE_FRAMES_JS_PATH,
      "frameId": frameId
    });
  }).then(function() {
    const frames = activeTabs[tabId].frames;
    const frame = frames.find((el) => el.frameUUID === TOP_FRAME_UUID);
    frame.port.postMessage({
      "command": MessageCommands.UPDATE_CANVASES,
      "tabId": tabId,
      "frameUUID": BG_FRAME_UUID,
      "targetFrameUUID": TOP_FRAME_UUID
    });
  });
}

function connected(port) {
  port.onMessage.addListener(onMessage);

  const sender = port.sender;
  const tab = sender.tab;
  const tabId = tab.id;
  const frameId = sender.frameId;
  const frameUUID = port.name;
  const url = sender.url;
  const frames = activeTabs[tabId].frames;
  const frame = {"frameUUID": frameUUID, "port": port, "url": url, "frameId": frameId};
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
    "frameId": frameId
  });

  if (frameUUID === TOP_FRAME_UUID) {
    let maxVideoSize = DEFAULT_MAX_VIDEO_SIZE;
    let fps = DEFAULT_FPS;
    let bps = DEFAULT_BPS;

    browser.storage.local.get(MAX_VIDEO_SIZE_KEY)
    .then(function(setting) {
      if (Array.isArray(setting)) {
        setting = setting[0];
      }
      maxVideoSize = setting[MAX_VIDEO_SIZE_KEY] || DEFAULT_MAX_VIDEO_SIZE;

      return browser.storage.local.get(FPS_KEY);
    }).then(function(setting) {
      if (Array.isArray(setting)) {
        setting = setting[0];
      }
      fps = setting[FPS_KEY] || DEFAULT_FPS;

      return browser.storage.local.get(BPS_KEY);
    }).then(function(setting) {
      if (Array.isArray(setting)) {
        setting = setting[0];
      }
      bps = setting[BPS_KEY] || DEFAULT_BPS;

      port.postMessage({
        "command": MessageCommands.DISPLAY,
        "tabId": tabId,
        "defaultSettings": {
          "maxVideoSize": maxVideoSize,
          "fps": fps,
          "bps": bps
        }
      });
    });
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

  browser.webNavigation.getAllFrames({"tabId": tabId})
  .then(function(frames) {
    for (let k = 0, n = frames.length; k < n; k += 1) {
      const frame = frames[k];
      if (frame.frameId !== 0) {
        browser.tabs.executeScript({
          "file": BROWSER_POLYFILL_JS_PATH,
          "frameId": frame.frameId
        }).then(function() {
          browser.tabs.executeScript({
            "file": CAPTURE_FRAMES_JS_PATH,
            "frameId": frame.frameId
          });
        });
      }
    }

    browser.tabs.executeScript({
      "file": BROWSER_POLYFILL_JS_PATH,
      "frameId": 0
    }).then(function() {
      browser.tabs.executeScript({
        "file": CAPTURE_JS_PATH,
        "frameId": 0
      });
    });
  });

  if (!browser.webNavigation.onCompleted.hasListener(onNavigationCompleted)) {
    browser.webNavigation.onCompleted.addListener(onNavigationCompleted);
  }
  activeTabs[tabId] = {"frames": [], "tabId": tabId};
  browser.browserAction.setIcon(
    {"path": ICON_ACTIVE_PATH_MAP, "tabId": tabId}
  ).then(nullifyError).catch(nullifyError);
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

  if (!(tabId in activeTabs)) {
    return;
  }

  if (frameUUID === TOP_FRAME_UUID) {
    delete activeTabs[tabId];
    browser.browserAction.setIcon(
      {"path": ICON_PATH_MAP, "tabId": tabId}
    ).then(nullifyError).catch(nullifyError);
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

function onMessage(msg) {
  switch (msg.command) {
    case MessageCommands.CAPTURE_START:
    case MessageCommands.CAPTURE_STOP:
    case MessageCommands.DELAY:
    case MessageCommands.DOWNLOAD:
    case MessageCommands.HIGHLIGHT: {
      const tabId = msg.tabId;
      const frames = activeTabs[tabId].frames;
      const targetFrame = frames.find((el) => el.frameUUID === msg.targetFrameUUID);

      if (targetFrame) {
        targetFrame.port.postMessage(msg);
      }
    }
    break;

    case MessageCommands.DISPLAY:
    case MessageCommands.UPDATE_CANVASES: {
      const tabId = msg.tabId;
      const frames = activeTabs[tabId].frames;
      const targetFrame = frames.find((el) => el.frameUUID === msg.targetFrameUUID);
      if (msg.targetFrameUUID === ALL_FRAMES_UUID && msg.frameUUID === TOP_FRAME_UUID) {
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

async function getSettings() {
  let maxVideoSize = DEFAULT_MAX_VIDEO_SIZE;
  let fps = DEFAULT_FPS;
  let bps = DEFAULT_BPS;

  await browser.storage.local.get(MAX_VIDEO_SIZE_KEY)
  .then(function(setting) {
    if (Array.isArray(setting)) {
      setting = setting[0];
    }
    maxVideoSize = setting[MAX_VIDEO_SIZE_KEY] || DEFAULT_MAX_VIDEO_SIZE;

    return browser.storage.local.get(FPS_KEY);
  }).then(function(setting) {
    if (Array.isArray(setting)) {
      setting = setting[0];
    }
    fps = setting[FPS_KEY] || DEFAULT_FPS;

    return browser.storage.local.get(BPS_KEY);
  }).then(function(setting) {
    if (Array.isArray(setting)) {
      setting = setting[0];
    }
    bps = setting[BPS_KEY] || DEFAULT_BPS;
  });

  return {
    [MAX_VIDEO_SIZE_KEY]: maxVideoSize,
    [FPS_KEY]:            fps,
    [BPS_KEY]:            bps
  };
}

/* Receive updated settings from top frame */
function updateSettings(msg) {
  const obj = Object.create(null);
  obj[msg.setting] = msg.value;
  browser.storage.local.set(obj);
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

function nullifyError() {
  if (browser.runtime.lastError) {
    // eslint-disable-line no-empty
  }
}
