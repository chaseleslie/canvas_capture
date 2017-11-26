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


 /* global browser */

; // eslint-disable-line no-extra-semi
(function() {
"use strict";

const TOP_FRAME_UUID = "top";
const BG_FRAME_UUID = "background";
const ALL_FRAMES_UUID = "*";

const MessageCommands = Object.freeze({
  "CAPTURE_START": 0,
  "CAPTURE_STOP": 1,
  "DISABLE": 2,
  "DISCONNECT": 3,
  "DISPLAY": 4,
  "DOWNLOAD": 5,
  "HIGHLIGHT": 6,
  "NOTIFY": 7,
  "REGISTER": 8,
  "UPDATE_CANVASES": 9
});

const MIME_TYPE_MAP = Object.freeze({
  "mp4": "video/mp4",
  "webm": "video/webm"
});
const DEFAULT_MIME_TYPE = "webm";
const CAPTURE_INTERVAL_MS = 1000;
const DEFAULT_FPS = 30;
const DEFAULT_BPS = 2500000;
const DEFAULT_MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024;
const MSEC_PER_SEC = 1000;
const CSS_FILE_PATH = "/capture/capture.css";
const HTML_FILE_PATH = "/capture/capture.html";
const HTML_ROW_FILE_PATH = "/capture/capture-row.html";
const ICON_ADD_PATH = "/capture/img/icon_add_32.svg";
const ICON_TIMER_PATH = "/capture/img/icon_timer_32.svg";

const CSS_STYLE_ID = "capture_list_container_css";
const WRAPPER_ID = "capture_list_container";
const LIST_CANVASES_ID = "list_canvases";
const MODIFY_TIMER_CONTAINER_ID = "modify_timer_container";
const MODIFY_TIMER_SET_ID = "modify_timer_set";
const MODIFY_TIMER_CLEAR_ID = "modify_timer_clear";
const MODIFY_TIMER_HOURS_ID = "modify_timer_hours";
const MODIFY_TIMER_MINUTES_ID = "modify_timer_minutes";
const MODIFY_TIMER_SECONDS_ID = "modify_timer_seconds";
const CAPTURE_CLOSE_ID = "capture_close";
const TIMER_SLICE_CONTAINER_ID = "timer_slice_container";
const TIMER_SLICE_CLIP_PATH_ID = "timer_slice_clip_path";
const CAPTURE_MAXIMIZE_ID = "capture_maximize";
const CAPTURE_MINIMIZE_ID = "capture_minimize";

const LIST_CANVASES_ROW_CLASS = "list_canvases_row";
const CANVAS_CAPTURE_TOGGLE_CLASS = "canvas_capture_toggle";
const LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS = "list_canvases_capture_timer_img";
const LIST_CANVASES_CANVAS_ID_CLASS = "list_canvases_canvas_id";
const LIST_CANVASES_CANVAS_DIMENS_CLASS = "list_canvases_canvas_dimens";
const LIST_CANVASES_CANVAS_WIDTH_CLASS = "list_canvases_canvas_width";
const LIST_CANVASES_CANVAS_HEIGHT_CLASS = "list_canvases_canvas_height";
const LIST_CANVASES_CAPTURE_FPS_CLASS = "list_canvases_capture_fps";
const LIST_CANVASES_CAPTURE_BPS_CLASS = "list_canvases_capture_bps";
const CANVAS_CAPTURE_LINK_CONTAINER_CLASS = "canvas_capture_link_container";
const CANVAS_CAPTURE_SELECTED_CLASS = "canvas_capture_selected";
const CANVAS_CAPTURE_INACTIVE_CLASS = "canvas_capture_inactive";
const TIMER_MODIFYING_CLASS = "timer_modifying";
const CAPTURING_CLASS = "capturing";
const HIDDEN_CLASS = "hidden";
const HIGHLIGHTER_UNAVAILABLE_CLASS = "highlighter_unavailable";
const HIGHLIGHTER_HORIZONTAL_CLASS = "highlighter_horizontal";
const HIGHLIGHTER_VERTICAL_CLASS = "highlighter_vertical";

const CANVAS_OBSERVER_OPS = Object.freeze({
  "attributes": true,
  "attributeFilter": ["id", "width", "height"]
});

const Ext = Object.seal({
  "tabId": null,
  "frameId": null,
  "port": browser.runtime.connect({
    "name": TOP_FRAME_UUID
  }),
  "rowTemplate": null,
  "settings": Object.seal({"maxVideoSize": DEFAULT_MAX_VIDEO_SIZE}),
  "mediaRecorder": null,
  "displayed": false,
  "active": Object.seal({
    "capturing": false,
    "index": -1,
    "frameUUID": "",
    "canvas": null,
    "startTS": 0,
    "updateTS": 0,
    "stopped": false,
    "error": false,
    "errorMessage": "",
    "timer": Object.seal({
      "timerId": -1,
      "canvas": null,
      "secs": 0,
      "updateTimerId": -1,
      "clear": function() {
        clearTimeout(this.timerId);
        clearUpdateTimer();
        this.timerId = -1;
        this.canvas = null;
        this.secs = 0;
        this.updateTimerId = -1;
      }
    }),
    "clear": function() {
      this.capturing = false;
      this.index = -1;
      this.frameUUID = "";
      this.canvas = null;
      this.startTS = 0;
      this.updateTS = 0;
      this.stopped = false;
      this.error = false;
      this.errorMessage = "";
      this.timer.clear();
    }
  }),
  "listCanvases": null,
  "chunks": null,
  "objectURLs": [],
  "frames": {[TOP_FRAME_UUID]: {"frameUUID": TOP_FRAME_UUID, "canvases": []}},
  "frameElementsTS": 0,
  "frameElementsKeys": [],
  "numBytesRecorded": 0,
  "wrapperMouseHover": false,
  "bodyMutObs": new MutationObserver(observeBodyMutations),
  "canvasMutObs": new MutationObserver(observeCanvasMutations),
  "highlighter": Object.seal({
    "left": null,
    "top": null,
    "right": null,
    "bottom": null,
    "current": null
  }),
  "freeObjectURLs": function() {
    for (let k = 0; k < this.objectURLs.length; k += 1) {
      window.URL.revokeObjectURL(this.objectURLs[k]);
    }
  },
  "disable": function() {
    for (let key of Object.keys(this)) {
      this[key] = null;
    }
  }
});

Ext.port.onMessage.addListener(onMessage);
window.addEventListener("message", handleWindowMessage, true);

Ext.bodyMutObs.observe(document.body, {
  "childList": true,
  "subtree": true
});

function handleWindowMessage(evt) {
  var msg = evt.data;
  var frameElements = Array.from(document.querySelectorAll("iframe"));
  var key = msg.key;
  var keyPos = Ext.frameElementsKeys.indexOf(key);

  if (!key || keyPos < 0) {
    return;
  } else if (msg.ts < Ext.frameElementsTS) {
    identifyFrames();
    Ext.frameElementsKeys.splice(keyPos, 1);
    evt.stopPropagation();
    return;
  }

  Ext.frameElementsKeys.splice(keyPos, 1);
  Ext.frames[msg.frameUUID].node = frameElements[msg.index];
  evt.stopPropagation();
}

function identifyFrames() {
  var frameElements = Array.from(document.querySelectorAll("iframe"));
  Ext.frameElementsTS = Date.now();
  for (let k = 0, n = frameElements.length; k < n; k += 1) {
    let frame = frameElements[k];
    let key = genUUIDv4();
    Ext.frameElementsKeys.push(key);
    frame.contentWindow.postMessage({
      "command": "identify",
      "key": key,
      "ts": Date.now(),
      "index": k
    }, "*");
  }
}

function onMessage(msg) {
  if (msg.command === MessageCommands.CAPTURE_START) {
    handleMessageCaptureStart(msg);
  } else if (msg.command === MessageCommands.CAPTURE_STOP) {
    handleMessageCaptureStop(msg);
  } else if (msg.command === MessageCommands.DISABLE) {
    handleDisable();
  } else if (msg.command === MessageCommands.DISCONNECT) {
    handleMessageDisconnect(msg);
  } else if (msg.command === MessageCommands.DISPLAY) {
    handleDisplay(msg);
  } else if (msg.command === MessageCommands.HIGHLIGHT) {
    handleMessageHighlight(msg);
  } else if (msg.command === MessageCommands.REGISTER) {
    Ext.tabId = msg.tabId;
    Ext.frameId = msg.frameId;
  } else if (msg.command === MessageCommands.UPDATE_CANVASES) {
    handleMessageUpdateCanvases(msg);
  }
}

function handleMessageCaptureStart(msg) {
  let rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  if (msg.success) {
    let row = rows[Ext.active.index];
    let linkCol = row.querySelector(`.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`);
    linkCol.classList.add(CAPTURING_CLASS);
    Ext.active.capturing = true;
    Ext.active.startTS = msg.startTS;
  } else {
    clearActiveRows();
    Ext.active.clear();
  }
}

function handleMessageCaptureStop(msg) {
  var rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  let row = rows[Ext.active.index];
  var linkCol = row.querySelector(`.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`);

  clearActiveRows();
  Ext.active.clear();

  if (msg.success) {
    let link = document.createElement("a");
    link.textContent = "Download";
    link.href = msg.videoURL;
    link.title = prettyFileSize(msg.size);

    if (msg.size) {
      link.addEventListener("click", function(evt) {
        Ext.port.postMessage({
          "command": MessageCommands.DOWNLOAD,
          "tabId": Ext.tabId,
          "frameId": Ext.frameId,
          "frameUUID": TOP_FRAME_UUID,
          "targetFrameUUID": msg.frameUUID,
          "canvasIndex": msg.canvasIndex
        });
        evt.preventDefault();
      }, false);
    } else {
      link.addEventListener("click", function(evt) {
        evt.preventDefault();
      });
    }

    linkCol.appendChild(link);
  } else {
    // error
  }
}

function handleMessageDisconnect(msg) {
  let frameUUID = msg.frameUUID;

  if (Ext.active.capturing && Ext.active.frameUUID === frameUUID) {
    preStopCapture();
    handleMessageCaptureStop({
      "command": MessageCommands.CAPTURE_STOP,
      "tabId": Ext.tabId,
      "frameUUID": Ext.active.frameUUID,
      "targetFrameUUID": TOP_FRAME_UUID,
      "success": false
    });
    showNotification("Iframe was removed while one of its canvases was being recorded.");
  }

  delete Ext.frames[frameUUID];
  updateCanvases();
  Ext.frameElementsTS = Date.now();
}

function handleMessageHighlight(msg, node) {
  var highlighter = Ext.highlighter;
  var frame = Ext.frames[msg.frameUUID];
  node = node || frame.node;

  if (node && highlighter.current) {
    let rect = msg.rect;
    let nodeRect = node.getBoundingClientRect();
    let nodeStyle = window.getComputedStyle(node);
    let borderWidthLeft = parseInt(nodeStyle.borderLeftWidth, 10);
    let borderWidthTop = parseInt(nodeStyle.borderTopWidth, 10);
    let vertTracerStyle = window.getComputedStyle(highlighter.left);
    let horizTracerStyle = window.getComputedStyle(highlighter.top);
    let vertTracerWidth = (
      highlighter.left.offsetWidth +
      (2 * parseInt(vertTracerStyle.borderLeftWidth, 10) || 0)
    );
    let horizTracerWidth = (
      highlighter.top.offsetHeight +
      (2 * parseInt(horizTracerStyle.borderTopWidth, 10) || 0)
    );
    let left = nodeRect.left + rect.left + borderWidthLeft;
    let top = nodeRect.top + rect.top + borderWidthTop;
    let right = nodeRect.left + rect.left + rect.width + borderWidthLeft;
    right = Math.min(
      document.documentElement.clientWidth - vertTracerWidth,
      right
    );
    let bottom = nodeRect.top + rect.top + rect.height + borderWidthTop;
    bottom = Math.min(
      document.documentElement.clientHeight - horizTracerWidth,
      bottom
    );

    if (left >= 0 && left <= window.innerWidth) {
      highlighter.left.classList.remove(HIDDEN_CLASS);
    }
    if (top >= 0 && top <= window.innerHeight) {
      highlighter.top.classList.remove(HIDDEN_CLASS);
    }
    if (right >= 0 && right <= window.innerWidth) {
      highlighter.right.classList.remove(HIDDEN_CLASS);
    }
    if (bottom >= 0 && bottom <= window.innerHeight) {
      highlighter.bottom.classList.remove(HIDDEN_CLASS);
    }

    highlighter.left.style.left = `${left}px`;
    highlighter.top.style.top = `${top}px`;
    highlighter.right.style.left = `${right}px`;
    highlighter.bottom.style.top = `${bottom}px`;
  }

  if (!msg.canCapture && highlighter.current) {
    highlighter.current.classList.add(HIGHLIGHTER_UNAVAILABLE_CLASS);
  }
}

function handleMessageUpdateCanvases(msg) {
  var frameUUID = msg.frameUUID;

  if (frameUUID === BG_FRAME_UUID) {
    Ext.port.postMessage({
      "command": MessageCommands.UPDATE_CANVASES,
      "tabId": Ext.tabId,
      "frameId": Ext.frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": ALL_FRAMES_UUID
    });
    return;
  } else if (Ext.frames[frameUUID]) {
    Ext.frames[frameUUID].canvases = msg.canvases;
  } else {
    Ext.frames[frameUUID] = {
      "frameUUID": frameUUID,
      "canvases": msg.canvases,
      "frameId": msg.frameId
    };
  }

  var canvasIndex = -1;
  var canvasFrameUUID = frameUUID;
  if (Ext.active.capturing) {
    let row = Ext.listCanvases.querySelector(
      `.${LIST_CANVASES_ROW_CLASS}.${CANVAS_CAPTURE_SELECTED_CLASS}`
    );
    let canvasIsLocal = Ext.active.frameUUID === TOP_FRAME_UUID;

    if (canvasIsLocal) {
      canvasIndex = parseInt(Ext.active.index, 10);
    } else if (frameUUID === Ext.active.frameUUID) {
      canvasIndex = parseInt(msg.activeCanvasIndex, 10);
    } else {
      canvasIndex = parseInt(row.dataset.canvasIndex, 10);
      canvasFrameUUID = row.dataset.frameUUID;
    }
  }

  updateCanvases();

  if (Ext.active.capturing) {
    let canvasIsLocal = Ext.active.frameUUID === TOP_FRAME_UUID;

    if (!canvasIsLocal) {
      let row = null;
      let rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
      let frameRows = rows.filter((el) => el.dataset.frameUUID === canvasFrameUUID);
      row = frameRows[canvasIndex];
      for (let k = 0, n = rows.length; k < n; k += 1) {
        if (row === rows[k]) {
          canvasIndex = k;
          break;
        }
      }

      Ext.active.index = canvasIndex;
    }

    setRowActive(canvasIndex);
  }

  identifyFrames();
}

function observeBodyMutations(mutations) {
  mutations = mutations.filter((el) => el.type === "childList");
  var addedCanvases = false;
  var removedCanvases = [];
  var isCanvas = (el) => el.nodeName.toLowerCase() === "canvas";

  for (let k = 0, n = mutations.length; k < n; k += 1) {
    let mutation = mutations[k];
    for (let iK = 0, iN = mutation.addedNodes.length; iK < iN; iK += 1) {
      if (isCanvas(mutation.addedNodes[iK])) {
        addedCanvases = true;
        break;
      }
    }

    removedCanvases = removedCanvases.concat(
      Array.from(mutation.removedNodes).filter(isCanvas)
    );
  }

  const canvasesChanged = addedCanvases || removedCanvases.length;

  if (!canvasesChanged) {
    return;
  }

  for (let k = 0, n = removedCanvases.length; k < n; k += 1) {
    let node = removedCanvases[k];
    if (Ext.active.capturing && node === Ext.active.canvas) {
      if (Ext.active.timer.timerId >= 0) {
        clearTimeout(Ext.active.timer.timerId);
        Ext.active.timer.timerId = -1;
      }
      Ext.active.capturing = false;
      Ext.active.canvas = null;
      preStopCapture();
      break;
    }
  }

  let activeCanvas = Ext.active.canvas;
  let activeFrameUUID = Ext.active.frameUUID;
  let row = null;
  let canvasIsLocal = true;
  let canvasIndex = -1;
  let canvases = Array.from(document.body.querySelectorAll("canvas"));

  if (Ext.active.capturing) {
    row = Ext.listCanvases.querySelector(
      `.${LIST_CANVASES_ROW_CLASS}.${CANVAS_CAPTURE_SELECTED_CLASS}`
    );
    canvasIsLocal = JSON.parse(row.dataset.canvasIsLocal);
    if (!canvasIsLocal) {
      canvasIndex = parseInt(row.dataset.canvasIndex, 10);
    }
  }

  Ext.frames[TOP_FRAME_UUID].canvases = canvases;

  updateCanvases();

  if (Ext.active.capturing && canvasIsLocal) {
    for (let k = 0, n = canvases.length; k < n; k += 1) {
      if (canvases[k] === activeCanvas) {
        canvasIndex = k;
        break;
      }
    }
    setRowActive(canvasIndex);
    Ext.active.index = canvasIndex;
  } else if (Ext.active.capturing && !canvasIsLocal) {
    let rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));

    for (let k = 0, n = rows.length; k < n; k += 1) {
      if (
        parseInt(rows[k].dataset.canvasIndex, 10) === canvasIndex &&
        rows[k].dataset.frameUUID === activeFrameUUID
      ) {
        canvasIndex = k;
        break;
      }
    }
    setRowActive(canvasIndex);
    Ext.active.index = canvasIndex;
  }
}

