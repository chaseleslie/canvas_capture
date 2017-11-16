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

var tabId = null;
var frameId = null;
const port = browser.runtime.connect({
  "name": TOP_FRAME_UUID
});

const MessageCommands = Object.freeze({
  "CAPTURE_START": "capture-start",
  "CAPTURE_STOP": "capture-stop",
  "DISABLE": "disable",
  "DISCONNECT": "disconnect",
  "DISPLAY": "display",
  "DOWNLOAD": "download",
  "HIGHLIGHT": "highlight",
  "NOTIFY": "notify",
  "REGISTER": "register",
  "UPDATE_CANVASES": "update-canvases"
});

const MIME_TYPE_MAP = Object.freeze({
  "mp4": "video/mp4",
  "webm": "video/webm"
});
const DEFAULT_MIME_TYPE = "webm";
const CAPTURE_INTERVAL = 1000;
const DEFAULT_FPS = 30;
const DEFAULT_BPS = 2500000;
const CSS_STYLE_ID = "capture_list_container_css";
const WRAPPER_ID = "capture_list_container";
const LIST_CANVASES_ID = "list_canvases";
const CSS_FILE_PATH = "/capture/capture.css";
const HTML_FILE_PATH = "/capture/capture.html";
var maxVideoSize = 4 * 1024 * 1024 * 1024;
var displayed = false;
var mediaRecorder = null;
const active = Object.seal({
  "capturing": false,
  "index": -1,
  "frameUUID": "",
  "canvas": null,
  "startTS": 0,
  "clear": function() {
    this.capturing = false;
    this.index = -1;
    this.frameUUID = "";
    this.canvas = null;
    this.startTS = 0;
  }
});
var chunks = null;
var objectURLs = [];
const frames = {[TOP_FRAME_UUID]: {"frameUUID": TOP_FRAME_UUID, "canvases": []}};
var frameElementsTS = 0;
const frameElementsKeys = [];
var numBytes = 0;
var wrapperMouseHover = false;
const bodyMutObs = new MutationObserver(observeBodyMutations);
const canvasMutObs = new MutationObserver(observeCanvasMutations);
const CANVAS_OBSERVER_OPS = Object.freeze({
  "attributes": true,
  "attributeFilter": ["id", "width", "height"]
});
const highlighter = Object.seal({
  "left": null,
  "top": null,
  "right": null,
  "bottom": null,
  "current": null
});

port.onMessage.addListener(onMessage);
window.addEventListener("message", handleWindowMessage, true);

bodyMutObs.observe(document.body, {
  "childList": true,
  "subtree": true
});

function handleWindowMessage(evt) {
  var msg = evt.data;
  var frameElements = Array.from(document.querySelectorAll("iframe"));
  var key = msg.key;
  var keyPos = frameElementsKeys.indexOf(key);

  if (!key || keyPos < 0) {
    return;
  } else if (msg.ts < frameElementsTS) {
    identifyFrames();
    frameElementsKeys.splice(keyPos, 1);
    evt.stopPropagation();
    return;
  }

  frameElementsKeys.splice(keyPos, 1);
  frames[msg.frameUUID].node = frameElements[msg.index];
  evt.stopPropagation();
}

function identifyFrames() {
  var frameElements = Array.from(document.querySelectorAll("iframe"));
  frameElementsTS = Date.now();
  for (let k = 0, n = frameElements.length; k < n; k += 1) {
    let frame = frameElements[k];
    let key = genUUIDv4();
    frameElementsKeys.push(key);
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
    if (!displayed) {
      handleDisplay(msg);
      displayed = true;
    }
  } else if (msg.command === MessageCommands.HIGHLIGHT) {
    handleMessageHighlight(msg);
  } else if (msg.command === MessageCommands.REGISTER) {
    tabId = msg.tabId;
    frameId = msg.frameId;
  } else if (msg.command === MessageCommands.UPDATE_CANVASES) {
    handleMessageUpdateCanvases(msg);
  }
}

