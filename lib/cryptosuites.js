/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc. All rights reserved.
 */
import {DataIntegrityProof} from '@digitalbazaar/data-integrity';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {
  cryptosuite as eddsaRdfc2022CryptoSuite
} from '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';

export const supportedSuites = new Map([
  ['Ed25519Signature2020', ({signer}) => new Ed25519Signature2020({signer})],
  [eddsaRdfc2022CryptoSuite.name, _createEddsaRdfc2022Suite]
]);
export const supported = supportedSuites;

function _createEddsaRdfc2022Suite({signer}) {
  // remove milliseconds precision
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const cryptosuite = eddsaRdfc2022CryptoSuite;
  return new DataIntegrityProof({signer, date, cryptosuite});
}
