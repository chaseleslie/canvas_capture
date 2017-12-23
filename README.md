# Canvas Capture ![icon](/img/png/icon_32.png)

---

## A WebExtension for modern web browsers

The Canvas Capture extension allows video to be captured from HTML `canvas`
elements.

Currently, video is only output in the webm container in the browser's choice
of codec (typically VPX).

### Usage

---

To use, simply navigate to a page with an animated canvas element and click
the extension's browser action (toolbar button). A list of canvases present
on the page will be displayed with some details about each one. Hover the
mouse over an entry in the list to highlight the canvas in the webpage.

Click the capture button next to the canvas that should be captured. When
finished, click the stop button and a link will be generated to save the
resulting video file.

Alternatively, a timeout can be set to record for a predetermined duration.
Click the add timer icon (plus sign) for a canvas entry to add a timer
before starting a capture.

A delay can be set to wait a period of time before recording.

Canvas Capture produces video files of canvas elements using the
MediaRecorder, MediaStream and Blob APIs. All captured video is kept local:
no data is sent over the network.

### Notes

---

Recording a static canvas likely won't result in a video file, or the file
may consist of a single frame.

Recording canvases in `iframes` is supported, but highlighting will not work
for canvases in nested `iframes`.

For the best results, the tab which is being captured should be visible and
focused (i.e. don't minimize the browser or switch to another tab).
Otherwise, the timing mechanism used to drive the animation or game onto the
canvas might be throttled by the browser.
