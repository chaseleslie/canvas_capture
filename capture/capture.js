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
var mimeTypeMap = {
  "mp4": "video/mp4",
  "webm": "video/webm"
};
var mimeType = "webm";
var objectURLs = [];
var captureInterval = 1000;
var maxVideoSize = 4 * 1024 * 1024 * 1024;
const defaultFPS = 30;
const defaultBPS = 2500000;
var cssStyleId = "capture_list_container_css";
var wrapperId = "capture_list_container";
var cssFile = "/capture/capture.css";
var htmlFile = "/capture/capture.html";

function freeObjectURLs() {
  for (let k = 0; k < objectURLs.length; k += 1) {
    window.URL.revokeObjectURL(objectURLs[k]);
  }
}

function beforeWindowUnload() {
  freeObjectURLs();

  port.postMessage({
    "command": "disconnect",
    "subcommand": tabId
  });
}
window.addEventListener("beforeunload", beforeWindowUnload, false);

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
  var inputMaxSizeSetting = browser.storage.local.get("maxVideoSize", setMaxVideoSize);
  if (typeof inputMaxSizeSetting === "function") {
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

function listCanvases(html) {
  var wrapper = document.createElement("div");
  document.body.appendChild(wrapper);
  wrapper.outerHTML = html;
  wrapper = document.getElementById(wrapperId);
  var bodyRect = document.body.getBoundingClientRect();
  var wrapperRect = wrapper.getBoundingClientRect();
  wrapper.style.bottom = "0px";
  wrapper.style.left = `${(bodyRect.width / 2) - (wrapperRect.width / 2)}px`;
  var docFrag = document.createDocumentFragment();
  var table = document.getElementById("list_canvases");
  var tableBody = table.querySelector("tbody");
  var headerKeys = ["id", "width", "height"];
  var tr = null;

  var canvases = Array.prototype.slice.call(document.body.querySelectorAll("canvas"));
  allCanvases = canvases;
  for (let k = 0; k < canvases.length; k += 1) {
    tr = document.createElement("tr");
    let canvas = canvases[k];
    for (let iK = 0; iK < headerKeys.length; iK += 1) {
      let td = document.createElement("td");
      td.textContent = canvas[headerKeys[iK]];
      tr.appendChild(td);
    }
    let td = document.createElement("td");
    let fpsInput = document.createElement("input");
    fpsInput.id = `fps${k}`;
    fpsInput.type = "text";
    fpsInput.value = defaultFPS;
    fpsInput.size = 5;
    td.appendChild(fpsInput);
    tr.appendChild(td);

    td = document.createElement("td");
    let bpsInput = document.createElement("input");
    bpsInput.id = `bps${k}`;
    bpsInput.type = "text";
    bpsInput.value = defaultBPS;
    bpsInput.size = 5;
    td.appendChild(bpsInput);
    tr.appendChild(td);

    td = document.createElement("td");
    let button = document.createElement("button");
    button.id = `toggle${k}`;
    button.dataset.index = k;
    button.textContent = "Capture";
    button.dataset.canvasId = canvas.id;
    button.dataset.fpsInput = fpsInput.id;
    button.dataset.bpsInput = bpsInput.id;
    button.addEventListener("click", onToggleCapture, false);
    td.appendChild(button);
    tr.appendChild(td);

    td = document.createElement("td");
    td.classList.add("canvas_capture_link_container");
    tr.appendChild(td);

    tr.dataset.canvasId = canvas.id;
    tr.dataset.index = k;
    docFrag.appendChild(tr);
  }

  tableBody.appendChild(docFrag);
}

function onToggleCapture(evt) {
  activeButton = evt.target;

  if (capturing) {
    preStopCapture();
  } else {
    preStartCapture();
  }
}

function preStartCapture() {
  var table = document.getElementById("list_canvases");
  var buttons = Array.prototype.slice.call(table.querySelectorAll("button"));
  var rows = Array.prototype.slice.call(table.querySelectorAll("tr"), 1);
  var button = activeButton;
  var h3 = document.getElementById(wrapperId).querySelector("h3");

  var buttonIndex = button.dataset.index;
  var row = null;
  var linkCol = rows[buttonIndex].querySelector("td.canvas_capture_link_container");
  linkCol.textContent = "";

  for (let k = 0; k < rows.length; k += 1) {
    let ro = rows[k];

    if (ro.dataset.index === buttonIndex) {
      ro.classList.add("canvas_capture_selected");
      row = ro;
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

  var canvasIndex = row.dataset.index;
  var canvasId = button.dataset.canvasId;
  var fpsInput = document.getElementById(button.dataset.fpsInput);
  var fps = parseFloat(fpsInput.value);
  fps = (isFinite(fps) && !isNaN(fps) && fps >= 0) ? fps : 0;
  var bpsInput = document.getElementById(button.dataset.bpsInput);
  var bps = parseFloat(bpsInput.value);
  bps = (isFinite(bps) && !isNaN(bps) && bps > 0) ? bps : defaultBPS;
  startCapture(canvasIndex, canvasId, fps, bps);

  h3.classList.add("capturing");
  activeButton = button;
}

function startCapture(canvasIndex, id, fps, bps) {
  capturingActiveCanvas = canvasIndex;
  chunks = [];
  var canvas = null;
  if (id) {
    canvas = document.getElementById(id);
  } else {
    canvas = allCanvases[canvasIndex];
  }

  if (!canvas) {
    return;
  }

  var stream = canvas.captureStream(fps);
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
}

function preStopCapture() {
  var table = document.getElementById("list_canvases");
  var buttons = Array.prototype.slice.call(table.querySelectorAll("button"));
  var rows = Array.prototype.slice.call(table.querySelectorAll("tr"), 1);
  var h3 = document.getElementById(wrapperId).querySelector("h3");

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
  h3.classList.remove("capturing");
  activeButton = null;
}

function createVideoURL(blob) {
  var table = document.getElementById("list_canvases");
  var rows = Array.prototype.slice.call(table.querySelectorAll("tr"), 1);
  var row = rows[capturingActiveCanvas];
  var col = row.querySelector("td.canvas_capture_link_container");
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