function handleMessageCaptureStart(msg) {
  let parent = document.getElementById(LIST_CANVASES_ID);
  let rows = Array.from(parent.querySelectorAll("span.list_canvases_row"));
  if (msg.success) {
    let linkCol = rows[active.index].querySelector("span.canvas_capture_link_container");
    linkCol.classList.add("capturing");
    active.capturing = true;
    active.startTS = Date.now();
  } else {
    for (let k = 0, n = rows.length; k < n; k += 1) {
      let row = rows[k];
      let button = row.querySelector("button");
      let linkCol = row.querySelector("span.canvas_capture_link_container");
      button.textContent = "Capture";
      button.addEventListener("click", onToggleCapture, false);
      linkCol.classList.remove("capturing");
      row.classList.remove("canvas_capture_selected");
      row.classList.remove("canvas_capture_inactive");
    }

    active.clear();
  }
}

function handleMessageCaptureStop(msg) {
  var parent = document.getElementById(LIST_CANVASES_ID);
  var rows = Array.from(parent.querySelectorAll("span.list_canvases_row"));
  var linkCol = rows[active.index].querySelector("span.canvas_capture_link_container");

  active.clear();

  if (msg.success) {
    let link = document.createElement("a");
    link.textContent = "Download";
    link.href = msg.videoURL;
    link.title = prettyFileSize(msg.size);

    if (msg.size) {
      link.addEventListener("click", function(evt) {
        port.postMessage({
          "command": MessageCommands.DOWNLOAD,
          "tabId": tabId,
          "frameId": frameId,
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

  if (active.capturing && active.frameUUID === frameUUID) {
    preStopCapture();
    handleMessageCaptureStop({
      "command": MessageCommands.CAPTURE_STOP,
      "tabId": tabId,
      "frameUUID": active.frameUUID,
      "targetFrameUUID": TOP_FRAME_UUID,
      "success": false
    });
    showNotification("Iframe was removed while one of its canvases was being recorded.");
  }

  delete frames[frameUUID];
  updateCanvases();
  frameElementsTS = Date.now();
}

function handleMessageHighlight(msg, node) {
  var frame = frames[msg.frameUUID];
  node = node || frame.node;

  if (node && highlighter.current) {
    let rect = msg.rect;
    let nodeRect = node.getBoundingClientRect();
    let nodeStyle = window.getComputedStyle(node);
    let borderWidthLeft = parseInt(nodeStyle.borderLeftWidth, 10);
    let borderWidthTop = parseInt(nodeStyle.borderTopWidth, 10);
    let vertTracerStyle = window.getComputedStyle(highlighter.left);
    let horizTracerStyle = window.getComputedStyle(highlighter.top);
    let vertTracerWidth = highlighter.left.offsetWidth + (2 * parseInt(vertTracerStyle.borderLeftWidth, 10) || 0);
    let horizTracerWidth = highlighter.top.offsetHeight + (2 * parseInt(horizTracerStyle.borderTopWidth, 10) || 0);
    let left = nodeRect.left + rect.left + borderWidthLeft;
    let top = nodeRect.top + rect.top + borderWidthTop;
    let right = nodeRect.left + rect.left + rect.width + borderWidthLeft;
    right = Math.min(document.documentElement.clientWidth - vertTracerWidth, right);
    let bottom = nodeRect.top + rect.top + rect.height + borderWidthTop;
    bottom = Math.min(document.documentElement.clientHeight - horizTracerWidth, bottom);

    if (left >= 0 && left <= window.screen.availWidth) {
      highlighter.left.classList.remove("hidden");
    }
    if (top >= 0 && top <= window.screen.availHeight) {
      highlighter.top.classList.remove("hidden");
    }
    if (right >= 0 && right <= window.screen.availWidth) {
      highlighter.right.classList.remove("hidden");
    }
    if (bottom >= 0 && bottom <= window.screen.availHeight) {
      highlighter.bottom.classList.remove("hidden");
    }

    highlighter.left.style.left = `${left}px`;
    highlighter.top.style.top = `${top}px`;
    highlighter.right.style.left = `${right}px`;
    highlighter.bottom.style.top = `${bottom}px`;
  }
}

function handleMessageUpdateCanvases(msg) {
  var frameUUID = msg.frameUUID;

  if (frameUUID === BG_FRAME_UUID) {
    port.postMessage({
      "command": MessageCommands.UPDATE_CANVASES,
      "tabId": tabId,
      "frameId": frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": ALL_FRAMES_UUID
    });
    return;
  } else if (frames[frameUUID]) {
    frames[frameUUID].canvases = msg.canvases;
  } else {
    frames[frameUUID] = {
      "frameUUID": frameUUID,
      "canvases": msg.canvases,
      "frameId": msg.frameId
    };
  }

  var canvasIndex = -1;
  var canvasFrameUUID = frameUUID;
  if (active.capturing) {
    let parent = document.getElementById(LIST_CANVASES_ID);
    let row = parent.querySelector(".list_canvases_row.canvas_capture_selected");
    let canvasIsLocal = active.frameUUID === TOP_FRAME_UUID;

    if (canvasIsLocal) {
      canvasIndex = parseInt(active.index, 10);
    } else if (frameUUID === active.frameUUID) {
      canvasIndex = parseInt(msg.activeCanvasIndex, 10);
    } else {
      canvasIndex = parseInt(row.dataset.canvasIndex, 10);
      canvasFrameUUID = row.dataset.frameUUID;
    }
  }

  updateCanvases();

  if (active.capturing) {
    let parent = document.getElementById(LIST_CANVASES_ID);
    let canvasIsLocal = active.frameUUID === TOP_FRAME_UUID;

    if (canvasIsLocal) {
      setRowActive(canvasIndex);
    } else {
      let row = null;
      let rows = Array.from(parent.querySelectorAll("span.list_canvases_row"));
      let frameRows = rows.filter((el) => el.dataset.frameUUID === canvasFrameUUID);
      row = frameRows[canvasIndex];
      for (let k = 0, n = rows.length; k < n; k += 1) {
        if (row === rows[k]) {
          canvasIndex = k;
          break;
        }
      }
      setRowActive(canvasIndex);
      active.index = canvasIndex;
    }
  }

  identifyFrames();
}

function observeBodyMutations(mutations) {
  var canvasesChanged = false;
  mutations = mutations.filter((el) => el.type === "childList");

  for (let k = 0, n = mutations.length; k < n; k += 1) {
    let mutation = mutations[k];

    let addedNodes = Array.from(mutation.addedNodes);
    for (let iK = 0, iN = addedNodes.length; iK < iN; iK += 1) {
      let node = addedNodes[iK];
      if (node.nodeName.toLowerCase() === "canvas") {
        canvasesChanged = true;
        break;
      }
    }

    let removedNodes = Array.from(mutation.removedNodes);
    for (let iK = 0, iN = removedNodes.length; iK < iN; iK += 1) {
      let node = removedNodes[iK];
      if (node.nodeName.toLowerCase() === "canvas") {
        canvasesChanged = true;
        if (active.capturing && node === active.canvas) {
          active.capturing = false;
          active.canvas = null;
          preStopCapture();
          break;
        }
      }
    }
  }

  if (canvasesChanged) {
    let activeCanvas = active.canvas;
    let activeFrameUUID = active.frameUUID;
    let parent = document.getElementById(LIST_CANVASES_ID);
    let row = null;
    let canvasIsLocal = true;
    let canvasIndex = -1;
    let canvases = Array.from(document.body.querySelectorAll("canvas"));

    if (active.capturing) {
      row = parent.querySelector(".list_canvases_row.canvas_capture_selected");
      canvasIsLocal = JSON.parse(row.dataset.canvasIsLocal);
      if (!canvasIsLocal) {
        canvasIndex = parseInt(row.dataset.canvasIndex, 10);
      }
    }

    frames[TOP_FRAME_UUID].canvases = canvases;

    updateCanvases();

    if (active.capturing && canvasIsLocal) {
      for (let k = 0, n = canvases.length; k < n; k += 1) {
        if (canvases[k] === activeCanvas) {
          canvasIndex = k;
          break;
        }
      }

      setRowActive(canvasIndex);
      active.index = canvasIndex;
    } else if (active.capturing && !canvasIsLocal) {
      let rows = Array.from(parent.querySelectorAll("span.list_canvases_row"));
      let index = -1;

      for (let k = 0, n = rows.length; k < n; k += 1) {
        if (
          parseInt(rows[k].dataset.canvasIndex, 10) === canvasIndex &&
          rows[k].dataset.frameUUID === activeFrameUUID
        ) {
          index = k;
        }
      }

      setRowActive(index);
      active.index = index;
    }
  }
}

function observeCanvasMutations(mutations) {
  var canvases = Array.from(document.body.querySelectorAll("canvas"));
  var parent = document.getElementById(LIST_CANVASES_ID);
  var rows = Array.from(parent.querySelectorAll(".list_canvases_row"));
  mutations = mutations.filter((el) => el.type === "attributes");

  for (let k = 0, n = mutations.length; k < n; k += 1) {
    let mutation = mutations[k];
    let canvas = mutation.target;
    let canvasIndex = -1;
    canvases.forEach((el, index) => el === canvas && (canvasIndex = index));
    if (canvasIndex >= 0) {
      let row = rows[canvasIndex];
      let colId = row.querySelector(".list_canvases_canvas_id");
      let colWidth = row.querySelector(".list_canvases_canvas_width");
      let colHeight = row.querySelector(".list_canvases_canvas_height");
      colId.textContent = canvas.id;
      colWidth.textContent = canvas.width;
      colHeight.textContent = canvas.height;
    }
  }
}

function handleDisable(notify) {
  if (!displayed) {
    return;
  }

  var wrapper = document.getElementById(WRAPPER_ID);
  if (wrapper) {
    wrapper.parentElement.removeChild(wrapper);
  }

  var style = document.getElementById(CSS_STYLE_ID);
  if (style) {
    style.parentElement.removeChild(style);
  }

  for (let prop in highlighter) {
    if (Object.prototype.hasOwnProperty.call(highlighter, prop)) {
      highlighter[prop].parentElement.removeChild(highlighter[prop]);
    }
  }

  freeObjectURLs();
  displayed = false;
  showNotification(notify);
  port.postMessage({
    "command": MessageCommands.DISCONNECT,
    "tabId": tabId,
    "frameId": frameId,
    "frameUUID": TOP_FRAME_UUID
  });
}

function handleDisplay(msg) {
  maxVideoSize = msg.defaultSettings.maxVideoSize;

  try {
    var cssUrl = browser.runtime.getURL(CSS_FILE_PATH);
    var htmlUrl = browser.runtime.getURL(HTML_FILE_PATH);
    fetch(cssUrl).then(function(response) {
      if (response.ok) {
        return response.text();
      }
      throw new Error(`Received ${response.status} ${response.statusText} fetching ${response.url}`);
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
      throw new Error(`Received ${response.status} ${response.statusText} fetching ${response.url}`);
    }).then(function(text) {
      setupDisplay(text);
    }).catch(function(e) {
      throw new Error(e);
    });
  } catch (e) {
    displayed = true;
    handleDisable(e.message);
  }

  for (let prop in highlighter) {
    if (Object.prototype.hasOwnProperty.call(highlighter, prop) && prop !== "current") {
      highlighter[prop] = document.createElement("div");
      highlighter[prop].textContent = " ";
      highlighter[prop].classList.add("hidden");
      document.body.appendChild(highlighter[prop]);
    }
  }
  highlighter.left.classList.add("highlighter_vertical");
  highlighter.top.classList.add("highlighter_horizontal");
  highlighter.right.classList.add("highlighter_vertical");
  highlighter.bottom.classList.add("highlighter_horizontal");
}

function positionWrapper() {
  var wrapper = document.getElementById(WRAPPER_ID);
  var bodyRect = document.body.getBoundingClientRect();
  var wrapperRect = wrapper.getBoundingClientRect();
  wrapper.style.left = `${(bodyRect.width / 2) - (wrapperRect.width / 2)}px`;
}

function setupWrapperEvents() {
  var wrapper = document.getElementById(WRAPPER_ID);
  wrapper.addEventListener("mouseenter", () => {
    wrapperMouseHover = true;
  }, false);
  wrapper.addEventListener("mouseleave", () => {
    wrapperMouseHover = false;
  }, false);
  window.addEventListener("wheel", (evt) => {
    if (wrapperMouseHover) {
      evt.stopPropagation();

      return false;
    }

    return true;
  }, true);
}

function setupDisplay(html) {
  var wrapper = document.createElement("div");
  document.body.appendChild(wrapper);
  wrapper.outerHTML = html;
  wrapper = document.getElementById(WRAPPER_ID);

  positionWrapper();
  setupWrapperEvents();

  var canvases = Array.from(document.body.querySelectorAll("canvas"));
  frames[TOP_FRAME_UUID].canvases = canvases;
  port.postMessage({
    "command": MessageCommands.DISPLAY,
    "tabId": tabId,
    "frameId": frameId,
    "frameUUID": TOP_FRAME_UUID,
    "targetFrameUUID": ALL_FRAMES_UUID,
    "defaultSettings": {
      "maxVideoSize": maxVideoSize
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

  for (let key in frames) {
    if (Object.prototype.hasOwnProperty.call(frames, key) && key !== TOP_FRAME_UUID) {
      let frameCanvases = frames[key].canvases;
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
  var parent = document.getElementById(LIST_CANVASES_ID);
  var docFrag = document.createDocumentFragment();
  var attrKeys = ["id", "width", "height"];
  var oldRows = Array.from(parent.querySelectorAll(".list_canvases_row"));
  var canvases = getAllCanvases();

  oldRows.forEach((row) => row.parentElement.removeChild(row));
  canvases.forEach(function(canvas) {
    if (canvas.local) {
      canvasMutObs.observe(canvas.element, CANVAS_OBSERVER_OPS);
    }
  });

  for (let k = 0; k < canvases.length; k += 1) {
    let row = document.createElement("span");
    let canvasIsLocal = true;
    let canvas = canvases[k];
    for (let iK = 0; iK < attrKeys.length; iK += 1) {
      if (canvas.local) {
        canvasIsLocal = true;
        row.classList.add("local_canvas");
      } else {
        canvasIsLocal = false;
        row.classList.add("remote_canvas");
      }
      let col = document.createElement("span");
      col.textContent = canvas[attrKeys[iK]];
      col.classList.add("middle_centered");
      col.classList.add(`list_canvases_canvas_${attrKeys[iK]}`);
      if (attrKeys[iK] === "id") {
        col.title = canvas.id;
      }
      row.appendChild(col);
    }
    let col = document.createElement("span");
    let fpsInput = document.createElement("input");
    fpsInput.id = `fps${k}`;
    fpsInput.type = "text";
    fpsInput.value = DEFAULT_FPS;
    fpsInput.size = 3;
    col.appendChild(fpsInput);
    col.classList.add("middle_centered");
    row.appendChild(col);

    col = document.createElement("span");
    let bpsInput = document.createElement("input");
    bpsInput.id = `bps${k}`;
    bpsInput.type = "text";
    bpsInput.value = DEFAULT_BPS;
    bpsInput.size = 8;
    col.appendChild(bpsInput);
    col.classList.add("middle_centered");
    row.appendChild(col);

    col = document.createElement("span");
    let button = document.createElement("button");
    button.dataset.index = k;
    button.textContent = "Capture";
    button.dataset.fpsInput = fpsInput.id;
    button.dataset.bpsInput = bpsInput.id;
    button.dataset.canvasIsLocal = canvasIsLocal;
    button.dataset.frameUUID = canvas.frameUUID;
    button.dataset.canvasIndex = canvas.index;
    button.addEventListener("click", onToggleCapture, false);
    button.classList.add("canvas_capture_button");
    col.appendChild(button);
    col.classList.add("middle_centered");
    row.appendChild(col);

    col = document.createElement("span");
    col.classList.add("canvas_capture_link_container");
    col.classList.add("middle_centered");
    row.appendChild(col);

    row.classList.add("list_canvases_row");
    row.dataset.index = k;
    row.dataset.canvasIsLocal = canvasIsLocal;
    row.dataset.frameUUID = canvas.frameUUID;
    row.dataset.canvasIndex = canvas.index;
    row.addEventListener("mouseenter", highlightCanvas, false);
    row.addEventListener("mouseleave", unhighlightCanvas, false);
    docFrag.appendChild(row);
  }

  parent.appendChild(docFrag);
}

function highlightCanvas(evt) {
  var el = evt.target;

  if (!el.classList.contains("list_canvases_row")) {
    return;
  }

  highlighter.current = el;

  if (JSON.parse(el.dataset.canvasIsLocal)) {
    let rect = frames[TOP_FRAME_UUID].canvases[el.dataset.index].getBoundingClientRect();

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
      }
    }, frames[TOP_FRAME_UUID].canvases[el.dataset.index]);
  } else {
    port.postMessage({
      "command": MessageCommands.HIGHLIGHT,
      "tabId": tabId,
      "frameId": frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": el.dataset.frameUUID,
      "canvasIndex": el.dataset.canvasIndex
    });
  }

  evt.stopPropagation();
}

function unhighlightCanvas(evt) {
  var el = evt.target;

  if (!el.classList.contains("list_canvases_row") || el !== highlighter.current) {
    return;
  }

  for (let prop in highlighter) {
    if (Object.prototype.hasOwnProperty.call(highlighter, prop) && prop !== "current") {
      highlighter[prop].classList.add("hidden");
    }
  }

  highlighter.current = null;
}

function onToggleCapture(evt) {
  var button = evt.target;

  button.blur();

  if (active.capturing) {
    preStopCapture();
  } else {
    preStartCapture(button);
  }
}

function setRowActive(index) {
  var parent = document.getElementById(LIST_CANVASES_ID);
  var buttons = Array.from(parent.querySelectorAll("button.canvas_capture_button"));
  var rows = Array.from(parent.querySelectorAll("span.list_canvases_row"));
  var linkCol = rows[index].querySelector("span.canvas_capture_link_container");

  for (let k = 0; k < rows.length; k += 1) {
    let row = rows[k];

    if (parseInt(row.dataset.index, 10) === index) {
      row.classList.add("canvas_capture_selected");
    } else {
      row.classList.add("canvas_capture_inactive");
    }
  }

  for (let k = 0; k < buttons.length; k += 1) {
    let button = buttons[k];

    if (k === index) {
      button.textContent = "Stop";
    } else {
      button.removeEventListener("click", onToggleCapture);
    }
  }

  linkCol.classList.add("capturing");
}

function preStartCapture(button) {
  var parent = document.getElementById(LIST_CANVASES_ID);
  var rows = Array.from(parent.querySelectorAll("span.list_canvases_row"));
  var canvasIsLocal = JSON.parse(button.dataset.canvasIsLocal);
  active.index = button.dataset.index;
  active.frameUUID = button.dataset.frameUUID;
  var index = active.index;
  var frame = frames[active.frameUUID];
  var canvas = canvasIsLocal ? frame.canvases[index] : frame.canvases[button.dataset.canvasIndex];
  var linkCol = rows[index].querySelector("span.canvas_capture_link_container");
  linkCol.textContent = "";

  if (canvasIsLocal && !canCaptureStream(canvas)) {
    return;
  }

  setRowActive(parseInt(index, 10));

  var fpsInput = document.getElementById(button.dataset.fpsInput);
  var fps = parseFloat(fpsInput.value);
  fps = (isFinite(fps) && !isNaN(fps) && fps >= 0) ? fps : 0;
  var bpsInput = document.getElementById(button.dataset.bpsInput);
  var bps = parseFloat(bpsInput.value);
  bps = (isFinite(bps) && !isNaN(bps) && bps > 0) ? bps : DEFAULT_BPS;

  if (canvasIsLocal) {
    let ret = startCapture(canvas, fps, bps);
    if (!ret) {
      linkCol.classList.remove("capturing");
    }
  } else {
    port.postMessage({
      "command": MessageCommands.CAPTURE_START,
      "tabId": tabId,
      "frameId": frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": button.dataset.frameUUID,
      "canvasIndex": button.dataset.canvasIndex,
      "fps": fps,
      "bps": bps
    });
    active.canvas = canvas;
  }
}

function startCapture(canvas, fps, bps) {
  chunks = [];
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
    mediaRecorder = new MediaRecorder(
      stream,
      {"mimeType": MIME_TYPE_MAP[DEFAULT_MIME_TYPE], "bitsPerSecond": bps}
    );
  } catch (e) {
    mediaRecorder = new MediaRecorder(stream);
  }
  mediaRecorder.addEventListener("dataavailable", onDataAvailable, false);
  mediaRecorder.addEventListener("stop", stopCapture, false);
  mediaRecorder.start(CAPTURE_INTERVAL);
  active.capturing = true;
  active.canvas = canvas;
  active.startTS = Date.now();

  return true;
}

function clearActiveRows() {
  var parent = document.getElementById(LIST_CANVASES_ID);
  var buttons = Array.from(parent.querySelectorAll("button.canvas_capture_button"));
  var rows = Array.from(parent.querySelectorAll("span.list_canvases_row"));
  var linkCol = rows[active.index].querySelector("span.canvas_capture_link_container");

  for (let k = 0; k < rows.length; k += 1) {
    let row = rows[k];
    row.classList.remove("canvas_capture_inactive", "canvas_capture_selected");
  }

  for (let k = 0; k < buttons.length; k += 1) {
    let but = buttons[k];
    but.addEventListener("click", onToggleCapture, false);
    but.textContent = "Capture";
  }

  linkCol.classList.remove("capturing");
}

function preStopCapture() {
  var parent = document.getElementById(LIST_CANVASES_ID);
  var buttons = Array.from(parent.querySelectorAll("button.canvas_capture_button"));
  var button = buttons[active.index];
  var canvasIsLocal = JSON.parse(button.dataset.canvasIsLocal);

  clearActiveRows();

  if (canvasIsLocal) {
    mediaRecorder.stop();
  } else {
    port.postMessage({
      "command": MessageCommands.CAPTURE_STOP,
      "tabId": tabId,
      "frameId": frameId,
      "frameUUID": TOP_FRAME_UUID,
      "targetFrameUUID": button.dataset.frameUUID,
      "canvasIndex": button.dataset.canvasIndex
    });
  }
}

function createVideoURL(blob) {
  var parent = document.getElementById(LIST_CANVASES_ID);
  var rows = Array.from(parent.querySelectorAll("span.list_canvases_row"));
  var row = rows[active.index];
  var col = row.querySelector("span.canvas_capture_link_container");
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
  link.download = `capture-${parseInt(Date.now() / 1000, 10)}.${DEFAULT_MIME_TYPE}`;
  link.href = videoURL;
  link.title = prettyFileSize(size);
  col.appendChild(link);
  objectURLs.push(videoURL);
}

function stopCapture() {
  var blob = null;
  if (active.capturing) {
    if (chunks.length) {
      blob = new Blob(chunks, {"type": chunks[0].type});
    }
    createVideoURL(blob);
  } else {
    showNotification("Canvas was removed while it was being recorded.");
  }

  mediaRecorder = null;
  chunks = null;
  active.clear();
  numBytes = 0;
}

function onDataAvailable(evt) {
  var blob = evt.data;

  if (blob.size) {
    chunks.push(blob);
    numBytes += blob.size;

    if (numBytes >= maxVideoSize) {
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
  port.postMessage({
    "command": MessageCommands.NOTIFY,
    "tabId": tabId,
    "frameUUID": TOP_FRAME_UUID,
    "notification": notification
  });
}

function freeObjectURLs() {
  for (let k = 0; k < objectURLs.length; k += 1) {
    window.URL.revokeObjectURL(objectURLs[k]);
  }
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

function genUUIDv4() {
  /* https://stackoverflow.com/a/2117523/1031545 */
  /* eslint-disable no-bitwise, id-length, no-mixed-operators */
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
  /* eslint-enable no-bitwise, id-length, no-mixed-operators */
}

}());
