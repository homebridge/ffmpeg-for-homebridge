/* Copyright(C) 2019-2026, The Homebridge Team. All rights reserved.
 *
 * index.d.ts: TypeScript type definitions for the FFmpeg binary path export.
 */

/**
 * Absolute path to the FFmpeg binary bundled with this package, or `undefined` if the binary is not available. Consumers should fall back to a system-installed FFmpeg
 * when this value is `undefined`.
 */
declare const ffmpegPath: string | undefined;
export = ffmpegPath;
