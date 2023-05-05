/*!
 * Copyright (c) 2018-2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import {_checkSignerType} from './helpers.js';
import {config} from '@bedrock/web';
import {documentLoader} from './documentLoader.js';
import {profileManager} from './state.js';
import {supportedSuites} from './cryptoSuites.js';

export async function sign({
  challenge, domain, presentation, profileId, acceptedProofTypes
} = {}) {
  // FIXME: profile signer needs to be selected based on `acceptedProofTypes`,
  // so this needs to be passed into `getProfileSigner`; until then, the
  // signer `type` should be checked against `acceptedProofTypes` and rejected
  // if there's no match
  const {
    invocationSigner: signer
  } = await profileManager.getProfileSigner({profileId});

  // pick a suite from the accepted proof types
  let suite;

  if(Array.isArray(acceptedProofTypes) && acceptedProofTypes.length > 0) {
    // Check if the signer type is in the acceptedProofTypes
    _checkSignerType({acceptedProofTypes, signer});
    for(const {name} of acceptedProofTypes) {
      suite = supportedSuites.get(name);
      if(suite) {
        break;
      }
    }
  }
  // if no suite chosen yet, use default
  if(!suite) {
    suite = supportedSuites.get(config.wallet.defaults.signatureSuite);
  }

  return vc.signPresentation({
    presentation,
    documentLoader,
    domain,
    challenge,
    suite: suite({signer})
  });
}
