# Using tools/*

---

Several tools have been created to ease development. They expect to be
run from the top level extension directory.

In general, running **tools/monitor.sh** will keep the platform-specific
builds synced with the top level source files. Loading a temporary extension
can be done by pointing the browser to **platform/$platform-dev**.

## Dependencies

---

- A linux-like environment
- bash shell
- python3
- rsync
- inotifywait (from inotify-tools package)

## Tools

---

### tools/generate-manifest.py

This script merges the platform-specific `manifest.json` files found in
`platform/$platform/` with the general `manifest.json` found in
the top level extension directory. The resulting `manifest.json` file is placed
in `platform/$platform-dev/`.

This is normally called by the generate process automatically.

### tools/generate.sh

This shell script copies over any changed files from the top level extension
directory to the platform-specific build directory in
`platform/$platform-dev`. Files are created if they don't exist and updated
if they already exist and have changes. The script `generate-manifest.py` is
called if the platform-specific manifest in `platform/$platform/` has been
updated.

Platforms are listed in `platform/platforms.txt`.

### tools/monitor.sh

This shell script uses `inotifywait` from the inotify-tools package to call
`generate.sh` whenever one of the top level source files is modified.

### tools/package.sh

This script makes ZIP files from the platform-specific build directories
in `platform/$platform-dev`. The resulting files are placed in the
`packaging/` directory with a naming convention using the name of the
extension, the version number and a `$platform` suffix. If the version
number is a development version (4 number string) then processing stops. If
the version number is a release number (3 number string) then the ZIP file
is also copied to `packaging/release/$platform` for archiving.
