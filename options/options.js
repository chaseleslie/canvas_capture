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

window.addEventListener("load", initOptions, false);

function initOptions() {
  var inputMaxSize = document.getElementById("option_max_video_size");
  inputMaxSize.addEventListener("blur", updateMaxVideoSize, false);

  var inputMaxSizeSetting = browser.storage.local.get(MAX_VIDEO_SIZE_KEY);
  if (inputMaxSizeSetting) {
    inputMaxSizeSetting.then(function(setting) {
      if (Array.isArray(setting)) {
        setting = setting[0];
      }
      inputMaxSize.value = setting[MAX_VIDEO_SIZE_KEY];
    });
  }
}

function updateMaxVideoSize(e) {
  var input = e.target;
  var size = parseInt(input.value, 10);
  if (!isFinite(size) || isNaN(size) || size < 0) {
    return;
  }

  var obj = {};
  obj[MAX_VIDEO_SIZE_KEY] = size;
  browser.storage.local.set(obj);
}
