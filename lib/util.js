/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * Decode base64 string to bytes (Node.js implmentation).
 *
 * @param {object} options - Options object.
 * @param {string} options.base64String - Base64 encoded string.
 * @returns {Uint8Array} Decoded bytes.
 */
export function base64ToBytes({base64String} = {}) {
  return new Uint8Array(Buffer.from(base64String, 'base64'));
}

/**
 * Encode bytes to base64 string (Node.js implementation).
 *
 * @param {object} options - Options object.
 * @param {Uint8Array} options.bytes - Bytes to encode.
 * @returns {string} Base64 encoded string.
 */
export function bytesToBase64({bytes} = {}) {
  return Buffer.from(bytes).toString('base64');
}
