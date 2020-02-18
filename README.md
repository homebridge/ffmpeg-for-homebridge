[![Build ffmpeg](https://github.com/oznu/ffmpeg-for-homebridge/workflows/Build%20ffmpeg/badge.svg)](https://github.com/oznu/ffmpeg-for-homebridge/actions)

# ffmpeg for homebridge

This project provides static `ffmpeg` binaries for multiple platforms and architectures for use with Homebridge.

* Audio support using `libfdk-aac`
* Hardware decoding on the Raspberry Pi using `h264_omx`

## Supported Platforms

| OS                  | Supported Architectures |
|---------------------|-------------------------|
| Raspbian Linux      | armv6l (armv7l)         |
| Debian/Ubuntu Linux | x86_64, armv7l, aarch64 |
| Alpine Linux        | x86_64, armv6l, aarch64 |
| macOS               | x86_64                  |
| Windows             | x86_64                  |

## Install

### Raspbian Linux:

```
curl -Lfs https://github.com/oznu/ffmpeg-for-homebridge/releases/download/v0.0.1/ffmpeg-raspbian-armv6l.tar.gz | sudo tar xzf - -C / --no-same-owner
```

### Debian / Ubuntu Linux:

```
curl -Lfs https://github.com/oznu/ffmpeg-for-homebridge/releases/download/v0.0.1/ffmpeg-debian-$(uname -m).tar.gz | sudo tar xzf - -C / --no-same-owner
```

### macOS:

```
curl -Lfs https://github.com/oznu/ffmpeg-for-homebridge/releases/download/v0.0.1/ffmpeg-darwin-x86_64.tar.gz | sudo tar xzf - -C / --no-same-owner
```

### Windows:

Download the `ffmpeg.exe` here [releases page](https://github.com/oznu/ffmpeg-for-homebridge/releases/latest).

## Build Flags

The `ffmpeg` binary is built with the following options enabled:

```bash
  --enable-static
  --disable-debug
  --disable-shared
  --disable-ffplay
  --disable-doc
  --enable-openssl
  --enable-gpl
  --enable-version3
  --enable-nonfree
  --enable-pthreads
  --enable-libvpx
  --enable-libmp3lame
  --enable-libopus
  --enable-libtheora
  --enable-libvorbis
  --enable-libx264
  --enable-runtime-cpudetect
  --enable-libfdk-aac
  --enable-avfilter
  --enable-libopencore_amrwb
  --enable-libopencore_amrnb
  --enable-filters
  --enable-decoder=h264
  --enable-network
  --enable-protocol=tcp
  --enable-demuxer=rtsp
  --enable-omx-rpi              # Raspbian Linux builds only
  --enable-mmal                 # Raspbian Linux builds only
  ```

## Credits

* Linux and macOS build script: [markus-perl/ffmpeg-build-script](https://github.com/markus-perl/ffmpeg-build-script)
* Windows build script: [rdp/ffmpeg-windows-build-helpers](https://github.com/rdp/ffmpeg-windows-build-helpers)