function observeCanvasMutations(mutations) {
  var canvases = Array.from(document.body.querySelectorAll("canvas"));
  var rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  mutations = mutations.filter((el) => el.type === "attributes");

  for (let k = 0, n = mutations.length; k < n; k += 1) {
    let mutation = mutations[k];
    let canvas = mutation.target;
    let canvasIndex = -1;
    canvases.forEach((el, index) => el === canvas && (canvasIndex = index));
    if (canvasIndex >= 0) {
      let row = rows[canvasIndex];
      let colId = row.querySelector(`.${LIST_CANVASES_CANVAS_ID_CLASS}`);
      let colWidth = row.querySelector(`.${LIST_CANVASES_CANVAS_WIDTH_CLASS}`);
      let colHeight = row.querySelector(`.${LIST_CANVASES_CANVAS_HEIGHT_CLASS}`);
      colId.textContent = canvas.id;
      colWidth.textContent = canvas.width;
      colHeight.textContent = canvas.height;
    }
  }
}

function handleDisable(notify) {
  var wrapper = document.getElementById(WRAPPER_ID);
  if (wrapper) {
    wrapper.parentElement.removeChild(wrapper);
  }

  var modifyTimer = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
  if (modifyTimer) {
    modifyTimer.parentElement.removeChild(modifyTimer);
  }

  var maximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  if (maximize) {
    maximize.parentElement.removeChild(maximize);
  }

  var style = document.getElementById(CSS_STYLE_ID);
  if (style) {
    style.parentElement.removeChild(style);
  }

  for (let key of Object.keys(Ext.highlighter)) {
    if (key !== "current") {
      Ext.highlighter[key].parentElement.removeChild(Ext.highlighter[key]);
    }
  }

  if (Ext.mediaRecorder) {
    Ext.mediaRecorder.removeEventListener("dataavailable", onDataAvailable, false);
    Ext.mediaRecorder.removeEventListener("stop", stopCapture, false);
    Ext.mediaRecorder.removeEventListener("error", preStopCapture, false);

    if (Ext.mediaRecorder.state !== "inactive") {
      Ext.mediaRecorder.stop();
    }
  }

  Ext.freeObjectURLs();
  showNotification(notify);
  Ext.port.disconnect();
  Ext.active.clear();
  Ext.bodyMutObs.disconnect();
  Ext.canvasMutObs.disconnect();

  window.removeEventListener("resize", positionWrapper, false);
  window.removeEventListener("wheel", handleWindowMouseWheel, true);
  window.removeEventListener("message", handleWindowMessage, true);
  window.removeEventListener("keypress", handleKeyEventsOnFocus, true);
  window.removeEventListener("keydown", handleKeyEventsOnFocus, true);
  window.removeEventListener("keyup", handleKeyEventsOnFocus, true);

  Ext.disable();
}

