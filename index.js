"use strict";

const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const ffmpegPath = path.resolve(__dirname, os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg");

if(fs.existsSync(ffmpegPath)) {

  module.exports = ffmpegPath;
} else {

  module.exports = undefined;
}
