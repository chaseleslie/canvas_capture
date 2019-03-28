#! /bin/bash

# Run script from toplevel dir (where manifest.json is).
#
# Create dev versions of extension with browser-specific hooks.

SRC_FILES="background.js capture img lib LICENSE options README.md wasm/worker.js wasm/build/webm_muxer.js wasm/build/webm_muxer.wasm"
PLATFORM_DIR="$PWD/platform"
PLATFORMS_PATH="$PWD/platform/platforms.txt"

printf "%s\n" "Building wasm"
pushd "$PWD/wasm" &> /dev/null
if ! make 1> /dev/null; then
  printf "  > %s\n" "Building failed. Aborting"
  exit 1
fi
popd &> /dev/null
printf "\n"

while read platform
do
  PLATFORM_DEV="$PLATFORM_DIR/$platform-dev"

  printf "%s\n" "Generating $platform"

  printf "  > %s\n" "Creating $PLATFORM_DEV"
  if [ -d "$PLATFORM_DEV" ]; then
    rm -r "$PLATFORM_DEV"
    mkdir -p "$PLATFORM_DEV"
  fi

  printf "  > %s\n" "Copying files"
  for file in $SRC_FILES; do
    if [ -d "$PWD/$file" ]; then
      dname=$(dirname "$PLATFORM_DEV/$file");
      if [ ! -d "$dname" ]; then
        mkdir -p "$dname"
      fi
      rsync -a -u -r "$PWD/$file" "$PLATFORM_DEV/"
    else
      dname=$(dirname "$PLATFORM_DEV/$file");
      if [ ! -d "$dname" ]; then
        mkdir -p "$dname"
      fi
      rsync -a -u -r "$PWD/$file" "$PLATFORM_DEV/$file"
    fi
  done

  printf "  > %s\n" "Generating manifest"
  PLAT_MAN="$PLATFORM_DIR/$platform/manifest.json"
  PLAT_DEV_MAN="$PLATFORM_DEV/manifest.json"
  MAIN_MAN="$PWD/manifest.json"
  if [ "$PLAT_MAN" -nt "$PLAT_DEV_MAN" ] || [ "$MAIN_MAN" -nt "$PLAT_MAN" ] || [ "$MAIN_MAN" -nt "$PLAT_DEV_MAN" ]; then
    "$PWD/tools/generate-manifest.py" "$platform"
    printf "    >> %s\n" "manifest.json created"
  else
    printf "    >> %s\n" "manifest.json is current"
  fi

  echo ""
done < "$PLATFORMS_PATH"
