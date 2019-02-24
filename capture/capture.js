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

const TOP_FRAME_UUID = Utils.TOP_FRAME_UUID;
const BG_FRAME_UUID = Utils.BG_FRAME_UUID;
const ALL_FRAMES_UUID = Utils.ALL_FRAMES_UUID;

const MessageCommands = Utils.MessageCommands;

const MIME_TYPE_MAP = Object.freeze({
  "mp4":  "video/mp4",
  "webm": "video/webm"
});
const DEFAULT_MIME_TYPE = "webm";
const CAPTURE_INTERVAL_MS = 1000;
const DEFAULT_DELAY = 0;
const MSEC_PER_SEC = 1000;
const CSS_FILE_PATH = "/capture/capture.css";
const HTML_FILE_PATH = "/capture/capture.html";
const HTML_ROW_FILE_PATH = "/capture/capture-row.html";
const HTML_DL_ROW_FILE_PATH = "/capture/download-row.html";
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
const LIST_CANVASES_DL_BUTTON_CONTAINER_ID = "list_canvases_dl_button_container";
const LIST_CANVASES_DL_BUTTON_ID = "list_canvases_dl_button";
const VIEW_CAPTURES_CLOSE_ID = "view_captures_close";
const VIEW_CAPTURES_CONTAINER_ID = "view_captures_container";
const VIEW_CAPTURES_ROW_CONTAINER_ID = "view_captures_row_container";

const LIST_CANVASES_ROW_CLASS = "list_canvases_row";
const CANVAS_CAPTURE_TOGGLE_CLASS = "canvas_capture_toggle";
const LIST_CANVASES_CAPTURE_TIMER_CLASS = "list_canvases_capture_timer";
const LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS = "list_canvases_capture_timer_img";
const LIST_CANVASES_CANVAS_ID_CLASS = "list_canvases_canvas_id";
const LIST_CANVASES_CANVAS_DIMENS_CLASS = "list_canvases_canvas_dimens";
const LIST_CANVASES_CANVAS_WIDTH_CLASS = "list_canvases_canvas_width";
const LIST_CANVASES_CANVAS_HEIGHT_CLASS = "list_canvases_canvas_height";
const LIST_CANVASES_CAPTURE_DELAY_CLASS = "list_canvases_capture_delay";
const LIST_CANVASES_CAPTURE_FPS_CLASS = "list_canvases_capture_fps";
const LIST_CANVASES_CAPTURE_BPS_CLASS = "list_canvases_capture_bps";
const LIST_CANVASES_CAPTURE_RELOAD_CLASS = "list_canvases_capture_reload";
const CANVAS_CAPTURE_SELECTED_CLASS = "canvas_capture_selected";
const CANVAS_CAPTURE_INACTIVE_CLASS = "canvas_capture_inactive";
const TIMER_MODIFYING_CLASS = "timer_modifying";
const CAPTURING_CLASS = "capturing";
const CAPTURING_MINIMIZED_CLASS = "capturing_minimized";
const HIDDEN_CLASS = "hidden";
const HIGHLIGHTER_UNAVAILABLE_CLASS = "highlighter_unavailable";
const HIGHLIGHTER_HORIZONTAL_CLASS = "highlighter_horizontal";
const HIGHLIGHTER_VERTICAL_CLASS = "highlighter_vertical";
const HIGHLIGHTER_OVERLAY_CLASS = "highlighter_overlay";
const CAPTURE_DL_ROW_CLASS = "view_captures_row";
const CAPTURE_DL_DATE_CLASS = "capture_dl_date";
const CAPTURE_DL_SIZE_CLASS = "capture_dl_size";
const CAPTURE_DL_DURATION_CLASS = "capture_dl_duration";
const CAPTURE_DL_REMOVE_BUTTON_CLASS = "capture_dl_remove_button";
const CAPTURE_DL_DOWNLOAD_LINK_CLASS = "capture_dl_download_link";
const CAPTURE_COMPLETE_CLASS = "capture_complete";

const CANVAS_OBSERVER_OPS = Object.freeze({
  "attributes": true,
  "attributeFilter": ["id", "width", "height"]
});

/* Settings which get saved per-canvas to persist page refresh */
const SAVE_SETTINGS_MAP = Object.freeze({
  [LIST_CANVASES_CAPTURE_FPS_CLASS]:    "fps",
  [LIST_CANVASES_CAPTURE_BPS_CLASS]:    "bps",
  [LIST_CANVASES_CAPTURE_DELAY_CLASS]:  "delay",
  [LIST_CANVASES_CAPTURE_TIMER_CLASS]:  "timer",
  [LIST_CANVASES_CAPTURE_RELOAD_CLASS]: "reload"
});

