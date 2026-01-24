#!/usr/bin/env node

/* Copyright(C) 2019-2025, The Homebridge Team. All rights reserved.
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

// Define the number of times we'll retry a failed download before giving up entirely.
const DOWNLOAD_RETRY_ATTEMPTS = 2;

// Define the maximum number of HTTP redirects we'll follow before considering it an error. This prevents infinite redirect loops while still allowing for CDN redirects.
const MAX_REDIRECTS = 5;

// Define the network timeout in milliseconds. Connections that don't respond within this time will be aborted.
const REQUEST_TIMEOUT_MS = 30000;

// Define the minimum macOS version we support. Versions older than Sequoia (macOS 15) are not compatible with our precompiled FFmpeg binaries.
const MACOS_MINIMUM_SUPPORTED_VERSION = 24;
const MACOS_MINIMUM_SUPPORTED_RELEASE = "Sequoia";

// Define file system constants for better maintainability.
const CACHE_DIR_NAME = ".build";
const TEMP_DOWNLOAD_FILENAME = ".download";
const FFMPEG_BINARY_NAME_UNIX = "ffmpeg";
const FFMPEG_BINARY_NAME_WINDOWS = "ffmpeg.exe";

// Define tar extraction constants. The tar.gz packages have FFmpeg nested four directories deep at /usr/local/bin/, so we need to strip these path components during
// extraction.
const TAR_STRIP_COMPONENTS = 4;

// Define file permission constants for Unix-like systems.
const EXECUTABLE_PERMISSIONS = 0o755;

// Define HTTP status codes for better readability.
const HTTP_STATUS_OK = 200;

// Define GitHub release URL components.
const GITHUB_RELEASE_BASE_URL = "https://github.com/homebridge/ffmpeg-for-homebridge/releases/download/";

// Define console output colors for better user feedback.
const CONSOLE_COLOR_CYAN = "\x1b[36m";
const CONSOLE_COLOR_RESET = "\x1b[0m";

/**
 * Retrieves the target FFmpeg release version from the npm package version. This ensures that we download the correct FFmpeg binary version that matches the version of
 * this npm package being installed.
 *
 * @returns {string} The release version string prefixed with 'v'.
 */
function targetFfmpegRelease() {

  return "v" + process.env.npm_package_version;
}

/**
 * Determines the cache directory path where downloaded FFmpeg binaries will be stored. This provides a consistent location for caching downloads across multiple
 * installation attempts, preventing unnecessary re-downloads.
 *
 * @returns {string} The absolute path to the cache directory.
 */
function ffmpegCache() {

  return path.join(__dirname, CACHE_DIR_NAME);
}

/**
 * Creates the FFmpeg cache directory with all necessary parent directories. This ensures we have a place to store our downloaded binaries before extraction.
 *
 * @returns {void}
 */
function makeFfmpegCacheDir() {

  fs.mkdirSync(ffmpegCache(), { recursive: true });
}

/**
 * Ensures the FFmpeg cache directory exists, creating it if necessary. This is a safety check that prevents file system errors when attempting to write downloaded files.
 *
 * @returns {void}
 */
function ensureFfmpegCacheDir() {

  // Check if the cache directory already exists. If it doesn't, we need to create it before proceeding with any download operations.
  if(!fs.existsSync(ffmpegCache())) {

    return makeFfmpegCacheDir();
  }
}

/**
 * Determines the appropriate FFmpeg binary filename to download based on the current operating system and CPU architecture. This ensures we download a binary that will
 * actually run on the user's system.
 *
 * @returns {Promise<string|null>} The filename to download, or null if the platform is not supported.
 */