function handleDisplay(msg) {
  Ext.settings.maxVideoSize = msg.defaultSettings.maxVideoSize;
  var cssUrl = browser.runtime.getURL(CSS_FILE_PATH);
  var htmlUrl = browser.runtime.getURL(HTML_FILE_PATH);
  var htmlRowUrl = browser.runtime.getURL(HTML_ROW_FILE_PATH);

  fetch(htmlRowUrl).then(function(response) {
    if (response.ok) {
      return response.text();
    }
    throw new Error(
      `Received ${response.status} ${response.statusText} fetching ${response.url}`
    );
  }).then(function(text) {
    Ext.rowTemplate = document.createElement("template");
    Ext.rowTemplate.innerHTML = text;
    Ext.rowTemplate = Ext.rowTemplate.content.firstElementChild;

    return fetch(cssUrl);
  }).then(function(response) {
    if (response.ok) {
      return response.text();
    }
    throw new Error(
      `Received ${response.status} ${response.statusText} fetching ${response.url}`
    );
  }).then(function(text) {
    var css = document.createElement("style");
    css.type = "text/css";
    css.textContent = text;
    css.id = CSS_STYLE_ID;
    document.head.appendChild(css);

    return fetch(htmlUrl);
  }).then(function(response) {
    if (response.ok) {
      return response.text();
    }
    throw new Error(
      `Received ${response.status} ${response.statusText} fetching ${response.url}`
    );
  }).then(function(text) {
    setupDisplay(text);
  }).catch(function() {
    showNotification("Failed to initialize resources.");
    handleCaptureClose();
  });

  let highlighter = Ext.highlighter;

  for (let key of Object.keys(highlighter)) {
    if (key !== "current") {
      highlighter[key] = document.createElement("div");
      highlighter[key].textContent = " ";
      highlighter[key].classList.add(HIDDEN_CLASS);
      document.body.appendChild(highlighter[key]);
    }
  }

  highlighter.left.classList.add(HIGHLIGHTER_VERTICAL_CLASS);
  highlighter.top.classList.add(HIGHLIGHTER_HORIZONTAL_CLASS);
  highlighter.right.classList.add(HIGHLIGHTER_VERTICAL_CLASS);
  highlighter.bottom.classList.add(HIGHLIGHTER_HORIZONTAL_CLASS);
}

