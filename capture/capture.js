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

var tabId = null;
var port = port = browser.runtime.connect({
  "name": "content-script-"
});
var displayed = false;
var mediaRecorder = null;
var capturing = false;
var capturingActiveCanvas = null;
var activeButton = null;
var chunks = null;
var allCanvases = null;
var numBytes = 0;
const mimeTypeMap = {
  "mp4": "video/mp4",
  "webm": "video/webm"
};
var mimeType = "webm";
var objectURLs = [];
var captureInterval = 1000;
var maxVideoSize = 4 * 1024 * 1024 * 1024;
const defaultFPS = 30;
const defaultBPS = 2500000;
var wrapperMouseHover = false;
var cssStyleId = "capture_list_container_css";
var wrapperId = "capture_list_container";
var listCanvasesId = "list_canvases";
var cssFile = "/capture/capture.css";
var htmlFile = "/capture/capture.html";

function freeObjectURLs() {
  for (let k = 0; k < objectURLs.length; k += 1) {
    window.URL.revokeObjectURL(objectURLs[k]);
  }
}

function onMessage(msg) {
  if (msg.command === "display") {
    tabId = msg.subcommand;
    if (!displayed) {
      handleDisplay(msg);
      displayed = true;
    }
  } else if (msg.command === "disable") {
    handleDisable(msg);
  }
}
port.onMessage.addListener(onMessage);

function handleDisable() {
  if (!displayed) {
    return;
  }

  var wrapper = document.getElementById(wrapperId);
  if (wrapper) {
    wrapper.parentElement.removeChild(wrapper);
  }

  var style = document.getElementById(cssStyleId);
  if (style) {
    style.parentElement.removeChild(style);
  }

  freeObjectURLs();
  displayed = false;
  port.postMessage({
    "command": "disconnect",
    "subcommand": tabId
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
    handleDisable();
    return;
  }

  var inputMaxSizeSetting = browser.storage.local.get("maxVideoSize", setMaxVideoSize);
  if (inputMaxSizeSetting) {
    inputMaxSizeSetting.then(setMaxVideoSize);
  }

  var xhrCSS = new XMLHttpRequest();
  var cssUrl = browser.runtime.getURL(cssFile);
  xhrCSS.open("GET", cssUrl, true);
  xhrCSS.onreadystatechange = function() {
    if (xhrCSS.status === 200 && xhrCSS.readyState === 4) {
      var css = document.createElement("style");
      css.type = "text/css";
      css.textContent = xhrCSS.responseText;
      css.id = cssStyleId;
      document.head.appendChild(css);

      var xhrHTML = new XMLHttpRequest();
      var htmlUrl = browser.runtime.getURL(htmlFile);
      xhrHTML.open("GET", htmlUrl, true);
      xhrHTML.onreadystatechange = function() {
        if (xhrHTML.status === 200 && xhrHTML.readyState === 4) {
          listCanvases(xhrHTML.responseText);
        }
      };
      xhrHTML.send();
    }
  };
  xhrCSS.send();
}

function positionWrapper() {
  var wrapper = document.getElementById(wrapperId);
  var bodyRect = document.body.getBoundingClientRect();
  var wrapperRect = wrapper.getBoundingClientRect();
  wrapper.style.left = `${(bodyRect.width / 2) - (wrapperRect.width / 2)}px`;
}

function setupWrapperEvents() {
  var wrapper = document.getElementById(wrapperId);
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

function listCanvases(html) {
  var wrapper = document.createElement("div");
  document.body.appendChild(wrapper);
  wrapper.outerHTML = html;
  wrapper = document.getElementById(wrapperId);
  var docFrag = document.createDocumentFragment();
  var grid = document.getElementById(listCanvasesId);
  var headerKeys = ["id", "width", "height"];
  var row = null;

  positionWrapper();
  setupWrapperEvents();

  var canvases = Array.from(document.body.querySelectorAll("canvas"));
  allCanvases = canvases;
  for (let k = 0; k < canvases.length; k += 1) {
    row = document.createElement("span");
    let canvas = canvases[k];
    for (let iK = 0; iK < headerKeys.length; iK += 1) {
      let col = document.createElement("span");
      col.textContent = canvas[headerKeys[iK]];
      col.classList.add("middle_centered");
      if (headerKeys[iK] === "id") {
        col.classList.add("list_canvases_canvas_id");
        col.title = canvas[headerKeys[iK]];
      }
      row.appendChild(col);
    }
    let col = document.createElement("span");
    let fpsInput = document.createElement("input");
    fpsInput.id = `fps${k}`;
    fpsInput.type = "text";
    fpsInput.value = defaultFPS;
    fpsInput.size = 5;
    col.appendChild(fpsInput);
    col.classList.add("middle_centered");
    row.appendChild(col);

    col = document.createElement("span");
    let bpsInput = document.createElement("input");
    bpsInput.id = `bps${k}`;
    bpsInput.type = "text";
    bpsInput.value = defaultBPS;
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

  grid.appendChild(docFrag);
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
  var grid = document.getElementById(listCanvasesId);
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
  bps = (isFinite(bps) && !isNaN(bps) && bps > 0) ? bps : defaultBPS;
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
      {"mimeType": mimeTypeMap[mimeType], "bitsPerSecond": bps}
    );
  } catch (e) {
    mediaRecorder = new window.MediaRecorder(stream);
  }
  mediaRecorder.addEventListener("dataavailable", onDataAvailable, false);
  mediaRecorder.addEventListener("stop", stopCapture, false);
  mediaRecorder.start(captureInterval);
  capturing = true;

  return true;
}

function preStopCapture() {
  var grid = document.getElementById(listCanvasesId);
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
  var grid = document.getElementById(listCanvasesId);
  var rows = Array.from(grid.querySelectorAll("span.list_canvases_row"));
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
