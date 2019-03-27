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
- [DELAY](#delay)
- [DISABLE](#disable)
- [DISCONNECT](#disconnect)
- [DISPLAY](#display)
- [HIGHLIGHT](#highlight)
- [IDENTIFY](#identify)
- [IFRAME_NAVIGATED](#iframe_navigated)
- [NOTIFY](#notify)
- [REGISTER](#register)
- [REMOVE_CAPTURE](#remove_capture)
- [REMUX](#remux)
- [UPDATE_CANVASES](#update_canvases)
- [UPDATE_SETTINGS](#update_settings)

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

#### DELAY <a name="delay"></a>

This command is sent from the top frame to a child frame to inform the child
that a delayed capture is going to take place on a given canvas. The child
frame marks the canvas so that if DOM changes during delay period the canvas
can be identified.

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

#### HIGHLIGHT <a name="highlight"></a>

This command is sent from the top frame to child frames to request
information about a canvas that needs to be highlighted. The child frame
responds with the position of the canvas in the frame so it can be
highlighted. The child frame sends the message to its parent frame using
the `Window.postMessage` API. Each frame adds the offset of the `iframe`
element it received the message from so that highlighting works correctly
in nested frames.

#### IDENTIFY <a name="identify"></a>

This command is sent from child frames upward to the top frame to identify the
canvases in each frame. To handle nested frames, a child frame receiving this
message from nested frames forwards the message up to its parent frame while
appending the pathspec of the frame it received the message from. This message
is sent using the `Window.postMessage` API in order to match up DOM frames with
`frameUUID`s.

#### IFRAME_NAVIGATED <a name="iframe_navigated"></a>

This command is sent from frames to the background script when a frame detects
that one of its nested frames has navigated. The background script can then
inject scripts into the navigated frame.

#### NOTIFY <a name="notify"></a>

This command is sent from any frame to the background script to use the
`chrome.notifications` API.

#### REGISTER <a name="register"></a>

This command is sent from the background script to any frame to inform the
frame of its `frameID` and to request its `frameUUID`.

#### REMOVE_CAPTURE <a name="remove_capture"></a>

This command is sent from the top frame to a child frame when one of the
captured videos (blobs) should be deleted.

#### REMUX <a name="remux"></a>

This command is sent from the a frame to the muxer worker script when a video
should be remuxed. The worker script then replies with this command and the
status of the remuxing. This command is also sent from a child frame when
it has finished remuxing a video to notify the top frame.

#### UPDATE_CANVASES <a name="update_canvases"></a>

This command is sent between the top frame and child frames. The top frame
sends this command when it requires a fresh list of what canvases are available
for recording. Child frames also send this command when a canvas in their
environment is modified (added, removed or changed).

#### UPDATE_SETTINGS <a name="update_settings"></a>

This command is sent between the top frame and the background script. When a
setting in the top frame is changed, it notifies the background script so that
the updated setting is saved to storage. When changes are made to the settings
on the options page, the background page will be prompted to send this
command to all top frames to notify them of the updated settings.


## Window Messaging <a name="window_msg"></a>

Wherever possible, messaging between frames is achieved through passing
messages back and forth through the background script. This prevents web
scripts from intercepting extension messages.

In order to be able to calculate the correct offsets and positioning of
the highlighting UI overlays, the top frame needs to be able to match its
in-memory knowledge of what frames are present in the tab (by `frameUUID`)
with the position of the actual `iframe` elements. To allow for this,
the commands `HIGHLIGHT` and `IDENTIFY` are sent through the native
`Window.postMessage` API.

This also allows building a multi-document pathspec to match up frames
across page refresh where the frames have identical DOM positions but
different URIs.
