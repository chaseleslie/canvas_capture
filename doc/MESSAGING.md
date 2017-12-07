# Messaging Between Scripts

---

A brief description of how messaging happens in the extension between the
content and background scripts. Most messaging occurs using the
[WebExtension Messaging APIs](#webext_msg). The top frame in an active tab
also communicates with its direct child frames using the general DOM
[Window Messaging](#window_msg).

## Identifying Frames

Frames are given an integral identifier by the browser implementing the
extension. This is denoted as `frameId`. The top frame in a tab always has
`frameId === 0`.

In addition, each frame generates its own unique string identifier
when the content script is first injected into it. This is denoted as
`frameUUID`. These identifiers are unique across frame navigations. The top
frame always has `frameUUID === "top"`. Child frames generate a version 4
UUID. These type of idenifiers are used preferentially in this extension.

## WebExtension Messaging <a name="webext_msg"></a>

Messaging between scripts uses the `chrome.runtime` API. A content script
sends messages to another content script or the background script by
posting a message to the background script. If the message is destined for
another content script, the background script forwards the message.

All messages take the form:

`{
  "command": MessageCommands.CMD,
  "frameUUID": "...",
  "targetFrameUUID": "..."
}`

### Commands

Each message has a `command` property-value pair which identifies the intent
of the message. The `frameUUID` property-value pair identifies which frame
the message originates from, while the `targetFrameUUID` identifies where
the message is intended for.

The following `command`s are used (see `MessageCommands` enum in source files):
- [CAPTURE_START](#capture_start)
- [CAPTURE_STOP](#capture_stop)
- [DISABLE](#disable)
- [DISCONNECT](#disconnect)
- [DISPLAY](#display)
- [DOWNLOAD](#download)
- [HIGHLIGHT](#highlight)
- [NOTIFY](#notify)
- [REGISTER](#register)
- [UPDATE_CANVASES](#update_canvases)

#### CAPTURE_START <a name="capture_start"></a>

This command originates from the top frame and is sent to a child frame when a
canvas recording should begin. Details about which canvas to record are sent in
the message. The child frame responds with the same command, including a
`success` property-value pair indicating whether recording was successfully
started.

#### CAPTURE_STOP <a name="capture_stop"></a>

This command can originate from either the top frame or a child frame. If a
child frame is actively recording and the recording is stopped through the UI,
a message with this command will be sent to the child frame to direct it to
stop the recording. In the event that a timer expired or an error occurred
while recording, an actively recording child frame can also send a message with
this command to signal that recording has stopped.

#### DISABLE <a name="disable"></a>

This command can either be sent from the background script to frames, or
it can be sent from the top frame to the background script. When the
`browserAction` is toggled on an active tab, the background script will send
this command to all the frames to let them destroy all their resources and
sanitize the DOM. This command is also used by the top frame to signal the
background script that the extension should be disabled. In that case the
background script again sends this command to all frames.

#### DISCONNECT <a name="disconnect"></a>

This command is sent from the background script to the top frame to notify
the top frame that a child frame has been removed or has navigated.

#### DISPLAY <a name="display"></a>

This command is sent from the background script to the top frame, and from the
top frame to the child frames. When the extension is first activated in a tab,
the top frame is sent this command to build the UI and perform setup. When
the top frame is ready, it sends this command to the child frames to notify
them that the top frame is ready to receive UPDATE_CANVASES.

#### DOWNLOAD <a name="download"></a>

This command is sent from the top frame to child frames when the user wants to
download a recorded video. Instead of passing binary blobs through the
messaging serialization process between frames, the frame that has the canvas
that is being recorded keeps the resulting video in its environment. This
command instructs the child frame to prompt the user to download the file.

#### HIGHLIGHT <a name="highlight"></a>

This command is sent from the top frame to child frames to request
information about a canvas that needs to be highlighted. The child frame
responds with the position of the canvas in the frame so it can be
highlighted.

#### NOTIFY <a name="notify"></a>

This command is sent from any frame to the background script to use the
`chrome.notifications` API.

#### REGISTER <a name="register"></a>

This command is sent from the background script to any frame to inform the
frame of its `frameID` and to request its `frameUUID`.

#### UPDATE_CANVASES <a name="update_canvases"></a>

This command is sent between the top frame and child frames. The top frame
sends this command when it requires a fresh list of what canvases are available
for recording. Child frames also send this command when a canvas in their
environment is modified (added, removed or changed).


## Window Messaging <a name="window_msg"></a>

In order to match up a frame with a DOM `iframe` element, the top frame uses
the native messaging between windows available for web scripts. This involves
the top frame sending a message with a command of `identify` to all of its
child `iframe` elements windows, and the child frames sending their `frameUUID`
in response. The top frame also includes a randomly generated key with the
message that the child frame must respond with, so the top frame can match
the `iframe` element to its `frameUUID`. This key also helps filter out
messages sent from web scripts that are not intended for the extension.