function positionWrapper() {
  if (Ext.displayed) {
    var wrapper = document.getElementById(WRAPPER_ID);
    var bodyRect = document.body.getBoundingClientRect();
    var wrapperRect = wrapper.getBoundingClientRect();
    wrapper.style.left = `${(bodyRect.width / 2) - (wrapperRect.width / 2)}px`;
    positionUpdateTimer();
    positionRowTimerModify();
  }
}

function handleWindowMouseWheel(evt) {
  if (Ext.wrapperMouseHover) {
    evt.stopPropagation();

    return false;
  }

  return true;
}

function setupWrapperEvents() {
  var wrapper = document.getElementById(WRAPPER_ID);
  wrapper.addEventListener("mouseenter", function() {
    Ext.wrapperMouseHover = true;
  }, false);
  wrapper.addEventListener("mouseleave", function() {
    Ext.wrapperMouseHover = false;
  }, false);
  window.addEventListener("wheel", handleWindowMouseWheel, true);
}

function handleKeyEventsOnFocus(evt) {
  evt.stopPropagation();
}

function handleInputFocus() {
  window.addEventListener("keypress", handleKeyEventsOnFocus, true);
  window.addEventListener("keydown", handleKeyEventsOnFocus, true);
  window.addEventListener("keyup", handleKeyEventsOnFocus, true);
}

function handleInputBlur() {
  window.removeEventListener("keypress", handleKeyEventsOnFocus, true);
  window.removeEventListener("keydown", handleKeyEventsOnFocus, true);
  window.removeEventListener("keyup", handleKeyEventsOnFocus, true);
}

function handleCaptureClose() {
  Ext.port.postMessage({
    "command": MessageCommands.DISABLE,
    "tabId": Ext.tabId
  });
}

