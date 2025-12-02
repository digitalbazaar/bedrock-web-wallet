/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {DEFAULT_DERIVATION_PATH, DEFAULT_MNEMONIC_STRENGTH} from './config.js';
import {ethers} from 'ethers';

/**
 * Generates a new BIP39 mnemonic phrase.
 *
 * @param {object} [options] - Options.
 * @param {number} [options.strength=128] - Entropy strength in bits.
 *  128 = 12 words, 256 = 24 words.
 *
 * @returns {string} The generated mnemonic phrase.
 */
export function generateMnemonic({strength = DEFAULT_MNEMONIC_STRENGTH} = {}) {
  const entropy = ethers.randomBytes(strength / 8);
  return ethers.Mnemonic.entropyToPhrase(entropy);
}

/**
 * Derives an Ethereum wallet from a mnemonic phrase.
 *
 * @param {object} options - Options.
 * @param {string} options.mnemonic - The BIP39 mnemonic phrase.
 * @param {string} [options.path] - Derivation path (default: m/49'/60'/0'/0/0).
 *
 * @returns {object} Wallet object with address, privateKey, publicKey, path.
 */
export function walletFromMnemonic({
  mnemonic,
  path = DEFAULT_DERIVATION_PATH
} = {}) {
  // ethers.js validates mnemonic internally, throws if invalid
  const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);

  return {
    address: hdNode.address,
    privateKey: hdNode.privateKey,
    publicKey: hdNode.publicKey,
    derivationPath: path,
    mnemonic
  };
}
