/* Copyright (C) 2019 Chase Leslie
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

/* global Utils */
/* exported Module */

var Module = {};

const MessageCommands = Object.create(null);

const muxer = Object.seal({
  "initialized":    false,
  "muxing":         false,
  "srcArrayBuffer": null,
  "srcArray":       null,
  "srcPos":         0,
  "dstArrayBuffer": null,
  "dstArray":       null,
  "dstPos":         null,
  "clear": function() {
    this.muxing = false;
    this.srcArrayBuffer = null;
    this.srcArray = null;
    this.srcPos = 0;
    this.dstArrayBuffer = null;
    this.dstArray = null;
    this.dstPos = null;
  }
});

self.addEventListener("message", handleMessage, false);

function handleMessage(e) {
  const msg = e.data;

  if (msg.command === "register") {
    handleMessageRegister(msg);
  } else if (msg.command === MessageCommands.REMUX) {
    if (!muxer.muxing) {
      handleMessageRemux(msg);
    }
  }
}

function handleMessageRegister(msg) {
  /* Use ugly hack Function() ctor until chromium allows accessing extension
     files from within workers */
  new Function(msg.utilsSrc)();
  Object.assign(MessageCommands, Utils.MessageCommands);
  Object.freeze(MessageCommands);
  Module.onRuntimeInitialized = function() {
    self.postMessage({
      "command": MessageCommands.REGISTER
    });
    muxer.initialized = true;
  };
  Module.wasmBinary = msg.wasmBinary;
  new Function(`var Module = self.Module; ${msg.wasmSrc}`)();
}

function handleMessageRemux(msg) {
  const srcBuffer = msg.srcArrayBuffer;
  muxer.muxing = true;
  muxer.srcArrayBuffer = srcBuffer;
  muxer.srcArray = new Uint8Array(muxer.srcArrayBuffer);

  const pReaderReadCB = Module.addFunction(readerReadCB);
  const pReaderLengthCB = Module.addFunction(readerLengthCB);
  const pWriterWriteCB = Module.addFunction(writerWriteCB);
  const pWriterWriteNoopCB = Module.addFunction(writerWriteNoopCB);
  const pWriterSeekCB = Module.addFunction(writerSeekCB);
  const pWriterSeekNoopCB = Module.addFunction(writerSeekNoopCB);
  const pWriterPositionCB = Module.addFunction(writerPositionCB);

  let ret = Module.ccall(
    "webm_muxer",
    "number",
    ["number", "number", "number", "number", "number"],
    [pReaderReadCB, pReaderLengthCB, pWriterWriteNoopCB, pWriterSeekNoopCB, pWriterPositionCB]
  );

  if (ret) {
    self.postMessage({
      "command":  MessageCommands.REMUX,
      "success":  false,
      "result":   null
    });
    muxer.clear();
    return;
  }

  muxer.dstArrayBuffer = new ArrayBuffer(muxer.dstPos);
  muxer.dstArray = new Uint8Array(muxer.dstArrayBuffer);
  muxer.srcPos = 0;
  muxer.dstPos = 0;

  ret = Module.ccall(
    "webm_muxer",
    "number",
    ["number", "number", "number", "number", "number"],
    [pReaderReadCB, pReaderLengthCB, pWriterWriteCB, pWriterSeekCB, pWriterPositionCB]
  );

  if (ret) {
    self.postMessage({
      "command":  MessageCommands.REMUX,
      "success":  !ret,
      "result":   null
    });
  } else {
    const dstArray = muxer.dstArray.subarray(0, muxer.dstPos);
    self.postMessage({
      "command":  MessageCommands.REMUX,
      "success":  !ret,
      "result":   dstArray.buffer
    }, [dstArray.buffer]);
  }

  muxer.clear();
}

/* int readCB(unsigned char*, size_t, size_t) */
function readerReadCB(buff, buffLen, pos) {
  if (pos + buffLen > muxer.srcArray.length) {
    return -1;
  }

  muxer.srcPos = pos;

  for (let k = 0; k < buffLen; k += 1) {
    Module.setValue(buff + k, muxer.srcArray[muxer.srcPos + k], "i8");
  }

  muxer.srcPos += buffLen;
  return buffLen;
}

/* int lengthCB(long long*, long long*) */
function readerLengthCB(total, available) {
  var totalSize = muxer.srcArray.length;

  if (total) {
    Module.setValue(total, totalSize, "i64");
  }
  if (available) {
    Module.setValue(available, totalSize, "i64");
  }

  return 0;
}

/* int32 writeCB(const void*, size_t) */
function writerWriteNoopCB(buff, buffLen) {
  muxer.dstPos += buffLen;
  return buffLen;
}

/* int32 seekCB(size_t) */
function writerSeekNoopCB(pos) {
  if (pos >= 0) {
    muxer.dstPos = pos;
    return 0;
  }

  return -1;
}

/* int32 writeCB(const void*, size_t) */
function writerWriteCB(buff, buffLen) {
  var bytesAvail = muxer.dstArray.length - muxer.dstPos;
  var bytesToWrite = 0;

  if (bytesAvail > buffLen) {
    bytesToWrite = buffLen;
  } else {
    bytesToWrite = bytesAvail;
  }

  for (let k = 0; k < bytesToWrite; k += 1) {
    muxer.dstArray[muxer.dstPos + k] = Module.getValue(buff + k, "i8");
  }

  muxer.dstPos += bytesToWrite;
  return bytesToWrite;
}

/* int32 seekCB(size_t) */
function writerSeekCB(pos) {
  if (pos >= 0 && pos <= muxer.dstArray.length) {
    muxer.dstPos = pos;
    return 0;
  }

  return -1;
}

/* int64 positionCB(void) */
function writerPositionCB() {
  return muxer.dstPos;
}