function maximizeCapture() {
  var captureMaximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  var wrapper = document.getElementById(WRAPPER_ID);
  captureMaximize.classList.add(HIDDEN_CLASS);
  wrapper.classList.remove(HIDDEN_CLASS);
}

function minimizeCapture() {
  var captureMaximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  var wrapper = document.getElementById(WRAPPER_ID);
  captureMaximize.classList.remove(HIDDEN_CLASS);
  wrapper.classList.add(HIDDEN_CLASS);
}

function setupDisplay(html) {
  var captureClose = null;
  var captureMaximize = null;
  var captureMinimize = null;
  var modifyTimerSet = null;
  var modifyTimerClear = null;
  var modifyTimerHours = null;
  var modifyTimerMinutes = null;
  var modifyTimerSeconds = null;
  var wrapper = document.createElement("template");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper.content);
  wrapper = document.getElementById(WRAPPER_ID);
  Ext.listCanvases = document.getElementById(LIST_CANVASES_ID);

  Ext.displayed = true;
  window.addEventListener("resize", positionWrapper, false);

  captureClose = document.getElementById(CAPTURE_CLOSE_ID);
  captureClose.addEventListener("click", handleCaptureClose, false);

  captureMaximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  captureMaximize.addEventListener("click", maximizeCapture, false);
  captureMinimize = document.getElementById(CAPTURE_MINIMIZE_ID);
  captureMinimize.addEventListener("click", minimizeCapture, false);

  modifyTimerSet = document.getElementById(MODIFY_TIMER_SET_ID);
  modifyTimerClear = document.getElementById(MODIFY_TIMER_CLEAR_ID);
  modifyTimerHours = document.getElementById(MODIFY_TIMER_HOURS_ID);
  modifyTimerMinutes = document.getElementById(MODIFY_TIMER_MINUTES_ID);
  modifyTimerSeconds = document.getElementById(MODIFY_TIMER_SECONDS_ID);
  modifyTimerSet.addEventListener("click", handleRowSetTimer, false);
  modifyTimerClear.addEventListener("click", handleRowClearTimer, false);
  modifyTimerHours.addEventListener("focus", handleInputFocus, false);
  modifyTimerHours.addEventListener("blur", handleInputBlur, false);
  modifyTimerMinutes.addEventListener("focus", handleInputFocus, false);
  modifyTimerMinutes.addEventListener("blur", handleInputBlur, false);
  modifyTimerSeconds.addEventListener("focus", handleInputFocus, false);
  modifyTimerSeconds.addEventListener("blur", handleInputBlur, false);

  positionWrapper();
  setupWrapperEvents();

  var canvases = Array.from(document.body.querySelectorAll("canvas"));
  Ext.frames[TOP_FRAME_UUID].canvases = canvases;
  Ext.port.postMessage({
    "command": MessageCommands.DISPLAY,
    "tabId": Ext.tabId,
    "frameId": Ext.frameId,
    "frameUUID": TOP_FRAME_UUID,
    "targetFrameUUID": ALL_FRAMES_UUID,
    "defaultSettings": {
      "maxVideoSize": Ext.settings.maxVideoSize
    }
  });

  updateCanvases();
}

function getAllCanvases() {
  var canvases = Array.from(document.body.querySelectorAll("canvas"));
  canvases = canvases.map(function(el, index) {
    return {
      "element": el,
      "frameUUID": TOP_FRAME_UUID,
      "index": index,
      "local": true,
      "id": el.id,
      "width": el.width,
      "height": el.height
    };
  });

  for (let key of Object.keys(Ext.frames)) {
    if (key !== TOP_FRAME_UUID) {
      let frameCanvases = Ext.frames[key].canvases;
      frameCanvases = frameCanvases.map(function(el, index) {
        var obj = JSON.parse(JSON.stringify(el));
        obj.local = false;
        obj.frameUUID = key;
        obj.index = index;
        return obj;
      });
      canvases = canvases.concat(frameCanvases);
    }
  }
  return canvases;
}

function updateCanvases() {
  var docFrag = document.createDocumentFragment();
  var oldRows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  var canvases = getAllCanvases();
  const addTimerImgUrl = browser.runtime.getURL(ICON_ADD_PATH);

  oldRows.forEach((row) => row.parentElement.removeChild(row));
  canvases.forEach(function(canvas) {
    if (canvas.local) {
      Ext.canvasMutObs.observe(canvas.element, CANVAS_OBSERVER_OPS);
    }
  });

  for (let k = 0, n = canvases.length; k < n; k += 1) {
    let row = Ext.rowTemplate.cloneNode(true);
    let canvas = canvases[k];
    let canvasIsLocal = canvas.local;

    let canvasId = row.querySelector(`.${LIST_CANVASES_CANVAS_ID_CLASS}`);
    canvasId.textContent = canvas.id;
    let dimens = row.querySelector(`.${LIST_CANVASES_CANVAS_DIMENS_CLASS}`);
    dimens.textContent = `${canvas.width}x${canvas.height}`;
    let addTimerImg = row.querySelector(`.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}`);
    addTimerImg.src = addTimerImgUrl;
    addTimerImg.dataset.hasTimer = false;
    let fpsInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_FPS_CLASS} input`);
    fpsInput.value = DEFAULT_FPS;
    fpsInput.addEventListener("focus", handleInputFocus, false);
    fpsInput.addEventListener("blur", handleInputBlur, false);
    let bpsInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_BPS_CLASS} input`);
    bpsInput.value = DEFAULT_BPS;
    bpsInput.addEventListener("focus", handleInputFocus, false);
    bpsInput.addEventListener("blur", handleInputBlur, false);

    let button = row.querySelector(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`);
    button.dataset.index = k;
    button.dataset.canvasIsLocal = canvasIsLocal;
    button.dataset.frameUUID = canvas.frameUUID;
    button.dataset.canvasIndex = canvas.index;

    row.dataset.index = k;
    row.dataset.canvasIsLocal = canvasIsLocal;
    row.dataset.frameUUID = canvas.frameUUID;
    row.dataset.canvasIndex = canvas.index;
    setRowEventListeners(row);
    docFrag.appendChild(row);
  }

  Ext.listCanvases.appendChild(docFrag);
  Ext.active.updateTS = Date.now();
}

function setRowEventListeners(
  ro,
  {row = true, img = true, button = true} = {"row": true, "img": true, "button": true}
) {
  if (img) {
    ro.querySelector(`.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}`)
      .addEventListener("click", handleRowTimerModify, false);
  }

  if (row) {
    ro.addEventListener("mouseenter", highlightCanvas, false);
    ro.addEventListener("mouseleave", unhighlightCanvas, false);
  }

  if (button) {
    ro.querySelector(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`)
      .addEventListener("click", onToggleCapture, false);
  }
}

