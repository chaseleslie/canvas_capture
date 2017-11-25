#! /bin/bash

# Run script from toplevel dir (where manifest.json is).
#
# Create dev versions of extension with browser-specific hooks.

SRC_FILES="background.js capture img lib LICENSE options README.md"
PLATFORM_DIR="$PWD/platform/"
PLATFORMS_PATH="$PWD/platform/platforms.txt"

while read platform
do
  PLATFORM_DEV="$PLATFORM_DIR/$platform-dev"

  printf "%s\n" "Generating $platform"

  printf "  > %s\n" "Creating $PLATFORM_DEV"
  if [ ! -d "$PLATFORM_DEV" ]; then
    mkdir -p "$PLATFORM_DEV"
  else
    printf "    >> %s\n" "already exists"
  fi

  printf "  > %s\n" "Copying files"
  for file in $SRC_FILES; do
    if [ -d "$PWD/$file" ]; then
      rsync -a -u -r "$PWD/$file" "$PLATFORM_DEV/"
    else
      rsync -a -u -r "$PWD/$file" "$PLATFORM_DEV/$file"
    fi
  done

  printf "  > %s\n" "Generating manifest"
  if [ "$PLATFORM_DIR/$platform/manifest.json" -nt "$PLATFORM_DEV/manifest.json" ]; then
    "$PWD/tools/generate-manifest.py" "$platform"
    printf "    >> %s\n" "manifest.json created"
  else
    printf "    >> %s\n" "manifest.json is current"
  fi

  echo ""
done < "$PLATFORMS_PATH"
