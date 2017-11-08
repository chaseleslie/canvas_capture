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


; // eslint-disable-line no-extra-semi
/* global chrome */
(function() {
"use strict";

var browser = chrome;

function genUUIDv4() {
  /* https://stackoverflow.com/a/2117523/1031545 */
  /* eslint-disable no-bitwise, id-length, no-mixed-operators */
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
  /* eslint-enable no-bitwise, id-length, no-mixed-operators */
}

function inIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

var frameId = "top";

if (inIframe()) {
  frameId = genUUIDv4();
}

var tabId = null;
var port = browser.runtime.connect({
  "name": frameId
});

const MIME_TYPE_MAP = {
  "mp4": "video/mp4",
  "webm": "video/webm"
};
const DEFAULT_MIME_TYPE = "webm";
const CAPTURE_INTERVAL = 1000;
const DEFAULT_FPS = 30;
const DEFAULT_BPS = 2500000;
const CSS_STYLE_ID = "capture_list_container_css";
const WRAPPER_ID = "capture_list_container";
const LIST_CANVASES_ID = "list_canvases";
const CSS_FILE_PATH = "/capture/capture.css";
const HTML_FILE_PATH = "/capture/capture.html";
var displayed = false;
var mediaRecorder = null;
var capturing = false;
var capturingActiveCanvas = null;
var activeButton = null;
var chunks = null;
var allCanvases = null;
var numBytes = 0;
var objectURLs = [];
var maxVideoSize = 4 * 1024 * 1024 * 1024;
var wrapperMouseHover = false;
var bodyMutObs = new MutationObserver(observeBodyMutations);
var canvasMutObs = new MutationObserver(observeCanvasMutations);

bodyMutObs.observe(document.body, {
  "childList": true,
  "subtree": true
});
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
        break;
      }
    }
  }

  var canvases = Array.from(document.body.querySelectorAll("canvas"));
  allCanvases = canvases;

  if (canvasesChanged) {
    updateCanvases(document.getElementById(LIST_CANVASES_ID), canvases);
  }
}

function freeObjectURLs() {
  for (let k = 0; k < objectURLs.length; k += 1) {
    window.URL.revokeObjectURL(objectURLs[k]);
  }
}

function onMessage(msg) {
  if (msg.command === "display") {
    tabId = msg.tabId;
    if (!displayed) {
      handleDisplay(msg);
      displayed = true;
    }
  } else if (msg.command === "disable") {
    handleDisable();
  }
}
port.onMessage.addListener(onMessage);

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

  var cmd = (notify) ? "disconnect-notify" : "disconnect";

  freeObjectURLs();
  displayed = false;
  port.postMessage({
    "command": cmd,
    "tabId": tabId,
    "frameId": frameId,
    "notification": notify
  });
}

function setMaxVideoSize(setting) {
  if (Array.isArray(setting)) {
    setting = setting[0];
  }
  maxVideoSize = setting.maxVideoSize || maxVideoSize;
}

function handleDisplay() {
  if (!document.querySelectorAll("canvas").length) {
    displayed = true;
    handleDisable("No canvases found");
    return;
  }

  var inputMaxSizeSetting = browser.storage.local.get("maxVideoSize", setMaxVideoSize);
  if (inputMaxSizeSetting) {
    inputMaxSizeSetting.then(setMaxVideoSize);
  }

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
  var parent = document.getElementById(LIST_CANVASES_ID);

  positionWrapper();
  setupWrapperEvents();

  var canvases = Array.from(document.body.querySelectorAll("canvas"));
  allCanvases = canvases;
  updateCanvases(parent, canvases);
}

