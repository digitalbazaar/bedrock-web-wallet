/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * Validates a private key.
 *
 * @param {string} privateKey - The private key to validate.
 *
 * @returns {boolean} True if valid, false otherwise.
 */
export function isValidPrivateKey(privateKey) {
  if(typeof privateKey !== 'string') {
    return false;
  }
  // Check format: 0x followed by 64 hex characters (32 bytes)
  return /^0x[a-fA-F0-9]{64}$/.test(privateKey);
}

/**
 * Validates a derivation path.
 *
 * @param {string} path - The derivation path to validate.
 *
 * @returns {boolean} True if valid, false otherwise.
 */
export function isValidDerivationPath(path) {
  if(typeof path !== 'string') {
    return false;
  }
  // Generic BIP derivation path validation (works for BIP-44, BIP-49, etc.)
  // Format: m/purpose'/coin'/account'/change/index
  // Example: m/49'/60'/0'/0/0 (USBC default)
  return /^m(\/\d+'?)+$/.test(path);
}
