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

var activeTabs = {};

const ICON_PATH_MAP = {
  "16": "/img/icon_16.svg",
  "32": "/img/icon_32.svg",
  "48": "/img/icon_48.svg",
  "64": "/img/icon_64.svg",
  "128": "/img/icon_128.svg"
};
const ICON_ACTIVE_PATH_MAP = {
  "16": "/img/icon_active_16.svg",
  "32": "/img/icon_active_32.svg",
  "48": "/img/icon_active_48.svg",
  "64": "/img/icon_active_64.svg",
  "128": "/img/icon_active_128.svg"
};

const CAPTURE_JS_PATH = "/capture/capture.js";
const BROWSER_POLYFILL_JS_PATH = "/lib/webextension-polyfill/browser-polyfill.min.js";
const CAPTURE_FRAMES_JS_PATH = "/capture/capture-frames.js";
const TOP_FRAME_UUID = "top";
const BG_FRAME_UUID = "background";
const ALL_FRAMES_UUID = "*";
const MAX_VIDEO_SIZE_KEY = "maxVideoSize";

const MessageCommands = Object.freeze({
  "CAPTURE_START": "capture-start",
  "CAPTURE_STOP": "capture-stop",
  "DISABLE": "disable",
  "DISCONNECT": "disconnect",
  "DISPLAY": "display",
  "DOWNLOAD": "download",
  "NOTIFY": "notify",
  "REGISTER": "register",
  "UPDATE_CANVASES": "update-canvases"
});

const NOTIFICATION_DURATION = 10000;
var notifications = [];

browser.browserAction.setIcon(
  {"path": ICON_PATH_MAP}
).then(nullifyError).catch(nullifyError);
browser.runtime.onConnect.addListener(connected);
browser.browserAction.onClicked.addListener(onBrowserAction);
browser.webNavigation.onCompleted.addListener(onNavigationCompleted);

if ("onInstalled" in browser.runtime) {
  /* New browser version support runtime.onInstalled */
  browser.runtime.onInstalled.addListener(handleInstall);
} else {
  /* Fallback for older browser versions first install */
  let firstInstallSetting = browser.storage.local.get("firstInstall");
  firstInstallSetting.then(function(setting) {
    if (Array.isArray(setting)) {
      setting = setting[0];
    }
    if (browser.runtime.lastError || !("firstInstall" in setting)) {
      handleInstall({"reason": "install"});
    }
  });
}

function handleInstall(details) {
  var reason = details.reason;
  switch (reason) {
    case "install":
      var obj = {[MAX_VIDEO_SIZE_KEY]: 524288000, "firstInstall": true};
      browser.storage.local.set(obj);
    break;
  }
}