function updateCanvases(parent, canvases) {
  var docFrag = document.createDocumentFragment();
  var headerKeys = ["id", "width", "height"];
  var oldRows = Array.from(parent.querySelectorAll(".list_canvases_row"));
  var canvasObsOps = {
    "attributes": true,
    "attributeFilter": ["id", "width", "height"]
  };

  oldRows.forEach((row) => row.parentElement.removeChild(row));
  canvases.forEach((canvas) => canvasMutObs.observe(canvas, canvasObsOps));

  for (let k = 0; k < canvases.length; k += 1) {
    var row = document.createElement("span");
    let canvas = canvases[k];
    for (let iK = 0; iK < headerKeys.length; iK += 1) {
      let col = document.createElement("span");
      col.textContent = canvas[headerKeys[iK]];
      col.classList.add("middle_centered");
      col.classList.add(`list_canvases_canvas_${headerKeys[iK]}`);
      if (headerKeys[iK] === "id") {
        col.title = canvas[headerKeys[iK]];
      }
      row.appendChild(col);
    }
    let col = document.createElement("span");
    let fpsInput = document.createElement("input");
    fpsInput.id = `fps${k}`;
    fpsInput.type = "text";
    fpsInput.value = DEFAULT_FPS;
    fpsInput.size = 5;
    col.appendChild(fpsInput);
    col.classList.add("middle_centered");
    row.appendChild(col);

    col = document.createElement("span");
    let bpsInput = document.createElement("input");
    bpsInput.id = `bps${k}`;
    bpsInput.type = "text";
    bpsInput.value = DEFAULT_BPS;
    bpsInput.size = 5;
    col.appendChild(bpsInput);
    col.classList.add("middle_centered");
    row.appendChild(col);

    col = document.createElement("span");
    let button = document.createElement("button");
    button.dataset.index = k;
    button.textContent = "Capture";
    button.dataset.fpsInput = fpsInput.id;
    button.dataset.bpsInput = bpsInput.id;
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
    docFrag.appendChild(row);
  }

  parent.appendChild(docFrag);
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

function onToggleCapture(evt) {
  activeButton = evt.target;

  activeButton.blur();

  if (capturing) {
    preStopCapture();
  } else {
    preStartCapture();
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

function preStartCapture() {
  var grid = document.getElementById(LIST_CANVASES_ID);
  var buttons = Array.from(grid.querySelectorAll("button.canvas_capture_button"));
  var rows = Array.from(grid.querySelectorAll("span.list_canvases_row"));
  var button = activeButton;
  var index = button.dataset.index;
  var canvas = allCanvases[index];
  var linkCol = rows[index].querySelector("span.canvas_capture_link_container");
  linkCol.textContent = "";

  if (!canCaptureStream(canvas)) {
    return;
  }

  for (let k = 0; k < rows.length; k += 1) {
    let ro = rows[k];

    if (ro.dataset.index === index) {
      ro.classList.add("canvas_capture_selected");
    } else {
      ro.classList.add("canvas_capture_inactive");
    }
  }

  for (let k = 0; k < buttons.length; k += 1) {
    let but = buttons[k];

    if (but === button) {
      but.textContent = "Stop";
    } else {
      but.removeEventListener("click", onToggleCapture);
    }
  }

  var fpsInput = document.getElementById(button.dataset.fpsInput);
  var fps = parseFloat(fpsInput.value);
  fps = (isFinite(fps) && !isNaN(fps) && fps >= 0) ? fps : 0;
  var bpsInput = document.getElementById(button.dataset.bpsInput);
  var bps = parseFloat(bpsInput.value);
  bps = (isFinite(bps) && !isNaN(bps) && bps > 0) ? bps : DEFAULT_BPS;
  capturingActiveCanvas = index;

  var ret = startCapture(canvas, fps, bps);
  if (ret) {
    linkCol.classList.add("capturing");
    activeButton = button;
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
    capturingActiveCanvas = null;
    return false;
  }

  try {
    mediaRecorder = new window.MediaRecorder(
      stream,
      {"DEFAULT_MIME_TYPE": MIME_TYPE_MAP[DEFAULT_MIME_TYPE], "bitsPerSecond": bps}
    );
  } catch (e) {
    mediaRecorder = new window.MediaRecorder(stream);
  }
  mediaRecorder.addEventListener("dataavailable", onDataAvailable, false);
  mediaRecorder.addEventListener("stop", stopCapture, false);
  mediaRecorder.start(CAPTURE_INTERVAL);
  capturing = true;

  return true;
}

function preStopCapture() {
  var grid = document.getElementById(LIST_CANVASES_ID);
  var buttons = Array.from(grid.querySelectorAll("button.canvas_capture_button"));
  var rows = Array.from(grid.querySelectorAll("span.list_canvases_row"));
  var linkCol = rows[activeButton.dataset.index].querySelector("span.canvas_capture_link_container");

  for (let k = 0; k < rows.length; k += 1) {
    let row = rows[k];
    row.classList.remove("canvas_capture_inactive", "canvas_capture_selected");
  }

  for (let k = 0; k < buttons.length; k += 1) {
    let but = buttons[k];
    but.addEventListener("click", onToggleCapture, false);
    but.textContent = "Capture";
  }

  mediaRecorder.stop();
  numBytes = 0;
  linkCol.classList.remove("capturing");
  activeButton = null;
}

function createVideoURL(blob) {
  var parent = document.getElementById(LIST_CANVASES_ID);
  var rows = Array.from(parent.querySelectorAll("span.list_canvases_row"));
  var row = rows[capturingActiveCanvas];
  var col = row.querySelector("span.canvas_capture_link_container");
  var videoURL = window.URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.textContent = "Download";
  link.download = `capture-${Date.now()}.webm`;
  link.href = videoURL;
  col.appendChild(link);
  objectURLs.push(videoURL);
}

function stopCapture() {
  if (chunks.length) {
    var blob = new Blob(chunks, {"type": chunks[0].type});
    createVideoURL(blob);
  }

  capturing = false;
  mediaRecorder = null;
  chunks = null;
  capturingActiveCanvas = null;
}

function onDataAvailable(evt) {
  var blob = evt.data;

  if (blob.size) {
    chunks.push(blob);
    numBytes += blob.size;

    if (numBytes >= maxVideoSize) {
      activeButton.click();
    }
  }
}
}());
