/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {DataIntegrityProof} from '@digitalbazaar/data-integrity';
import {
  cryptosuite as ecdsaRdfc2019Cryptosuite
} from '@digitalbazaar/ecdsa-rdfc-2019-cryptosuite';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {
  cryptosuite as eddsaRdfc2022CryptoSuite
} from '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';

export const supportedSuites = new Map([
  ['Ed25519Signature2020', ({signer}) => new Ed25519Signature2020({signer})],
  [ecdsaRdfc2019Cryptosuite.name, _createEcdsaRdfc2019Suite],
  [eddsaRdfc2022CryptoSuite.name, _createEddsaRdfc2022Suite]
]);
export const supported = supportedSuites;

function _createEcdsaRdfc2019Suite({signer}) {
  // remove milliseconds precision
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const cryptosuite = ecdsaRdfc2019Cryptosuite;
  return new DataIntegrityProof({signer, date, cryptosuite});
}

function _createEddsaRdfc2022Suite({signer}) {
  // remove milliseconds precision
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const cryptosuite = eddsaRdfc2022CryptoSuite;
  return new DataIntegrityProof({signer, date, cryptosuite});
}
