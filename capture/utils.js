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

return {
  "MessageCommands": MessageCommands,
  "pathSpecFromElement": pathSpecFromElement,
  "elementFromPathSpec": elementFromPathSpec
};

}());
