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
  if [ -d "$PLATFORM_DEV" ]; then
    rm -R "$PLATFORM_DEV"
  fi
  mkdir -p "$PLATFORM_DEV"
  for file in $SRC_FILES; do
    cp -ar "$PWD/$file" "$PLATFORM_DEV/$file"
  done

  echo "Generating manifest for $platform"
  "$PWD/tools/generate-manifest.py" "$platform"
done < "$PLATFORMS_PATH"
