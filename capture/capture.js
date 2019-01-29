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


 /* global browser Utils */

; // eslint-disable-line no-extra-semi
(function() {
"use strict";

const TOP_FRAME_UUID = "top";
const BG_FRAME_UUID = "background";
const ALL_FRAMES_UUID = "*";

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

const MIME_TYPE_MAP = Object.freeze({
  "mp4":  "video/mp4",
  "webm": "video/webm"
});
const DEFAULT_MIME_TYPE = "webm";
const CAPTURE_INTERVAL_MS = 1000;
const DEFAULT_DELAY = 0;
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
const DELAY_OVERLAY_ID = "capture_delay_overlay";
const DELAY_OVERLAY_TIME_ID = "capture_delay_overlay_time";
const DELAY_OVERLAY_SKIP_ID = "capture_delay_overlay_skip";
const DELAY_OVERLAY_CANCEL_ID = "capture_delay_overlay_cancel";

const LIST_CANVASES_ROW_CLASS = "list_canvases_row";
const CANVAS_CAPTURE_TOGGLE_CLASS = "canvas_capture_toggle";
const LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS = "list_canvases_capture_timer_img";
const LIST_CANVASES_CANVAS_ID_CLASS = "list_canvases_canvas_id";
const LIST_CANVASES_CANVAS_DIMENS_CLASS = "list_canvases_canvas_dimens";
const LIST_CANVASES_CANVAS_WIDTH_CLASS = "list_canvases_canvas_width";
const LIST_CANVASES_CANVAS_HEIGHT_CLASS = "list_canvases_canvas_height";
const LIST_CANVASES_CAPTURE_DELAY_CLASS = "list_canvases_capture_delay";
const LIST_CANVASES_CAPTURE_FPS_CLASS = "list_canvases_capture_fps";
const LIST_CANVASES_CAPTURE_BPS_CLASS = "list_canvases_capture_bps";
const CANVAS_CAPTURE_LINK_CONTAINER_CLASS = "canvas_capture_link_container";
const CANVAS_CAPTURE_SELECTED_CLASS = "canvas_capture_selected";
const CANVAS_CAPTURE_INACTIVE_CLASS = "canvas_capture_inactive";
const TIMER_MODIFYING_CLASS = "timer_modifying";
const CAPTURING_CLASS = "capturing";
const CAPTURING_MINIMIZED_CLASS = "capturing_minimized";
const HIDDEN_CLASS = "hidden";
const HIGHLIGHTER_UNAVAILABLE_CLASS = "highlighter_unavailable";
const HIGHLIGHTER_HORIZONTAL_CLASS = "highlighter_horizontal";
const HIGHLIGHTER_VERTICAL_CLASS = "highlighter_vertical";

const CANVAS_OBSERVER_OPS = Object.freeze({
  "attributes": true,
  "attributeFilter": ["id", "width", "height"]
});

const INPUT_BLUR_UPDATE_SETTINGS_MAP = Object.freeze({
  [LIST_CANVASES_CAPTURE_FPS_CLASS]: "fps",
  [LIST_CANVASES_CAPTURE_BPS_CLASS]: "bps"
});

const Ext = Object.seal({
  "tabId": null,
  "frameId": null,
  "port": browser.runtime.connect({
    "name": TOP_FRAME_UUID
  }),
  "rowTemplate": null,
  "settings": Object.seal({
    "maxVideoSize": DEFAULT_MAX_VIDEO_SIZE,
    "fps": 0,
    "bps": 0
  }),
  "mediaRecorder": null,
  "displayed": false,
  "minimized": false,
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
    "delay": Object.seal({
      "startTS": 0,
      "delaySecs": 0,
      "timerId": -1,
      "updateTimerId": -1,
      "options": null,
      "clear": function() {
        clearTimeout(this.timerId);
        clearTimeout(this.updateTimerId);
        this.startTS = 0;
        this.delaySecs = 0;
        this.timerId = -1;
        this.updateTimerId = -1;
        this.options = null;
      }
    }),
    "timer": Object.seal({
      "timerId": -1,
      "secs": 0,
      "updateTimerId": -1,
      "clear": function() {
        clearTimeout(this.timerId);
        clearUpdateTimer();
        this.timerId = -1;
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
      this.delay.clear();
      this.timer.clear();
    }
  }),
  "listCanvases": null,
  "chunks": null,
  "objectURLs": [],
  "frames": {[TOP_FRAME_UUID]: {"frameUUID": TOP_FRAME_UUID, "canvases": []}},
  "frameElementsTS": 0,
  "frameElementsKeys": [],
  "frameElementsTimeoutId": -1,
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
    this.freeObjectURLs();
    for (const key of Object.keys(this)) {
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
  const msg = evt.data;
  const key = msg.key;
  const keyPos = Ext.frameElementsKeys.indexOf(key);

  if (!key || keyPos < 0) {
    return;
  } else if (msg.ts < Ext.frameElementsTS) {
    if (Ext.frameElementsTimeoutId < 0) {
      // Delay immediate retry to try and avoid race condition
      Ext.frameElementsTimeoutId = setTimeout(identifyFrames, 2000);
    }
    Ext.frameElementsKeys.splice(keyPos, 1);
    evt.stopPropagation();
    return;
  }

  const frameElements = Array.from(document.querySelectorAll("iframe"));
  Ext.frameElementsKeys.splice(keyPos, 1);
  Ext.frames[msg.frameUUID].node = frameElements[msg.index];
  evt.stopPropagation();
}

function identifyFrames() {
  const frameElements = Array.from(document.querySelectorAll("iframe"));
  Ext.frameElementsTimeoutId = -1;
  Ext.frameElementsTS = Date.now();
  for (let k = 0, n = frameElements.length; k < n; k += 1) {
    const frame = frameElements[k];
    const key = genUUIDv4();
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
  } else if (msg.command === MessageCommands.UPDATE_SETTINGS) {
    handleMessageUpdateSettings(msg);
  }
}

function handleMessageCaptureStart(msg) {
  if (msg.success) {
    Ext.active.capturing = true;
    Ext.active.startTS = msg.startTS;
    setCapturing();
  } else {
    clearActiveRows();
    Ext.active.clear();
  }
}

function handleMessageCaptureStop(msg) {
  const linkCol = Ext.listCanvases.querySelectorAll(
    `.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`
  )[Ext.active.index];

  clearCapturing();
  clearActiveRows();
  Ext.active.clear();

  if (msg.success) {
    const link = document.createElement("a");
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
  const frameUUID = msg.frameUUID;

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
  const highlighter = Ext.highlighter;
  const frame = Ext.frames[msg.frameUUID];
  node = node || frame.node;

  if (node && highlighter.current) {
    const rect = msg.rect;
    const nodeRect = node.getBoundingClientRect();
    const nodeStyle = window.getComputedStyle(node);
    const borderWidthLeft = parseInt(nodeStyle.borderLeftWidth, 10);
    const borderWidthTop = parseInt(nodeStyle.borderTopWidth, 10);
    const vertTracerStyle = window.getComputedStyle(highlighter.left);
    const horizTracerStyle = window.getComputedStyle(highlighter.top);
    const vertTracerWidth = (
      highlighter.left.offsetWidth +
      (2 * parseInt(vertTracerStyle.borderLeftWidth, 10) || 0)
    );
    const horizTracerWidth = (
      highlighter.top.offsetHeight +
      (2 * parseInt(horizTracerStyle.borderTopWidth, 10) || 0)
    );
    const left = nodeRect.left + rect.left + borderWidthLeft;
    const top = nodeRect.top + rect.top + borderWidthTop;
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
  const frameUUID = msg.frameUUID;

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
    const row = Ext.listCanvases.querySelector(
      `.${LIST_CANVASES_ROW_CLASS}.${CANVAS_CAPTURE_SELECTED_CLASS}`
    );
    const canvasIsLocal = Ext.active.frameUUID === TOP_FRAME_UUID;

    if (canvasIsLocal) {
      canvasIndex = parseInt(Ext.active.index, 10);
    } else if (frameUUID === Ext.active.frameUUID) {
      canvasIndex = parseInt(msg.activeCanvasIndex, 10);
    } else {
      canvasIndex = parseInt(row.dataset.canvasIndex, 10);
      canvasFrameUUID = row.dataset.frameUUID;
    }
  } else if (Ext.active.delay.timerId >= 0) {
    const canvasIsLocal = Ext.active.delay.options.canvasIsLocal;
    if (canvasIsLocal) {
      canvasIndex = Ext.active.delay.options.canvasIndex;
    } else if (frameUUID === Ext.active.delay.options.frameUUID) {
      canvasIndex = parseInt(msg.delayCanvasIndex, 10);
      if (canvasIndex >= 0) {
        Ext.active.delay.options.canvasIndex = canvasIndex;
      } else {
        handleCancelDelay();
      }
    } else {
      canvasIndex = Ext.active.delay.options.canvasIndex;
      canvasFrameUUID = Ext.active.delay.options.frameUUID;
    }
  }

  updateCanvases();

  if (Ext.active.capturing || Ext.active.delay.timerId >= 0) {
    const canvasIsLocal =
      (Ext.active.capturing)
      ? (Ext.active.frameUUID === TOP_FRAME_UUID)
      : Ext.active.delay.options.canvasIsLocal;

    if (!canvasIsLocal) {
      const rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
      const frameRows = rows.filter((el) => el.dataset.frameUUID === canvasFrameUUID);
      const row = frameRows[canvasIndex];
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

  if (Date.now() > Ext.frameElementsTS + 2000) {
    identifyFrames();
  } else if (Ext.frameElementsTimeoutId < 0) {
    Ext.frameElementsTimeoutId = setTimeout(identifyFrames, 2000);
  }
}

function handleMessageUpdateSettings(msg) {
  const settings = msg.defaultSettings;
  for (const key of Object.keys(Ext.settings)) {
    if (key in settings) {
      Ext.settings[key] = settings[key];
    }
  }
}

function observeBodyMutations(mutations) {
  mutations = mutations.filter((el) => el.type === "childList");
  var addedCanvases = false;
  var removedCanvases = [];
  const isCanvas = (el) => el.nodeName.toLowerCase() === "canvas";

  for (let k = 0, n = mutations.length; k < n; k += 1) {
    const mutation = mutations[k];
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
    const node = removedCanvases[k];
    if (Ext.active.capturing && node === Ext.active.canvas) {
      if (Ext.active.timer.timerId >= 0) {
        clearTimeout(Ext.active.timer.timerId);
        Ext.active.timer.timerId = -1;
      }
      Ext.active.capturing = false;
      Ext.active.canvas = null;
      preStopCapture();
      break;
    } else if (
      Ext.active.delay.timerId >= 0 &&
      Ext.active.delay.options.canvasIsLocal &&
      Ext.active.delay.options.canvasIndex === k
    ) {
      handleCancelDelay();
      break;
    }
  }

  const activeCanvas = Ext.active.canvas;
  const activeFrameUUID = Ext.active.frameUUID;
  const canvases = Array.from(document.body.querySelectorAll("canvas"));
  let canvasIsLocal = true;
  let canvasIndex = -1;

  if (Ext.active.capturing) {
    const row = Ext.listCanvases.querySelector(
      `.${LIST_CANVASES_ROW_CLASS}.${CANVAS_CAPTURE_SELECTED_CLASS}`
    );
    canvasIsLocal = JSON.parse(row.dataset.canvasIsLocal);
    if (!canvasIsLocal) {
      canvasIndex = parseInt(row.dataset.canvasIndex, 10);
    }
  } else if (Ext.active.delay.timerId >= 0) {
    canvasIsLocal = Ext.active.delay.options.canvasIsLocal;
    canvasIndex = Ext.active.delay.options.canvasIndex;
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
    const rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));

    for (let k = 0, n = rows.length; k < n; k += 1) {
      const ro = rows[k];
      if (
        ro.dataset.frameUUID === activeFrameUUID &&
        parseInt(ro.dataset.canvasIndex, 10) === canvasIndex
      ) {
        canvasIndex = k;
        break;
      }
    }

    setRowActive(canvasIndex);
    Ext.active.index = canvasIndex;
  } else if (Ext.active.delay.timerId >= 0 && canvasIsLocal) {
    for (let k = 0, n = canvases.length; k < n; k += 1) {
      if (canvases[k] === activeCanvas) {
        canvasIndex = k;
        break;
      }
    }

    setRowActive(canvasIndex);
    Ext.active.index = canvasIndex;
  } else if (Ext.active.delay.timerId >= 0 && !canvasIsLocal) {
    const rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
    const frameUUID = Ext.active.delay.options.frameUUID;

    for (let k = 0, n = rows.length; k < n; k += 1) {
      const ro = rows[k];
      if (
        ro.dataset.frameUUID === frameUUID &&
        parseInt(ro.dataset.canvasIndex, 10) === canvasIndex
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
  const canvases = Array.from(document.body.querySelectorAll("canvas"));
  const rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  mutations = mutations.filter((el) => el.type === "attributes");

  for (let k = 0, n = mutations.length; k < n; k += 1) {
    const mutation = mutations[k];
    const canvas = mutation.target;
    let canvasIndex = -1;
    canvases.forEach((el, index) => el === canvas && (canvasIndex = index));
    if (canvasIndex >= 0) {
      const row = rows[canvasIndex];
      const colId = row.querySelector(`.${LIST_CANVASES_CANVAS_ID_CLASS}`);
      const colWidth = row.querySelector(`.${LIST_CANVASES_CANVAS_WIDTH_CLASS}`);
      const colHeight = row.querySelector(`.${LIST_CANVASES_CANVAS_HEIGHT_CLASS}`);
      colId.textContent = canvas.id;
      colWidth.textContent = canvas.width;
      colHeight.textContent = canvas.height;
    }
  }
}

function handleDisable(notify) {
  showNotification(notify);
  Ext.port.disconnect();
  Ext.active.clear();
  Ext.bodyMutObs.disconnect();
  Ext.canvasMutObs.disconnect();

  const wrapper = document.getElementById(WRAPPER_ID);
  if (wrapper) {
    wrapper.parentElement.removeChild(wrapper);
  }

  const modifyTimer = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
  if (modifyTimer) {
    modifyTimer.parentElement.removeChild(modifyTimer);
  }

  const maximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  if (maximize) {
    maximize.parentElement.removeChild(maximize);
  }

  const style = document.getElementById(CSS_STYLE_ID);
  if (style) {
    style.parentElement.removeChild(style);
  }

  for (const key of Object.keys(Ext.highlighter)) {
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
  Ext.settings.fps = msg.defaultSettings.fps;
  Ext.settings.bps = msg.defaultSettings.bps;
  const cssUrl = browser.runtime.getURL(CSS_FILE_PATH);
  const htmlUrl = browser.runtime.getURL(HTML_FILE_PATH);
  const htmlRowUrl = browser.runtime.getURL(HTML_ROW_FILE_PATH);

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
    const css = document.createElement("style");
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

  const highlighter = Ext.highlighter;

  for (const key of Object.keys(highlighter)) {
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
  const wrapper = document.getElementById(WRAPPER_ID);
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

function handleInputBlur(e) {
  const el = e.target.parentElement;

  if (el) {
    for (const key of Object.keys(INPUT_BLUR_UPDATE_SETTINGS_MAP)) {
      if (el.classList.contains(key)) {
        Ext.port.postMessage({
          "command": MessageCommands.UPDATE_SETTINGS,
          "setting": INPUT_BLUR_UPDATE_SETTINGS_MAP[key],
          "value": e.target.value
        });
      }
    }
  }

  window.removeEventListener("keypress", handleKeyEventsOnFocus, true);
  window.removeEventListener("keydown", handleKeyEventsOnFocus, true);
  window.removeEventListener("keyup", handleKeyEventsOnFocus, true);
}

function handleCaptureClose(evt) {
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }

  Ext.port.postMessage({
    "command": MessageCommands.DISABLE,
    "tabId": Ext.tabId
  });
}

function maximizeCapture(evt) {
  const captureMaximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  const wrapper = document.getElementById(WRAPPER_ID);

  evt.preventDefault();
  evt.stopPropagation();
  captureMaximize.classList.add(HIDDEN_CLASS);
  wrapper.classList.remove(HIDDEN_CLASS);
  Ext.minimized = false;
}

function minimizeCapture(evt) {
  const captureMaximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  const wrapper = document.getElementById(WRAPPER_ID);

  evt.preventDefault();
  evt.stopPropagation();
  captureMaximize.classList.remove(HIDDEN_CLASS);
  wrapper.classList.add(HIDDEN_CLASS);
  Ext.minimized = true;
}

function setupDisplay(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  document.body.appendChild(template.content);
  const wrapper = document.getElementById(WRAPPER_ID);
  Ext.listCanvases = document.getElementById(LIST_CANVASES_ID);

  wrapper.addEventListener("click", function(evt) {
    evt.stopPropagation();
  }, false);

  Ext.displayed = true;
  window.addEventListener("resize", positionWrapper, false);

  const captureClose = document.getElementById(CAPTURE_CLOSE_ID);
  captureClose.addEventListener("click", handleCaptureClose, false);

  const captureMaximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  captureMaximize.addEventListener("click", maximizeCapture, false);
  const captureMinimize = document.getElementById(CAPTURE_MINIMIZE_ID);
  captureMinimize.addEventListener("click", minimizeCapture, false);

  const modifyTimerSet = document.getElementById(MODIFY_TIMER_SET_ID);
  const modifyTimerClear = document.getElementById(MODIFY_TIMER_CLEAR_ID);
  const modifyTimerHours = document.getElementById(MODIFY_TIMER_HOURS_ID);
  const modifyTimerMinutes = document.getElementById(MODIFY_TIMER_MINUTES_ID);
  const modifyTimerSeconds = document.getElementById(MODIFY_TIMER_SECONDS_ID);
  modifyTimerSet.addEventListener("click", handleRowSetTimer, false);
  modifyTimerClear.addEventListener("click", handleRowClearTimer, false);
  modifyTimerHours.addEventListener("focus", handleInputFocus, false);
  modifyTimerHours.addEventListener("blur", handleInputBlur, false);
  modifyTimerMinutes.addEventListener("focus", handleInputFocus, false);
  modifyTimerMinutes.addEventListener("blur", handleInputBlur, false);
  modifyTimerSeconds.addEventListener("focus", handleInputFocus, false);
  modifyTimerSeconds.addEventListener("blur", handleInputBlur, false);

  const delaySkip = document.getElementById(DELAY_OVERLAY_SKIP_ID);
  const delayCancel = document.getElementById(DELAY_OVERLAY_CANCEL_ID);
  delaySkip.addEventListener("click", handleDelayEnd, false);
  delayCancel.addEventListener("click", handleCancelDelay, false);

  positionWrapper();
  setupWrapperEvents();

  const canvases = Array.from(document.body.querySelectorAll("canvas"));
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
  var canvases = Array.from(document.body.querySelectorAll("canvas"))
    .map(function(el, index) {
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

  for (const key of Object.keys(Ext.frames)) {
    if (key !== TOP_FRAME_UUID) {
      let frameCanvases = Ext.frames[key].canvases.map(function(el, index) {
        const obj = JSON.parse(JSON.stringify(el));
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
  const docFrag = document.createDocumentFragment();
  const oldRows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  const canvases = getAllCanvases();
  const addTimerImgUrl = browser.runtime.getURL(ICON_ADD_PATH);

  oldRows.forEach((row) => row.parentElement.removeChild(row));
  canvases.forEach(function(canvas) {
    if (canvas.local) {
      Ext.canvasMutObs.observe(canvas.element, CANVAS_OBSERVER_OPS);
    }
  });

  for (let k = 0, n = canvases.length; k < n; k += 1) {
    const row = Ext.rowTemplate.cloneNode(true);
    const canvas = canvases[k];
    const canvasIsLocal = canvas.local;

    const canvasId = row.querySelector(`.${LIST_CANVASES_CANVAS_ID_CLASS}`);
    canvasId.textContent = canvas.id;
    const dimens = row.querySelector(`.${LIST_CANVASES_CANVAS_DIMENS_CLASS}`);
    dimens.textContent = `${canvas.width}x${canvas.height}`;
    const addTimerImg = row.querySelector(`.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}`);
    addTimerImg.src = addTimerImgUrl;
    addTimerImg.dataset.hasTimer = false;
    const fpsInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_FPS_CLASS} input`);
    fpsInput.value = Ext.settings.fps;
    fpsInput.addEventListener("focus", handleInputFocus, false);
    fpsInput.addEventListener("blur", handleInputBlur, false);
    const bpsInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_BPS_CLASS} input`);
    bpsInput.value = Ext.settings.bps;
    bpsInput.addEventListener("focus", handleInputFocus, false);
    bpsInput.addEventListener("blur", handleInputBlur, false);
    const delayInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_DELAY_CLASS} input`);
    delayInput.value = DEFAULT_DELAY;
    delayInput.addEventListener("focus", handleInputFocus, false);
    delayInput.addEventListener("blur", handleInputBlur, false);

    const button = row.querySelector(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`);
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
  const wrapper = document.getElementById(WRAPPER_ID);
  const img = wrapper.querySelector(`.${TIMER_MODIFYING_CLASS}`);

  if (img) {
    const container = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    container.style.left = `${imgRect.left + (0.5 * imgRect.width) - Math.trunc(0.5 * containerRect.width)}px`;
    container.style.top = `${imgRect.top - containerRect.height - 20}px`;
  }
}

function handleRowTimerModify(evt) {
  const container = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
  const img = evt.target;
  const rows = Array.from(document.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  const hasTimer = JSON.parse(img.dataset.hasTimer || false);
  const hoursInput = document.getElementById(MODIFY_TIMER_HOURS_ID);
  const minutesInput = document.getElementById(MODIFY_TIMER_MINUTES_ID);
  const secondsInput = document.getElementById(MODIFY_TIMER_SECONDS_ID);
  var row = img.parentElement;

  img.dataset.ts = Date.now();
  img.classList.add(TIMER_MODIFYING_CLASS);

  if (hasTimer) {
    const secs = parseInt(img.dataset.timerSeconds, 10) || 0;
    const {hours, minutes, seconds} = secondsToHMS(secs);
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
    const ro = rows[k];
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
  const container = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
  const hasTimer = img && ("hasTimer" in img.dataset) && JSON.parse(img.dataset.hasTimer);
  const rows = Array.from(document.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));

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
    const row = rows[k];
    row.classList.remove(
      CANVAS_CAPTURE_SELECTED_CLASS,
      CANVAS_CAPTURE_INACTIVE_CLASS
    );
    setRowEventListeners(row);
  }

  container.classList.add(HIDDEN_CLASS);
}

function handleRowSetTimer() {
  const img = Ext.listCanvases.querySelector(
    `.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}.${TIMER_MODIFYING_CLASS}`
  );
  const ts = (img && parseInt(img.dataset.ts, 10)) || 0;

  if (ts < Ext.active.updateTS) {
    handleRowTimerModifyClose(img);
    return;
  }

  const hoursInput = document.getElementById(MODIFY_TIMER_HOURS_ID);
  const minutesInput = document.getElementById(MODIFY_TIMER_MINUTES_ID);
  const secondsInput = document.getElementById(MODIFY_TIMER_SECONDS_ID);
  const hours = parseInt(hoursInput.value, 10) || 0;
  const minutes = parseInt(minutesInput.value, 10) || 0;
  const seconds = parseInt(secondsInput.value, 10) || 0;
  const totalSecs = hmsToSeconds({hours, minutes, seconds});

  img.dataset.hasTimer = Boolean(totalSecs);
  img.dataset.timerSeconds = totalSecs;
  handleRowTimerModifyClose(img);
}

function handleRowClearTimer() {
  const img = Ext.listCanvases.querySelector(
    `.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}.${TIMER_MODIFYING_CLASS}`
  );
  const ts = (img && parseInt(img.dataset.ts, 10)) || 0;

  if (ts < Ext.active.updateTS) {
    handleRowTimerModifyClose(img);
    return;
  }

  img.dataset.hasTimer = false;
  img.dataset.timerSeconds = 0;
  handleRowTimerModifyClose(img);
}

function positionUpdateTimer() {
  const wrapper = document.getElementById(WRAPPER_ID);
  const timer = document.getElementById(TIMER_SLICE_CONTAINER_ID);
  const wrapperRect = wrapper.getBoundingClientRect();
  const timerRect = timer.getBoundingClientRect();
  const left = (0.5 * wrapperRect.width) - (0.5 * timerRect.width);
  const top = (0.5 * wrapperRect.height) - (0.5 * timerRect.height);
  timer.style.left = `${left}px`;
  timer.style.top = `${top}px`;
}

function setUpdateTimer() {
  const updateTimerMS = 75;
  const timer = document.getElementById(TIMER_SLICE_CONTAINER_ID);
  const clipPath = document.getElementById(TIMER_SLICE_CLIP_PATH_ID);
  Ext.active.timer.updateTimerId = setInterval(updateTimerDisplay, updateTimerMS);
  timer.classList.remove(HIDDEN_CLASS);
  positionUpdateTimer();
  clipPath.setAttribute("d", "M0,0 L100,0 L100,100 L0,100 Z");
}

function clearUpdateTimer() {
  const timer = document.getElementById(TIMER_SLICE_CONTAINER_ID);
  timer.classList.add(HIDDEN_CLASS);
  clearTimeout(Ext.active.timer.updateTimerId);
}

function updateTimerDisplay() {
  const clipPath = document.getElementById(TIMER_SLICE_CLIP_PATH_ID);
  const frac = Math.min(
    1,
    ((Date.now() - Ext.active.startTS) / MSEC_PER_SEC) / Ext.active.timer.secs
  );
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
  const el = evt.target;

  if (!el.classList.contains(LIST_CANVASES_ROW_CLASS)) {
    return;
  }

  Ext.highlighter.current = el;

  if (JSON.parse(el.dataset.canvasIsLocal)) {
    const canvas = Ext.frames[TOP_FRAME_UUID].canvases[el.dataset.index];
    const rect = canvas.getBoundingClientRect();

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
  const el = evt.target;
  const highlighter = Ext.highlighter;

  if (
    !el.classList.contains(LIST_CANVASES_ROW_CLASS) ||
    el !== highlighter.current
  ) {
    return;
  }

  for (const key of Object.keys(highlighter)) {
    if (key !== "current") {
      highlighter[key].classList.add(HIDDEN_CLASS);
    }
  }

  el.classList.remove(HIGHLIGHTER_UNAVAILABLE_CLASS);
  highlighter.current = null;
}

function onToggleCapture(evt) {
  const button = evt.target;

  button.blur();

  if (Ext.active.capturing) {
    preStopCapture();
  } else {
    preStartCapture(button);
  }
}

function setRowActive(index) {
  const rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  const inputs = Array.from(Ext.listCanvases.querySelectorAll("input"));
  var linkRow = null;

  for (let k = 0; k < rows.length; k += 1) {
    const row = rows[k];

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

  try {
    linkRow.scrollIntoView(
      {"block": "center", "behavior": "smooth", "inline": "center"}
    );
  } catch (e) {
    // FF < 58 doesn't accept "block": "center"
    linkRow.scrollIntoView({"behavior": "smooth", "inline": "center"});
  }

  for (let k = 0, n = inputs.length; k < n; k += 1) {
    const input = inputs[k];
    input.readOnly = true;
  }
}

function clearActiveRows() {
  const rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  const inputs = Array.from(Ext.listCanvases.querySelectorAll("input"));

  for (let k = 0; k < rows.length; k += 1) {
    const row = rows[k];
    row.classList.remove(
      CANVAS_CAPTURE_INACTIVE_CLASS,
      CANVAS_CAPTURE_SELECTED_CLASS
    );
    setRowEventListeners(row);
    row.querySelector(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`).textContent = "Capture";
    row.querySelector(`.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`)
      .classList.remove(CAPTURING_CLASS);
  }

  for (let k = 0, n = inputs.length; k < n; k += 1) {
    const input = inputs[k];
    input.readOnly = false;
  }
}

function preStartCapture(button) {
  const rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  const canvasIsLocal = JSON.parse(button.dataset.canvasIsLocal);
  const index = parseInt(button.dataset.index, 10);
  Ext.active.index = index;
  Ext.active.frameUUID = button.dataset.frameUUID;
  const row = rows[index];
  const timerImg = row.querySelector(`.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}`);
  const hasTimer = JSON.parse(timerImg.dataset.hasTimer || false);
  const timerSeconds = parseInt(timerImg.dataset.timerSeconds, 10) || 0;
  const canvases = Ext.frames[Ext.active.frameUUID].canvases;
  const canvasIndex = parseInt(button.dataset.canvasIndex, 10);
  const canvas = canvasIsLocal ? canvases[index] : canvases[canvasIndex];
  const linkCol = row.querySelector(`.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`);
  linkCol.textContent = "";

  if (canvasIsLocal && !canCaptureStream(canvas)) {
    return;
  }

  setRowActive(index);
  Ext.active.canvas = canvas;
  Ext.active.timer.secs = timerSeconds;

  const fpsInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_FPS_CLASS} input`);
  const fpsVal = parseFloat(fpsInput.value);
  const fps = (isFinite(fpsVal) && !isNaN(fpsVal) && fpsVal >= 0) ? fpsVal : 0;
  const bpsInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_BPS_CLASS} input`);
  const bpsVal = parseFloat(bpsInput.value);
  const bps = (isFinite(bpsVal) && !isNaN(bpsVal) && bpsVal > 0) ? bpsVal : Ext.settings.bps;

  const delayOverlay = document.getElementById(DELAY_OVERLAY_ID);
  const delayInput = row.querySelector(`.${LIST_CANVASES_CAPTURE_DELAY_CLASS} input`);
  const delaySecs = parseInt(delayInput.value, 10) || 0;
  const delayMsecs =
    (isFinite(delaySecs) && !isNaN(delaySecs) && delaySecs > 0)
    ? delaySecs * 1000
    : 0;

  const frameUUID = button.dataset.frameUUID;
  const rowIndex = index;
  const delayUpdateMSecs = 150;
  Ext.active.delay.options = Object.seal({
    canvas,
    canvasIsLocal,
    hasTimer,
    timerSeconds,
    frameUUID,
    canvasIndex,
    fps,
    bps,
    rowIndex
  });
  delayOverlay.classList.remove(HIDDEN_CLASS);
  Ext.active.delay.delaySecs = delaySecs;
  Ext.active.delay.timerId = setTimeout(handleDelayEnd, delayMsecs);
  Ext.active.delay.updateTimerId = setInterval(handleDelayUpdate, delayUpdateMSecs);
  Ext.active.delay.startTS = Date.now();
  if (!canvasIsLocal) {
    Ext.port.postMessage({
      "command": MessageCommands.DELAY,
      "tabId": Ext.tabId,
      "frameId": Ext.frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": frameUUID,
      "canvasIndex": canvasIndex,
      "delayed": true
    });
  }
}

function handleDelayEnd() {
  const {
    canvas,
    canvasIsLocal,
    hasTimer,
    timerSeconds,
    frameUUID,
    canvasIndex,
    fps,
    bps
  } = Ext.active.delay.options;
  const delayOverlay = document.getElementById(DELAY_OVERLAY_ID);

  if (canvasIsLocal) {
    const ret = startCapture(canvas, fps, bps);
    if (!ret) {
      clearActiveRows();
      Ext.active.clear();
    }
  } else {
    Ext.port.postMessage({
      "command": MessageCommands.DELAY,
      "tabId": Ext.tabId,
      "frameId": Ext.frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": frameUUID,
      "canvasIndex": canvasIndex,
      "delayed": false
    });
    Ext.port.postMessage({
      "command": MessageCommands.CAPTURE_START,
      "tabId": Ext.tabId,
      "frameId": Ext.frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": frameUUID,
      "canvasIndex": canvasIndex,
      "fps": fps,
      "bps": bps,
      "hasTimer": hasTimer,
      "timerSeconds": timerSeconds
    });
  }

  delayOverlay.classList.add(HIDDEN_CLASS);
  Ext.active.delay.clear();
}

function handleDelayUpdate() {
  const delayTime = document.getElementById(DELAY_OVERLAY_TIME_ID);
  const startTS = Ext.active.delay.startTS;
  const delaySecs = Ext.active.delay.delaySecs;
  const timeDiff = delaySecs - (((Date.now() - startTS)) / 1000);
  delayTime.textContent = Math.round(timeDiff);
}

function handleCancelDelay() {
  const delayOverlay = document.getElementById(DELAY_OVERLAY_ID);
  delayOverlay.classList.add(HIDDEN_CLASS);
  Ext.active.delay.clear();
  clearActiveRows();
  Ext.active.clear();
}

function startCapture(canvas, fps, bps) {
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
  Ext.mediaRecorder.addEventListener("start", handleCaptureStart, false);
  Ext.mediaRecorder.addEventListener("stop", stopCapture, false);
  Ext.mediaRecorder.addEventListener("error", preStopCapture, false);
  Ext.mediaRecorder.start(CAPTURE_INTERVAL_MS);

  return true;
}

function handleCaptureStart() {
  const timerSeconds = Ext.active.timer.secs;
  Ext.active.capturing = true;
  Ext.active.startTS = Date.now();

  if (timerSeconds) {
    Ext.active.timer.timerId = setTimeout(preStopCapture, timerSeconds * MSEC_PER_SEC);
    setUpdateTimer();
  }

  setCapturing();
}

function setCapturing() {
  const maximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  const index = Ext.active.index;
  const linkCol = Ext.listCanvases.querySelectorAll(
    `.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`
  )[index];

  linkCol.classList.add(CAPTURING_CLASS);
  maximize.classList.add(CAPTURING_MINIMIZED_CLASS);
}

function clearCapturing() {
  const maximize = document.getElementById(CAPTURE_MAXIMIZE_ID);

  clearActiveRows();

  maximize.classList.remove(CAPTURING_MINIMIZED_CLASS);
}

function preStopCapture(evt) {
  const buttons = Array.from(Ext.listCanvases.querySelectorAll(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`));
  const button = buttons[Ext.active.index];
  const canvasIsLocal = JSON.parse(button.dataset.canvasIsLocal);

  if (evt && evt.error) {
    Ext.active.error = true;
    Ext.active.errorMessage = evt.error.message;
  } else {
    Ext.active.stopped = true;
  }

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
  const rows = Array.from(Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`));
  const row = rows[Ext.active.index];
  const col = row.querySelector(`.${CANVAS_CAPTURE_LINK_CONTAINER_CLASS}`);
  const link = document.createElement("a");
  const size = blob ? blob.size : 0;
  var videoURL = "";

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

  clearCapturing();
  clearActiveRows();

  if (Ext.active.capturing && !Ext.active.error && Ext.active.stopped) {
    if (Ext.chunks.length) {
      blob = new Blob(Ext.chunks, {"type": Ext.chunks[0].type});
    }
    createVideoURL(blob);
  } else if (Ext.active.error || !Ext.active.stopped) {
    showNotification("An error occured while recording.");
  } else {
    showNotification("Canvas was removed while it was being recorded.");
  }

  Ext.mediaRecorder = null;
  Ext.chunks = null;
  Ext.active.clear();
  Ext.numBytesRecorded = 0;
}

function onDataAvailable(evt) {
  const blob = evt.data;

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
