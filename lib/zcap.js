/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {CapabilityDelegation} from '@digitalbazaar/zcapld';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import jsigs from 'jsonld-signatures';
import {securityDocumentLoader} from './documentLoader.js';

const {sign} = jsigs;

export const delegate = async ({zcap, signer, capabilityChain}) => {
  capabilityChain =
    Array.isArray(capabilityChain) ? capabilityChain : [zcap.parentCapability];
  // attach capability delegation proof
  return sign(zcap, {
    // TODO: map `signer.type` to signature suite
    documentLoader: securityDocumentLoader,
    purpose: new CapabilityDelegation({
      capabilityChain
    }),
    suite: new Ed25519Signature2020({signer})
  });
};
