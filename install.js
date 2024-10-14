#!/usr/bin/env node

const os = require("os");
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

const dotenv = require("dotenv");
const get = require("simple-get");
const tar = require("tar");

const DOWNLOAD_RETRY_ATTEMPTS = 2;

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

  if(!fs.existsSync(ffmpegCache())) {

    return makeFfmpegCacheDir();
  }
}

async function getDownloadFileName() {

  switch(os.platform()) {

    case "darwin":

      if(parseInt(os.release()) >= 24) {

        switch(process.arch) {

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

      if(fs.existsSync("/etc/os-release")) {

        osReleaseEnv = dotenv.parse(fs.readFileSync("/etc/os-release"));
      }

      switch(process.arch) {

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

      switch(process.arch) {

        case "x64":

          return "ffmpeg-freebsd-x86_64.tar.gz";

        default:

          return null;
      }

    case "win32":

      if(process.arch === "x64") {

        return "ffmpeg.exe"
      }

      return null;

    default:

      return null;
  }
}

async function downloadFfmpeg(downloadUrl, ffmpegDownloadPath, retries = DOWNLOAD_RETRY_ATTEMPTS) {

  const tempFile = path.resolve(ffmpegCache(), ".download");

  console.log("Downloading FFmpeg from: " + downloadUrl);

  return new Promise((resolve, reject) => {

    const file = fs.createWriteStream(tempFile);

    const attemptDownload = () => {

      // Download the file.
      get(downloadUrl, (err, res) => {

        if(err || (res.statusCode !== 200)) {

          console.log("Download failed. Retrying.");

          // Clean up the incomplete download before proceeding.
          if(retries > 0) {

            file.close();
            fs.unlinkSync(tempFile);

            return downloadFfmpeg(downloadUrl, ffmpegDownloadPath, retries - 1)
              .then(resolve)
              .catch(reject);
          }

          return reject(err || new Error("Failed to download after " + (DOWNLOAD_RETRY_ATTEMPTS + 1).toString() + " attempts."));
        }

        // We ensure totalBytes is never zero so we avoid divide-by-zero errors.
        const totalBytes = parseInt(res.headers["content-length"], 10) || 1;
        let downloadedBytes = 0;

        // Inform users of our progress.
        res.on("data", (chunk) => {

          downloadedBytes += chunk.length;
          process.stdout.write("\r" + Math.round((downloadedBytes / totalBytes) * 100).toString() + "%.");
        });

        // Download complete and the file is now closed, rename it.
        file.on("close", () => {

          fs.renameSync(tempFile, ffmpegDownloadPath);
          resolve();
        });

        // Error handling.
        file.on("error", (error) => {

          console.log(error);
          reject(error);
        });

        // All data written - we've completed the download.
        file.on("finish", () => console.log(" - download complete."));

        res.pipe(file);
      }).on("error", (error) => {

        console.log("Request error: ", error);

        // Clean up the incomplete download before proceeding.
        if(retries > 0) {

          console.log("Retrying download.");
          fs.unlinkSync(tempFile); // Clean up on error

          return downloadFfmpeg(downloadUrl, ffmpegDownloadPath, retries - 1)
            .then(resolve)
            .catch(reject);
        }

        reject(new Error("Failed after " + (DOWNLOAD_RETRY_ATTEMPTS + 1).toString() + " attempts."));
      });
    };

    attemptDownload();
  });
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

  // Ensure the FFmpeg npm cache directory exists.
  ensureFfmpegCacheDir();

  // Determine the download file name for the current platform.
  const ffmpegDownloadFileName = await getDownloadFileName();

  if(!ffmpegDownloadFileName) {

    if(os.platform() === "darwin" && parseInt(os.release()) < 24) {

      console.log("ffmpeg-for-homebridge: macOS versions older than 15 (Sequoia) are not supported, you will need to install a working version of FFmpeg manually.");
    } else {

      console.log("ffmpeg-for-homebridge: %s %s is not supported, you will need to install a working version of FFmpeg manually.", os.platform, process.arch);
    }

    process.exit(0);
  }

  // The file path where the download will be located.
  const ffmpegDownloadPath = path.resolve(ffmpegCache(), targetFfmpegRelease() + "-" + ffmpegDownloadFileName);

  // Construct the download url.
  const downloadUrl = "https://github.com/homebridge/ffmpeg-for-homebridge/releases/download/" + targetFfmpegRelease() + "/" + ffmpegDownloadFileName;

  // Download the latest release if it's not been previously cached.
  if(!fs.existsSync(ffmpegDownloadPath)) {

    await downloadFfmpeg(downloadUrl, ffmpegDownloadPath);
  }

  // Contruct the path of the temporary FFmpeg binary.
  const ffmpegTempPath = path.resolve(ffmpegCache(), os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const ffmpegTargetPath = path.resolve(__dirname, os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg");

  // Extract the FFmpeg binary from the downloaded tar.gz bundle on non-windows platforms.
  if(os.platform() !== "win32") {

    try {

      await tar.x({

        file: ffmpegDownloadPath,
        C: ffmpegCache(),
        strip: 4, // tar.gz packs ffmpeg into /usr/local/bin - this strips that out.
      });
    } catch (e) {

      console.error(e);
      console.error("An error occured while extracting the downloaded FFmpeg binary.");
      displayErrorMessage();

      // Delete the cached download if it failed to extract for some reason.
      fs.unlinkSync(ffmpegDownloadPath);

      process.exit(0);
    }

    // Set the execute permissions for FFmpeg.
    if(fs.existsSync(ffmpegTempPath)) {

      fs.chmodSync(ffmpegTempPath, 0o755);
    }
  } else {

    // There's no need to extract for Windows - we just copy the downloaded binary to the temp path.

    fs.renameSync(ffmpegDownloadPath, ffmpegTempPath)
  }

  // check if the downloaded binary works
  if(!binaryOk(ffmpegTempPath)) {

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

  console.log("Retrieving FFmpeg from ffmpeg-for-homebridge release: %s.", targetFfmpegRelease());

  try {

    await install();
  } catch (e) {

    if(e && e.code && e.code === "EACCES") {

      console.log("Unable to download FFmpeg.\nIf you are installing this plugin as a global module (-g) make sure you add the --unsafe-perm flag to the install command.");
    }

    displayErrorMessage();

    setTimeout(() => {

      process.exit(0);
    });
  }
}

bootstrap();