function clearRowEventListeners(
  ro,
  {row = true, img = true, button = true} = {"row": true, "img": true, "button": true}
) {
  if (img) {
    ro.querySelector(`.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}`)
      .removeEventListener("click", handleRowTimerModify, false);
  }

  if (row) {
    ro.removeEventListener("mouseenter", highlightCanvas, false);
    ro.removeEventListener("mouseleave", unhighlightCanvas, false);
  }

  if (button) {
    ro.querySelector(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`)
      .removeEventListener("click", onToggleCapture, false);
  }
}

function positionRowTimerModify() {
  var wrapper = document.getElementById(WRAPPER_ID);
  var container = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
  var containerRect = null;
  var img = wrapper.querySelector(`.${TIMER_MODIFYING_CLASS}`);
  var imgRect = null;

  if (img) {
    containerRect = container.getBoundingClientRect();
    imgRect = img.getBoundingClientRect();
    container.style.left = `${imgRect.left + (0.5 * imgRect.width) - Math.trunc(0.5 * containerRect.width)}px`;
    container.style.top = `${imgRect.top - containerRect.height - 20}px`;
  }
}

function handleRowTimerModify(evt) {
  var container = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
  var img = evt.target;
  var rows = Array.from(document.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  var row = img.parentElement;
  var hasTimer = JSON.parse(img.dataset.hasTimer || false);
  var hoursInput = document.getElementById(MODIFY_TIMER_HOURS_ID);
  var minutesInput = document.getElementById(MODIFY_TIMER_MINUTES_ID);
  var secondsInput = document.getElementById(MODIFY_TIMER_SECONDS_ID);

  img.dataset.ts = Date.now();
  img.classList.add(TIMER_MODIFYING_CLASS);

  if (hasTimer) {
    let secs = parseInt(img.dataset.timerSeconds, 10) || 0;
    let {hours, minutes, seconds} = secondsToHMS(secs);
    hoursInput.value = hours;
    minutesInput.value = minutes;
    secondsInput.value = seconds;
  } else {
    hoursInput.value = 0;
    minutesInput.value = 0;
    secondsInput.value = 0;
  }

  while (row && !row.classList.contains(LIST_CANVASES_ROW_CLASS)) {
    row = row.parentElement;
  }

  for (let k = 0, n = rows.length; k < n; k += 1) {
    let ro = rows[k];
    if (row === ro) {
      ro.classList.add(CANVAS_CAPTURE_SELECTED_CLASS);
    } else {
      ro.classList.add(CANVAS_CAPTURE_INACTIVE_CLASS);
    }

    clearRowEventListeners(ro, {"row": false});
  }

  container.classList.remove(HIDDEN_CLASS);
  positionRowTimerModify();
}

function handleRowTimerModifyClose(img) {
  const addImgUrl = browser.runtime.getURL(ICON_ADD_PATH);
  const timerImgUrl = browser.runtime.getURL(ICON_TIMER_PATH);
  var container = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
  var hasTimer = img && ("hasTimer" in img.dataset) && JSON.parse(img.dataset.hasTimer);
  var rows = Array.from(document.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));

  if (img) {
    if (hasTimer) {
      img.src = timerImgUrl;
      img.title = "Modify timer";
    } else {
      img.src = addImgUrl;
      img.title = "Add a timer";
    }
  }

  for (let k = 0, n = rows.length; k < n; k += 1) {
    let row = rows[k];
    row.classList.remove(
      CANVAS_CAPTURE_SELECTED_CLASS,
      CANVAS_CAPTURE_INACTIVE_CLASS
    );
    setRowEventListeners(row);
  }

  container.classList.add(HIDDEN_CLASS);
}

function handleRowSetTimer() {
  var img = Ext.listCanvases.querySelector(
    `.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}.${TIMER_MODIFYING_CLASS}`
  );
  var ts = (img && parseInt(img.dataset.ts, 10)) || 0;

  if (ts < Ext.active.updateTS) {
    handleRowTimerModifyClose(img);
    return;
  }

  var hoursInput = document.getElementById(MODIFY_TIMER_HOURS_ID);
  var minutesInput = document.getElementById(MODIFY_TIMER_MINUTES_ID);
  var secondsInput = document.getElementById(MODIFY_TIMER_SECONDS_ID);
  var hours = parseInt(hoursInput.value, 10) || 0;
  var minutes = parseInt(minutesInput.value, 10) || 0;
  var seconds = parseInt(secondsInput.value, 10) || 0;
  var totalSecs = hmsToSeconds({hours, minutes, seconds});

  img.dataset.hasTimer = Boolean(totalSecs);
  img.dataset.timerSeconds = totalSecs;
  handleRowTimerModifyClose(img);
}

function handleRowClearTimer() {
  var img = Ext.listCanvases.querySelector(
    `.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}.${TIMER_MODIFYING_CLASS}`
  );
  var ts = (img && parseInt(img.dataset.ts, 10)) || 0;

  if (ts < Ext.active.updateTS) {
    handleRowTimerModifyClose(img);
    return;
  }

  img.dataset.hasTimer = false;
  img.dataset.timerSeconds = 0;
  handleRowTimerModifyClose(img);
}

function positionUpdateTimer() {
  var wrapper = document.getElementById(WRAPPER_ID);
  var timer = document.getElementById(TIMER_SLICE_CONTAINER_ID);
  var wrapperRect = wrapper.getBoundingClientRect();
  var timerRect = timer.getBoundingClientRect();
  var left = (0.5 * wrapperRect.width) - (0.5 * timerRect.width);
  var top = (0.5 * wrapperRect.height) - (0.5 * timerRect.height);
  timer.style.left = `${left}px`;
  timer.style.top = `${top}px`;
}

function setUpdateTimer() {
  var updateTimerMS = 75;
  var timer = document.getElementById(TIMER_SLICE_CONTAINER_ID);
  var clipPath = document.getElementById(TIMER_SLICE_CLIP_PATH_ID);
  Ext.active.timer.updateTimerId = setInterval(updateTimerDisplay, updateTimerMS);
  timer.classList.remove("hidden");
  positionUpdateTimer();
  clipPath.setAttribute("d", "M0,0 L100,0 L100,100 L0,100 Z");
}

function clearUpdateTimer() {
  let timer = document.getElementById(TIMER_SLICE_CONTAINER_ID);
  timer.classList.add("hidden");
  clearTimeout(Ext.active.timer.updateTimerId);
}

function updateTimerDisplay() {
  var clipPath = document.getElementById(TIMER_SLICE_CLIP_PATH_ID);
  var frac = ((Date.now() - Ext.active.startTS) / MSEC_PER_SEC) / Ext.active.timer.secs;
  frac = Math.min(frac, 1);
  const rd = 48;
  const cx = 50;
  const cy = 50;
  const angle = (2 * Math.PI * frac);
  const phase = 0.5 * Math.PI;
  const theta = phase + angle;
  const sweep = (frac <= 0.5) ? 1 : 0;
  const x2 = 50;
  const y2 = cy - rd;
  const x1 = (rd * Math.cos(theta)) + cx;
  const y1 = (-rd * Math.sin(theta)) + cy;
  const path = `M${cx},${cy} L${x1},${y1} A${rd},${rd} 0 ${sweep} 0 ${x2},${y2} Z`;
  clipPath.setAttribute("d", path);
}

function highlightCanvas(evt) {
  var el = evt.target;

  if (!el.classList.contains(LIST_CANVASES_ROW_CLASS)) {
    return;
  }

  Ext.highlighter.current = el;

  if (JSON.parse(el.dataset.canvasIsLocal)) {
    let canvas = Ext.frames[TOP_FRAME_UUID].canvases[el.dataset.index];
    let rect = canvas.getBoundingClientRect();

    handleMessageHighlight({
      "frameUUID": TOP_FRAME_UUID,
      "rect": {
        "width": rect.width,
        "height": rect.height,
        "left": 0,
        "top": 0,
        "right": 0,
        "bottom": 0,
        "x": 0,
        "y": 0
      },
      "canCapture": canCaptureStream(canvas)
    }, Ext.frames[TOP_FRAME_UUID].canvases[el.dataset.index]);
  } else {
    Ext.port.postMessage({
      "command": MessageCommands.HIGHLIGHT,
      "tabId": Ext.tabId,
      "frameId": Ext.frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": el.dataset.frameUUID,
      "canvasIndex": el.dataset.canvasIndex
    });
  }

  evt.stopPropagation();
}

function unhighlightCanvas(evt) {
  var el = evt.target;
  var highlighter = Ext.highlighter;

  if (
    !el.classList.contains(LIST_CANVASES_ROW_CLASS) ||
    el !== highlighter.current
  ) {
    return;
  }

  for (let key of Object.keys(highlighter)) {
    if (key !== "current") {
      highlighter[key].classList.add(HIDDEN_CLASS);
    }
  }

  el.classList.remove(HIGHLIGHTER_UNAVAILABLE_CLASS);
  highlighter.current = null;
}

function onToggleCapture(evt) {
  var button = evt.target;

  button.blur();

  if (Ext.active.capturing) {
    preStopCapture();
  } else {
    preStartCapture(button);
  }
}

function setRowActive(index) {
  var rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  var linkCol = rows[index].querySelector(`.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`);
  var linkRow = null;

  for (let k = 0; k < rows.length; k += 1) {
    let row = rows[k];

    if (parseInt(row.dataset.index, 10) === index) {
      row.classList.add(CANVAS_CAPTURE_SELECTED_CLASS);
      clearRowEventListeners(row, {"button": false, "row": false});
      row.querySelector(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`).textContent = "Stop";
      linkRow = row;
    } else {
      row.classList.add(CANVAS_CAPTURE_INACTIVE_CLASS);
      clearRowEventListeners(row, {"row": false});
    }
  }

  linkCol.classList.add(CAPTURING_CLASS);
  try {
    linkRow.scrollIntoView(
      {"block": "center", "behavior": "smooth", "inline": "center"}
    );
  } catch (e) {
    linkRow.scrollIntoView({"behavior": "smooth", "inline": "center"});
  }
}

