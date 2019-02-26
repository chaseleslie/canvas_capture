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
resulting video file. The captured videos can be viewed, downloaded and removed
by clicking the View Captures button.

Alternatively, a timeout can be set to record for a predetermined duration.
Click the add timer icon (plus sign) for a canvas entry to add a timer
before starting a capture.

A delay can be set to wait a period of time before recording.

A canvas can be captured after page refresh by checking the
Capture on Refresh checkbox next to the canvas. This requires the setting
"Automatically restart extension on page refresh" to be enabled on the
options page (this is the default). After reloading the page, the canvas
will start to record immediately upon page load (subject to the delay setting).

Canvas Capture produces video files of canvas elements using the
MediaRecorder, MediaStream and Blob APIs. All captured video is kept local:
no data is sent over the network.

### Notes

---

Recording a static canvas likely won't result in a video file, or the file
may consist of a single frame.

For the best results, the tab which is being captured should be visible and
focused (i.e. don't minimize the browser or switch to another tab).
Otherwise, the timing mechanism used to drive the animation or game onto the
canvas might be throttled by the browser.

The ability to reload per-canvas settings across page refresh is dependent
upon the DOM being constructed deterministically (where the canvases take the
same place in the hierarchy when the page reloads). This restriction also
applies to capturing a canvas on page reload. This works well for most sites,
but cannot be guaranteed to work for all sites.