function onNavigationCompleted(details) {
  var tabId = details.tabId;
  var frameId = details.frameId;

  if (details.url === "about:blank" || frameId === 0 || !(tabId in activeTabs)) {
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
    var frames = activeTabs[tabId].frames;
    var frame = frames.find((el) => el.frameUUID === TOP_FRAME_UUID);
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

  browser.tabs.query({"active": true})
  .then(function(tabs) {
    var tab = tabs[0];
    var tabId = tab.id;
    var sepPos = port.name.indexOf("@");
    sepPos = sepPos >= 0 ? sepPos : port.name.length;
    var frameUUID = port.name.substr(0, sepPos);
    var url = port.name.substr(sepPos + 1);
    var frames = activeTabs[tabId].frames;
    var frame = {"frameUUID": frameUUID, "port": port, "url": url};
    frames.push(frame);

    port.onDisconnect.addListener(function() {
      onDisconnectTab({"command": MessageCommands.DISCONNECT, "tabId": tabId, "frameUUID": frameUUID});
    });

    port.postMessage({
      "command": MessageCommands.REGISTER,
      "tabId": tabId
    });

    if (frameUUID === TOP_FRAME_UUID) {
      browser.storage.local.get(MAX_VIDEO_SIZE_KEY)
      .then(function(setting) {
        if (Array.isArray(setting)) {
          setting = setting[0];
        }
        var maxVideoSize = setting[MAX_VIDEO_SIZE_KEY] || 4 * 1024 * 1024 * 1024;

        port.postMessage({
          "command": MessageCommands.DISPLAY,
          "tabId": tabId,
          "defaultSettings": {
            "maxVideoSize": maxVideoSize
          }
        });
      });
    }
  });
}

function onDisconnectTab(msg) {
  var tabId = msg.tabId;
  var frameUUID = msg.frameUUID;

  if (!(tabId in activeTabs)) {
    return;
  }

  if (frameUUID === TOP_FRAME_UUID) {
    delete activeTabs[tabId];
    browser.browserAction.setIcon(
      {"path": ICON_PATH_MAP, "tabId": tabId}
    ).then(nullifyError).catch(nullifyError);
  } else {
    let frames = activeTabs[tabId].frames;
    let frameIndex = -1;

    for (let k = 0, n = frames.length; k < n; k += 1) {
      let frame = frames[k];
      if (frame.frameUUID === frameUUID) {
        frameIndex = k;
        break;
      }
    }

    if (frameIndex >= 0) {
      frames.splice(frameIndex, 1);
    }

    for (let k = 0, n = frames.length; k < n; k += 1) {
      let frame = frames[k];
      if (frame.frameUUID === TOP_FRAME_UUID) {
        frame.port.postMessage({
          "command": MessageCommands.DISCONNECT,
          "tabId": tabId,
          "frameUUID": frameUUID
        });
      }
    }
  }
}

function onMessage(msg) {
  switch (msg.command) {
    case MessageCommands.CAPTURE_START:
    case MessageCommands.CAPTURE_STOP:
    case MessageCommands.DOWNLOAD: {
      let tabId = msg.tabId;
      let targetFrame = activeTabs[tabId].frames.find((el) => el.frameUUID === msg.targetFrameUUID);
      targetFrame.port.postMessage(msg);
    }
    break;

    case MessageCommands.DISPLAY:
    case MessageCommands.UPDATE_CANVASES: {
      let tabId = msg.tabId;
      let targetFrame = activeTabs[tabId].frames.find((el) => el.frameUUID === msg.targetFrameUUID);
      if (msg.targetFrameUUID === ALL_FRAMES_UUID && msg.frameUUID === TOP_FRAME_UUID) {
        let frames = activeTabs[tabId].frames;
        for (let k = 0, n = frames.length; k < n; k += 1) {
          let frame = frames[k];
          if (frame.frameUUID !== TOP_FRAME_UUID) {
            let obj = JSON.parse(JSON.stringify(msg));
            obj.targetFrameUUID = frame.frameUUID;
            frame.port.postMessage(obj);
          }
        }
      } else {
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
  }
}

function onTabNotify(msg) {
  var notifyId = msg.notification;
  if (!notifyId) {
    return;
  }

  var notifyOpts = {
    "type": "basic",
    "message": msg.notification,
    "title": "Capture Canvas",
    "iconUrl": ICON_ACTIVE_PATH_MAP["32"]
  };

  for (let k = 0, n = notifications.length; k < n; k += 1) {
    let notify = notifications[k];
    if (notify.message === notifyOpts.message) {
      return;
    }
  }
  notifications.push(notifyOpts);

  browser.notifications.create(notifyId, notifyOpts);
  setTimeout(() => {
    browser.notifications.clear(notifyId);
    for (let k = 0, n = notifications.length; k < n; k += 1) {
      let notify = notifications[k];
      if (notify.message === notifyOpts.message) {
        notifications.splice(k, 1);
      }
    }
  }, NOTIFICATION_DURATION);
}

function onBrowserAction(tab) {
  var tabId = tab.id;

  if (tabId in activeTabs) {
    var topFrame = activeTabs[tabId].frames.find((el) => el.frameUUID === "top");
    topFrame.port.postMessage({
      "command": MessageCommands.DISABLE,
      "tabId": tabId
    });
    delete activeTabs[tabId];
    browser.browserAction.setIcon(
      {"path": ICON_PATH_MAP, "tabId": tabId}
    ).then(nullifyError).catch(nullifyError);
  } else {
    browser.webNavigation.getAllFrames({"tabId": tabId})
    .then(function(frames) {
      for (let k = 0, n = frames.length; k < n; k += 1) {
        let frame = frames[k];
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

    activeTabs[tabId] = {"frames": [], "tabId": tabId};
    browser.browserAction.setIcon(
      {"path": ICON_ACTIVE_PATH_MAP, "tabId": tabId}
    ).then(nullifyError).catch(nullifyError);
  }
}

function nullifyError() {
  if (browser.runtime.lastError) {
    // eslint-disable-line no-empty
  }
}