function clearActiveRows() {
  var rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));

  for (let k = 0; k < rows.length; k += 1) {
    let row = rows[k];
    row.classList.remove(
      CANVAS_CAPTURE_INACTIVE_CLASS,
      CANVAS_CAPTURE_SELECTED_CLASS
    );
    setRowEventListeners(row);
    row.querySelector(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`).textContent = "Capture";
    row.querySelector(`.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`)
      .classList.remove(CAPTURING_CLASS);
  }
}

function preStartCapture(button) {
  var rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  var canvasIsLocal = JSON.parse(button.dataset.canvasIsLocal);
  Ext.active.index = button.dataset.index;
  Ext.active.frameUUID = button.dataset.frameUUID;
  var index = Ext.active.index;
  var row = rows[index];
  var timerImg = row.querySelector(`.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}`);
  var hasTimer = JSON.parse(timerImg.dataset.hasTimer || false);
  var timerSeconds = parseInt(timerImg.dataset.timerSeconds, 10) || 0;
  var canvases = Ext.frames[Ext.active.frameUUID].canvases;
  var canvas = canvasIsLocal ? canvases[index] : canvases[button.dataset.canvasIndex];
  var linkCol = row.querySelector(`.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`);
  linkCol.textContent = "";

  if (canvasIsLocal && !canCaptureStream(canvas)) {
    return;
  }

  setRowActive(parseInt(index, 10));

  var fpsInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_FPS_CLASS} input`);
  var fps = parseFloat(fpsInput.value);
  fps = (isFinite(fps) && !isNaN(fps) && fps >= 0) ? fps : 0;
  var bpsInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_BPS_CLASS} input`);
  var bps = parseFloat(bpsInput.value);
  bps = (isFinite(bps) && !isNaN(bps) && bps > 0) ? bps : DEFAULT_BPS;

  if (timerSeconds) {
    setUpdateTimer();
  }

  if (canvasIsLocal) {
    let ret = startCapture(canvas, fps, bps, timerSeconds);
    if (!ret) {
      clearActiveRows();
      Ext.active.clear();
    }
  } else {
    Ext.port.postMessage({
      "command": MessageCommands.CAPTURE_START,
      "tabId": Ext.tabId,
      "frameId": Ext.frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": button.dataset.frameUUID,
      "canvasIndex": button.dataset.canvasIndex,
      "fps": fps,
      "bps": bps,
      "hasTimer": hasTimer,
      "timerSeconds": timerSeconds
    });
    Ext.active.canvas = canvas;
    Ext.active.timer.secs = timerSeconds;
  }
}

function startCapture(canvas, fps, bps, timerSeconds) {
  Ext.chunks = [];
  var stream = null;

  if (!canvas) {
    return false;
  }

  try {
    stream = canvas.captureStream(fps);
  } catch (e) {
    return false;
  }

  try {
    Ext.mediaRecorder = new MediaRecorder(
      stream,
      {"mimeType": MIME_TYPE_MAP[DEFAULT_MIME_TYPE], "bitsPerSecond": bps}
    );
  } catch (e) {
    Ext.mediaRecorder = new MediaRecorder(stream);
  }
  Ext.mediaRecorder.addEventListener("dataavailable", onDataAvailable, false);
  Ext.mediaRecorder.addEventListener("stop", stopCapture, false);
  Ext.mediaRecorder.addEventListener("error", preStopCapture, false);
  Ext.mediaRecorder.start(CAPTURE_INTERVAL_MS);
  Ext.active.capturing = true;
  Ext.active.canvas = canvas;
  Ext.active.startTS = Date.now();
  if (timerSeconds) {
    Ext.active.timer.secs = timerSeconds;
    Ext.active.timer.canvas = canvas;
    Ext.active.timer.timerId = setTimeout(preStopCapture, timerSeconds * MSEC_PER_SEC);
  }

  return true;
}

function preStopCapture(evt) {
  var buttons = Array.from(Ext.listCanvases.querySelectorAll(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`));
  var button = buttons[Ext.active.index];
  var canvasIsLocal = JSON.parse(button.dataset.canvasIsLocal);

  if (evt && evt.error) {
    Ext.active.error = true;
    Ext.active.errorMessage = evt.error.message;
  } else {
    Ext.active.stopped = true;
  }

  clearActiveRows();

  if (canvasIsLocal) {
    if (Ext.mediaRecorder && Ext.mediaRecorder.state !== "inactive") {
      Ext.mediaRecorder.stop();
    }
  } else {
    Ext.port.postMessage({
      "command": MessageCommands.CAPTURE_STOP,
      "tabId": Ext.tabId,
      "frameId": Ext.frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": button.dataset.frameUUID,
      "canvasIndex": button.dataset.canvasIndex
    });
  }
}

