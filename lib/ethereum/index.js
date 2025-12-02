/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */

// Configuration exports
export {
  DEFAULT_DERIVATION_PATH,
  DEFAULT_MNEMONIC_STRENGTH
} from './config.js';

// Wallet generation exports
export {
  generateMnemonic,
  walletFromMnemonic
} from './wallet.js';

// Utility exports
export {
  isValidPrivateKey,
  isValidDerivationPath
} from './utils.js';
