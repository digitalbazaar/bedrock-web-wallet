/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
// TODO: Later figure out the right place for this config.

/**
 * Default derivation path for Ethereum-compatible wallets.
 * BIP-49 path: m/49'/60'/0'/0/0
 * - 49' = BIP-49 (used for USBC/Omnumi compatibility).
 * - 60' = Ethereum coin type.
 * - 0' = account.
 * - 0 = change (external).
 * - 0 = address index.
 */
export const DEFAULT_DERIVATION_PATH = 'm/49\'/60\'/0\'/0/0';

/**
 * Default mnemonic strength (128 bits = 12 words).
 */
export const DEFAULT_MNEMONIC_STRENGTH = 128;
