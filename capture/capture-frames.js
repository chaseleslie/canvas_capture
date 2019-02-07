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

const FRAME_UUID = Utils.genUUIDv4();
const TOP_FRAME_UUID = Utils.TOP_FRAME_UUID;

const MessageCommands = Utils.MessageCommands;

const MIME_TYPE_MAP = Object.freeze({
  "mp4":  "video/mp4",
  "webm": "video/webm"
});
const DEFAULT_MIME_TYPE = "webm";
const CAPTURE_INTERVAL_MS = 1000;

const CANVAS_ACTIVE_CAPTURING_CLASS = "canvas_active_capturing";
const CANVAS_ACTIVE_DELAYED_CLASS = "canvas_active_delayed";

const CANVAS_OBSERVER_OPS = Object.freeze({
  "attributes": true,
  "attributeFilter": ["id", "width", "height"]
});

const Ext = Object.seal({
  "tabId": null,
  "frameId": null,
  "port": browser.runtime.connect({
    "name": FRAME_UUID
  }),
  "mediaRecorder": null,
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
  "objectURLs": [],
  "downloadLinks": [],
  "settings": {
    "maxVideoSize": Utils.DEFAULT_MAX_VIDEO_SIZE
  },
  "bodyMutObs": new MutationObserver(observeBodyMutations),
  "canvasMutObs": new MutationObserver(observeCanvasMutations),
  "freeObjectURLs": function() {
    for (let k = 0; k < this.objectURLs.length; k += 1) {
      window.URL.revokeObjectURL(this.objectURLs[k]);
    }

    for (let k = 0, n = this.downloadLinks.length; k < n; k += 1) {
      const link = this.downloadLinks[k];
      link.parentElement.removeChild(link);
      this.downloadLinks[k] = null;
    }
    Ext.downloadLinks = [];
  },
  "disable": function() {
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

  if (msg.command === "identify") {
    const obj = JSON.parse(JSON.stringify(msg));
    obj.frameUUID = FRAME_UUID;
    evt.source.postMessage(obj, evt.origin);
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
    Ext.tabId = msg.tabId;
    Ext.frameId = msg.frameId;
  } else if (msg.command === MessageCommands.UPDATE_CANVASES) {
    const canvases = Array.from(document.body.querySelectorAll("canvas"));
    Ext.frames[FRAME_UUID].canvases = canvases;
    updateCanvases(canvases);
  }
}

function handleMessageCaptureStart(msg) {
  const ret = preStartCapture(msg);
  if (!ret) {
    Ext.port.postMessage({
      "command": MessageCommands.CAPTURE_START,
      "tabId": Ext.tabId,
      "frameId": Ext.frameId,
      "frameUUID": FRAME_UUID,
      "targetFrameUUID": TOP_FRAME_UUID,
      "success": ret,
      "startTS": Ext.active.startTS
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
    Ext.mediaRecorder.removeEventListener("dataavailable", onDataAvailable, false);
    Ext.mediaRecorder.removeEventListener("stop", stopCapture, false);
    Ext.mediaRecorder.removeEventListener("error", preStopCapture, false);

    if (Ext.mediaRecorder.state !== "inactive") {
      Ext.mediaRecorder.stop();
    }
  }

  Ext.freeObjectURLs();
  Ext.active.clear();
  Ext.bodyMutObs.disconnect();
  Ext.canvasMutObs.disconnect();
  Ext.port.disconnect();

  window.removeEventListener("message", handleWindowMessage, true);

  Ext.disable();
}

function handleMessageDisplay(msg) {
  const canvases = Array.from(document.body.querySelectorAll("canvas"));

  canvases.forEach((canvas) => Ext.canvasMutObs.observe(canvas, CANVAS_OBSERVER_OPS));
  Ext.settings.maxVideoSize = msg.defaultSettings.maxVideoSize;
  Ext.tabId = msg.tabId;
  Ext.frames[FRAME_UUID].canvases = canvases;
  updateCanvases(canvases);
}

function handleMessageDownload(msg) {
  const link = document.createElement("a");
  link.textContent = "download";
  link.href = Ext.objectURLs[msg.canvasIndex];
  link.download = `capture-${Math.trunc(Date.now() / 1000)}.${DEFAULT_MIME_TYPE}`;
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

  Ext.port.postMessage({
    "command": MessageCommands.HIGHLIGHT,
    "tabId": Ext.tabId,
    "frameId": Ext.frameId,
    "frameUUID": FRAME_UUID,
    "targetFrameUUID": TOP_FRAME_UUID,
    "rect": {
      "left": rect.left,
      "top": rect.top,
      "right": rect.right,
      "bottom": rect.bottom,
      "width": rect.width,
      "height": rect.height,
      "x": rect.x,
      "y": rect.y
    },
    "canCapture": canCaptureStream(canvas)
  });
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

function updateCanvases(canvases) {
  const canvasData = canvases.map(function(el) {
    return {
      "id": el.id,
      "width": el.width,
      "height": el.height,
      "pathSpec": Utils.pathSpecFromElement(el)
    };
  });

  canvases.forEach((canvas) => Ext.canvasMutObs.observe(canvas, CANVAS_OBSERVER_OPS));

  Ext.port.postMessage({
    "command": MessageCommands.UPDATE_CANVASES,
    "tabId": Ext.tabId,
    "frameId": Ext.frameId,
    "frameUUID": FRAME_UUID,
    "targetFrameUUID": TOP_FRAME_UUID,
    "frameUrl": window.location.href.split("#")[0],
    "canvases": canvasData,
    "activeCanvasIndex": Ext.active.index,
    "delayCanvasIndex": Ext.active.delayCanvasIndex
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
    }, timerSeconds * 1000);
  }

  Ext.active.canvas.classList.add(CANVAS_ACTIVE_CAPTURING_CLASS);
  Ext.active.capturing = true;
  Ext.active.startTS = Date.now();
  Ext.port.postMessage({
    "command": MessageCommands.CAPTURE_START,
    "tabId": Ext.tabId,
    "frameId": Ext.frameId,
    "frameUUID": FRAME_UUID,
    "targetFrameUUID": TOP_FRAME_UUID,
    "success": true,
    "startTS": Ext.active.startTS
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

  if (Ext.chunks.length) {
    blob = new Blob(Ext.chunks, {"type": Ext.chunks[0].type});
    videoURL = window.URL.createObjectURL(blob);
    Ext.objectURLs[Ext.active.index] = videoURL;
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
    "command": MessageCommands.CAPTURE_STOP,
    "tabId": Ext.tabId,
    "frameId": Ext.frameId,
    "frameUUID": FRAME_UUID,
    "targetFrameUUID": TOP_FRAME_UUID,
    "canvasIndex": Ext.active.index,
    "videoURL": videoURL,
    "success": success,
    "size": blob ? blob.size : 0,
    "startTS": Ext.active.startTS
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
    "frameUUID": FRAME_UUID,
    "notification": notification
  });
}

}());
