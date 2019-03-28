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


"use strict";

/* global browser Utils */

const MAX_VIDEO_SIZE_KEY = Utils.MAX_VIDEO_SIZE_KEY;
const OPTION_MAX_VIDEO_SIZE_ID = "option_max_video_size";

const FPS_KEY = Utils.FPS_KEY;
const OPTION_FPS_ID = "option_fps";

const BPS_KEY = Utils.BPS_KEY;
const OPTION_BPS_ID = "option_bps";

const AUTO_OPEN_KEY = Utils.AUTO_OPEN_KEY;
const OPTION_AUTO_OPEN_ID = "option_auto_open";

const REMUX_KEY = Utils.REMUX_KEY;
const OPTION_REMUX_ID = "option_remux";

window.addEventListener("load", initOptions, false);

function initOptions() {
  const inputMaxSize = document.getElementById(OPTION_MAX_VIDEO_SIZE_ID);
  inputMaxSize.addEventListener("blur", updateMaxVideoSize, false);
  const inputFPS = document.getElementById(OPTION_FPS_ID);
  inputFPS.addEventListener("blur", updateFPS, false);
  const inputBPS = document.getElementById(OPTION_BPS_ID);
  inputBPS.addEventListener("blur", updateBPS, false);
  const inputAutoOpen = document.getElementById(OPTION_AUTO_OPEN_ID);
  inputAutoOpen.addEventListener("change", updateAutoOpen, false);
  const inputRemux = document.getElementById(OPTION_REMUX_ID);
  inputRemux.addEventListener("change", updateRemux, false);

  browser.storage.local.get(MAX_VIDEO_SIZE_KEY)
  .then(function(setting) {
    inputMaxSize.value = setting[MAX_VIDEO_SIZE_KEY];
  });

  browser.storage.local.get(FPS_KEY)
  .then(function(setting) {
    inputFPS.value = setting[FPS_KEY];
  });

  browser.storage.local.get(BPS_KEY)
  .then(function(setting) {
    inputBPS.value = setting[BPS_KEY];
  });

  browser.storage.local.get(AUTO_OPEN_KEY)
  .then(function(setting) {
    inputAutoOpen.checked = setting[AUTO_OPEN_KEY];
  });

  browser.storage.local.get(REMUX_KEY)
  .then(function(setting) {
    inputRemux.checked = setting[REMUX_KEY];
  });
}

function updateMaxVideoSize(e) {
  const input = e.target;
  const size = parseInt(input.value, 10);

  if (!isFinite(size) || isNaN(size) || size < 0) {
    return;
  }

  const obj = Object.create(null);
  obj[MAX_VIDEO_SIZE_KEY] = size;
  browser.storage.local.set(obj)
  .then(updateBackgroundPage);
}

function updateFPS(e) {
  const input = e.target;
  const fps = parseInt(input.value, 10);

  if (!isFinite(fps) || isNaN(fps) || fps < 1) {
    return;
  }

  const obj = Object.create(null);
  obj[FPS_KEY] = fps;
  browser.storage.local.set(obj)
  .then(updateBackgroundPage);
}

function updateBPS(e) {
  const input = e.target;
  const bps = parseInt(input.value, 10);

  if (!isFinite(bps) || isNaN(bps) || bps < 1) {
    return;
  }

  const obj = Object.create(null);
  obj[BPS_KEY] = bps;
  browser.storage.local.set(obj)
  .then(updateBackgroundPage);
}

function updateAutoOpen(e) {
  const input = e.target;
  const checked = input.checked;

  const obj = Object.create(null);
  obj[AUTO_OPEN_KEY] = checked;
  browser.storage.local.set(obj)
  .then(updateBackgroundPage);
}

function updateRemux(e) {
  const input = e.target;
  const checked = input.checked;

  const obj = Object.create(null);
  obj[REMUX_KEY] = checked;
  browser.storage.local.set(obj)
  .then(updateBackgroundPage);
}

function updateBackgroundPage() {
  const background = browser.extension.getBackgroundPage();
  background.sendUpdatedSettings();
}
