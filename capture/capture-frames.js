/* Copyright (C) 2016-2017, 2019 Chase Leslie
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

const FRAME_UUID = Utils.genUUIDv4();
const TOP_FRAME_UUID = Utils.TOP_FRAME_UUID;

const MessageCommands = Utils.MessageCommands;

const WORKER_PATH = "/wasm/worker.js";
const WASM_PATH = "/wasm/build/webm_muxer.js";
const WASM_BINARY_PATH = "/wasm/build/webm_muxer.wasm";
const UTILS_JS_PATH = "/capture/utils.js";

const MSEC_PER_SEC = 1000;

const MIME_TYPE_MAP = Object.freeze({
  "mp4":  "video/mp4",
  "webm": "video/webm"
});
const DEFAULT_MIME_TYPE = "webm";
const CAPTURE_INTERVAL_MS = MSEC_PER_SEC;

const CANVAS_ACTIVE_CAPTURING_CLASS = "canvas_active_capturing";
const CANVAS_ACTIVE_DELAYED_CLASS = "canvas_active_delayed";

const CANVAS_OBSERVER_OPS = Object.freeze({
  "attributes": true,
  "attributeFilter": ["id", "width", "height"]
});

const Ext = Object.seal({
  "tabId": null,
  "frameId": null,
  "tabKey": null,
  "port": null,
  "mediaRecorder": null,
  "muxer": Object.seal({
    "worker":       null,
    "workerSrcURL": null,
    "utilsSrcURL":  null,
    "wasmSrcURL":   null,
    "initialized":  false,
    "objectURL":    null,
    "muxing":       false,
    "queue":        [],
    "clear": function() {
      this.objectURL = null;
      this.muxing = false;
    },
    "disable": function() {
      window.URL.revokeObjectURL(this.workerSrcURL);
      window.URL.revokeObjectURL(this.utilsSrcURL);
      window.URL.revokeObjectURL(this.wasmSrcURL);

      for (const key of Object.keys(this)) {
        this[key] = null;
      }
    }
  }),
  "active": Object.seal({
    "capturing": false,
    "index": -1,
    "frameUUID": FRAME_UUID,
    "canvas": null,
    "startTS": 0,
    "canvasRemoved": false,
    "stopped": false,
    "delayCanvasIndex": -1,
    "error": false,
    "errorMessage": "",
    "timer": Object.seal({
      "timerId": -1,
      "secs": 0,
      "clear": function() {
        clearTimeout(this.timerId);
        this.timerId = -1;
        this.secs = 0;
      }
    }),
    "clear": function() {
      this.capturing = false;
      this.index = -1;
      this.frameUUID = FRAME_UUID;
      this.canvas = null;
      this.startTS = 0;
      this.canvasRemoved = false;
      this.stopped = false;
      this.delayCanvasIndex = -1;
      this.error = false;
      this.errorMessage = "";
      this.timer.clear();
    }
  }),
  "chunks": null,
  "frames": {[FRAME_UUID]: {"frameUUID": FRAME_UUID, "canvases": []}},
  "numBytesRecorded": 0,
  "captures": [],
  "downloadLinks": [],
  "settings": Object.seal({
    [Utils.MAX_VIDEO_SIZE_KEY]: Utils.DEFAULT_MAX_VIDEO_SIZE,
    [Utils.FPS_KEY]:            Utils.DEFAULT_FPS,
    [Utils.BPS_KEY]:            Utils.DEFAULT_BPS,
    [Utils.AUTO_OPEN_KEY]:      Utils.DEFAULT_AUTO_OPEN,
    [Utils.REMUX_KEY]:          Utils.DEFAULT_REMUX
  }),
  "bodyMutObs": new MutationObserver(observeBodyMutations),
  "canvasMutObs": new MutationObserver(observeCanvasMutations),
  "freeCaptures": function() {
    for (let k = 0; k < this.captures.length; k += 1) {
      const capture = this.captures[k];
      window.URL.revokeObjectURL(capture.url);
    }

    for (let k = 0, n = this.downloadLinks.length; k < n; k += 1) {
      const link = this.downloadLinks[k];
      link.remove(link);
      this.downloadLinks[k] = null;
    }

    Ext.downloadLinks = [];
  },
  "disable": function() {
    this.freeCaptures();

    for (const key of Object.keys(this)) {
      this[key] = null;
    }
  }
});

if (document.readyState === "loading") {
  window.addEventListener("load", handleWindowLoad, false);
} else {
  handleWindowLoad();
}

function handleWindowLoad() {
  Ext.port = browser.runtime.connect({"name": FRAME_UUID});
  Ext.port.onMessage.addListener(onMessage);
  window.addEventListener("message", handleWindowMessage, true);

  Ext.bodyMutObs.observe(document.body, {
    "childList":  true,
    "subtree":    true
  });
}

function handleWindowMessage(evt) {
  const msg = evt.data;
  const tabKey = msg && msg.tabKey;

  if (!msg || !("command" in msg) || tabKey !== Ext.tabKey) {
    return;
  }

  const frames = Array.from(document.querySelectorAll("iframe"));
  let frame = null;

  for (let k = 0, n = frames.length; k < n; k += 1) {
    const fr = frames[k];

    if (fr.contentWindow === evt.source) {
      frame = fr;
    }
  }

  if (!frame) {
    return;
  }

  if (msg.command === MessageCommands.HIGHLIGHT) {
    const rect = msg.rect;
    const frameRect = frame.getBoundingClientRect();

    rect.left += frameRect.left;
    rect.top += frameRect.top;
    rect.right = rect.left + rect.width;
    rect.bottom = rect.top + rect.height;

    window.parent.postMessage(msg, "*");
  } else if (msg.command === MessageCommands.IDENTIFY) {
    const pathSpec = Utils.pathSpecFromElement(frame);
    msg.pathSpec = `${pathSpec}:${msg.pathSpec}`;
    window.parent.postMessage(msg, "*");
  }
}

function onMessage(msg) {
  if (msg.command === MessageCommands.CAPTURE_START) {
    handleMessageCaptureStart(msg);
  } else if (msg.command === MessageCommands.CAPTURE_STOP) {
    preStopCapture();
  } else if (msg.command === MessageCommands.DELAY) {
    handleMessageDelay(msg);
  } else if (msg.command === MessageCommands.DISABLE) {
    handleMessageDisable();
  } else if (msg.command === MessageCommands.DISPLAY) {
    handleMessageDisplay(msg);
  } else if (msg.command === MessageCommands.DOWNLOAD) {
    handleMessageDownload(msg);
  } else if (msg.command === MessageCommands.HIGHLIGHT) {
    handleMessageHighlight(msg);
  } else if (msg.command === MessageCommands.REGISTER) {
    handleMessageRegister(msg);
  } else if (msg.command === MessageCommands.REMOVE_CAPTURE) {
    handleMessageRemoveCapture(msg);
  } else if (msg.command === MessageCommands.UPDATE_CANVASES) {
    const canvases = Array.from(document.body.querySelectorAll("canvas"));
    Ext.frames[FRAME_UUID].canvases = canvases;
    updateCanvases(canvases);
  } else if (msg.command === MessageCommands.UPDATE_SETTINGS) {
    handleMessageUpdateSettings(msg);
  }
}

function handleMessageCaptureStart(msg) {
  const ret = preStartCapture(msg);
  if (!ret) {
    Ext.port.postMessage({
      "command":          MessageCommands.CAPTURE_START,
      "tabId":            Ext.tabId,
      "frameId":          Ext.frameId,
      "frameUUID":        FRAME_UUID,
      "targetFrameUUID":  TOP_FRAME_UUID,
      "success":          ret,
      "startTS":          Ext.active.startTS
    });
  }
}

function handleMessageDelay(msg) {
  const canvases = Array.from(document.body.querySelectorAll("canvas"));
  if (msg.delayed) {
    const index = msg.canvasIndex;
    Ext.active.delayCanvasIndex = index;
    const canvas = canvases[index];
    canvas.classList.add(CANVAS_ACTIVE_DELAYED_CLASS);
  } else {
    Ext.active.delayCanvasIndex = -1;
    for (let k = 0, n = canvases.length; k < n; k += 1) {
      const canvas = canvases[k];
      canvas.classList.remove(CANVAS_ACTIVE_DELAYED_CLASS);
    }
  }
}

function handleMessageDisable() {
  if (Ext.mediaRecorder) {
    Ext.mediaRecorder.removeEventListener(
      "dataavailable", onDataAvailable, false
    );
    Ext.mediaRecorder.removeEventListener("stop", stopCapture, false);
    Ext.mediaRecorder.removeEventListener("error", preStopCapture, false);

    if (Ext.mediaRecorder.state !== "inactive") {
      Ext.mediaRecorder.stop();
    }
  }

  Ext.active.clear();
  Ext.bodyMutObs.disconnect();
  Ext.canvasMutObs.disconnect();
  Ext.port.disconnect();

  window.removeEventListener("message", handleWindowMessage, true);

  Ext.disable();
}

function handleMessageDisplay(msg) {
  const canvases = Array.from(document.body.querySelectorAll("canvas"));

  canvases.forEach(
    (canvas) => Ext.canvasMutObs.observe(canvas, CANVAS_OBSERVER_OPS)
  );
  Ext.tabId = msg.tabId;
  Ext.frames[FRAME_UUID].canvases = canvases;
  updateCanvases(canvases);
}

function handleMessageDownload(msg) {
  let url = msg.url;
  const link = document.createElement("a");

  for (let k = 0, n = Ext.captures.length; k < n; k += 1) {
    const capture = Ext.captures[k];

    if (capture.oldUrl === url) {
      url = capture.url;
    }
  }

  link.href = url;
  link.textContent = "download";
  link.download = msg.name;
  link.style.maxWidth = "0px";
  link.style.maxHeight = "0px";
  link.style.display = "block";
  link.style.visibility = "hidden";
  link.style.position = "absolute";
  Ext.downloadLinks.push(link);
  document.body.appendChild(link);
  link.click();
}

function handleMessageHighlight(msg) {
  const canvasIndex = msg.canvasIndex;
  const canvas = Ext.frames[FRAME_UUID].canvases[canvasIndex];
  const rect = canvas.getBoundingClientRect();

  window.parent.postMessage({
    "command":          MessageCommands.HIGHLIGHT,
    "tabKey":           Ext.tabKey,
    "tabId":            Ext.tabId,
    "frameId":          Ext.frameId,
    "frameUUID":        FRAME_UUID,
    "targetFrameUUID":  TOP_FRAME_UUID,
    "canCapture":       canCaptureStream(canvas),
    "rect": {
      "left":   rect.left,
      "top":    rect.top,
      "right":  rect.right,
      "bottom": rect.bottom,
      "width":  rect.width,
      "height": rect.height
    }
  }, "*");
}

function handleMessageRegister(msg) {
  Ext.tabId = msg.tabId;
  Ext.frameId = msg.frameId;
  Ext.tabKey = msg.tabKey;

  const canvases = Array.from(document.querySelectorAll("canvas"));
  updateCanvases(canvases);

  const frames = Array.from(document.querySelectorAll("iframe"));
  if (frames.length) {
    handleAddedIframes(frames);
  }

  window.parent.postMessage({
    "command":          MessageCommands.IDENTIFY,
    "tabKey":           Ext.tabKey,
    "tabId":            Ext.tabId,
    "frameId":          Ext.frameId,
    "frameUUID":        FRAME_UUID,
    "frameUrl":         window.location.href.split("#")[0],
    "targetFrameUUID":  TOP_FRAME_UUID,
    "pathSpec":         ""
  }, "*");
}

function handleMessageRemoveCapture(msg) {
  const url = msg.url;

  for (let k = 0, n = Ext.captures.length; k < n; k += 1) {
    const capture = Ext.captures[k];

    if (capture.url === url) {
      window.URL.revokeObjectURL(url);
      Ext.captures.splice(k, 1);
      break;
    }
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
  const removedCanvases = [];
  const addedIframes = [];
  const isCanvas = (el) => el.nodeName.toLowerCase() === "canvas";
  const isIframe = (el) => el.nodeName.toUpperCase() === "IFRAME";

  for (let k = 0, n = mutations.length; k < n; k += 1) {
    const mutation = mutations[k];
    for (let iK = 0, iN = mutation.addedNodes.length; iK < iN; iK += 1) {
      if (isCanvas(mutation.addedNodes[iK])) {
        addedCanvases = true;
      } else if (isIframe(mutation.addedNodes[iK])) {
        addedIframes.push(mutation.addedNodes[iK]);
      }
    }

    removedCanvases.push(...Array.from(mutation.removedNodes).filter(isCanvas));
  }

  const canvasesChanged = addedCanvases || removedCanvases.length;

  if (addedIframes.length) {
    handleAddedIframes(addedIframes);
  }

  if (!canvasesChanged) {
    return;
  }

  for (let k = 0, n = removedCanvases.length; k < n; k += 1) {
    const node = removedCanvases[k];
    if (
      Ext.active.capturing &&
      node.classList.contains(CANVAS_ACTIVE_CAPTURING_CLASS)
    ) {
      if (Ext.active.timer.timerId >= 0) {
        clearTimeout(Ext.active.timer.timerId);
        Ext.active.timer.timerId = -1;
      }
      Ext.active.canvasRemoved = true;
      preStopCapture();
      break;
    } else if (
      Ext.active.delay.delayCanvasIndex >= 0 &&
      node.classList.contains(CANVAS_ACTIVE_DELAYED_CLASS)
    ) {
      Ext.active.delayCanvasIndex = -1;
    }
  }

  const canvases = Array.from(document.body.querySelectorAll("canvas"));
  Ext.frames[FRAME_UUID].canvases = canvases;

  if (Ext.active.capturing && !Ext.active.canvasRemoved) {
    for (let k = 0, n = canvases.length; k < n; k += 1) {
      const canvas = canvases[k];
      if (canvas.classList.contains(CANVAS_ACTIVE_CAPTURING_CLASS)) {
        Ext.active.index = k;
        Ext.active.canvas = canvas;
        break;
      }
    }
  } else if (Ext.active.delayCanvasIndex >= 0) {
    for (let k = 0, n = canvases.length; k < n; k += 1) {
      const canvas = canvases[k];
      if (canvas.classList.contains(CANVAS_ACTIVE_DELAYED_CLASS)) {
        Ext.active.delayCanvasIndex = k;
        break;
      }
    }
  }

  updateCanvases(canvases);
}

function observeCanvasMutations(mutations) {
  mutations = mutations.filter((el) => el.type === "attributes");
  const canvases = Array.from(document.body.querySelectorAll("canvas"));

  if (mutations.length) {
    updateCanvases(canvases);
  }
}

function handleAddedIframes(iframes) {
  for (let k = 0, n = iframes.length; k < n; k += 1) {
    const iframe = iframes[k];
    iframe.addEventListener("load", handleIframeLoaded, false);
    Ext.port.postMessage({
      "command":      MessageCommands.IFRAME_NAVIGATED,
      "tabId":        Ext.tabId,
      "frameUUID":    FRAME_UUID,
      "frameUrl":     iframe.src,
      "oldFrameUrl":  ""
    });
  }
}

function handleIframeLoaded(e) {
  const iframe = e.target;
  Ext.port.postMessage({
    "command":      MessageCommands.IFRAME_NAVIGATED,
    "tabId":        Ext.tabId,
    "frameUUID":    TOP_FRAME_UUID,
    "frameUrl":     iframe.src,
    "oldFrameUrl":  ""
  });
}

function updateCanvases(canvases) {
  const canvasData = canvases.map(function(el) {
    return {
      "id":       el.id,
      "width":    el.width,
      "height":   el.height,
      "pathSpec": Utils.pathSpecFromElement(el)
    };
  });

  canvases.forEach(
    (canvas) => Ext.canvasMutObs.observe(canvas, CANVAS_OBSERVER_OPS)
  );

  Ext.port.postMessage({
    "command":            MessageCommands.UPDATE_CANVASES,
    "tabId":              Ext.tabId,
    "frameId":            Ext.frameId,
    "frameUUID":          FRAME_UUID,
    "targetFrameUUID":    TOP_FRAME_UUID,
    "frameUrl":           window.location.href.split("#")[0],
    "canvases":           canvasData,
    "activeCanvasIndex":  Ext.active.index,
    "delayCanvasIndex":   Ext.active.delayCanvasIndex
  });
}

function preStartCapture(msg) {
  if (Ext.active.capturing) {
    return false;
  }

  Ext.active.index = msg.canvasIndex;
  const canvas = Ext.frames[FRAME_UUID].canvases[Ext.active.index];
  const fps = msg.fps;
  const bps = msg.bps;
  Ext.active.timer.secs = parseInt(msg.timerSeconds, 10) || 0;
  Ext.active.canvas = canvas;

  if (!canCaptureStream(canvas)) {
    return false;
  }

  return startCapture(canvas, fps, bps);
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
  if (Ext.active.timer.secs) {
    const timerSeconds = Ext.active.timer.secs;
    Ext.active.timer.timerId = setTimeout(function() {
      preStopCapture();
    }, timerSeconds * MSEC_PER_SEC);
  }

  Ext.active.canvas.classList.add(CANVAS_ACTIVE_CAPTURING_CLASS);
  Ext.active.capturing = true;
  Ext.active.startTS = Date.now();
  Ext.port.postMessage({
    "command":          MessageCommands.CAPTURE_START,
    "tabId":            Ext.tabId,
    "frameId":          Ext.frameId,
    "frameUUID":        FRAME_UUID,
    "targetFrameUUID":  TOP_FRAME_UUID,
    "success":          true,
    "startTS":          Ext.active.startTS
  });
}

function preStopCapture(evt) {
  if (evt && evt.error) {
    Ext.active.error = true;
    Ext.active.errorMessage = evt.error.message;
  } else {
    Ext.active.stopped = true;
  }

  if (Ext.mediaRecorder && Ext.mediaRecorder.state !== "inactive") {
    Ext.mediaRecorder.stop();
  }
}

function stopCapture() {
  var blob = null;
  var videoURL = "";
  var size = 0;
  var capture = {
    "url":        "",
    "oldUrl":     "",
    "blob":       null,
    "startTS":    Ext.active.startTS,
    "endTS":      Ext.active.startTS,
    "size":       0,
    "prettySize": "",
    "name":       "",
    "frameUUID":  FRAME_UUID
  };

  if (Ext.chunks.length) {
    blob = new Blob(Ext.chunks, {"type": Ext.chunks[0].type});
    videoURL = window.URL.createObjectURL(blob);
    size = blob ? blob.size : 0;
    const ts = Math.trunc(Date.now() / MSEC_PER_SEC);
    capture = {
      "url":        videoURL,
      "oldUrl":     videoURL,
      "blob":       blob,
      "startTS":    Ext.active.startTS,
      "endTS":      Date.now(),
      "size":       size,
      "prettySize": Utils.prettyFileSize(size),
      "name":       `capture-${ts}.${DEFAULT_MIME_TYPE}`,
      "frameUUID":  FRAME_UUID
    };
    Ext.captures.push(capture);

    if (Ext.settings[Utils.REMUX_KEY]) {
      handleSpawnMuxer();
      Ext.muxer.queue.push(videoURL);
      handleMuxerQueue();
    }
  }
  var success = !Ext.active.error;

  if (Ext.active.canvasRemoved) {
    showNotification("Canvas was removed while it was being recorded.");
    success = false;
  } else if (Ext.active.error) {
    showNotification("An error occured while recording.");
  } else if (!Ext.active.stopped) {
    showNotification("Recording unexpectedly stopped.");
  }

  Ext.port.postMessage({
    "command":          MessageCommands.CAPTURE_STOP,
    "tabId":            Ext.tabId,
    "frameId":          Ext.frameId,
    "frameUUID":        FRAME_UUID,
    "targetFrameUUID":  TOP_FRAME_UUID,
    "canvasIndex":      Ext.active.index,
    "success":          success,
    "capture":          capture
  });

  Ext.active.clear();
  Ext.mediaRecorder = null;
  Ext.chunks = null;
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

function handleSpawnMuxer() {
  /* Unfortunately chromium doesn't allow loading workers from extension
     scripts. For now, spawn worker from objectURL and import scripts into
     worker by fetching source and using Function() ctor hack.
     See https://crbug.com/357664 */
  const muxer = Ext.muxer;

  if (muxer.worker) {
    return;
  }

  let wasmBinary = null;

  fetch(browser.runtime.getURL(WORKER_PATH))
  .then(function(response) {
    if (response.ok) {
      return response.blob();
    }

    throw Error(`Error fetching '${response.url}': ${response.status}`);
  }).then(function(blob) {
    muxer.workerSrcURL = window.URL.createObjectURL(blob);
    muxer.worker = new Worker(muxer.workerSrcURL);
    muxer.worker.addEventListener("message", handleMuxerMessage, false);

    return fetch(browser.runtime.getURL(WASM_BINARY_PATH));
  }).then(function(response) {
    if (response.ok) {
      return response.arrayBuffer();
    }

    throw Error(`Error fetching '${response.url}': ${response.status}`);
  }).then(function(buffer) {
    wasmBinary = buffer;
    return fetch(browser.runtime.getURL(UTILS_JS_PATH));
  }).then(function(response) {
    if (response.ok) {
      return response.blob();
    }

    throw Error(`Error fetching '${response.url}': ${response.status}`);
  }).then(function(blob) {
    muxer.utilsSrcURL = window.URL.createObjectURL(blob);
    return fetch(browser.runtime.getURL(WASM_PATH));
  }).then(function(response) {
    if (response.ok) {
      return response.blob();
    }

    throw Error(`Error fetching '${response.url}': ${response.status}`);
  }).then(function(blob) {
    muxer.wasmSrcURL = window.URL.createObjectURL(blob);
    muxer.worker.postMessage({
      "command":    "register",
      "wasmBinary": wasmBinary,
      "utilsSrc":   muxer.utilsSrcURL,
      "wasmSrc":    muxer.wasmSrcURL
    }, [wasmBinary]);
  }).catch(function() {
    Ext.muxer.clear();
  });
}

