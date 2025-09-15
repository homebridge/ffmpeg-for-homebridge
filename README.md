<div align="center">
<p>
  <a href="https://homebridge.io"><img src="https://raw.githubusercontent.com/homebridge/branding/latest/logos/homebridge-color-round-stylized.png" height="140"></a>
</p>

[![Build Status](https://img.shields.io/github/actions/workflow/status/homebridge/ffmpeg-for-homebridge/ci.yml?branch=latest&color=%23491F59&logo=github-actions&logoColor=%23FFFFFF&style=for-the-badge)](https://github.com/homebridge/ffmpeg-for-homebridge/actions?query=workflow%3A%22Build+FFmpeg%22)
[![Downloads](https://img.shields.io/npm/dt/ffmpeg-for-homebridge?color=%23491F59&logo=icloud&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/ffmpeg-for-homebridge)
[![Version](https://img.shields.io/npm/v/ffmpeg-for-homebridge?color=%23491F59&label=FFmpeg%20for%20Homebridge&logoColor=%23FFFFFF&style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyByb2xlPSJpbWciIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBzdHlsZT0iZmlsbDojRkZGRkZGIiBkPSJNMjMuOTkzIDkuODE2TDEyIDIuNDczbC00LjEyIDIuNTI0VjIuNDczSDQuMTI0djQuODE5TC4wMDQgOS44MTZsMS45NjEgMy4yMDIgMi4xNi0xLjMxNXY5LjgyNmgxNS43NDl2LTkuODI2bDIuMTU5IDEuMzE1IDEuOTYtMy4yMDIiLz48L3N2Zz4K)](https://www.npmjs.com/package/ffmpeg-for-homebridge)
[![Homebridge Discord](https://img.shields.io/discord/432663330281226270?color=%23491F59&label=Discord&logo=discord&logoColor=%23FFFFFF&style=for-the-badge)](https://discord.gg/QXqfHEW)

# FFmpeg for Homebridge
</div>

ffmpeg-for-homebridge provides prebuilt, static FFmpeg binaries for a range of platforms and architectures and is purpose-built for [Homebridge](https://homebridge.io). Think of it as a reliable FFmpeg you can bundle with your plugins to get predictable behavior across environments without asking users to install anything extra.

This isn’t a kitchen-sink FFmpeg build. Instead, it focuses on the essentials Homebridge camera plugins actually need — SRTP, AAC-ELD, H.264 transcoding, and a few other critical pieces of plumbing — so you can spend your time building great HomeKit experiences rather than wrangling dependencies. We also provide pragmatic hardware acceleration support where it can be compiled in statically (V4L2M2M on Linux, VideoToolbox on macOS, and QSV on Windows only). If you need broader or more advanced hardware acceleration, or the full spectrum of FFmpeg libraries and experimental options, a rich FFmpeg distribution like [Jellyfin's FFmpeg distribution](https://repo.jellyfin.org/?path=/ffmpeg) will serve you better. If you’re aiming for a solid, cross-platform baseline that “just works” with HomeKit, this package is for you.

Specifically, we provide:

* Audio support using `libfdk-aac`.
* Hardware-accelerated encoding support on Apple platforms using `videotoolbox`.
* Hardware-accelerated encoding support on Intel platforms using `h264_qsv` **(Windows only)**.
* Hardware-accelerated encoding support on Raspberry Pi 4 using `h264_v4l2m2m`.

## Supported Platforms
| OS                                  | Supported Architectures        |
|-------------------------------------|--------------------------------|
| FreeBSD                             | x86_64                         |
| Linux                               | x86_64, armv7l, aarch64        |
| macOS 15.0 (Sequoia) or newer       | x86_64, arm64 (Apple Silicon)  |
| Raspberry Pi 4 (Raspbian)           | armv7l, aarch64                |
| Windows 10 or newer                 | x86_64                         |

> [!IMPORTANT]
> * **Intel Quick Sync Video is only supported on Windows. If you need QSV or other GPU acceleration capabilities on Linux, we recommend looking at the [Jellyfin FFmpeg distribution](https://repo.jellyfin.org/?path=/ffmpeg) for distribution-specific releases.**
> * **Raspberry Pi 5 is currently unsupported. There are multiple known issues with FFmpeg and Raspberry Pi 5 that will hopefully be addressed by the respective teams in the future.**
> * Plugins such as `libalsa` that require dynamic runtime loading are incompatible with static builds of FFmpeg and will not be supported.
> * macOS Tahoe will be the last release that supports Intel Macs. When Apple releases the successor to Tahoe, this package will stop including binaries for macOS on Intel.

#### 32-bit armv7-based Linux:

```
sudo curl -Lf# https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest/download/ffmpeg-alpine-arm32v7.tar.gz | sudo tar xzf - -C / --no-same-owner
```

#### x64 or arm64 Linux:

```
sudo curl -Lf# https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest/download/ffmpeg-alpine-$(uname -m).tar.gz | sudo tar xzf - -C / --no-same-owner
```

#### Apple Silicon or Intel macOS:

```
sudo curl -Lf# https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest/download/ffmpeg-darwin-$(uname -m).tar.gz | sudo tar xzfm - -C / --no-same-owner
```

#### Windows:

Download the `ffmpeg.exe` file from the [releases page](https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest).

## Build Flags

The current version is based on FFmpeg 8 and built with the following configuration options:

```bash
    # Common to all platforms.
    --disable-debug
    --disable-shared
    --enable-gpl
    --enable-hardcoded-tables
    --enable-libdav1d
    --enable-libfdk-aac
    --enable-libmp3lame
    --enable-libopencore_amrnb
    --enable-libopencore_amrwb
    --enable-libopus
    --enable-libspeex
    --enable-libsrt
    --enable-libsvtav1
    --enable-libtheora
    --enable-libvidstab
    --enable-libvorbis
    --enable-libwebp
    --enable-libx264
    --enable-libxvid
    --enable-libzimg
    --enable-lv2
    --enable-nonfree
    --enable-static
    --enable-version3

    # Platform-specific caveats.
    --disable-alsa                     # Linux only
    --disable-ffnvcodec                # x64 Linux only
    --enable-amf                       # x64 Linux and Windows only
    --enable-libaom                    # arm64/x64 Linux and Windows only
    --enable-librav1e                  # macOS only
    --enable-libvpx                    # arm64/x64 Linux and Windows only
    --enable-libx265                   # not on arm32v7 Linux
    --enable-openssl                   # not on Windows
    --enable-pthreads                  # not on Windows
    --enable-videotoolbox              # macOS only

    # Windows-only extras.
    --disable-w32threads
    --enable-avisynth
    --enable-decklink
    --enable-filter=drawtext
    --enable-fontconfig
    --enable-frei0r
    --enable-gmp
    --enable-gnutls
    --enable-gray
    --enable-libaribb24
    --enable-libaribcaption
    --enable-libass
    --enable-libbs2b
    --enable-libcaca
    --enable-libdavs2
    --enable-libflite
    --enable-libfreetype
    --enable-libfribidi
    --enable-libgme
    --enable-libgsm
    --enable-libilbc
    --enable-libmodplug
    --enable-libmysofa
    --enable-libopenh264
    --enable-libopenjpeg
    --enable-librubberband
    --enable-libsnappy
    --enable-libsoxr
    --enable-libtesseract
    --enable-libtwolame
    --enable-libvmaf
    --enable-libvo-amrwbenc
    --enable-libvpl
    --enable-libxml2
    --enable-libxavs
    --enable-libxavs2
    --enable-libzvbi
    --enable-nvdec
    --enable-nvenc
    --enable-opengl
    --enable-vulkan
```

## Issues

Issues related to Homebridge or any Homebridge-related camera plugins should be raised on the corresponding project page, Discord, or community support forums.

Issues strictly related to the compatibility or installation of the resulting binary may be raised [here](https://github.com/homebridge/ffmpeg-for-homebridge/issues).

## Homebridge Plugin Development

> [!TIP]
> **This section is intended for Homebridge plugin developers. If you want to just install one of the prebuilt FFmpeg builds, see the instructions above.**

You can optionally include this package as a dependency in your Homebridge camera plugins. This package will automatically download and install the correct FFmpeg binary to your user's Homebridge installation  when they install your plugin, as long as they are on one of the  supported platforms listed above.

```
npm install --save ffmpeg-for-homebridge
```

```ts
// .js
var pathToFfmpeg = require("ffmpeg-for-homebridge");

// .ts
import pathToFfmpeg from "ffmpeg-for-homebridge";

// fallback to system FFmpeg (replace this with your own ffmpeg spawn command)
child_process.spawn(pathToFfmpeg ?? "ffmpeg", []);
```

If a supported version of FFmpeg is unavailable for the user's platform, or this package failed to download the FFmpeg binary, the package will return `undefined`, you should check for this and and try and use FFmpeg from the user's `PATH` instead.

## Credits

* FreeBSD build script: [hjdhjd/build-ffmpeg](https://github.com/hjdhjd/build-ffmpeg)
* Linux and macOS build script: [markus-perl/ffmpeg-build-script](https://github.com/markus-perl/ffmpeg-build-script)
* Windows build script: [rdp/ffmpeg-windows-build-helpers](https://github.com/rdp/ffmpeg-windows-build-helpers)
