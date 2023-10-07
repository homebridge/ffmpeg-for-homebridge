#!/usr/bin/env node

const os = require("os");
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

const dotenv = require("dotenv");
const get = require("simple-get");
const tar = require("tar");

function targetFfmpegRelease() {

  return "v" + process.env.npm_package_version;
}

function ffmpegCache() {

  return path.join(__dirname, ".build");
}

function makeFfmpegCacheDir() {

  fs.mkdirSync(ffmpegCache(), { recursive: true });
}

function ensureFfmpegCacheDir() {

  if (!fs.existsSync(ffmpegCache())) {

    return makeFfmpegCacheDir();
  }
}

async function getDownloadFileName() {

  switch (os.platform()) {

    case "darwin":

      if (parseInt(os.release()) >= 22) {

        switch (process.arch) {

          case "x64":

            return "ffmpeg-darwin-x86_64.tar.gz";

          case "arm64":

            return "ffmpeg-darwin-arm64.tar.gz";

          default:
            return null;
        }
      }

    case "linux":

      let osReleaseEnv = {};

      if (fs.existsSync("/etc/os-release")) {

        osReleaseEnv = dotenv.parse(fs.readFileSync("/etc/os-release"));
      }

      switch (process.arch) {

        case "x64": 

          return "ffmpeg-alpine-x86_64.tar.gz";

        case "arm":

          return "ffmpeg-alpine-arm32v7.tar.gz";

        case "arm64":

          return "ffmpeg-alpine-aarch64.tar.gz";

        default:

          return null;
      }

    case "freebsd":

      switch (process.arch) {

        case "x64":

          return "ffmpeg-freebsd-x86_64.tar.gz";

        default:

          return null;
      }

    case "win32":

      if (process.arch === "x64") {

        return "ffmpeg.exe"
      } 

      return null;

    default:

      return null;
  }
}

async function downloadFfmpeg(downloadUrl, ffmpegDownloadPath) {

  // open write stream to download location
  const tempFile = path.resolve(ffmpegCache(), ".download");
  const file = fs.createWriteStream(tempFile);

  console.log("Downloading FFmpeg from: %s", downloadUrl);

  return new Promise((resolve, reject) => {

    get({
      url: downloadUrl,
    }, (err, res) => {

      if (err || res.statusCode !== 200) {

        return reject(err);
      }

      const totalBytes = parseInt(res.headers["content-length"], 10);
      let downloadedBytes = 0;

      res.on("data", (chunk) => {

        downloadedBytes = downloadedBytes + chunk.length;
        const percent = Math.round((downloadedBytes / totalBytes) * 100) + "%";
        process.stdout.write("\r" + percent);
      });
      
      file.on("finish", () => {

        console.log(" - Download Complete");
        file.close();
      });

      file.on("close", () => {

        fs.renameSync(tempFile, ffmpegDownloadPath);
        resolve();
      })

      file.on("error", (error) => {

        console.log(error);
        reject(error)
      });

      res.pipe(file);
    })
  })
}

function binaryOk(ffmpegTempPath) {

  try {

    child_process.execSync(ffmpegTempPath + " -buildconf");
    return true;
  } catch (e) {

    return false;
  }
}

function displayErrorMessage() {

  console.log("\n\x1b[36mThe homebridge plugin has been installed, however you may need to install FFmpeg separately.\x1b[0m\n");
}

// Attempt to install a working version of FFmpeg for the system we are running on.
async function install() {

  // ensure the ffmpeg npm cache directory exists
  ensureFfmpegCacheDir();

  // work out the download file name for the current platform
  const ffmpegDownloadFileName = await getDownloadFileName();

  if (!ffmpegDownloadFileName) {

    if (os.platform() === "darwin" && parseInt(os.release()) < 22) {

      console.log("ffmpeg-for-homebridge: macOS versions older than 13 (Ventura) are not supported, you will need to install a working version of FFmpeg manually.");
    } else {

      console.log("ffmpeg-for-homebridge: %s %s is not supported, you will need to install a working version of FFmpeg manually.", os.platform, process.arch);
    }

    process.exit(0);
  }

  // the file path where the download should go
  const ffmpegDownloadPath = path.resolve(ffmpegCache(), targetFfmpegRelease() + "-" + ffmpegDownloadFileName);

  // construct the download url
  const downloadUrl = "https://github.com/homebridge/ffmpeg-for-homebridge/releases/download/" + targetFfmpegRelease() + "/" + ffmpegDownloadFileName;

  // download if not cached
  if (!fs.existsSync(ffmpegDownloadPath)) {

    await downloadFfmpeg(downloadUrl, ffmpegDownloadPath);
  }

  // contruct the path of the temporary ffmpeg binary
  const ffmpegTempPath = path.resolve(ffmpegCache(), os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const ffmpegTargetPath = path.resolve(__dirname, os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg");

  // extract ffmpeg binary from the downloaded tar.gz on non-windows platforms
  if (os.platform() !== "win32") {

    try {

      await tar.x({

        file: ffmpegDownloadPath,
        C: ffmpegCache(),
        strip: 4, // tar.gz packs ffmpeg into /usr/local/bin - this strips that out
      });
    } catch (e) {

      console.error(e);
      console.error("An error occured while extracting the downloaded ffmpeg binary.");
      displayErrorMessage();
      
      // delete the cached download if it failed to extract
      fs.unlinkSync(ffmpegDownloadPath);

      process.exit(0);
    }

    if (fs.existsSync(ffmpegTempPath)) {

      fs.chmodSync(ffmpegTempPath, 0o755);
    }
  }

  // no need to extract for windows - just copy the downloaded binary to the temp path on windows
  if (os.platform() === "win32") {

    fs.renameSync(ffmpegDownloadPath, ffmpegTempPath)
  }

  // check if the downloaded binary works
  if (!binaryOk(ffmpegTempPath)) {

    displayErrorMessage();
    
    // delete the cached download if it failed the test
    fs.unlinkSync(ffmpegDownloadPath);

    process.exit(0);
  };

  // move the binary to the npm package directory
  fs.renameSync(ffmpegTempPath, ffmpegTargetPath);

  console.log("\x1b[36m\nFFmpeg has been downloaded to %s.\x1b[0m", ffmpegTargetPath);
}

// Bootstrap the installation process.
async function bootstrap() {

  console.log("Building for version: %s", targetFfmpegRelease());

  try {

    await install();
  } catch (e) {

    if (e && e.code && e.code === "EACCES") {

      console.log("Unable to download FFmpeg.\nIf you are installing this plugin as a global module (-g) make sure you add the --unsafe-perm flag to the install command.");
    }

    displayErrorMessage();

    setTimeout(() => {

      process.exit(0);
    });
  }
}

bootstrap();