function handleMuxerMessage(e) {
  const msg = e.data;

  if (msg.command === MessageCommands.REGISTER) {
    Ext.muxer.initialized = true;

    handleMuxerQueue();
  } else if (msg.command === MessageCommands.REMUX) {
    if (msg.success) {
      handleMuxerRemuxSuccess(msg);
    } else {
      handleMuxerRemuxError(msg);
    }

    Ext.muxer.clear();
    handleMuxerQueue();
  }
}

function handleMuxerRemux(objectURL) {
  const muxer = Ext.muxer;
  const caps = Ext.captures;
  const capture = caps.find((el) => el.url === objectURL);
  const blob = (capture) ? capture.blob : null;

  if (!blob) {
    setTimeout(handleMuxerQueue, 0);
    return;
  }

  muxer.objectURL = objectURL;
  const reader = new FileReader();
  reader.addEventListener("loadend", function() {
    const buffer = reader.result;
    muxer.worker.postMessage({
      "command":        MessageCommands.REMUX,
      "srcArrayBuffer": buffer,
      "ts":             capture.startTS
    }, [buffer]);
    muxer.muxing = true;
  }, false);
  reader.addEventListener("error", function() {
    muxer.clear();
  }, false);
  reader.readAsArrayBuffer(blob);
}

function handleMuxerRemuxSuccess(msg) {
  const blob = new Blob([msg.result], {"type": MIME_TYPE_MAP[DEFAULT_MIME_TYPE]});
  const url = window.URL.createObjectURL(blob);

  for (let k = 0, n = Ext.captures.length; k < n; k += 1) {
    const capture = Ext.captures[k];

    if (capture.url === Ext.muxer.objectURL) {
      capture.url = url;
      capture.blob = blob;
      capture.size = blob.size;
      capture.prettySize = Utils.prettyFileSize(capture.size);
      window.URL.revokeObjectURL(Ext.muxer.objectURL);
      Ext.port.postMessage({
        "command":          MessageCommands.REMUX,
        "tabId":            Ext.tabId,
        "frameId":          Ext.frameId,
        "frameUUID":        FRAME_UUID,
        "targetFrameUUID":  TOP_FRAME_UUID,
        "capture":          capture
      });
      break;
    }
  }
}

function handleMuxerRemuxError() {
  Ext.muxer.clear();
}

function handleMuxerQueue() {
  const muxer = Ext.muxer;

  if (muxer.muxing || !muxer.queue.length || !muxer.initialized) {
    return;
  }

  const objectURL = muxer.queue.splice(0, 1)[0];
  handleMuxerRemux(objectURL);
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
    "command":      MessageCommands.NOTIFY,
    "tabId":        Ext.tabId,
    "frameUUID":    FRAME_UUID,
    "notification": notification
  });
}

}());
