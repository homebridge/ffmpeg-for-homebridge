#!/bin/sh

set -e

WORKDIR=$(pwd)
BUILD_TARGET=/Users/Shared/ffmpeg-for-homebridge

if [ ! -f "$WORKDIR/build-ffmpeg" ]; then
  echo "Execute this script from inside the ffmpeg-for-homebridge project directory."
  exit 1
fi

mkdir -p $BUILD_TARGET
cd $BUILD_TARGET

export SKIPINSTALL=yes

$WORKDIR/build-ffmpeg --build --enable-gpl-and-non-free

rm -rf $BUILD_TARGET/upload
mkdir -p $BUILD_TARGET/upload/usr/bin/local
cp $BUILD_TARGET/workspace/bin/ffmpeg upload/usr/bin/local/
tar -C $BUILD_TARGET/upload -zcvf ffmpeg-darwin-$(uname -m).tar.gz .
cp ffmpeg-darwin-$(uname -m).tar.gz $WORKDIR/

echo "File to upload at $WORKDIR/ffmpeg-darwin-$(uname -m).tar.gz"