async function getDownloadFileName() {

  // The list of operating systems we support.
  switch(os.platform()) {

    case "darwin":

      // macOS systems need different binaries for Apple Silicon and Intel processors.
      switch(process.arch) {

        case "x64":

          return "ffmpeg-darwin-x86_64.tar.gz";

        case "arm64":

          return "ffmpeg-darwin-arm64.tar.gz";

        default:

          return null;
      }

    case "linux":

      // Linux systems have multiple architectures we need to support. We use Alpine Linux builds for their strong static-build compatibility.
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

      // FreeBSD support is x64-only.
      switch(process.arch) {

        case "x64":

          return "ffmpeg-freebsd-x86_64.tar.gz";

        default:

          return null;
      }

    case "win32":

      // Windows only supports x64 architectures. The platform name "win32" is used for all Windows systems regardless of architecture...a historical anachronism.
      if(process.arch === "x64") {

        return FFMPEG_BINARY_NAME_WINDOWS;
      }

      return null;

    default:

      // Any other operating system is not supported by our precompiled binaries.
      return null;
  }
}

/**
 * Performs a single download attempt for the FFmpeg binary using native Node.js HTTPS module. This function handles the HTTP request, follows redirects, and manages the
 * file writing process.
 *
 * @param {string} downloadUrl - The complete URL to download the FFmpeg binary from.
 * @param {string} tempFile - The temporary file path to write the download to.
 * @param {string} ffmpegDownloadPath - The final destination path for the downloaded file.
 * @param {number} redirectCount - The number of redirects we've followed (to prevent infinite redirect loops).
 * @returns {Promise<void>} Resolves when the download completes successfully, rejects on error.
 */
