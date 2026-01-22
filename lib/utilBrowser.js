/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * Decode base64 string to bytes (Browser implmentation).
 *
 * @param {object} options - Options object.
 * @param {string} options.base64String - Base64 encoded string.
 * @returns {Uint8Array} Decoded bytes.
 */
export function base64ToBytes({base64String} = {}) {
  // Use modern API
  if(typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(base64String);
  }

  // Fallback to atob
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for(let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode bytes to base64 string (Browser implementation).
 *
 * @param {object} options - Options object.
 * @param {Uint8Array} options.bytes - Bytes to encode.
 * @returns {string} Base64 encoded string.
 */
export function bytesToBase64({bytes} = {}) {
  // Use modern API
  if(typeof Uint8Array.prototype.toBase64 === 'function') {
    return bytes.toBase64();
  }

  // Fallback to btoa
  let binaryString = '';
  for(let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}
