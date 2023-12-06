/*!
 * Copyright (c) 2020-2023 Digital Bazaar, Inc. All rights reserved.
 */
import {DataIntegrityProof} from '@digitalbazaar/data-integrity';
import {Ed25519Signature2018} from '@digitalbazaar/ed25519-signature-2018';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {
  cryptosuite as eddsa2022CryptoSuite
} from '@digitalbazaar/eddsa-2022-cryptosuite';
import {
  cryptosuite as eddsaRdfc2022CryptoSuite
} from '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';

export const supportedSuites = new Map([
  ['Ed25519Signature2018', ({signer}) => new Ed25519Signature2018({signer})],
  ['Ed25519Signature2020', ({signer}) => new Ed25519Signature2020({signer})],
  [eddsa2022CryptoSuite.name, _createEddsa2022Suite],
  [eddsaRdfc2022CryptoSuite.name, _createEddsaRdfc2022Suite]
]);
export const supported = supportedSuites;

function _createEddsa2022Suite({signer}) {
  // remove milliseconds precision
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const cryptosuite = eddsa2022CryptoSuite;
  return new DataIntegrityProof({
    signer, date, cryptosuite, legacyContext: true
  });
}

function _createEddsaRdfc2022Suite({signer}) {
  // remove milliseconds precision
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const cryptosuite = eddsaRdfc2022CryptoSuite;
  return new DataIntegrityProof({signer, date, cryptosuite});
}