function performDownload(downloadUrl, tempFile, ffmpegDownloadPath, redirectCount = 0) {

  // We use a promise here so we can tailor the retrieval to our needs and provide progress tracking, efficient streaming of our download to disk, custom error, redirect
  // and timeout handling.
  return new Promise((resolve, reject) => {

    // Parse the URL to extract the components needed for the HTTPS request. This gives us the hostname, path, and other URL components in a structured format.
    const urlParts = new URL(downloadUrl);

    // Configure the HTTPS request options. We include a user agent to identify our script and set a reasonable timeout to prevent hanging on slow connections.
    const options = {

      headers: { "User-Agent": "ffmpeg-for-homebridge-installer" },
      hostname: urlParts.hostname,
      method: "GET",
      path: urlParts.pathname + urlParts.search,
      timeout: REQUEST_TIMEOUT_MS
    };

    // Create a write stream for saving the downloaded file to disk. We'll pipe the response data directly to this stream for memory efficiency.
    const file = fs.createWriteStream(tempFile);

    // Keep track of whether we've already cleaned up resources. This prevents double-cleanup in error scenarios where multiple error events might fire.
    let cleaned = false;

    // Helper function to clean up resources when an error occurs. This ensures we don't leave file handles open or partial files on disk.
    const cleanup = () => {

      if(!cleaned) {

        cleaned = true;
        file.close();

        if(fs.existsSync(tempFile)) {

          fs.unlinkSync(tempFile);
        }
      }
    };

    // Initiate the request to download the FFmpeg binary from GitHub releases.
    const request = https.get(options, (response) => {

      // Handle redirect responses (3xx status codes). GitHub often redirects to CDN servers, so we need to follow these redirects to get to the actual file.
      if((response.statusCode >= 300) && (response.statusCode < 400) && response.headers.location) {

        // Check if we've exceeded the maximum number of redirects. This prevents infinite redirect loops that could occur with misconfigured servers.
        if(redirectCount >= MAX_REDIRECTS) {

          cleanup();
          reject(new Error("Too many redirects (maximum " + MAX_REDIRECTS + ")."));

          return;
        }

        // Close the current file stream and follow the redirect to the new location.
        file.close();
        fs.unlinkSync(tempFile);

        // Handle both relative and absolute redirect URLs. Relative URLs need to be resolved against the current URL to get the complete path.
        const redirectUrl = response.headers.location.startsWith("http") ? response.headers.location : new URL(response.headers.location, downloadUrl).toString();

        // Recursively call performDownload with the new URL and increment the redirect counter.
        performDownload(redirectUrl, tempFile, ffmpegDownloadPath, redirectCount + 1).then(resolve).catch(reject);

        return;
      }

      // Check if we received a successful response. Anything other than 200 OK is considered an error for our
      // purposes since we're expecting a direct file download.
      if(response.statusCode !== HTTP_STATUS_OK) {

        cleanup();
        reject(new Error("HTTP " + response.statusCode + " response received."));

        return;
      }

      // Calculate the total size of the file being downloaded. We default to 1 to avoid divide-by-zero errors if the content-length header is missing.
      const totalBytes = parseInt(response.headers["content-length"], 10) || 1;
      let downloadedBytes = 0;

      // Track download progress and update the console with the current percentage. This gives users feedback that the download is progressing.
      response.on("data", (chunk) => {

        downloadedBytes += chunk.length;
        process.stdout.write("\r" + Math.round((downloadedBytes / totalBytes) * 100).toString() + "%.");
      });

      // Handle the end of the response stream. At this point, all data has been received from the server.
      response.on("end", () => file.end());

      // Handle any errors that occur during the response stream. These could be network errors or timeouts.
      response.on("error", (error) => {

        console.log("Response stream error: ", error);
        cleanup();
        reject(error);
      });

      // Handle any file system errors that occur during the write process. These could be disk full errors or permission issues.
      file.on("error", (error) => {

        console.log("File system error: ", error);
        cleanup();
        reject(error);
      });

      // Handle the finish event, which fires when all data has been written to the file successfully.
      file.on("finish", () => {

        console.log(" - Download complete.");

        // Only rename if the file exists and the download completed successfully. This prevents errors if something went wrong during the download process.
        if(fs.existsSync(tempFile)) {

          fs.renameSync(tempFile, ffmpegDownloadPath);
          resolve();
        } else {

          reject(new Error("Downloaded file does not exist."));
        }
      });

      // Pipe the response data directly to the file. This is more memory-efficient than buffering the entire file in memory, especially important for large binary files
      // like FFmpeg.
      response.pipe(file);
    });

    // Handle request-level errors such as DNS failures, connection timeouts, or other network issues. These are different from HTTP errors and indicate problems
    // establishing the connection.
    request.on("error", (error) => {

      console.log("Network error: ", error);
      cleanup();
      reject(error);
    });

    // Handle timeout events. If the server doesn't respond within our timeout period, we abort the request to avoid hanging indefinitely.
    request.on("timeout", () => {

      console.log("Request timed out.");
      request.destroy();
      cleanup();
      reject(new Error("Request timed out after " + (REQUEST_TIMEOUT_MS / 1000) + " seconds."));
    });
  });
}

/**
 * Downloads the FFmpeg binary from GitHub releases with automatic retry logic. This function handles network errors gracefully and provides progress feedback to the
 * user during the download process.
 *
 * @param {string} downloadUrl - The complete URL to download the FFmpeg binary from.
 * @param {string} ffmpegDownloadPath - The local file path where the downloaded file should be saved.
 * @param {number} retries - The number of retry attempts remaining if the download fails.
 * @returns {Promise<void>} Resolves when the download completes successfully.
 */
