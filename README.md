# Canvas Capture

## A WebExtension for the Firefox and Chrome browsers

---

The Canvas Capture extension allows video to be captured from HTML `canvas`
elements.

Currently, video is only output in the webm container in the browser's choice
of codec (typically VPX).

To use, simply navigate to a page with an animated canvas element and click
the extension's browser action (toolbar button). A list of canvases present
on the page will be displayed with some details about each one. Click the
capture button next to the canvas that should be captured. When finished,
click the stop button and a link will be generated to download the
resulting video file (the file is constructed using Blobs; no network
access is required).

Canvas Capture produces video files of canvas elements using the
MediaRecorder, MediaStream and Blob APIs.
