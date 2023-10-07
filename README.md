<div align="center">
<p>
  <a href="https://homebridge.io"><img src="https://raw.githubusercontent.com/homebridge/branding/latest/logos/homebridge-color-round-stylized.png" height="140"></a>
</p>

[![Build Status](https://img.shields.io/github/actions/workflow/status/homebridge/ffmpeg-for-homebridge/ci.yml?branch=latest&color=%23491F59&logo=github-actions&logoColor=%23FFFFFF&style=for-the-badge)](https://github.com/homebridge/ffmpeg-for-homebridge/actions?query=workflow%3A%22Build+FFmpeg%22)
[![Downloads](https://img.shields.io/npm/dt/ffmpeg-for-homebridge?color=%23491F59&logo=icloud&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/ffmpeg-for-homebridge)
[![Version](https://img.shields.io/npm/v/ffmpeg-for-homebridge?color=%23491F59&label=FFmpeg%20for%20Homebridge&logoColor=%23FFFFFF&style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyByb2xlPSJpbWciIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBzdHlsZT0iZmlsbDojRkZGRkZGIiBkPSJNMjMuOTkzIDkuODE2TDEyIDIuNDczbC00LjEyIDIuNTI0VjIuNDczSDQuMTI0djQuODE5TC4wMDQgOS44MTZsMS45NjEgMy4yMDIgMi4xNi0xLjMxNXY5LjgyNmgxNS43NDl2LTkuODI2bDIuMTU5IDEuMzE1IDEuOTYtMy4yMDIiLz48L3N2Zz4K)](https://www.npmjs.com/package/homebridge-myq)
[![Homebridge Discord](https://img.shields.io/discord/432663330281226270?color=%23491F59&label=Discord&logo=discord&logoColor=%23FFFFFF&style=for-the-badge)](https://discord.gg/QXqfHEW)

# FFmpeg for Homebridge
</div>

This project provides static FFmpeg binaries for multiple platforms and architectures for use with [Homebridge](https://homebridge.io).

Specifically, we provide:

* Audio support using `libfdk-aac`
* Hardware-accelerated encoding support on Intel platforms using `h264_qsv` and hardware-accelerated encoding on Raspberry Pi 3+ using `h264_v4l2m2m`
* Hardware-accelerated encoding support on Apple platforms using `videotoolbox`

## Supported Platforms

| OS                                  | Supported Architectures        |
|-------------------------------------|--------------------------------|
| FreeBSD                             | x86_64                         |
| Linux                               | x86_64, armv7l, aarch64        |
| macOS 13.0 (Ventura) or newer       | x86_64, arm64 (Apple Silicon)  |
| Raspberry Pi 3 or better (Raspbian) | armv7l, aarch64                |
| Windows 10 or newer                 | x86_64                         |

## Install

#### Raspbian or armv7/armv8-based Linux environments:

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

FFmpeg is built with the following configuration options:

```bash
    --disable-debug
    --disable-ffnvcodec
    --disable-shared
    --enable-amf                         # x86_64 Linux only
    --enable-gpl
    --enable-hardcoded-tables
    --enable-libaom                      # x86_64 Linux only
    --enable-libdav1d
    --enable-libfdk-aac
    --enable-libmp3lame
    --enable-libopencore_amrnb
    --enable-libopencore_amrwb
    --enable-libopus
    --enable-libsrt
    --enable-libsvtav1
    --enable-libtheora
    --enable-libvidstab
    --enable-libvorbis
    --enable-libvpl                      # x86_64 Linux and Windows only
    --enable-libvpx                      # not available on arm32v7 Linux
    --enable-libwebp
    --enable-libx264
    --enable-libx265                     # not available on arm32v7 Linux
    --enable-libxvid
    --enable-libzimg
    --enable-lv2
    --enable-nonfree
    --enable-openssl
    --enable-pthreads
    --enable-static
    --enable-version3
    --enable-videotoolbox                # macOS only
  ```

## Issues

Issues related to Homebridge or any Homebridge-related camera plugins should be raised on the corresponding project page, Discord, or community support forums.

Issues strictly related to the compatibility or installation of the resulting binary may be raised [here](https://github.com/homebridge/ffmpeg-for-homebridge/issues).

## Plugin Dependency

**This section is for Homebridge plugin developers only, if you need to install FFmpeg see the instructions above.**

You can optionally include this package as a dependency in your Homebridge camera plugins. This package will automatically download and install the correct FFmpeg binary to your user's Homebridge installation  when they install your plugin, as long as they are on one of the  supported platforms listed above.

```
npm install --unsafe-perm --save ffmpeg-for-homebridge
```

```ts
// .js
var pathToFfmpeg = require("ffmpeg-for-homebridge");

// .ts
import pathToFfmpeg from "ffmpeg-for-homebridge";

// fallback to system FFmpeg (replace this with your own ffmpeg spawn command)
child_process.spawn(pathToFfmpeg || "ffmpeg", []);
```

If a supported version of FFmpeg is unavailable for the user's platform, or this package failed to download the FFmpeg binary, the package will return `undefined`, you should check for this and and try and use FFmpeg from the user's `PATH` instead.

**You will need to update your plugin's README installation command to include the `--unsafe-perm` flag.** For example:

```bash
# example 
sudo npm install -g --unsafe-perm homebridge-fake-camera-plugin
```

## Credits

* FreeBSD build script: [hjdhjd/build-ffmpeg](https://github.com/hjdhjd/build-ffmpeg)
* Linux and macOS build script: [markus-perl/ffmpeg-build-script](https://github.com/markus-perl/ffmpeg-build-script)
* Windows build script: [rdp/ffmpeg-windows-build-helpers](https://github.com/rdp/ffmpeg-windows-build-helpers)
