[![Build ffmpeg](https://github.com/homebridge/ffmpeg-for-homebridge/workflows/Build%20ffmpeg/badge.svg)](https://github.com/homebridge/ffmpeg-for-homebridge/actions)
[![GitHub All Releases](https://img.shields.io/github/downloads/homebridge/ffmpeg-for-homebridge/total)](https://somsubhra.com/github-release-stats/?username=homebridge&repository=ffmpeg-for-homebridge)

# FFmpeg for homebridge

This project provides static FFmpeg binaries for multiple platforms and architectures for use with [Homebridge](https://homebridge.io).

* Audio support using `libfdk-aac`
* Hardware-accelerated encoding support on Intel platforms using `h264_qsv` and hardware-accelerated encoding on Raspberry Pi 3+  using `h264_v4l2m2m`

## Supported Platforms

| OS                                  | Supported Architectures |
|-------------------------------------|-------------------------|
| FreeBSD                             | x86_64                  |
| Linux                               | x86_64, armv6l, aarch64 |
| macOS (10.14 (Mojave) or newer)     | x86_64                  |
| Raspberry Pi 3 or better (Raspbian) | armv7l                  |
| Windows 10 or newer                 | x86_64                  |

## Install

#### Raspbian or ARMv7-based Linux environments:

```
sudo curl -Lf# https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest/download/ffmpeg-alpine-arm32v7.tar.gz | sudo tar xzf - -C / --no-same-owner
```

#### x64 or arm64 Linux:

```
sudo curl -Lf# https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest/download/ffmpeg-alpine-$(uname -m).tar.gz | sudo tar xzf - -C / --no-same-owner
```

#### Intel or Apple Silicon macOS:

```
sudo curl -Lf# https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest/download/ffmpeg-darwin-$(uname -m).tar.gz | sudo tar xzfm - -C / --no-same-owner
```

#### Windows:

Download the `ffmpeg.exe` file from the [releases page](https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest).

## Build Flags

The `ffmpeg` binary is built with the following options enabled:

```bash
    --enable-hardcoded-tables
    --enable-nonfree
    --enable-gpl
    --enable-hardcoded-tables
    --enable-hardcoded-tables
    --enable-openssl
    --enable-libdav1d
    --enable-libsvtav1
    --enable-libx264
    --enable-libx265
    --enable-libvpx
    --enable-libxvid
    --enable-libvidstab
    --enable-libaom
    --enable-libzimg
    --enable-lv2
    --enable-libopencore_amrnb
    --enable-libopencore_amrwb
    --enable-libmp3lame
    --enable-libopus
    --enable-libvorbis
    --enable-libtheora
    --enable-libfdk-aac
    --enable-libwebp
    --enable-libsrt
    --enable-libvpl                      # x86_64 Linux and Windows only
    --disable-ffnvcodec
    --enable-amf
    --disable-debug
    --disable-shared
    --enable-pthreads
    --enable-static
    --enable-version3
  ```

## Issues

Issues related to Homebridge, any camera plugins, or your config.json, should be raised on the corresponding project page or community support forums.

Issues strictly related to the compatibility or installation of the resulting binary may be raised [here](https://github.com/homebridge/ffmpeg-for-homebridge/issues).

## Plugin Dependency

**This section is for Homebridge Plugin developers only, if you need to install FFmpeg see the instructions above.**

You can optionally include this package as a dependency in your Homebridge camera plugins, by doing this the correct FFmpeg binary will automatically be downloaded to your user's server when they install your plugin.

```
npm install --save ffmpeg-for-homebridge
```

```ts
// .js
var pathToFfmpeg = require('ffmpeg-for-homebridge');

// .ts
import pathToFfmpeg from 'ffmpeg-for-homebridge';

// fallback to system FFmpeg (replace this with your own ffmpeg spawn command)
child_process.spawn(pathToFfmpeg || 'ffmpeg', []);
```

If a supported version of FFmpeg is unavailable for the user's platform, or this package failed to download the FFmpeg binary, the package will return `undefined`, you should check for this and and try and use FFmpeg from the user's `PATH` instead.

You will need to update your plugin's README installation command to include the `--unsafe-perm` flag. For example:

```bash
# example 
sudo npm install -g --unsafe-perm homebridge-fake-camera-plugin
```

## Credits

* Linux and macOS build script: [markus-perl/ffmpeg-build-script](https://github.com/markus-perl/ffmpeg-build-script)
* Windows build script: [marierose147/ffmpeg_windows_exe_with_fdk_aac](https://github.com/marierose147/ffmpeg_windows_exe_with_fdk_aac)
