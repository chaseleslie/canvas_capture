/* Copyright (C) 2019 Chase
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

/* exported Utils */

const Utils = (function() {

const MessageCommands = Object.freeze({
  "CAPTURE_START":   0,
  "CAPTURE_STOP":    1,
  "DELAY":           2,
  "DISABLE":         3,
  "DISCONNECT":      4,
  "DISPLAY":         5,
  "DOWNLOAD":        6,
  "HIGHLIGHT":       7,
  "NOTIFY":          8,
  "REGISTER":        9,
  "UPDATE_CANVASES": 10,
  "UPDATE_SETTINGS": 11
});

const DEFAULT_MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024;
const MAX_VIDEO_SIZE_KEY = "maxVideoSize";

const FPS_KEY = "fps";
const DEFAULT_FPS = 30;

const BPS_KEY = "bps";
const DEFAULT_BPS = 2500000;

const AUTO_OPEN_KEY = "autoOpen";
const DEFAULT_AUTO_OPEN = true;

const TOP_FRAME_UUID = "top";
const BG_FRAME_UUID = "background";
const ALL_FRAMES_UUID = "*";

function pathSpecFromElement(element) {
  const pathComponents = [];
  var ptr = element;
  var path = "";

  do {
    const tag = ptr.nodeName;
    var tagIndex = -1;
    const siblings = Array.from(ptr.parentElement.children).filter((el) => el.nodeName === tag);

    for (let k = 0, n = siblings.length; k < n; k += 1) {
      const el = siblings[k];
      if (el === ptr) {
        tagIndex = k;
        break;
      }
    }

    if (tagIndex < 0) {
      throw Error("cannot find element in list of parent's children");
    }

    pathComponents.push(`${tag}[${tagIndex}]`);
  } while ((ptr = ptr.parentElement) && ptr !== document.documentElement);

  pathComponents.reverse();
  for (let k = 0, n = pathComponents.length; k < n; k += 1) {
    path += `/${pathComponents[k]}`;
  }

  return path;
}

function elementFromPathSpec(path) {
  const regex = /([a-zA-Z]+(?:-[a-zA-Z]+)*)\[([0-9]|[1-9][0-9]+)\]/;
  const paths = path.split("/").filter((el) => el);
  var ptr = document.documentElement;
  const components = paths.map(function(el) {
    const match = regex.exec(el);
    if (!match || match.length < 3) {
      throw Error(`invalid pathspec component '${el}'`);
    }
    return {
      "el": match[1],
      "index": match[2]
    };
  });

  for (let k = 0, n = components.length; k < n; k += 1) {
    const tag = components[k].el.toUpperCase();
    const index = parseInt(components[k].index, 10);
    const children = Array.from(ptr.children).filter((el) => el.nodeName.toUpperCase() === tag);
    if (index >= children.length) {
      return null;
    }
    ptr = children[index];
  }

  return ptr;
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

function hmsToSeconds({hours, minutes, seconds}) {
  return (hours * 3600) + (minutes * 60) + seconds;
}

function secondsToHMS(secs) {
  var hours = Math.trunc(secs / 3600);
  var minutes = Math.trunc((secs - (hours * 3600)) / 60);
  var seconds = secs - (hours * 3600) - (minutes * 60);

  if (seconds >= 60) {
    seconds -= (seconds % 60);
    minutes += 1;
  }

  if (minutes >= 60) {
    minutes -= (minutes % 60);
    hours += 1;
  }

  return {hours, minutes, seconds};
}

function genUUIDv4() {
  /* https://stackoverflow.com/a/2117523/1031545 */
  /* eslint-disable no-bitwise, id-length, no-mixed-operators */
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
  /* eslint-enable no-bitwise, id-length, no-mixed-operators */
}

function makeDelay(delay) {
  return new Promise(function(resolve) {
    setTimeout(function() {
      resolve();
    }, delay);
  });
}

return {
  "MessageCommands": MessageCommands,
  "DEFAULT_MAX_VIDEO_SIZE": DEFAULT_MAX_VIDEO_SIZE,
  "MAX_VIDEO_SIZE_KEY": MAX_VIDEO_SIZE_KEY,
  "FPS_KEY": FPS_KEY,
  "DEFAULT_FPS": DEFAULT_FPS,
  "BPS_KEY": BPS_KEY,
  "DEFAULT_BPS": DEFAULT_BPS,
  "AUTO_OPEN_KEY": AUTO_OPEN_KEY,
  "DEFAULT_AUTO_OPEN": DEFAULT_AUTO_OPEN,
  "TOP_FRAME_UUID": TOP_FRAME_UUID,
  "BG_FRAME_UUID": BG_FRAME_UUID,
  "ALL_FRAMES_UUID": ALL_FRAMES_UUID,
  "pathSpecFromElement": pathSpecFromElement,
  "elementFromPathSpec": elementFromPathSpec,
  "prettyFileSize": prettyFileSize,
  "hmsToSeconds": hmsToSeconds,
  "secondsToHMS": secondsToHMS,
  "genUUIDv4": genUUIDv4,
  "makeDelay": makeDelay
};

}());
