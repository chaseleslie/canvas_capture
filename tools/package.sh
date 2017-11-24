#! /bin/bash

# Run script from toplevel dir (where manifest.json is).
#
# Version of addon is extracted from manifest.json.
#
# Packaged addon is placed in packaging/. If it is a release version
# (i.e. 3 number version string) a copy is placed in
# packaging/release/$platform/ as well.

DEST="$PWD/packaging"
TMP_DEST=$(mktemp -d)
PY_VERSION_CMD=$(cat <<'EOF'
import json
with open("manifest.json", "r") as fp:
    manifest = json.load(fp)
print(manifest['version'], end='')
EOF
)
EXT_VERSION=$(python3 -c "$PY_VERSION_CMD")
PLATFORMS_PATH="$PWD/platform/platforms.txt"
SRC_FILES="LICENSE README.md background.js manifest.json capture options lib img"

while read platform; do
  PLAT_PATH="$PWD/platform/${platform}-dev"
  ZIP_NAME="canvas-capture-${EXT_VERSION}-${platform}.zip"
  REL_ZIP_NAME="canvas-capture-${EXT_VERSION}-${platform}_$(date +%s).zip"

  echo "Packaging $platform"

  rm -R "$TMP_DEST/*"
  for file in $SRC_FILES; do
    cp -R "$PLAT_PATH/$file" "$TMP_DEST/$file"
  done

  pushd "$TMP_DEST" > /dev/null
  zip "$DEST/$ZIP_NAME" -q -r *
  popd > /dev/null

  # dd.dd.dd.dd - Dev version
  # dd.dd.dd    - Release version
  if [[ $EXT_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    :
  elif [[ $EXT_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    cp "$DEST/$ZIP_NAME" "$DEST/release/$platform/$REL_ZIP_NAME"
  fi

  echo "Packaging $platform complete"
done < "$PLATFORMS_PATH"