function createVideoURL(blob) {
  var rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  var row = rows[Ext.active.index];
  var col = row.querySelector(`.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`);
  var videoURL = "";
  var link = document.createElement("a");
  var size = blob ? blob.size : 0;

  if (blob) {
    videoURL = window.URL.createObjectURL(blob);
  } else {
    link.addEventListener("click", function(evt) {
      evt.preventDefault();
    });
  }

  link.textContent = "Download";
  link.download = `capture-${Math.trunc(Date.now() / 1000)}.${DEFAULT_MIME_TYPE}`;
  link.href = videoURL;
  link.title = prettyFileSize(size);
  col.appendChild(link);
  Ext.objectURLs.push(videoURL);
}

function stopCapture() {
  var blob = null;
  if (Ext.active.capturing && !Ext.active.error && Ext.active.stopped) {
    if (Ext.chunks.length) {
      blob = new Blob(Ext.chunks, {"type": Ext.chunks[0].type});
    }
    createVideoURL(blob);
  } else if (Ext.active.error) {
    showNotification("An error occured while recording.");
  } else if (!Ext.active.stopped) {//eslint-disable-line
    clearActiveRows();
    showNotification("Recording unexpectedly stopped, likely due to canvas inactivity.");
  } else {
    showNotification("Canvas was removed while it was being recorded.");
  }

  Ext.mediaRecorder = null;
  Ext.chunks = null;
  Ext.active.clear();
  Ext.numBytesRecorded = 0;
}

function onDataAvailable(evt) {
  var blob = evt.data;

  if (blob.size) {
    Ext.chunks.push(blob);
    Ext.numBytesRecorded += blob.size;

    if (Ext.numBytesRecorded >= Ext.settings.maxVideoSize) {
      preStopCapture();
    }
  }
}

function canCaptureStream(canvas) {
  try {
    if (canvas.captureStream(0)) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function showNotification(notification) {
  Ext.port.postMessage({
    "command": MessageCommands.NOTIFY,
    "tabId": Ext.tabId,
    "frameUUID": TOP_FRAME_UUID,
    "notification": notification
  });
}

function prettyFileSize(nBytes, useSI) {
  const SI_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const IEC_UNITS = ["B", "kiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  const mult = useSI ? 1000 : 1024;
  const units = useSI ? SI_UNITS : IEC_UNITS;
  var index = 0;

  while (Math.abs(nBytes) >= mult) {
    index += 1;
    nBytes /= mult;
  }

  return `${nBytes.toFixed(Boolean(index))} ${units[index]}`;
}

function hmsToSeconds({hours, minutes, seconds}) {
  return (hours * 3600) + (minutes * 60) + seconds;
}

function secondsToHMS(secs) {
  var hours = Math.trunc(secs / 3600);
  var minutes = Math.trunc((secs - (hours * 3600)) / 60);
  var seconds = secs - (hours * 3600) - (minutes * 60);

  if (seconds >= 60) {
    seconds -= (seconds % 60);
    minutes += 1;
  }

  if (minutes >= 60) {
    minutes -= (minutes % 60);
    hours += 1;
  }

  return {hours, minutes, seconds};
}

function genUUIDv4() {
  /* https://stackoverflow.com/a/2117523/1031545 */
  /* eslint-disable no-bitwise, id-length, no-mixed-operators */
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
  /* eslint-enable no-bitwise, id-length, no-mixed-operators */
}

}());
