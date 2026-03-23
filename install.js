#!/usr/bin/env node

/* Copyright(C) 2019-2026, The Homebridge Team. All rights reserved.
 *
 * install.js: Install platform-specific versions of FFmpeg that has been statically built.
 */
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { URL } = require("node:url");
const child_process = require("node:child_process");

const tar = require("tar");

// Retry a failed download up to this many times before giving up (3 total attempts: initial + 2 retries).
const DOWNLOAD_RETRY_ATTEMPTS = 2;

// Maximum HTTP redirects to follow before treating it as an error. Prevents infinite redirect loops while allowing CDN redirects.
const MAX_REDIRECTS = 5;

// Network timeout in milliseconds. Connections that don't respond within this time will be aborted.
const REQUEST_TIMEOUT_MS = 30000;

// Minimum macOS version we support. The value is a Darwin kernel version, not the user-visible macOS number...kernel 24 corresponds to macOS 15 (Sequoia).
const MACOS_MINIMUM_SUPPORTED_VERSION = 24;
const MACOS_MINIMUM_SUPPORTED_RELEASE = "Sequoia";

// File system constants.
const CACHE_DIR_NAME = ".build";
const TEMP_DOWNLOAD_FILENAME = ".download";
const FFMPEG_BINARY_NAME_UNIX = "ffmpeg";
const FFMPEG_BINARY_NAME_WINDOWS = "ffmpeg.exe";

// The tar.gz archives nest FFmpeg four directories deep at usr/local/bin/ffmpeg, so we strip these path components during extraction.
const TAR_STRIP_COMPONENTS = 4;

const EXECUTABLE_PERMISSIONS = 0o755;
const HTTP_STATUS_OK = 200;
const GITHUB_RELEASE_BASE_URL = "https://github.com/homebridge/ffmpeg-for-homebridge/releases/download/";
const CONSOLE_COLOR_CYAN = "\x1b[36m";
const CONSOLE_COLOR_RESET = "\x1b[0m";

/**
 * Retrieves the target FFmpeg release version from the npm package version. This ensures we download the binary that matches the npm package being installed.
 *
 * @returns {string} The release version string prefixed with 'v'.
 */
function targetFfmpegRelease() {

  return "v" + process.env.npm_package_version;
}

/**
 * Returns the absolute path to the cache directory where downloaded FFmpeg binaries are stored.
 *
 * @returns {string} The absolute path to the cache directory.
 */
function ffmpegCache() {

  return path.join(__dirname, CACHE_DIR_NAME);
}

/**
 * Determines the appropriate FFmpeg binary filename to download based on the current operating system and CPU architecture.
 *
 * @returns {string|null} The filename to download, or null if the platform is not supported.
 */
function getDownloadFileName() {

  switch(os.platform()) {

    case "darwin":

      switch(process.arch) {

        case "x64":

          return "ffmpeg-darwin-x86_64.tar.gz";

        case "arm64":

          return "ffmpeg-darwin-arm64.tar.gz";

        default:

          return null;
      }

    case "linux":

      // We use Alpine Linux builds for their strong static-build compatibility.
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

      // The platform name "win32" is used for all Windows systems regardless of architecture...a historical anachronism.
      if(process.arch === "x64") {

        return FFMPEG_BINARY_NAME_WINDOWS;
      }

      return null;

    default:

      return null;
  }
}

/**
 * Performs a single download attempt for the FFmpeg binary. Handles the HTTP request, follows redirects, streams to disk, and provides progress feedback.
 *
 * @param {string} downloadUrl - The complete URL to download the FFmpeg binary from.
 * @param {string} tempFile - The temporary file path to write the download to.
 * @param {string} ffmpegDownloadPath - The final destination path for the downloaded file.
 * @param {number} redirectCount - The number of redirects followed so far.
 * @returns {Promise<void>} Resolves when the download completes successfully, rejects on error.
 */
