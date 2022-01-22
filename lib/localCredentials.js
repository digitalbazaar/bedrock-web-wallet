/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {caches, profileManager} from './state.js';
import {config} from './config';
import {getProfileEdv} from './credentialStorageHelpers.js';
import {LocalVerifiableCredentialStore} from 'bedrock-web-local-vc-store';
import pMap from 'p-map';

export async function getLocalVcStore({profileId}) {
  return caches.localProfileVcStores.memoize({
    key: 'profile-' + profileId,
    fn: () => _initLocalVcStore({profileId})
  });
}

export async function getLocalDisplayableCredentials({profileId}) {
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
    const localVcStore = await getLocalVcStore({profileId: id});
    const credentialRecords = await localVcStore.find({displayable: true});
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

export async function getLocalCredentialsByType({profileId, type, parentId}) {
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
    const localVcStore = await getLocalVcStore({profileId: id});
    let credentialRecords;
    if(parentId) {
      credentialRecords = await localVcStore.find({type, parentId});
    } else {
      credentialRecords = await localVcStore.find({type});
    }
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

export async function queryLocalCredentials({profileId, query}) {
  let ids;
  if(!profileId) {
    const profiles = await profileManager.getProfiles();
    ids = profiles.map(({id}) => id);
  } else if(typeof profileId === 'string') {
    ids = [profileId];
  } else if(Array.isArray(profileId)) {
    ids = profileId;
  } else {
    throw new Error('"profileId" is not a string or an array.');
  }
  // get all verifiable credential docs for the credential subject
  const credentials = await pMap(
    ids,
    async id => {
      const localVcStore = await getLocalVcStore({profileId: id});
      return localVcStore.match({query});
    },
    {concurrency: 5});
  // flatten results
  return credentials.reduce((acc, val) => acc.concat(val), []);
}

async function _initLocalVcStore({profileId}) {
  const {credentials} = config.DEFAULT_EDVS;
  const {
    edv,
    invocationSigner
  } = await getProfileEdv({
    profileId,
    referenceIdPrefix: credentials
  });
  return new LocalVerifiableCredentialStore({
    dbName: 'wallet-vcs', edv, invocationSigner, profileId
  });
}
