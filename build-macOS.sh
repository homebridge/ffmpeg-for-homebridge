#!/bin/zsh
set -e

# Get the operating system and architecture to create the target in system-arch form.
TARGET="$(uname -s | awk '{print tolower($0)}')-$(uname -m)"

# Create our workspace.
rm -rf "${TARGET}"
mkdir -p "${TARGET}"
cd ${TARGET}

# Build FFmpeg.
SKIPINSTALL=yes VERBOSE=yes ../build-ffmpeg --build --enable-gpl-and-non-free

# Package FFmpeg.
echo "Packaging FFmpeg."
mkdir -p package/usr/local/bin/

# Emulate the filesystem hierarchy so it's easily discoverable in a user's path environment variable.
cp workspace/bin/ffmpeg package/usr/local/bin/ffmpeg

# Now we package it all up.
tar -C package -zcvf ffmpeg-${TARGET}.tar.gz .