function performDownload(downloadUrl, tempFile, ffmpegDownloadPath, redirectCount = 0) {

  // We use a manual promise so we can provide progress tracking, efficient streaming to disk, and custom redirect/timeout handling.
  return new Promise((resolve, reject) => {

    const urlParts = new URL(downloadUrl);

    const options = {

      headers: { "User-Agent": "ffmpeg-for-homebridge-installer" },
      hostname: urlParts.hostname,
      method: "GET",
      path: urlParts.pathname + urlParts.search,
      timeout: REQUEST_TIMEOUT_MS
    };

    const file = fs.createWriteStream(tempFile);

    // Prevents double-cleanup when multiple error events fire for the same failure.
    let cleaned = false;

    const cleanup = () => {

      if(!cleaned) {

        cleaned = true;
        file.close();

        if(fs.existsSync(tempFile)) {

          fs.unlinkSync(tempFile);
        }
      }
    };

    const request = https.get(options, (response) => {

      // GitHub redirects to CDN servers, so we follow 3xx responses to the actual download location.
      if((response.statusCode >= 300) && (response.statusCode < 400) && response.headers.location) {

        if(redirectCount >= MAX_REDIRECTS) {

          cleanup();
          reject(new Error("Too many redirects (maximum " + MAX_REDIRECTS + ")."));

          return;
        }

        // Using cleanup() rather than manual close/unlink ensures the cleaned flag is set, preventing late error events on the abandoned request from attempting a
        // second cleanup.
        cleanup();

        // Resolve both absolute and relative redirect URLs.
        const redirectUrl = response.headers.location.startsWith("http") ? response.headers.location : new URL(response.headers.location, downloadUrl).toString();

        performDownload(redirectUrl, tempFile, ffmpegDownloadPath, redirectCount + 1).then(resolve).catch(reject);

        return;
      }

      if(response.statusCode !== HTTP_STATUS_OK) {

        cleanup();
        reject(new Error("HTTP " + response.statusCode + " response received."));

        return;
      }

      // Default to 1 to avoid divide-by-zero when the content-length header is missing.
      const totalBytes = parseInt(response.headers["content-length"], 10) || 1;
      let downloadedBytes = 0;

      response.on("data", (chunk) => {

        downloadedBytes += chunk.length;
        process.stdout.write("\r" + Math.round((downloadedBytes / totalBytes) * 100).toString() + "%.");
      });

      response.on("error", (error) => {

        console.log("Response stream error: ", error);
        cleanup();
        reject(error);
      });

      file.on("error", (error) => {

        console.log("File system error: ", error);
        cleanup();
        reject(error);
      });

      // The finish event fires after all piped data has been flushed to disk.
      file.on("finish", () => {

        console.log(" - Download complete.");

        if(fs.existsSync(tempFile)) {

          fs.renameSync(tempFile, ffmpegDownloadPath);
          resolve();
        } else {

          reject(new Error("Downloaded file does not exist."));
        }
      });

      // Pipe directly to the file stream to avoid buffering the entire binary in memory.
      response.pipe(file);
    });

    request.on("error", (error) => {

      console.log("Network error: ", error);
      cleanup();
      reject(error);
    });

    // Abort if the server doesn't respond within our timeout period to avoid hanging indefinitely.
    request.on("timeout", () => {

      console.log("Request timed out.");
      request.destroy();
      cleanup();
      reject(new Error("Request timed out after " + (REQUEST_TIMEOUT_MS / 1000) + " seconds."));
    });
  });
}

/**
 * Downloads the FFmpeg binary from GitHub releases with automatic retry logic.
 *
 * @param {string} downloadUrl - The complete URL to download the FFmpeg binary from.
 * @param {string} ffmpegDownloadPath - The local file path where the downloaded file should be saved.
 * @param {number} retries - The number of retry attempts remaining if the download fails.
 * @returns {Promise<void>} Resolves when the download completes successfully.
 */
async function downloadFfmpeg(downloadUrl, ffmpegDownloadPath, retries = DOWNLOAD_RETRY_ATTEMPTS) {

  // Download to a temp file first to avoid leaving partial files if the download is interrupted.
  const tempFile = path.resolve(ffmpegCache(), TEMP_DOWNLOAD_FILENAME);

  console.log("Downloading FFmpeg from: " + downloadUrl);

  let attemptNumber = 0;

  while(attemptNumber <= retries) {

    try {

      await performDownload(downloadUrl, tempFile, ffmpegDownloadPath);

      return;
    } catch(error) {

      attemptNumber++;

      if(attemptNumber <= retries) {

        console.log("Download failed on attempt " + attemptNumber + ". Retrying...");
      } else {

        throw new Error("Failed to download after " + (retries + 1) + " attempts. Last error: " + error.message);
      }
    }
  }
}

/**
 * Verifies that the downloaded FFmpeg binary is functional by running a lightweight command. Prevents installing a corrupted or incompatible binary.
 *
 * @param {string} ffmpegTempPath - The path to the FFmpeg binary to test.
 * @returns {boolean} True if the binary executes successfully, false otherwise.
 */
function binaryOk(ffmpegTempPath) {

  try {

    // The -buildconf flag outputs build configuration without processing media...a quick, side-effect-free validation. We use execFileSync so the binary path is
    // passed directly to the OS without shell interpretation.
    child_process.execFileSync(ffmpegTempPath, ["-buildconf"]);

    return true;
  } catch(e) {

    return false;
  }
}

/**
 * Displays a fallback message when FFmpeg installation fails, letting users know the plugin installed but FFmpeg may need manual setup.
 *
 * @returns {void}
 */
function displayErrorMessage() {

  console.log("\n" + CONSOLE_COLOR_CYAN + "The Homebridge plugin has been installed, however you may need to install FFmpeg separately." + CONSOLE_COLOR_RESET + "\n");
}

