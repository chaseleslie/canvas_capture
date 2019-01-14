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


"use strict";

/* global browser */

const MAX_VIDEO_SIZE_KEY = "maxVideoSize";
const OPTION_MAX_VIDEO_SIZE_ID = "option_max_video_size";

const FPS_KEY = "fps";
const OPTION_FPS_ID = "option_fps";

const BPS_KEY = "bps";
const OPTION_BPS_ID = "option_bps";

window.addEventListener("load", initOptions, false);

function initOptions() {
  const inputMaxSize = document.getElementById(OPTION_MAX_VIDEO_SIZE_ID);
  inputMaxSize.addEventListener("blur", updateMaxVideoSize, false);
  const inputFPS = document.getElementById(OPTION_FPS_ID);
  inputFPS.addEventListener("blur", updateFPS, false);
  const inputBPS = document.getElementById(OPTION_BPS_ID);
  inputBPS.addEventListener("blur", updateBPS, false);

  const inputMaxSizeSetting = browser.storage.local.get(MAX_VIDEO_SIZE_KEY);
  if (inputMaxSizeSetting) {
    inputMaxSizeSetting.then(function(setting) {
      if (Array.isArray(setting)) {
        setting = setting[0];
      }
      inputMaxSize.value = setting[MAX_VIDEO_SIZE_KEY];
    });
  }

  const inputFPSSetting = browser.storage.local.get(FPS_KEY);
  if (inputFPSSetting) {
    inputFPSSetting.then(function(setting) {
      if (Array.isArray(setting)) {
        setting = setting[0];
      }
      inputFPS.value = setting[FPS_KEY];
    });
  }

  const inputBPSSetting = browser.storage.local.get(BPS_KEY);
  if (inputBPSSetting) {
    inputBPSSetting.then(function(setting) {
      if (Array.isArray(setting)) {
        setting = setting[0];
      }
      inputBPS.value = setting[BPS_KEY];
    });
  }
}

function updateMaxVideoSize(e) {
  const input = e.target;
  const size = parseInt(input.value, 10);
  if (!isFinite(size) || isNaN(size) || size < 0) {
    return;
  }

  const obj = Object.create(null);
  obj[MAX_VIDEO_SIZE_KEY] = size;
  browser.storage.local.set(obj);

  updateBackgroundPage();
}

function updateFPS(e) {
  const input = e.target;
  const fps = parseInt(input.value, 10);
  if (!isFinite(fps) || isNaN(fps) || fps < 1) {
    return;
  }

  const obj = Object.create(null);
  obj[FPS_KEY] = fps;
  browser.storage.local.set(obj);

  updateBackgroundPage();
}

function updateBPS(e) {
  const input = e.target;
  const bps = parseInt(input.value, 10);
  if (!isFinite(bps) || isNaN(bps) || bps < 1) {
    return;
  }

  const obj = Object.create(null);
  obj[BPS_KEY] = bps;
  browser.storage.local.set(obj);

  updateBackgroundPage();
}

function updateBackgroundPage() {
  const background = browser.extension.getBackgroundPage();
  background.sendUpdatedSettings();
}
