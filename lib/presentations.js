/*!
 * Copyright (c) 2018-2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import {_checkSignerType} from './helpers.js';
import {config} from '@bedrock/web';
import {documentLoader} from './documentLoader.js';
import {profileManager} from './state.js';
import {supportedSuites} from './cryptoSuites.js';

export function pruneCredentialProofs({
  presentation, proofAllowList = []
} = {}) {
  // add configuration `proofAllowList` to `proofAllowList`
  const {presentations: {proofAllowList: configProofAllowList}} = config.wallet;
  proofAllowList = proofAllowList.concat(configProofAllowList);

  const credentials = presentation.verifiableCredential;
  if(!credentials) {
    // nothing to prune
    return;
  }

  const vcs = Array.isArray(credentials) ? credentials : [credentials];
  const pruned = vcs.map(
    credential => _pruneCredentialProofs({credential, proofAllowList}));

  if(Array.isArray(credentials)) {
    presentation.verifiableCredential = pruned;
  } else {
    presentation.verifiableCredential = pruned[0];
  }
}

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

function _pruneCredentialProofs({credential, proofAllowList}) {
  const {proof} = credential;
  if(!proof) {
    // nothing to prune
    return credential;
  }

  const proofs = Array.isArray(proof) ? proof : [proof];
  const allowed = [];
  for(const proof of proofs) {
    let added = false;
    for(const filter of proofAllowList) {
      // non-`DataIntegrity` type proof
      if(filter.type && (filter.type === proof.type)) {
        allowed.push(proof);
        added = true;
        break;
      }
      // `DataIntegrity` w/cryptosuite type proof
      if(filter.cryptosuite && (filter.cryptosuite === proof.cryptosuite)) {
        // either no `proofValuePrefix` constraints or `proofValue` must start
        // with `proofValuePrefix
        if(!filter.proofValuePrefix ||
          proof.proofValue?.startsWith(filter.proofValuePrefix)) {
          allowed.push(proof);
          added = true;
          break;
        }
      }
    }
    if(!added) {
      console.warn(
        'Removing disallowed proof prior to presentation', {credential, proof});
    }
  }

  if(Array.isArray(proofs)) {
    credential.proof = allowed;
  } else {
    credential.proof = allowed[0];
  }
  return credential;
}
