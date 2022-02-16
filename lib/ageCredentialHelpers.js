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
  const t0 = performance.now();

  // get age verification VC, which has a refresh service expressed in it
  const queryResults = await credentialStore.remote.find({
    query: {
      bundledBy: ageVerificationContainerId,
      type: 'AgeVerificationCredential'
    },
    options: {limit: 1}
  });

  if(queryResults.documents.length === 0) {
    const error = new Error(
      'Could not reissue age verification credentials; age verification ' +
      'credential not found.');
    error.name = 'NotFoundError';
    throw error;
  }

  const {documents: [{content: ageVerificationCredential}]} = queryResults;

  // FIXME: assert `ageVerificationCredential`

  // FIXME: auto-refresh should be generalized

  // empty post to refresh service to get interaction URL
  const {refreshService: {url}} = ageVerificationCredential;
  const {data: vpr} = await httpClient.post(url);

  // FIXME: assert `vpr` response data

  // get service endpoint
  const {serviceEndpoint} = vpr.interact.service[0];

  // FIXME: determine VCs to be sent based on `vpr`; current code presumes
  // what to send

  // wrap ageVerificationCredential in verifiable presentation (VP)
  const verifiablePresentation = vc.createPresentation({
    verifiableCredential: ageVerificationCredential
  });

  // send VP to reissue workflow service endpoint
  const {data: vp} = await httpClient.post(serviceEndpoint, {
    json: {verifiablePresentation}
  });

  // FIXME: assert `vp` response data

  // get reissued credentials
  const {verifiableCredential: credentials} = vp;

  try {
    // add credentials to storage
    await credentialStore.add({credentials});

    // delete old container credential (and everything it bundled)
    await credentialStore.delete({id: ageVerificationContainerId});
  } catch(e) {
    // FIXME: throw error?
    console.log(e);
  }

  const t1 = performance.now();
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
