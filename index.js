"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");

const ffmpegPath = path.resolve(__dirname, os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg");

if (fs.existsSync(ffmpegPath)) {

  module.exports = ffmpegPath;
} else {

  module.exports = undefined;
}
