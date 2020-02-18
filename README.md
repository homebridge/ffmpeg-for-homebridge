![Build ffmpeg](https://github.com/oznu/ffmpeg-for-homebridge/workflows/Build%20ffmpeg/badge.svg)

# ffmpeg for homebridge

This project provides static `ffmpeg` binaries for multiple platforms and architectures for use with Homebridge.

* Audio support using `libfdk-aac`
* Hardware decoding on the Raspberry Pi using `h264_omx`

## Supported Platforms

| OS                  | Supported Architectures |
|---------------------|-------------------------|
| macOS               | x86_64                  |
| Debian/Ubuntu Linux | x86_64, armv7l, aarch64 |
| Alpine Linux        | x86_64, armv6l, aarch64 |
| Raspbian Linux      | armv6l (armv7l)         |

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

The script to build `ffmpeg` as a static binary on Linux and macOS was created by [markus-perl/ffmpeg-build-script](https://github.com/markus-perl/ffmpeg-build-script).