async function downloadFfmpeg(downloadUrl, ffmpegDownloadPath, retries = DOWNLOAD_RETRY_ATTEMPTS) {

  // Create a temporary file path for the download. We download to a temp file first to avoid leaving partial files if the download is interrupted.
  const tempFile = path.resolve(ffmpegCache(), TEMP_DOWNLOAD_FILENAME);

  console.log("Downloading FFmpeg from: " + downloadUrl);

  // Keep track of the current attempt number for error reporting. This helps users understand how many attempts have been made.
  let attemptNumber = 0;

  // Continue trying to download until we succeed or exhaust all retry attempts.
  while(attemptNumber <= retries) {

    try {

      // Attempt to perform the download. If this succeeds, we'll return immediately. If it fails, we'll catch the error and potentially retry.
      await performDownload(downloadUrl, tempFile, ffmpegDownloadPath);

      return;
    } catch(error) {

      attemptNumber++;

      // Check if we have more retry attempts available. If we do, inform the user and try again. If not, throw the error to fail the entire operation.
      if(attemptNumber <= retries) {

        console.log("Download failed on attempt " + attemptNumber + ". Retrying...");
      } else {

        // We've exhausted all retry attempts, so we need to fail with an appropriate error message that includes the original error for debugging purposes.
        throw new Error("Failed to download after " + (retries + 1) + " attempts. Last error: " + error.message);
      }
    }
  }
}

/**
 * Verifies that the downloaded FFmpeg binary is functional by attempting to execute it with a simple command. This prevents us from installing a corrupted or
 * incompatible binary.
 *
 * @param {string} ffmpegTempPath - The path to the FFmpeg binary to test.
 * @returns {boolean} True if the binary executes successfully, false otherwise.
 */
function binaryOk(ffmpegTempPath) {

  try {

    // Attempt to run FFmpeg with the -buildconf flag, which simply outputs build configuration without processing any media files. This is a quick way to verify the binary works.
    child_process.execSync(ffmpegTempPath + " -buildconf");

    return true;
  } catch(e) {

    // If the execution fails for any reason, the binary is not usable on this system.
    return false;
  }
}

/**
 * Displays a helpful error message to the user when FFmpeg installation fails. This ensures users understand that while the plugin installed successfully, they may need
 * to manually install FFmpeg.
 *
 * @returns {void}
 */
function displayErrorMessage() {

  console.log("\n" + CONSOLE_COLOR_CYAN + "The Homebridge plugin has been installed, however you may need to install FFmpeg separately." + CONSOLE_COLOR_RESET + "\n");
}

/**
 * Main installation function that orchestrates the entire FFmpeg download and setup process. This function handles platform detection, downloading, extraction, and
 * verification of the FFmpeg binary.
 *
 * @returns {Promise<void>} Resolves when installation completes successfully.
 */
