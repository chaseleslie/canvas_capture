#! /bin/bash

# Monitor project for modifications and run generate.sh upon
# changes.
#
# Expects to be run from top level directory (where manifest.json is).
#
# Requires inotifywait from inotify-tools package.

SRC_FILES="background.js capture img lib LICENSE manifest.json options README.md"

function loop() {
  while <<< "$SRC_FILES" xargs inotifywait -qq -r -e modify; do
    "$PWD/tools/generate.sh" > /dev/null 2>&1
  done
}

loop &
