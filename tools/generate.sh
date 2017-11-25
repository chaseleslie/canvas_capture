#! /bin/bash

# Run script from toplevel dir (where manifest.json is).
#
# Create dev versions of extension with browser-specific hooks.

SRC_FILES="background.js capture img lib LICENSE options README.md"
PLATFORM_DIR="$PWD/platform/"
PLATFORMS_PATH="$PWD/platform/platforms.txt"

while read platform
do
  printf "%s\n" "Generating $platform"
  PLATFORM_DEV="$PLATFORM_DIR/$platform-dev"
  if [ ! -d "$PLATFORM_DEV" ]; then
    printf "  > %s\n" "Creating $PLATFORM_DEV"
    mkdir -p "$PLATFORM_DEV"
  else
    printf "  > %s\n" "$PLATFORM_DEV already exists"
  fi

  printf "  > %s\n" "Copying files to $PLATFORM_DEV"
  for file in $SRC_FILES; do
    if [ -d "$PWD/$file" ]; then
      rsync -a -u -r "$PWD/$file" "$PLATFORM_DEV/"
    else
      rsync -a -u -r "$PWD/$file" "$PLATFORM_DEV/$file"
    fi
  done

  if [ "$PLATFORM_DIR/$platform/manifest.json" -nt "$PLATFORM_DEV/manifest.json" ]; then
    printf "  > %s\n" "Generating manifest"
    "$PWD/tools/generate-manifest.py" "$platform"
  else
    printf "  > %s\n" "Manifest is current"
  fi
done < "$PLATFORMS_PATH"