async function install() {

  // Ensure the FFmpeg cache directory exists before we attempt any file operations. This prevents errors when trying to save downloaded files.
  ensureFfmpegCacheDir();

  // Check if we're running on a supported version of macOS. Older versions of macOS don't have the required libraries for our precompiled FFmpeg binaries.
  if((os.platform().toString() === "darwin") && (parseInt(os.release().split(".")[0]) < MACOS_MINIMUM_SUPPORTED_VERSION)) {

    console.error("ffmpeg-for-homebridge: macOS versions older than " + MACOS_MINIMUM_SUPPORTED_RELEASE +
      " are not supported, you will need to install a working version of FFmpeg manually.");

    process.exit(0);
  }

  // Determine which FFmpeg binary we need to download for the current platform and architecture.
  const ffmpegDownloadFileName = await getDownloadFileName();

  if(!ffmpegDownloadFileName) {

    console.error("ffmpeg-for-homebridge: " + os.platform() + " " + process.arch + " is not supported, you will need to install a working version of FFmpeg manually.");

    process.exit(0);
  }

  // Construct the full path where the downloaded file will be cached. We include the version in the filename to support multiple versions being cached.
  const ffmpegDownloadPath = path.resolve(ffmpegCache(), targetFfmpegRelease() + "-" + ffmpegDownloadFileName);

  // Build the complete URL for downloading the FFmpeg binary from GitHub releases.
  const downloadUrl = GITHUB_RELEASE_BASE_URL + targetFfmpegRelease() + "/" + ffmpegDownloadFileName;

  // Check if we've already downloaded this version. If not, download it now. This caching prevents unnecessary downloads when reinstalling the package.
  if(!fs.existsSync(ffmpegDownloadPath)) {

    await downloadFfmpeg(downloadUrl, ffmpegDownloadPath);
  }

  // Determine the paths for the temporary and final locations of the FFmpeg binary. Windows uses a different filename than Unix-like systems.
  const ffmpegTempPath = path.resolve(ffmpegCache(), (os.platform() === "win32") ? FFMPEG_BINARY_NAME_WINDOWS : FFMPEG_BINARY_NAME_UNIX);
  const ffmpegTargetPath = path.resolve(__dirname, (os.platform() === "win32") ? FFMPEG_BINARY_NAME_WINDOWS : FFMPEG_BINARY_NAME_UNIX);

  // Extract the FFmpeg binary from the tar.gz archive on Unix-like systems. Windows downloads are already executable files that don't need extraction.
  if(os.platform() !== "win32") {

    try {

      // Extract the FFmpeg binary from the tar.gz archive. The binary is nested several directories deep, so we strip those path components during extraction.
      await tar.x({

        C: ffmpegCache(),
        file: ffmpegDownloadPath,
        strip: TAR_STRIP_COMPONENTS
      });
    } catch(e) {

      console.error(e);
      console.error("An error occurred while extracting the downloaded FFmpeg binary.");
      displayErrorMessage();

      // Delete the cached download since it appears to be corrupted or invalid. This allows a fresh download on the next installation attempt.
      fs.unlinkSync(ffmpegDownloadPath);

      process.exit(0);
    }

    // Set the execute permission on the extracted binary. Unix-like systems require this permission for the binary to be runnable.
    if(fs.existsSync(ffmpegTempPath)) {

      fs.chmodSync(ffmpegTempPath, EXECUTABLE_PERMISSIONS);
    }
  } else {

    // For Windows, the downloaded file is already an executable, so we just need to move it to the temp location.
    fs.renameSync(ffmpegDownloadPath, ffmpegTempPath);
  }

  // Verify that the downloaded binary actually works on this system. This catches issues with incompatible architectures or missing system libraries.
  if(!binaryOk(ffmpegTempPath)) {

    displayErrorMessage();

    // Clean up the failed binary. On Windows, the download was moved (not copied) to ffmpegTempPath, so we delete that. On Unix, we delete the cached archive to allow a
    // fresh download on the next attempt.
    fs.unlinkSync((os.platform() === "win32") ? ffmpegTempPath : ffmpegDownloadPath);

    process.exit(0);
  }

  // Move the verified binary to its final location in the npm package directory. This is where the main package code will look for it.
  fs.renameSync(ffmpegTempPath, ffmpegTargetPath);

  console.log(CONSOLE_COLOR_CYAN + "\nFFmpeg has been downloaded to " + ffmpegTargetPath + "." + CONSOLE_COLOR_RESET);

  // Explicitly exit to ensure the process terminates promptly. Without this, lingering handles from HTTPS requests or tar extraction can keep the event loop alive.
  process.exit(0);
}

/**
 * Bootstrap function that initiates the installation process and handles top-level errors. This provides a clean entry point for the script and ensures proper error
 * handling.
 *
 * @returns {Promise<void>} Resolves when the bootstrap process completes.
 */
async function bootstrap() {

  console.log("Retrieving FFmpeg from ffmpeg-for-homebridge release: " + targetFfmpegRelease() + ".");

  try {

    await install();
  } catch(e) {

    // Check if the error is due to permission issues. This commonly happens when installing global npm packages without proper permissions.
    if(e && e.code && (e.code === "EACCES")) {

      console.log("Unable to download FFmpeg.");
      console.log("If you are installing this plugin as a global module (-g), make sure you add the --unsafe-perm flag to the install command.");
    }

    displayErrorMessage();

    // Use setTimeout to ensure all console output is flushed before the process exits.
    setTimeout(() => process.exit(0));
  }
}

// Start the installation process when this script is executed.
bootstrap();
