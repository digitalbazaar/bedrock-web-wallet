/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {CapabilityDelegation} from '@digitalbazaar/zcap';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import jsigs from 'jsonld-signatures';
import {securityDocumentLoader} from './documentLoader.js';

const {sign} = jsigs;

export const delegate = async ({zcap, signer, parentCapability}) => {
  // attach capability delegation proof
  return sign(zcap, {
    documentLoader: securityDocumentLoader,
    purpose: new CapabilityDelegation({
      parentCapability
    }),
    // TODO: map `signer.type` to signature suite
    suite: new Ed25519Signature2020({signer})
  });
};