const Ext = Object.seal({
  "tabId": null,
  "frameId": null,
  "tabKey": null,
  "port": null,
  "rowTemplate": null,
  "dlRowTemplate": null,
  "settings": Object.seal({
    [Utils.MAX_VIDEO_SIZE_KEY]: Utils.DEFAULT_MAX_VIDEO_SIZE,
    [Utils.FPS_KEY]:            Utils.DEFAULT_FPS,
    [Utils.BPS_KEY]:            Utils.DEFAULT_BPS,
    [Utils.AUTO_OPEN_KEY]:      Utils.DEFAULT_AUTO_OPEN
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
  "captures": [],
  "frames": {
    [TOP_FRAME_UUID]: {
      "frameUUID": TOP_FRAME_UUID,
      "canvases": [],
      "node": window,
      "frameUrl": window.location.href.split("#")[0],
      "framePathSpec": "",
      "settings": {}
    }
  },
  "reloadedFrameSettings": {},
  "numBytesRecorded": 0,
  "wrapperMouseHover": false,
  "bodyMutObs": new MutationObserver(observeBodyMutations),
  "canvasMutObs": new MutationObserver(observeCanvasMutations),
  "highlighter": Object.seal({
    "left":     null,
    "top":      null,
    "right":    null,
    "bottom":   null,
    "overlay":  null
  }),
  "highlighterCurrent": null,
  "freeCaptures": function() {
    for (let k = 0; k < this.captures.length; k += 1) {
      const capture = this.captures[k];
      window.URL.revokeObjectURL(capture.url);
    }
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
  Ext.port = browser.runtime.connect({"name": TOP_FRAME_UUID});
  Ext.port.onMessage.addListener(onMessage);
  window.addEventListener("message", handleWindowMessage, true);

  window.addEventListener("beforeunload", handlePageUnload, false);

  Ext.bodyMutObs.observe(document.body, {
    "childList": true,
    "subtree": true
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
    if (frames[k].contentWindow === evt.source) {
      frame = frames[k];
      break;
    }
  }

  if (!frame) {
    return;
  }

  if (msg.command === MessageCommands.HIGHLIGHT) {
    const rect = msg.rect;
    rect.left += window.scrollX;
    rect.top += window.scrollY;

    handleMessageHighlight(msg, frame);
  } else if (msg.command === MessageCommands.IDENTIFY) {
    const frameUUID = msg.frameUUID;
    const pathSpec = Utils.pathSpecFromElement(frame);
    const framePathSpec = `${pathSpec}:${msg.pathSpec}`;

    if (frameUUID in Ext.frames) {
      Ext.frames[frameUUID].framePathSpec = framePathSpec;
    } else {
      Ext.frames[frameUUID] = {
        "frameUUID":      frameUUID,
        "canvases":       [],
        "frameId":        msg.frameId,
        "frameUrl":       msg.frameUrl,
        "framePathSpec":  framePathSpec,
        "settings":       {}
      };
    }
  }

  evt.stopPropagation();
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
  } else if (msg.command === MessageCommands.IFRAME_NAVIGATED) {
    handleMessageIframeAdded(msg);
  } else if (msg.command === MessageCommands.REGISTER) {
    handleMessageRegister(msg);
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
  if (msg.success) {
    const capture = msg.capture;
    Ext.captures.push(capture);
  } else {
    // error
  }

  clearCapturing(msg.success);
  clearActiveRows();
  Ext.active.clear();
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
    showNotification(
      "Iframe was removed while one of its canvases was being recorded."
    );
  }

  delete Ext.frames[frameUUID];
  updateCanvases();
  Ext.frameElementsTS = Date.now();
}

function handleMessageHighlight(msg, node) {
  const highlighter = Ext.highlighter;
  const frame = Ext.frames[msg.frameUUID];
  node = node || frame.node;

  if (node && Ext.highlighterCurrent) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const rect = msg.rect;
    const nodeRect = node.getBoundingClientRect();
    const nodeStyle = window.getComputedStyle(node);
    const borderWidthLeft = parseInt(nodeStyle.borderLeftWidth, 10);
    const borderWidthTop = parseInt(nodeStyle.borderTopWidth, 10);
    const left = nodeRect.left + rect.left + borderWidthLeft;
    const top = nodeRect.top + rect.top + borderWidthTop;
    const right = nodeRect.left + rect.left + rect.width + (2 * borderWidthLeft);
    const bottom = top + rect.height + borderWidthTop;

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

    highlighter.left.style.top = `${scrollY}px`;
    highlighter.left.style.left = `${left}px`;
    highlighter.top.style.top = `${top}px`;
    highlighter.top.style.left = `${scrollX}px`;
    highlighter.right.style.top = `${scrollY}px`;
    highlighter.right.style.left = `${right}px`;
    highlighter.bottom.style.top = `${bottom}px`;
    highlighter.bottom.style.left = `${scrollX}px`;

    highlighter.overlay.classList.remove(HIDDEN_CLASS);
    highlighter.overlay.style.left = `${left + borderWidthLeft}px`;
    highlighter.overlay.style.top = `${top + borderWidthTop}px`;
    highlighter.overlay.style.width = `${rect.width}px`;
    highlighter.overlay.style.height = `${rect.height}px`;
  }

  if (!msg.canCapture && Ext.highlighterCurrent) {
    Ext.highlighterCurrent.classList.add(HIGHLIGHTER_UNAVAILABLE_CLASS);
  }
}

function handleMessageIframeAdded() {
  Ext.port.postMessage({
    "command": MessageCommands.UPDATE_CANVASES,
    "tabId": Ext.tabId,
    "frameId": Ext.frameId,
    "frameUUID": TOP_FRAME_UUID,
    "targetFrameUUID": ALL_FRAMES_UUID
  });
}

function handleMessageRegister(msg) {
  Ext.tabId = msg.tabId;
  Ext.frameId = msg.frameId;
  Ext.tabKey = msg.tabKey;

  if (msg.settings) {
    Ext.reloadedFrameSettings = msg.settings;
  }

  const frames = Array.from(document.querySelectorAll("iframe"));
  if (frames.length) {
    handleAddedIframes(frames);
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
      "frameId": msg.frameId,
      "frameUrl": msg.frameUrl,
      "settings": {}
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
      let wasLocal = false;
      canvasIndex = parseInt(msg.delayCanvasIndex, 10);

      if (canvasIndex < 0) {
        /* Race condition when DELAY is sent to frame but frame sends
           UPDATE_CANVASES before it receives DELAY */
        canvasIndex = Ext.active.delay.options.canvasIndex;
        wasLocal = true;
      }

      if (!wasLocal && canvasIndex >= 0) {
        Ext.active.delay.options.canvasIndex = canvasIndex;
      } else if (canvasIndex < 0) {
        handleCancelDelay();
      }
    } else {
      canvasIndex = Ext.active.delay.options.canvasIndex;
      canvasFrameUUID = Ext.active.delay.options.frameUUID;
    }
  } else if (Ext.active.index >= 0) {
    /* Race condition when CAPTURE_START sent to frame but frame sends
       UPDATE_CANVASES before replying to CAPTURE_START */
       const row = Ext.listCanvases.querySelector(
         `.${LIST_CANVASES_ROW_CLASS}.${CANVAS_CAPTURE_SELECTED_CLASS}`
       );
       canvasIndex = parseInt(row.dataset.canvasIndex, 10);
       canvasFrameUUID = row.dataset.frameUUID;
  }

  updateCanvases();

  const isCapturing = Ext.active.capturing;
  const haveTimer = Ext.active.delay.timerId >= 0;
  const haveIndex = Ext.active.index >= 0;

  if (isCapturing || haveTimer || haveIndex) {
    const canvasIsLocal =
      (Ext.active.capturing)
      ? (Ext.active.frameUUID === TOP_FRAME_UUID)
      : Ext.active.delay.options && Ext.active.delay.options.canvasIsLocal;

    if (!canvasIsLocal) {
      const rows = Array.from(
        Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
      );
      const row = rows.filter(
        (el) => el.dataset.frameUUID === canvasFrameUUID
      )[canvasIndex];
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

  loadSavedFrameSettings();
}

function handleMessageUpdateSettings(msg) {
  const settings = msg.defaultSettings;
  for (const key of Object.keys(Ext.settings)) {
    if (key in settings) {
      Ext.settings[key] = settings[key];
    }
  }
}

function saveCanvasSettings() {
  const wrapper = document.getElementById(WRAPPER_ID);
  const rows = Array.from(
    wrapper.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  ).filter((el) => el.dataset.frameUUID in Ext.frames);

  for (const key of Object.keys(Ext.frames)) {
    delete Ext.frames[key].settings;
    Ext.frames[key].settings = Object.create(null);
  }

  for (let k = 0, n = rows.length; k < n; k += 1) {
    const settings = Object.create(null);
    const row = rows[k];
    const frameUUID = row.dataset.frameUUID;
    const pathSpec = row.dataset.pathSpec;

    for (const key of Object.keys(SAVE_SETTINGS_MAP)) {
      const span = row.querySelector(`.${key}`);
      let value = null;

      if (span) {
        const input = span.firstElementChild;

        if (key === LIST_CANVASES_CAPTURE_TIMER_CLASS) {
          const hasTimer = JSON.parse(input.dataset.hasTimer || "false");
          const timerSeconds = parseInt(input.dataset.timerSeconds, 10);
          value = (hasTimer && timerSeconds) ? timerSeconds : "0";
        } else if (input.type.toUpperCase() === "TEXT") {
          value = input.value;
        } else if (input.type.toUpperCase() === "CHECKBOX") {
          value = input.checked;
        }

        settings[SAVE_SETTINGS_MAP[key]] = value;
      }
    }

    Ext.frames[frameUUID].settings[pathSpec] = settings;
  }
}

function loadCanvasSettings() {
  const wrapper = document.getElementById(WRAPPER_ID);
  const rows = Array.from(
    wrapper.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  );

  for (let k = 0, n = rows.length; k < n; k += 1) {
    const row = rows[k];
    const frameUUID = row.dataset.frameUUID;
    const pathSpec = row.dataset.pathSpec;
    const frame = Ext.frames[frameUUID];
    const settings = frame && frame.settings[pathSpec];

    if (settings) {
      for (const key of Object.keys(SAVE_SETTINGS_MAP)) {
        const span = row.querySelector(`.${key}`);

        if (span) {
          const input = span.firstElementChild;
          const value = settings[SAVE_SETTINGS_MAP[key]];

          if (key === LIST_CANVASES_CAPTURE_TIMER_CLASS) {
            input.dataset.hasTimer = Boolean(parseInt(value, 10));
            input.dataset.timerSeconds = value;
            handleRowTimerModifyClose(input);
          } else if (input.type.toUpperCase() === "TEXT") {
            input.value = value;
          } else if (input.type.toUpperCase() === "CHECKBOX") {
            input.checked = value;
          }
        }
      }
    }
  }
}

function loadSavedFrameSettings() {
  const wrapper = document.getElementById(WRAPPER_ID);
  const rows = Array.from(
    wrapper.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  );
  const reloadedFrameSettingsKeys = Object.keys(Ext.reloadedFrameSettings);

  if (!reloadedFrameSettingsKeys.length) {
    return;
  }

  for (const framePathSpec of reloadedFrameSettingsKeys) {
    let settingsLoaded = false;
    for (const frameUUID of Object.keys(Ext.frames)) {
      const frame = Ext.frames[frameUUID];

      if (frame.framePathSpec === framePathSpec) {
        const frameSettingsKeys = Object.keys(
          Ext.reloadedFrameSettings[framePathSpec]
        );

        if (!frameSettingsKeys.length) {
          settingsLoaded = true;
        }

        for (const pathSpec of frameSettingsKeys) {
          const settings = Ext.reloadedFrameSettings[framePathSpec][pathSpec];

          for (let k = 0, n = rows.length; k < n; k += 1) {
            const row = rows[k];
            const pathSpecMatches = row.dataset.pathSpec === pathSpec;
            const frameUUIDMatches = row.dataset.frameUUID === frameUUID;

            if (pathSpecMatches && frameUUIDMatches) {
              loadSavedSettingsToRow(row, settings);
              settingsLoaded = true;
            }
          }
        }
      }
    }

    if (settingsLoaded) {
      delete Ext.reloadedFrameSettings[framePathSpec];
    }
  }
}

function loadSavedSettingsToRow(row, settings) {
  if (settings) {
    for (const key of Object.keys(SAVE_SETTINGS_MAP)) {
      const span = row.querySelector(`.${key}`);

      if (span) {
        const input = span.firstElementChild;
        const value = settings[SAVE_SETTINGS_MAP[key]];

        if (key === LIST_CANVASES_CAPTURE_TIMER_CLASS) {
          input.dataset.hasTimer = Boolean(parseInt(value, 10));
          input.dataset.timerSeconds = value;
          handleRowTimerModifyClose(input);
        } else if (input.type.toUpperCase() === "TEXT") {
          input.value = value;
        } else if (input.type.toUpperCase() === "CHECKBOX") {
          input.checked = value;

          if (value && key === LIST_CANVASES_CAPTURE_RELOAD_CLASS) {

            setTimeout(function() {
              const button = row.querySelector(
                `.${CANVAS_CAPTURE_TOGGLE_CLASS}`
              );

              if (button) {
                button.click();
              }
            }, 1);
          }
        }
      }
    }
  }
}

function observeBodyMutations(mutations) {
  mutations = mutations.filter((el) => el.type === "childList");
  var addedCanvases = false;
  const removedCanvases = [];
  const addedIframes = [];
  const isCanvas = (el) => el.nodeName.toUpperCase() === "CANVAS";
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
    const rows = Array.from(
      Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
    );

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
    const rows = Array.from(
      Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
    );
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
  const rows = Array.from(
    Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  );
  mutations = mutations.filter((el) => el.type === "attributes");

  for (let k = 0, n = mutations.length; k < n; k += 1) {
    const mutation = mutations[k];
    const canvas = mutation.target;
    let canvasIndex = -1;
    canvases.forEach((el, index) => el === canvas && (canvasIndex = index));
    if (canvasIndex >= 0) {
      const row = rows[canvasIndex];
      const colId = row.querySelector(`.${LIST_CANVASES_CANVAS_ID_CLASS}`);
      const colWidth = row.querySelector(
        `.${LIST_CANVASES_CANVAS_WIDTH_CLASS}`
      );
      const colHeight = row.querySelector(
        `.${LIST_CANVASES_CANVAS_HEIGHT_CLASS}`
      );
      colId.textContent = canvas.id;
      colWidth.textContent = canvas.width;
      colHeight.textContent = canvas.height;
    }
  }
}

function handleAddedIframes(iframes) {
  for (let k = 0, n = iframes.length; k < n; k += 1) {
    const iframe = iframes[k];
    iframe.addEventListener("load", handleIframeLoaded, false);
    Ext.port.postMessage({
      "command":      MessageCommands.IFRAME_NAVIGATED,
      "tabId":        Ext.tabId,
      "frameUUID":    TOP_FRAME_UUID,
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

function handleDisable(notify) {
  showNotification(notify);
  Ext.port.disconnect();
  Ext.active.clear();
  Ext.bodyMutObs.disconnect();
  Ext.canvasMutObs.disconnect();

  const wrapper = document.getElementById(WRAPPER_ID);
  if (wrapper) {
    wrapper.remove();
  }

  const modifyTimer = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
  if (modifyTimer) {
    modifyTimer.remove();
  }

  const maximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  if (maximize) {
    maximize.remove();
  }

  const style = document.getElementById(CSS_STYLE_ID);
  if (style) {
    style.remove();
  }

  const viewCaptures = document.getElementById(VIEW_CAPTURES_CONTAINER_ID);
  if (viewCaptures) {
    viewCaptures.remove();
  }

  for (const key of Object.keys(Ext.highlighter)) {
    Ext.highlighter[key].remove();
  }

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

  window.removeEventListener("resize", positionWrapper, false);
  window.removeEventListener("wheel", handleWindowMouseWheel, true);
  window.removeEventListener("message", handleWindowMessage, true);
  window.removeEventListener("keypress", handleKeyEventsOnFocus, true);
  window.removeEventListener("keydown", handleKeyEventsOnFocus, true);
  window.removeEventListener("keyup", handleKeyEventsOnFocus, true);

  Ext.disable();
}

function handleDisplay() {
  const cssUrl = browser.runtime.getURL(CSS_FILE_PATH);
  const htmlUrl = browser.runtime.getURL(HTML_FILE_PATH);
  const htmlRowUrl = browser.runtime.getURL(HTML_ROW_FILE_PATH);
  const htmlDlRowUrl = browser.runtime.getURL(HTML_DL_ROW_FILE_PATH);

  fetch(htmlRowUrl).then(function(response) {
    if (response.ok) {
      return response.text();
    }

    throw new Error(`Received ${response.status} fetching ${response.url}`);
  }).then(function(text) {
    Ext.rowTemplate = document.createElement("template");
    Ext.rowTemplate.innerHTML = text;
    Ext.rowTemplate = Ext.rowTemplate.content.firstElementChild;

    return fetch(htmlDlRowUrl);
  }).then(function (response) {
    if (response.ok) {
      return response.text();
    }

    throw new Error(`Received ${response.status} fetching ${response.url}`);
  }).then(function (text) {
    const template = document.createElement("template");
    template.innerHTML = text;
    Ext.dlRowTemplate = template.content.firstElementChild;

    return fetch(cssUrl);
  }).then(function(response) {
    if (response.ok) {
      return response.text();
    }

    throw new Error(`Received ${response.status} fetching ${response.url}`);
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

    throw new Error(`Received ${response.status} fetching ${response.url}`);
  }).then(function(text) {
    setupDisplay(text);
  }).catch(function() {
    showNotification("Failed to initialize resources.");
    handleCaptureClose();
  });

  const highlighter = Ext.highlighter;

  for (const key of Object.keys(highlighter)) {
    highlighter[key] = document.createElement("div");
    highlighter[key].textContent = " ";
    highlighter[key].classList.add(HIDDEN_CLASS);
    document.body.appendChild(highlighter[key]);
  }

  highlighter.left.classList.add(HIGHLIGHTER_VERTICAL_CLASS);
  highlighter.top.classList.add(HIGHLIGHTER_HORIZONTAL_CLASS);
  highlighter.right.classList.add(HIGHLIGHTER_VERTICAL_CLASS);
  highlighter.bottom.classList.add(HIGHLIGHTER_HORIZONTAL_CLASS);
  highlighter.overlay.classList.add(HIGHLIGHTER_OVERLAY_CLASS);

  Ext.port.postMessage({
    "command": MessageCommands.UPDATE_CANVASES,
    "tabId": Ext.tabId,
    "frameId": Ext.frameId,
    "frameUUID": TOP_FRAME_UUID,
    "targetFrameUUID": ALL_FRAMES_UUID
  });
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

function handleInputBlur() {
  window.removeEventListener("keypress", handleKeyEventsOnFocus, true);
  window.removeEventListener("keydown", handleKeyEventsOnFocus, true);
  window.removeEventListener("keyup", handleKeyEventsOnFocus, true);

  saveCanvasSettings();
}

function handleInputChange(e) {
  const checkbox = e.target;

  if (checkbox.checked) {
    const selector = `.${LIST_CANVASES_CAPTURE_RELOAD_CLASS} input`;
    const inputs = Array.from(Ext.listCanvases.querySelectorAll(selector));

    for (let k = 0, n = inputs.length; k < n; k += 1) {
      const input = inputs[k];

      if (input !== checkbox) {
        input.checked = false;
      }
    }
  }
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

  const viewCapturesOpen = document.getElementById(LIST_CANVASES_DL_BUTTON_ID);
  viewCapturesOpen.addEventListener("click", handleViewCapturesOpen, false);
  const viewCapturesClose = document.getElementById(VIEW_CAPTURES_CLOSE_ID);
  viewCapturesClose.addEventListener("click", handleViewCapturesClose, false);

  positionWrapper();
  setupWrapperEvents();

  const canvases = Array.from(document.body.querySelectorAll("canvas"));
  Ext.frames[TOP_FRAME_UUID].canvases = canvases;
  Ext.port.postMessage({
    "command": MessageCommands.DISPLAY,
    "tabId": Ext.tabId,
    "frameId": Ext.frameId,
    "frameUUID": TOP_FRAME_UUID,
    "targetFrameUUID": ALL_FRAMES_UUID
  });

  updateCanvases();
  loadSavedFrameSettings();
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
      "height": el.height,
      "pathSpec": Utils.pathSpecFromElement(el)
    };
  });

  for (const key of Object.keys(Ext.frames)) {
    if (key !== TOP_FRAME_UUID) {
      let frameCanvases = Ext.frames[key].canvases.map(function(el, index) {
        const obj = JSON.parse(JSON.stringify(el));
        obj.local = false;
        obj.frameUUID = key;
        obj.index = index;
        obj.frameUrl = Ext.frames[key].frameUrl;
        return obj;
      });
      canvases = canvases.concat(frameCanvases);
    }
  }

  return canvases;
}

function updateCanvases() {
  const docFrag = document.createDocumentFragment();
  const oldRows = Array.from(
    Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  );
  const canvases = getAllCanvases();
  const addTimerImgUrl = browser.runtime.getURL(ICON_ADD_PATH);

  saveCanvasSettings();

  oldRows.forEach((row) => row.remove());
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
    const addTimerImg = row.querySelector(
      `.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}`
    );
    addTimerImg.src = addTimerImgUrl;
    addTimerImg.dataset.hasTimer = false;
    addTimerImg.dataset.timerSeconds = 0;
    const fpsInput = row.querySelector(
      `.${LIST_CANVASES_CAPTURE_FPS_CLASS} input`
    );
    fpsInput.value = Ext.settings.fps;
    fpsInput.addEventListener("focus", handleInputFocus, false);
    fpsInput.addEventListener("blur", handleInputBlur, false);
    const bpsInput = row.querySelector(
      `.${LIST_CANVASES_CAPTURE_BPS_CLASS} input`
    );
    bpsInput.value = Ext.settings.bps;
    bpsInput.addEventListener("focus", handleInputFocus, false);
    bpsInput.addEventListener("blur", handleInputBlur, false);
    const delayInput = row.querySelector(
      `.${LIST_CANVASES_CAPTURE_DELAY_CLASS} input`
    );
    delayInput.value = DEFAULT_DELAY;
    delayInput.addEventListener("focus", handleInputFocus, false);
    delayInput.addEventListener("blur", handleInputBlur, false);
    const reloadInput = row.querySelector(
      `.${LIST_CANVASES_CAPTURE_RELOAD_CLASS} input`
    );
    reloadInput.addEventListener("change", handleInputChange, false);

    const button = row.querySelector(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`);
    button.dataset.index = k;
    button.dataset.canvasIsLocal = canvasIsLocal;
    button.dataset.frameUUID = canvas.frameUUID;
    button.dataset.canvasIndex = canvas.index;

    row.dataset.index = k;
    row.dataset.canvasIsLocal = canvasIsLocal;
    row.dataset.frameUUID = canvas.frameUUID;
    row.dataset.canvasIndex = canvas.index;
    row.dataset.frameUrl = canvas.frameUrl;
    row.dataset.pathSpec = canvas.pathSpec;
    setRowEventListeners(row);
    docFrag.appendChild(row);
  }

  Ext.listCanvases.appendChild(docFrag);
  Ext.active.updateTS = Date.now();

  loadCanvasSettings();
  saveCanvasSettings();
}

function setRowEventListeners(
  ro,
  {
    row = true,
    img = true,
    button = true
  } = {
    "row": true,
    "img": true,
    "button": true
  }
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
  {
    row = true,
    img = true,
    button = true
  } = {
    "row": true,
    "img": true,
    "button": true
  }
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
  const trunc = Math.trunc;
  const wrapper = document.getElementById(WRAPPER_ID);
  const img = wrapper.querySelector(`.${TIMER_MODIFYING_CLASS}`);

  if (img) {
    const container = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
    const containerRect = container.getBoundingClientRect();
    const width = containerRect.width;
    const imgRect = img.getBoundingClientRect();
    const left = imgRect.left + (0.5 * imgRect.width) - trunc(0.5 * width);
    const top = imgRect.top - containerRect.height - 20;
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
  }
}

function handleRowTimerModify(evt) {
  const container = document.getElementById(MODIFY_TIMER_CONTAINER_ID);
  const img = evt.target;
  const rows = Array.from(
    document.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  );
  const hasTimer = JSON.parse(img.dataset.hasTimer || false);
  const hoursInput = document.getElementById(MODIFY_TIMER_HOURS_ID);
  const minutesInput = document.getElementById(MODIFY_TIMER_MINUTES_ID);
  const secondsInput = document.getElementById(MODIFY_TIMER_SECONDS_ID);
  var row = img.parentElement;

  img.dataset.ts = Date.now();
  img.classList.add(TIMER_MODIFYING_CLASS);

  if (hasTimer) {
    const secs = parseInt(img.dataset.timerSeconds, 10) || 0;
    const {hours, minutes, seconds} = Utils.secondsToHMS(secs);
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
  const hasTimer = (
    img &&
    ("hasTimer" in img.dataset) &&
    JSON.parse(img.dataset.hasTimer)
  );
  const rows = Array.from(
    document.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  );

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
  img.classList.remove(TIMER_MODIFYING_CLASS);
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
  const totalSecs = Utils.hmsToSeconds({hours, minutes, seconds});

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
  Ext.active.timer.updateTimerId = setInterval(
    updateTimerDisplay, updateTimerMS
  );
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
  const path = (
    `M${cx},${cy} L${x1},${y1} A${rd},${rd} 0 ${sweep} 0 ${x2},${y2} Z`
  );
  clipPath.setAttribute("d", path);
}

function highlightCanvas(evt) {
  const el = evt.target;

  if (!el.classList.contains(LIST_CANVASES_ROW_CLASS)) {
    return;
  }

  Ext.highlighterCurrent = el;

  if (JSON.parse(el.dataset.canvasIsLocal)) {
    const canvas = Ext.frames[TOP_FRAME_UUID].canvases[el.dataset.index];
    const rect = canvas.getBoundingClientRect();

    handleMessageHighlight({
      "frameUUID": TOP_FRAME_UUID,
      "rect": {
        "width": rect.width,
        "height": rect.height,
        "left": window.scrollX,
        "top": window.scrollY,
        "right": 0,
        "bottom": 0
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
    el !== Ext.highlighterCurrent
  ) {
    return;
  }

  for (const key of Object.keys(highlighter)) {
    highlighter[key].classList.add(HIDDEN_CLASS);
  }

  el.classList.remove(HIGHLIGHTER_UNAVAILABLE_CLASS);
  Ext.highlighterCurrent = null;
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
  const rows = Array.from(
    Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  );
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
  const rows = Array.from(
    Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  );
  const inputs = Array.from(Ext.listCanvases.querySelectorAll("input"));

  for (let k = 0; k < rows.length; k += 1) {
    const row = rows[k];
    row.classList.remove(
      CANVAS_CAPTURE_INACTIVE_CLASS,
      CANVAS_CAPTURE_SELECTED_CLASS
    );
    setRowEventListeners(row);
    const button = row.querySelector(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`);
    button.textContent = "Capture";
  }

  const wrapper = document.getElementById(WRAPPER_ID);
  const dlButtonContainer = wrapper.querySelector(
    `#${LIST_CANVASES_DL_BUTTON_CONTAINER_ID}`
  );
  const dlButton = wrapper.querySelector(`#${LIST_CANVASES_DL_BUTTON_ID}`);
  dlButtonContainer.classList.remove(CAPTURING_CLASS);
  dlButton.classList.remove(HIDDEN_CLASS);

  for (let k = 0, n = inputs.length; k < n; k += 1) {
    const input = inputs[k];
    input.readOnly = false;
  }
}

function preStartCapture(button) {
  const rows = Array.from(
    Ext.listCanvases.querySelectorAll(`.${LIST_CANVASES_ROW_CLASS}`)
  );
  const canvasIsLocal = JSON.parse(button.dataset.canvasIsLocal);
  const index = parseInt(button.dataset.index, 10);
  Ext.active.index = index;
  Ext.active.frameUUID = button.dataset.frameUUID;
  const row = rows[index];
  const timerImg = row.querySelector(
    `.${LIST_CANVASES_CAPTURE_TIMER_IMG_CLASS}`
  );
  const hasTimer = JSON.parse(timerImg.dataset.hasTimer || false);
  const timerSeconds = parseInt(timerImg.dataset.timerSeconds, 10) || 0;
  const canvases = Ext.frames[Ext.active.frameUUID].canvases;
  const canvasIndex = parseInt(button.dataset.canvasIndex, 10);
  const canvas = canvasIsLocal ? canvases[index] : canvases[canvasIndex];

  if (canvasIsLocal && !canCaptureStream(canvas)) {
    return;
  }

  setRowActive(index);
  Ext.active.canvas = canvas;
  Ext.active.timer.secs = timerSeconds;

  const fpsInput = row.querySelector(
    `.${LIST_CANVASES_CAPTURE_FPS_CLASS} input`
  );
  const fpsVal = parseFloat(fpsInput.value);
  const fps = (isFinite(fpsVal) && !isNaN(fpsVal) && fpsVal >= 0) ? fpsVal : 0;
  const bpsInput = row.querySelector(
    `.${LIST_CANVASES_CAPTURE_BPS_CLASS} input`
  );
  const bpsVal = parseFloat(bpsInput.value);
  const bps =
    (isFinite(bpsVal) && !isNaN(bpsVal) && bpsVal > 0)
    ? bpsVal
    : Ext.settings.bps;

  const delayOverlay = document.getElementById(DELAY_OVERLAY_ID);
  const delayInput = row.querySelector(
    `.${LIST_CANVASES_CAPTURE_DELAY_CLASS} input`
  );
  const delaySecs = parseInt(delayInput.value, 10) || 0;
  const delayMsecs =
    (isFinite(delaySecs) && !isNaN(delaySecs) && delaySecs > 0)
    ? delaySecs * MSEC_PER_SEC
    : 0;

  const frameUUID = button.dataset.frameUUID;
  const rowIndex = index;
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

  if (delaySecs) {
    const delayUpdateMSecs = 150;
    delayOverlay.classList.remove(HIDDEN_CLASS);
    Ext.active.delay.delaySecs = delaySecs;
    Ext.active.delay.timerId = setTimeout(handleDelayEnd, delayMsecs);
    Ext.active.delay.updateTimerId = setInterval(
      handleDelayUpdate, delayUpdateMSecs
    );
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
  } else {
    handleDelayEnd();
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
    if (Ext.active.delay.delaySecs) {
      Ext.port.postMessage({
        "command": MessageCommands.DELAY,
        "tabId": Ext.tabId,
        "frameId": Ext.frameId,
        "frameUUID": TOP_FRAME_UUID,
        "targetFrameUUID": frameUUID,
        "canvasIndex": canvasIndex,
        "delayed": false
      });
    }

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
  const timeDiff = delaySecs - (((Date.now() - startTS)) / MSEC_PER_SEC);
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
    Ext.active.timer.timerId = setTimeout(
      preStopCapture, timerSeconds * MSEC_PER_SEC
    );
    setUpdateTimer();
  }

  setCapturing();
}

function setCapturing() {
  const wrapper = document.getElementById(WRAPPER_ID);
  const maximize = document.getElementById(CAPTURE_MAXIMIZE_ID);
  const dlButtonContainer = wrapper.querySelector(
    `#${LIST_CANVASES_DL_BUTTON_CONTAINER_ID}`
  );
  const dlButton = wrapper.querySelector(`#${LIST_CANVASES_DL_BUTTON_ID}`);

  dlButtonContainer.classList.add(CAPTURING_CLASS);
  dlButton.classList.add(HIDDEN_CLASS);

  maximize.classList.add(CAPTURING_MINIMIZED_CLASS);
}

function clearCapturing(success) {
  const maximize = document.getElementById(CAPTURE_MAXIMIZE_ID);

  clearActiveRows();
  maximize.classList.remove(CAPTURING_MINIMIZED_CLASS);

  if (success) {
    const wrapper = document.getElementById(WRAPPER_ID);
    const dlButtonContainer = wrapper.querySelector(
      `#${LIST_CANVASES_DL_BUTTON_CONTAINER_ID}`
    );
    const viewCapturesContainer = document.getElementById(
      VIEW_CAPTURES_CONTAINER_ID
    );

    dlButtonContainer.addEventListener(
      "animationend", clearCaptureCompleteAnimation, false
    );
    dlButtonContainer.classList.add(CAPTURE_COMPLETE_CLASS);

    if (!viewCapturesContainer.classList.contains(HIDDEN_CLASS)) {
      handleViewCapturesOpen();
    }
  }
}

function clearCaptureCompleteAnimation(e) {
  const el = e.target;
  el.classList.remove(CAPTURE_COMPLETE_CLASS);
  el.removeEventListener("animationend", clearCaptureCompleteAnimation, false);
}

function preStopCapture(evt) {
  const buttons = Array.from(
    Ext.listCanvases.querySelectorAll(`.${CANVAS_CAPTURE_TOGGLE_CLASS}`)
  );
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
  const size = blob ? blob.size : 0;
  var videoURL = "";

  if (blob) {
    videoURL = window.URL.createObjectURL(blob);
  }

  const ts = Math.trunc(Date.now() / MSEC_PER_SEC);
  Ext.captures.push({
    "url":        videoURL,
    "startTS":    Ext.active.startTS,
    "endTS":      Date.now(),
    "size":       size,
    "prettySize": Utils.prettyFileSize(size),
    "name":       `capture-${ts}.${DEFAULT_MIME_TYPE}`,
    "frameUUID":  TOP_FRAME_UUID
  });
}

function stopCapture() {
  var blob = null;
  var success = false;

  if (Ext.active.capturing && !Ext.active.error && Ext.active.stopped) {
    if (Ext.chunks.length) {
      blob = new Blob(Ext.chunks, {"type": Ext.chunks[0].type});
    }
    createVideoURL(blob);
    success = true;
  } else if (Ext.active.error || !Ext.active.stopped) {
    showNotification("An error occured while recording.");
  } else {
    showNotification("Canvas was removed while it was being recorded.");
  }

  clearCapturing(success);
  clearActiveRows();

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

function handleViewCapturesOpen() {
  const viewCapturesContainer = document.getElementById(
    VIEW_CAPTURES_CONTAINER_ID
  );
  const viewCapturesRowContainer = document.getElementById(
    VIEW_CAPTURES_ROW_CONTAINER_ID
  );

  viewCapturesContainer.classList.remove(HIDDEN_CLASS);

  setTimeout(function() {
    const rect = viewCapturesContainer.getBoundingClientRect();
    const left = Math.round((0.5 * window.innerWidth) - (0.5 * rect.width));
    const top = Math.round((0.5 * window.innerHeight) - (0.5 * rect.height));
    viewCapturesContainer.style.left = `${left}px`;
    viewCapturesContainer.style.top = `${top}px`;
  }, 0);

  const oldRows = Array.from(
    viewCapturesRowContainer.querySelectorAll(`.${CAPTURE_DL_ROW_CLASS}`)
  );
  oldRows.forEach((el) => el.remove());

  const docFrag = document.createDocumentFragment();

  for (let k = 0, n = Ext.captures.length; k < n; k += 1) {
    const capture = Ext.captures[k];
    const row = Ext.dlRowTemplate.cloneNode(true);
    const dateSpan = row.querySelector(`.${CAPTURE_DL_DATE_CLASS}`);
    const sizeSpan = row.querySelector(`.${CAPTURE_DL_SIZE_CLASS}`);
    const durationSpan = row.querySelector(`.${CAPTURE_DL_DURATION_CLASS}`);
    const removeButton = row.querySelector(`.${CAPTURE_DL_REMOVE_BUTTON_CLASS}`);
    const downloadLink = row.querySelector(`.${CAPTURE_DL_DOWNLOAD_LINK_CLASS}`);
    const date = new Date(capture.startTS);
    const timeDiff = capture.endTS - capture.startTS;
    const duration = Utils.secondsToHMS(Math.round(timeDiff / MSEC_PER_SEC));

    dateSpan.textContent = date.toLocaleString("en-us", {
      "hour":   "numeric",
      "minute": "numeric",
      "hour12": true
    });
    dateSpan.title = date.toString();
    sizeSpan.textContent = capture.prettySize;
    sizeSpan.title = `${capture.size} B`;
    durationSpan.textContent = duration;
    removeButton.addEventListener("click", handleViewCapturesRemove, false);
    removeButton.dataset.url = capture.url;
    downloadLink.download = capture.name;
    downloadLink.href = capture.url;
    downloadLink.title = capture.prettySize;

    docFrag.append(row);
  }

  viewCapturesRowContainer.append(docFrag);
}

function handleViewCapturesRemove(e) {
  const url = e.target.dataset.url;

  for (let k = 0, n = Ext.captures.length; k < n; k += 1) {
    const capture = Ext.captures[k];

    if (capture.url === url) {
      if (capture.frameUUID === TOP_FRAME_UUID) {
        window.URL.revokeObjectURL(url);
      } else {
        Ext.port.postMessage({
          "command":          MessageCommands.REMOVE_CAPTURE,
          "tabId":            Ext.tabId,
          "frameUUID":        TOP_FRAME_UUID,
          "targetFrameUUID":  capture.frameUUID,
          "url":              url
        });
      }

      Ext.captures.splice(k, 1);
      break;
    }
  }

  handleViewCapturesOpen();
}

function handleViewCapturesClose() {
  const viewCapturesContainer = document.getElementById(
    VIEW_CAPTURES_CONTAINER_ID
  );
  viewCapturesContainer.classList.add(HIDDEN_CLASS);
}

function handlePageUnload() {
  if (!Ext.settings[Utils.AUTO_OPEN_KEY]) {
    return;
  }

  saveCanvasSettings();

  const settings = Object.create(null);

  for (const key of Object.keys(Ext.frames)) {
    const frame = Ext.frames[key];
    const framePathSpec = frame.framePathSpec;
    settings[framePathSpec] = frame.settings;
  }

  Ext.port.postMessage({
    "command": MessageCommands.UPDATE_SETTINGS,
    "tabId": Ext.tabId,
    "frameUUID": TOP_FRAME_UUID,
    "settings": settings
  });
}

function showNotification(notification) {
  Ext.port.postMessage({
    "command": MessageCommands.NOTIFY,
    "tabId": Ext.tabId,
    "frameUUID": TOP_FRAME_UUID,
    "notification": notification
  });
}

}());
