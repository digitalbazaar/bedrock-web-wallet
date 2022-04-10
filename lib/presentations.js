/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/web';
import {documentLoader} from './documentLoader.js';
import {profileManager} from './state.js';
import {supported as supportedSuites} from './cryptoSuites.js';
import vc from '@digitalbazaar/vc';

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
  let Suite;
  if(acceptedProofTypes) {
    for(const {name} of acceptedProofTypes) {
      Suite = supportedSuites.get(name);
      if(Suite) {
        break;
      }
    }
  }
  // if no suite chosen yet, use default
  if(!Suite) {
    Suite = supportedSuites.get(config.wallet.defaults.signatureSuite);
  }

  return vc.signPresentation({
    presentation,
    documentLoader,
    domain,
    challenge,
    suite: new Suite({signer})
  });
}