/**
 * Handles a graceful installation failure. Logs the reason, displays the fallback message, optionally cleans up a file, and exits with code 0 so the Homebridge
 * installation can continue without FFmpeg.
 *
 * @param {string} message - The error message explaining what went wrong.
 * @param {string} [cleanupPath] - Optional file path to delete before exiting.
 * @returns {never}
 */
function failGracefully(message, cleanupPath) {

  console.error(message);
  displayErrorMessage();

  if(cleanupPath && fs.existsSync(cleanupPath)) {

    fs.unlinkSync(cleanupPath);
  }

  process.exit(0);
}

/**
 * Main installation function that orchestrates the FFmpeg download and setup process: platform detection, downloading, extraction, validation, and final placement.
 *
 * @returns {Promise<void>} Resolves when installation completes successfully.
 */
async function install() {

  // The recursive option makes mkdirSync idempotent...it's a no-op when the directory already exists.
  fs.mkdirSync(ffmpegCache(), { recursive: true });

  const platform = os.platform();
  const isWindows = platform === "win32";
  const binaryName = isWindows ? FFMPEG_BINARY_NAME_WINDOWS : FFMPEG_BINARY_NAME_UNIX;

  // Older macOS versions lack the system libraries our precompiled binaries are linked against.
  if((platform === "darwin") && (parseInt(os.release().split(".")[0]) < MACOS_MINIMUM_SUPPORTED_VERSION)) {

    failGracefully("ffmpeg-for-homebridge: macOS versions older than " + MACOS_MINIMUM_SUPPORTED_RELEASE +
      " are not supported, you will need to install a working version of FFmpeg manually.");
  }

  const ffmpegDownloadFileName = getDownloadFileName();

  if(!ffmpegDownloadFileName) {

    failGracefully("ffmpeg-for-homebridge: " + platform + " " + process.arch + " is not supported, you will need to install a working version of FFmpeg manually.");
  }

  // The version is included in the cache filename to support multiple versions being cached simultaneously.
  const ffmpegDownloadPath = path.resolve(ffmpegCache(), targetFfmpegRelease() + "-" + ffmpegDownloadFileName);
  const downloadUrl = GITHUB_RELEASE_BASE_URL + targetFfmpegRelease() + "/" + ffmpegDownloadFileName;

  if(!fs.existsSync(ffmpegDownloadPath)) {

    await downloadFfmpeg(downloadUrl, ffmpegDownloadPath);
  }

  const ffmpegTempPath = path.resolve(ffmpegCache(), binaryName);
  const ffmpegTargetPath = path.resolve(__dirname, binaryName);

  // Windows downloads are standalone executables...no extraction needed. Unix downloads are tar.gz archives with the binary nested at usr/local/bin/ffmpeg.
  if(!isWindows) {

    try {

      await tar.x({

        C: ffmpegCache(),
        file: ffmpegDownloadPath,
        strip: TAR_STRIP_COMPONENTS
      });
    } catch(e) {

      console.error(e);

      // Delete the cached archive since it's likely corrupted, forcing a fresh download on the next attempt.
      failGracefully("An error occurred while extracting the downloaded FFmpeg binary.", ffmpegDownloadPath);
    }

    if(fs.existsSync(ffmpegTempPath)) {

      fs.chmodSync(ffmpegTempPath, EXECUTABLE_PERMISSIONS);
    }
  } else {

    // Copy rather than move so the cached download survives validation failure, matching Unix behavior where tar.x() reads from the archive without removing it.
    fs.copyFileSync(ffmpegDownloadPath, ffmpegTempPath);
  }

  if(!binaryOk(ffmpegTempPath)) {

    // Delete the cached archive to force a fresh download on the next attempt.
    fs.unlinkSync(ffmpegDownloadPath);

    failGracefully("The downloaded FFmpeg binary failed validation.", ffmpegTempPath);
  }

  fs.renameSync(ffmpegTempPath, ffmpegTargetPath);

  console.log(CONSOLE_COLOR_CYAN + "\nFFmpeg has been downloaded to " + ffmpegTargetPath + "." + CONSOLE_COLOR_RESET);

  // Explicitly exit to prevent lingering HTTPS or tar handles from keeping the event loop alive.
  process.exit(0);
}

/**
 * Entry point that initiates installation and handles top-level errors.
 *
 * @returns {Promise<void>} Resolves when the bootstrap process completes.
 */
async function bootstrap() {

  console.log("Retrieving FFmpeg from ffmpeg-for-homebridge release: " + targetFfmpegRelease() + ".");

  try {

    await install();
  } catch(e) {

    // Permission issues commonly happen when installing global npm packages without --unsafe-perm.
    if(e && e.code && (e.code === "EACCES")) {

      console.log("Unable to download FFmpeg.");
      console.log("If you are installing this plugin as a global module (-g), make sure you add the --unsafe-perm flag to the install command.");
    }

    displayErrorMessage();

    // setTimeout ensures all console output is flushed before the process exits.
    setTimeout(() => process.exit(0));
  }
}

bootstrap();
