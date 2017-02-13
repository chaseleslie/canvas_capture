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

/* global chrome */
var browser = chrome;

var activeTabs = {};
var iconPathMap = {
  "16": "/img/icon_16.svg",
  "32": "/img/icon_32.svg",
  "48": "/img/icon_48.svg",
  "64": "/img/icon_64.svg",
  "128": "/img/icon_128.svg"
};
var iconActivePathMap = {
  "16": "/img/icon_active_16.svg",
  "32": "/img/icon_active_32.svg",
  "48": "/img/icon_active_48.svg",
  "64": "/img/icon_active_64.svg",
  "128": "/img/icon_active_128.svg"
};

function nullifyError() {
  if (browser.runtime.lastError) {
    // eslint-disable-line no-empty
  }
}

browser.browserAction.setIcon({"path": iconPathMap}, nullifyError);

function handleInstall(details) {
  var reason = details.reason;
  switch (reason) {
    case "install":
      var obj = {"maxVideoSize": 524288000, "firstInstall": true};
      browser.storage.local.set(obj);
    break;
  }
}
function getFirstInstallSetting(setting) {
  if (Array.isArray(setting)) {
    setting = setting[0];
  }
  if (browser.runtime.lastError || !("firstInstall" in setting)) {
    handleInstall({"reason": "install"});
  }
}

if ("onInstalled" in browser.runtime) {
  browser.runtime.onInstalled.addListener(handleInstall);
} else {
  let firstInstallSetting = browser.storage.local.get("firstInstall", getFirstInstallSetting);
  if (firstInstallSetting) {
    firstInstallSetting.then(getFirstInstallSetting);
  }
}

function connected(port) {
  port.onMessage.addListener(onMessage);

  var queryTab = browser.tabs.query({"active": true}, getTabInfo);
  if (typeof queryTab === "function") {
    queryTab.then(getTabInfo);
  }
  function getTabInfo(tabs) {
    var tab = tabs[0];
    activeTabs[tab.id].port = port;
    port.onDisconnect.addListener(function() {
      onDisconnectTab({"command": "disconnect","subcommand": tab.id});
    });
    port.postMessage({
      "command": "display",
      "subcommand": tab.id
    });
  }
}
browser.runtime.onConnect.addListener(connected);

function onMessage(msg) {
  if (msg.command === "disconnect") {
    onDisconnectTab(msg);
  }
}

function onDisconnectTab(msg) {
  var tabId = msg.subcommand;
  if (tabId in activeTabs) {
    delete activeTabs[tabId];
  }
  browser.browserAction.setIcon({"path": iconPathMap, "tabId": tabId}, nullifyError);
}

function onBrowserAction(tab) {
  var tabId = tab.id;

  if (tabId in activeTabs) {
    activeTabs[tabId].port.postMessage({
      "command": "disable",
      "subcommand": tabId
    });
    delete activeTabs[tabId];
    browser.browserAction.setIcon({"path": iconPathMap, "tabId": tabId}, nullifyError);
  } else {
    browser.tabs.executeScript({
      "file": "/capture/capture.js"
    });
    activeTabs[tabId] = {"port": null};
    browser.browserAction.setIcon({"path": iconActivePathMap, "tabId": tabId}, nullifyError);
  }
}
browser.browserAction.onClicked.addListener(onBrowserAction);
