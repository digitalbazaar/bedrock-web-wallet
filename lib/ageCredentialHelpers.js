/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as vpqr from '@digitalbazaar/vpqr';
import {httpClient} from '@digitalbazaar/http-client';
import {securityDocumentLoader} from './documentLoader.js';
import vc from '@digitalbazaar/vc';

const vpTemplate = {
  '@context': 'https://www.w3.org/2018/credentials/v1',
  type: 'VerifiablePresentation'
};

export async function generateQrCodeDataUrl({credential}) {
  const vp = JSON.parse(JSON.stringify(vpTemplate));
  vp.verifiableCredential = credential;
  const {imageDataUrl} = await vpqr.toQrCode({
    vp, documentLoader: securityDocumentLoader, size: 3
  });
  return imageDataUrl;
}

export async function reissue({
  ageVerificationContainerId, credentialStore
} = {}) {
  console.log('Start Reissue call.');
  const t0 = Date.now();

  // keep retrying reissue until remote VCs to refresh are exhausted; as soon
  // as the first is successful, break
  while(true) {
    const result = await _attemptReissue(
      {ageVerificationContainerId, credentialStore});
    const {success, credentials} = result;
    if(!success) {
      // non-fatal error, loop to try again
      continue;
    }

    // get updated age VC container to delete
    ({ageVerificationContainerId} = result);

    try {
      // add new credentials to storage
      await credentialStore.add({credentials});
    } catch(e) {
      console.log(e);
      // credential failed to be added, surface error
      throw e;
    }

    // delete old container credential (and everything it bundled)
    if(ageVerificationContainerId) {
      try {
        await credentialStore.delete({id: ageVerificationContainerId});
      } catch(e) {
        // non-fatal error, just log it
        console.log(e);
      }
    }

    break;
  }

  const t1 = Date.now();
  console.log('Reissue call took ' + (t1 - t0) + ' milliseconds.');
}

export async function ensureLocalCredentials({credentialStore} = {}) {
  // FIXME: determine how to handle multiple credential container results
  const {documents: localDocuments} = await credentialStore.local.find({
    query: {type: 'AgeVerificationContainerCredential'},
    options: {limit: 1}
  });

  let containerCredentialId;
  if(localDocuments.length > 0) {
    ([{content: {id: containerCredentialId}}] = localDocuments);
    // ensure there is at least one matching local over age token
    const results = await credentialStore.local.find({
      query: {
        type: 'OverAgeTokenCredential',
        bundledBy: containerCredentialId
      },
      options: {limit: 1}
    });
    if(results.documents.length > 0) {
      // at least one over age token available
      return;
    }
  }

  // insufficient local age verification credentials
  if(!containerCredentialId) {
    // no local container VC, get remote container VC
    const {documents: remoteDocuments} = await credentialStore.remote.find({
      query: {type: 'AgeVerificationContainerCredential'},
      options: {limit: 1}
    });
    if(remoteDocuments.length === 0) {
      // user has no usable age VC
      return;
    }
    ([{content: {id: containerCredentialId}}] = remoteDocuments);
  }

  // reissue age verification VC and tokens to store them locally
  try {
    await reissue({
      ageVerificationContainerId: containerCredentialId,
      credentialStore
    });
  } catch(e) {
    // log any errors and return
    console.log(e);
    return;
  }
}

async function _attemptReissue({
  ageVerificationContainerId, credentialStore
} = {}) {
  // get any remote age verification VC (there could be more than one and this
  // function just attempts to get one and work with it); this VC has a
  // refresh service expressed in it
  const ageVcResults = await credentialStore.remote.find({
    query: {
      type: 'AgeVerificationCredential'
    },
    options: {limit: 1}
  });

  if(ageVcResults.documents.length === 0) {
    // no age verification VCs at all, no way to refresh; fatal error, throw
    const error = new Error(
      'Could not reissue age verification credentials; age verification ' +
      'credential not found.');
    error.name = 'NotFoundError';
    throw error;
  }

  const {documents: [{content: ageVerificationCredential}]} = ageVcResults;

  // FIXME: auto-refresh should be generalized

  // empty post to refresh service to start getting interaction URL
  const {refreshService: {url}} = ageVerificationCredential;
  const getInteractionVprPromise = httpClient.post(url);

  // FIXME: assert `vpr` response data

  // get bundling container VC if not previously given -- to ensure it is
  // deleted once the refresh occurs
  // FIXME: assert remote VC is bundled
  const {documents: [{meta: {bundledBy}}]} = ageVcResults;
  const remoteContainerId = bundledBy[0];
  if(!ageVerificationContainerId) {
    ageVerificationContainerId = remoteContainerId;
  } else {
    // if specified container VC is different from the remote one, delete the
    // specified one (as it is to be replaced) and use and refresh the remote
    // bundle; this can happen if multiple devices have refreshed
    if(remoteContainerId && remoteContainerId !== ageVerificationContainerId) {
      try {
        await credentialStore.delete({id: ageVerificationContainerId});
      } catch(e) {
        // non-fatal error, just log it and continue
        console.log(e);
      }
      ageVerificationContainerId = remoteContainerId;
    }
  }

  // FIXME: assert `ageVerificationCredential`

  // FIXME: potential optimization targets with making some of these calls
  // concurrent

  // get bundled photo credential concurrently to ensure it gets bundled with
  // the newly reissued age verification VC
  const photoVcResults = await credentialStore.remote.find({
    query: {
      bundledBy: ageVerificationCredential.id,
      type: 'PersonalPhotoCredential'
    },
    options: {limit: 1}
  });

  if(photoVcResults.documents.length === 0) {
    // log error, do not throw
    const error = new Error(
      'Could not reissue age verification credentials; personal photo ' +
      'credential not found.');
    error.name = 'NotFoundError';
    console.log(error);

    // without a photo, the age verification VC is useless / corrupt, delete
    // it and then return failure; allow delete to throw to break any
    // looping behavior on this VC -- should not happen if retried again
    await credentialStore.delete({id: ageVerificationCredential.id});
    ageVerificationContainerId = null;
    return {success: false, credentials: null, ageVerificationContainerId};
  }

  const {documents: [{content: photoCredential}]} = photoVcResults;

  // get service endpoint
  const {data: vpr} = await getInteractionVprPromise;
  const {serviceEndpoint} = vpr.interact.service[0];

  // FIXME: determine VCs to be sent based on `vpr`; current code presumes
  // what to send

  // wrap ageVerificationCredential in verifiable presentation (VP)
  const verifiablePresentation = vc.createPresentation({
    verifiableCredential: ageVerificationCredential
  });

  // send VP to reissue workflow service endpoint
  try {
    const {data: vp} = await httpClient.post(serviceEndpoint, {
      json: {verifiablePresentation}
    });

    // FIXME: assert `vp` response data

    // get reissued credentials
    const {verifiableCredential: credentials} = vp;

    // ensure photo credential gets rebundled with the new VCs
    credentials.push(photoCredential);
    return {success: true, credentials, ageVerificationContainerId};
  } catch(e) {
    if(e.status !== 403) {
      throw e;
    }

    // reissue is not allowed, age VC container is invalid, delete and fail;
    // allow delete to throw to prevent tight loops -- should not occur if
    // retried
    await credentialStore.delete({id: ageVerificationContainerId});
    ageVerificationContainerId = null;
    return {success: false, credentials: null, ageVerificationContainerId};
  }
}
