/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from './config';
import {getProfileEdv} from './credentialStorageHelpers.js';
import {getProfiles} from './profileManager.js';
import {store as defaultStore} from 'bedrock-web-store';
import VerifiableCredentialStore from 'bedrock-web-vc-store';

export async function getRemoteVcStore({profileId}) {
  const remoteProfileVcStoreCache = await defaultStore.get({
    id: 'remoteProfileVcStoreCache'
  });
  return remoteProfileVcStoreCache.memoize({
    key: 'profile-' + profileId,
    fn: () => initRemoteVcStore({profileId})
  });
}

export async function initRemoteVcStore({profileId}) {
  const {credentials} = config.DEFAULT_EDVS;
  const {
    edv,
    invocationSigner
  } = await getProfileEdv({
    profileId,
    referenceIdPrefix: credentials
  });
  // FIXME: one of the profile's keys should be signing invocations; a
  // signer API that will invoke a profile key via WebKMS using the
  // capability agent must be constructed here
  return new VerifiableCredentialStore({edv, invocationSigner});
}

export async function getRemoteDisplayableCredentials({profileId}) {
  let ids = [];
  if(typeof profileId === 'string') {
    ids.push(profileId);
  } else if(Array.isArray(profileId)) {
    ids = ids.concat(profileId);
  } else {
    throw new TypeError('"profileId" must be a string or an array.');
  }
  // get all verifiable credential docs for the credential subject
  const results = ids.map(async id => {
    const remoteVcStore = await getRemoteVcStore({profileId: id});
    const credentialRecords = await remoteVcStore.find({
      query: {type: 'VerifiableCredential', displayable: true}
    });
    return credentialRecords.map(({meta, content}) => {
      meta.holder = id;
      return {
        meta,
        credential: content
      };
    });
  });

  const credentials = await Promise.all(results);
  // flatten results
  return credentials.reduce((acc, val) => acc.concat(val), []);
}

export async function getRemoteCredentialsByType({profileId, type}) {
  let ids = [];
  if(typeof profileId === 'string') {
    ids.push(profileId);
  } else if(Array.isArray(profileId)) {
    ids = ids.concat(profileId);
  } else {
    throw new TypeError('"profileId" must be a string or an array.');
  }
  // get all verifiable credential docs for the credential subject
  const results = ids.map(async id => {
    const remoteVcStore = await getRemoteVcStore({profileId: id});
    type = Array.isArray(type) ? type : [type];
    const query = type.map(type => ({type}));
    const credentialRecords = await remoteVcStore.find({query});
    return credentialRecords.map(({meta, content}) => {
      meta.holder = id;
      return {
        meta,
        credential: content
      };
    });
  });

  const credentials = await Promise.all(results);
  // flatten results
  return credentials.reduce((acc, val) => acc.concat(val), []);
}

export async function queryRemoteCredentials({profileId, query}) {
  let ids = [];
  if(!profileId) {
    const profiles = await getProfiles();
    ids = ids.concat(profiles.map(({id}) => id));
  } else if(typeof profileId === 'string') {
    ids.push(profileId);
  } else if(Array.isArray(profileId)) {
    ids = ids.concat(profileId);
  } else {
    throw new Error('"profileId" is not a string or an array.');
  }
  // get all verifiable credential docs for the credential subject
  const results = ids.map(async id => {
    const vcStore = await getRemoteVcStore({profileId: id});
    return vcStore.match({query});
  });
  const credentials = await Promise.all(results);
  // flatten results
  return credentials.reduce((acc, val) => acc.concat(val), []);
}
