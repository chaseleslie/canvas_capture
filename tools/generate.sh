#! /bin/bash

# Run script from toplevel dir (where manifest.json is).
#
# Create dev versions of extension with browser-specific hooks.

SRC_FILES="background.js capture img lib LICENSE options README.md"
PLATFORM_DIR="$PWD/platform/"
PLATFORMS_PATH="$PWD/platform/platforms.txt"

while read platform
do
  echo "Generating platform folder for $platform"
  PLATFORM_DEV="$PLATFORM_DIR/$platform-dev"
  if [ ! -d "$PLATFORM_DEV" ]; then
    mkdir -p "$PLATFORM_DEV"
  fi

  for file in $SRC_FILES; do
    if [ -d "$PWD/$file" ]; then
      rsync -a -u -r "$PWD/$file" "$PLATFORM_DEV/"
    else
      rsync -a -u -r "$PWD/$file" "$PLATFORM_DEV/$file"
    fi
  done

  echo "Generating manifest for $platform"
  "$PWD/tools/generate-manifest.py" "$platform"
done < "$PLATFORMS_PATH"
