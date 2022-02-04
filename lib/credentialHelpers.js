/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as vpqr from '@digitalbazaar/vpqr';
import {config} from 'bedrock-web';
import {documentLoader, securityDocumentLoader} from './documentLoader.js';
// FIXME: remove
import {
  getRemoteCredentialsByType,
  getRemoteDisplayableCredentials,
  getRemoteVcStore,
  queryRemoteCredentials
} from './remoteCredentials.js';
// FIXME: remove
import {
  getLocalCredentialsByType,
  getLocalDisplayableCredentials,
  getLocalVcStore,
  queryLocalCredentials
} from './localCredentials.js';
import {httpClient} from '@digitalbazaar/http-client';
import pMap from 'p-map';
import pLimit from 'p-limit';
import {profileManager} from './state.js';
import {suites} from './cryptoSuites.js';
import uuid from 'uuid-random';
import vc from '@digitalbazaar/vc';

const vpTemplate = {
  '@context': 'https://www.w3.org/2018/credentials/v1',
  type: 'VerifiablePresentation'
};

export const hiddenCredentialTypes = new Map([
  ['PersonalPhotoCredential', true],
  ['OverAgeTokenCredential', true],
  ['AgeVerificationCredential', true]
]);

export const bundleCredentialTypes = new Map([
  ['AgeVerificationContainerCredential', true]
]);

export async function signPresentation({
  challenge, domain, presentation, profileId, suite, supportedProofTypes
} = {}) {
  // FIXME: the profile signer needs to be compatible with the selected
  // proof types; this must be selected *after* selecting a suite
  const {
    invocationSigner: signer
  } = await profileManager.getProfileSigner({profileId});

  // pick a suite from the supported proof types
  if(!suite && supportedProofTypes) {
    supportedProofTypes = Array.isArray(supportedProofTypes) ?
      supportedProofTypes : [supportedProofTypes];
    const types = supportedProofTypes.map(t => t.name);
    for(const suiteType of types) {
      const Suite = suites.get(suiteType);
      if(Suite) {
        suite = new Suite({signer});
        break;
      }
    }
  }
  // if no suite chosen yet, use default
  if(!suite) {
    const suiteType = config.wallet.defaultSignatureSuite;
    const Suite = suites.get(suiteType);
    suite = new Suite({signer});
  }
  return vc.signPresentation({
    presentation,
    documentLoader,
    domain,
    challenge,
    suite
  });
}

export async function storeAllCredentials({credentials, holder}) {
  const remoteVcStore = await getRemoteVcStore({profileId: holder});
  const localVcStore = await getLocalVcStore({profileId: holder});
  const containerCredential = credentials.find(c => {
    return c.type.includes('AgeVerificationContainerCredential');
  });
  let parentId;
  if(containerCredential) {
    parentId = containerCredential.id;
  }
  const promises = [];
  for(const credential of credentials) {
    const record = createMetaData({
      parentId,
      credential,
      credentials
    });
    promises.push(addCredential({
      credential: record.credential,
      localVcStore,
      meta: record.meta,
      remoteVcStore
    }).catch(err => err));
  }
  const results = await Promise.all(promises);
  const criticalErrors = [];
  results.map((result, index) => {
    if(result instanceof Error) {
      if(result.name === 'DuplicateError') {
        result.message = 'Duplicate Error: This credential already exists in' +
        ' your wallet.';
        // FIXME: return this error and display to the user; customers using
        // the wallet need feedback when developing
        console.error('Duplicate Error', {
          error: result,
          credential: credentials[index]
        });
        return;
      }
      criticalErrors.push({error: result, credential: credentials[index]});
    }
  });
  if(criticalErrors.length > 0) {
    throw criticalErrors;
  }
}

function createMetaData({credential, credentials, parentId}) {
  const displayable = !_hasTypeIn({credential, typeMap: hiddenCredentialTypes});
  const meta = {displayable, parentId: null};
  const bundle = _hasTypeIn({credential, typeMap: bundleCredentialTypes});
  if(bundle) {
    meta.linkedCredentialIds = createLinkedCredentials({
      credential, credentials
    });
  }
  if(credential.type.includes('OverAgeTokenCredential') && parentId) {
    const issuer = _getAgeVerifcationContainerIssuer({credentials});
    meta.parentId = parentId;
    meta.container = {
      name: 'Over Age Token Credential',
      description: 'The Over Age Token Credential can be used to prove that ' +
        'you are over a particular age.',
      issuer
    };
  }
  return {credential, meta};
}

function _getAgeVerifcationContainerIssuer({credentials}) {
  const {issuer} = credentials.find(credential =>
    credential.type.includes('AgeVerificationContainerCredential'));
  return issuer;
}

function createLinkedCredentials({credential, credentials}) {
  if(credential.type.includes('AgeVerificationContainerCredential')) {
    const linkedCredentialIds = [];
    const linkedCredentialTypes = new Map([
      ['PersonalPhotoCredential', true],
      ['AgeVerificationCredential', true]
    ]);
    for(const cred of credentials) {
      const linkedCredential = _hasTypeIn({
        credential: cred, typeMap: linkedCredentialTypes
      });
      if(linkedCredential) {
        linkedCredentialIds.push(cred.id);
      }
    }
    return linkedCredentialIds;
  }
}

export async function getLinkedCredentials({id, profileId}) {
  const ids = [];
  const localVcStore = await getLocalVcStore({profileId});
  const containerVc = await localVcStore.get({id});
  const tokenRecords = await getLocalCredentialsByType({
    profileId, type: 'OverAgeTokenCredential', parentId: containerVc.content.id
  });
  for(const tokenRecord of tokenRecords) {
    ids.push(tokenRecord.credential.id);
  }
  ids.push(...containerVc.meta.linkedCredentialIds);
  return ids;
}

export async function createCompactBundledCredentials({credentials}) {
  const credentialsList = [];
  const visibleCredentials = JSON.parse(JSON.stringify(credentials))
    .filter(credential => {
      return !_hasTypeIn({credential, typeMap: hiddenCredentialTypes});
    });
  for(const credential of visibleCredentials) {
    const bundle = _hasTypeIn({credential, typeMap: bundleCredentialTypes});
    if(bundle) {
      if(credential.type.includes('AgeVerificationContainerCredential')) {
        credential.credentialSubject = await createAgeCredential({
          bundledCredentials: credentials, compact: true
        });
      }
    }
    credentialsList.push(credential);
  }
  return credentialsList;
}

export async function createBundledCredential({credentialRecord}) {
  const credential = JSON.parse(JSON
    .stringify(credentialRecord.credential));
  const profileId = credentialRecord.meta.holder;
  const localVcStore = await getLocalVcStore({profileId});

  const bundledCredentials = await pMap(
    credentialRecord.meta.linkedCredentialIds,
    async id => (await localVcStore.get({id})).content,
    {concurrency: 5});

  if(credential.type.includes('AgeVerificationContainerCredential')) {
    const parentId = credential.id;
    credential.credentialSubject = await createAgeCredential({
      bundledCredentials, parentId, profileId
    });
  }
  return credential;
}

async function createAgeCredential({
  bundledCredentials, parentId, profileId, compact = false
}) {
  const newCredentialSubject = {};
  let tokenCount = 0;
  for(const credential of bundledCredentials) {
    if(compact && credential.type.includes('OverAgeTokenCredential')) {
      tokenCount += 1;
      continue;
    }
    if(credential.type.includes('PersonalPhotoCredential')) {
      newCredentialSubject.image = credential.credentialSubject.image;
      continue;
    }
    if(credential.type.includes('AgeVerificationCredential')) {
      newCredentialSubject.overAge = credential.credentialSubject
        .overAge;
      continue;
    }
  }
  if(!compact) {
    const localVcStore = await getLocalVcStore({profileId});
    const credentialRecords = await localVcStore.find({parentId});
    const localTokenVcs = credentialRecords.map(({content}) => content);
    tokenCount = localTokenVcs.length;
    const qr = {};
    if(!qr.url) {
      qr.id = localTokenVcs[0].id;
      qr.url = await generateQrCodeDataUrl({signedVc: localTokenVcs[0]});
      if(tokenCount === 1) {
        await reissue({
          cidTokenVc: localTokenVcs[0], parentId, profileId
        });
      }
    }
    newCredentialSubject.qr = qr;
  }
  newCredentialSubject.concealedIdTokenCount = tokenCount;
  return newCredentialSubject;
}

async function reissue({
  cidTokenVc = null, parentId, profileId, remoteAvRecord = null
}) {
  const t0 = performance.now();
  console.log('Start Reissue call.');
  let localAvContainerRecord;
  let remoteAvContainerRecord;
  let containerMeta;
  let ageVerificationCredential;
  let ageVerificationCredentialMeta;
  if(!remoteAvRecord) {
    const localVcStore = await getLocalVcStore({profileId});
    const {content, meta} = await localVcStore.get({
      id: parentId
    });
    localAvContainerRecord = {meta, credential: content};
    containerMeta = localAvContainerRecord.meta;
    const localAvRecord = await localVcStore.get({
      id: localAvContainerRecord.credential.credentialSubject.id
    });
    ageVerificationCredential = localAvRecord.content;
    ageVerificationCredentialMeta = localAvRecord.meta;
    [remoteAvContainerRecord] = await getRemoteCredentialsByType({
      profileId, type: 'AgeVerificationContainerCredential'
    });
  } else {
    remoteAvContainerRecord = remoteAvRecord;
    containerMeta = remoteAvRecord.meta;
    containerMeta.displayable = true;
    const remoteVcStore = await getRemoteVcStore({profileId});
    const newRemoteAvRecord = await remoteVcStore.get({
      id: remoteAvRecord.credential.credentialSubject.id
    });
    ageVerificationCredential = newRemoteAvRecord.content;
    ageVerificationCredentialMeta = newRemoteAvRecord.meta;
  }

  // wrap ageVerificationCredential in VP
  const ageVerificationPresentation = vc.createPresentation({
    verifiableCredential: ageVerificationCredential
  });

  // reissue tokens
  const {url: refreshServiceUrl} = ageVerificationCredential.refreshService;
  const refreshServiceResult = await httpClient.post(refreshServiceUrl);

  const {serviceEndpoint} = refreshServiceResult.data.interact.service[0];

  const serviceEndpointResult = await httpClient.post(
    serviceEndpoint, {
      json: {verifiablePresentation: ageVerificationPresentation}
    });

  // add credentials
  const verifiableCredentials = serviceEndpointResult.data.verifiableCredential;
  const remoteVcStore = await getRemoteVcStore({profileId});
  const localVcStore = await getLocalVcStore({profileId});
  const limit = pLimit(5);
  const promises = [];
  let newAvContainer;
  for(const vc of verifiableCredentials) {
    if(vc.type.includes('AgeVerificationContainerCredential')) {
      newAvContainer = vc;
      promises.push(limit(() => addCredential({
        credential: vc,
        localVcStore,
        meta: containerMeta,
        remoteVcStore
      })));
    }
    if(vc.type.includes('AgeVerificationCredential')) {
      const hasAvVcId = containerMeta.linkedCredentialIds
        .includes(ageVerificationCredential.id);
      if(hasAvVcId) {
        const index = containerMeta.linkedCredentialIds
          .findIndex(i => i === ageVerificationCredential.id);
        containerMeta.linkedCredentialIds.splice(index, 1);
        containerMeta.linkedCredentialIds.push(vc.id);
      }
      promises.push(limit(() => addCredential({
        credential: vc,
        localVcStore,
        meta: ageVerificationCredentialMeta,
        remoteVcStore
      })));
    }
    if(vc.type.includes('OverAgeTokenCredential')) {
      const record = createMetaData({
        credential: vc,
        credentials: [newAvContainer],
        parentId: newAvContainer.id});
      promises.push(limit(() => addCredential({
        credential: record.credential,
        localVcStore,
        meta: record.meta
      })));
    }
  }

  // delete credentials that were replaced with reissued ones
  if(localAvContainerRecord) {
    promises.push(limit(() => localVcStore.delete({
      id: cidTokenVc.id
    })));
    promises.push(limit(() => localVcStore.delete({
      id: parentId
    })));
    promises.push(limit(() => localVcStore.delete({
      id: ageVerificationCredential.id
    })));
  }
  promises.push(limit(() => remoteVcStore.delete({
    id: remoteAvContainerRecord.credential.id
  })));
  promises.push(limit(() => remoteVcStore.delete({
    id: ageVerificationCredential.id
  })));

  try {
    await Promise.all(promises);
  } catch(e) {
    console.log(e);
  }
  const t1 = performance.now();
  console.log('Reissue call took ' + (t1 - t0) + ' milliseconds.');
}

export async function getRecords({query, profileId}) {
  // Clone is done here to prevent Vue from calling the function multiple times
  // due to "query" being set inside of a computed function.
  const queryClone = JSON.parse(JSON.stringify(query));
  const type = queryClone.credentialQuery.example.type;
  const records = [];
  if(type.includes('OverAgeTokenCredential')) {
    queryClone.credentialQuery.example.type = 'OverAgeTokenCredential';
    const results = await queryLocalCredentials({query: queryClone, profileId});
    // adds only the first OverAgeTokenCredential to records array
    records.push(results[0]);
    // removes local credential from type in query
    const index = type.indexOf('OverAgeTokenCredential');
    type.splice(index, 1);
    queryClone.credentialQuery.example.type = type;
  }
  if(type.length === 0) {
    return records;
  }
  const results = await queryRemoteCredentials({query: queryClone, profileId});
  records.push(...results);
  return records;
}

export function createContainers({records}) {
  const recordsClone = JSON.parse(JSON.stringify(records));
  const credentials = [];
  for(const record of recordsClone) {
    const type = record.content.type;
    if(type.includes('OverAgeTokenCredential')) {
      record.content.name = record.meta.container.name;
      record.content.description = record.meta.container.description;
      record.content.issuer = record.meta.container.issuer;
      credentials.push(record.content);
      continue;
    }
    credentials.push(record.content);
  }
  return credentials;
}

export async function deleteCredentialBundle({id, profileId, credentialStore}) {
  try {
    // get list of credential ids related to container
    const idList = await getLinkedCredentials({id, profileId});
    // note: this code is currently specific to AV credentials and will
    // need to be updated to become more general in the future
    const avContainerId = id;
    const avId = idList.pop();

    const promises = [];
    for(const id of idList) {
      promises.push(credentialStore.deleteCredential({id}));
    }
    promises.push(credentialStore.deleteCredential({id: avId}));
    const results = await Promise.allSettled(promises);

    const rejected = [];
    for(const index in results) {
      if(results[index].status === 'rejected') {
        rejected.push(results[index]);
      }
    }

    if(rejected.length === 1) {
      throw rejected[0].reason;
    }

    if(rejected.length > 1) {
      const e = new Error('Multiple errors.');
      e.name = 'AggregateError';
      e.errors = rejected.map(({reason}) => reason);
      throw e;
    }

    await credentialStore.deleteCredential({id: avId});
    await credentialStore.deleteCredential({id: avContainerId});
  } catch(e) {
    const error = new Error(
      `The container credential with ID "${id}" could not be deleted.`);
    error.name = 'OperationError';
    error.cause = e;
    throw error;
  }
}

async function generateQrCodeDataUrl({signedVc}) {
  const vp = JSON.parse(JSON.stringify(vpTemplate));
  vp.verifiableCredential = signedVc;
  const {imageDataUrl} = await vpqr.toQrCode({
    vp, documentLoader: securityDocumentLoader, size: 3
  });
  return imageDataUrl;
}

export async function addCredential({
  credential, localVcStore, meta, remoteVcStore
}) {
  if(credential.type.includes('OverAgeTokenCredential')) {
    return localVcStore.insert({credential, meta});
  }
  if(credential.type.includes('AgeVerificationContainerCredential')) {
    await localVcStore.insert({credential, meta});
    const updatedMeta = JSON.parse(JSON.stringify(meta));
    updatedMeta.displayable = false;
    return remoteVcStore.insert({credential, meta: updatedMeta});
  }
  if(credential.type.includes('PersonalPhotoCredential') || credential.type
    .includes('AgeVerificationCredential')) {
    if(remoteVcStore) {
      await remoteVcStore.insert({credential, meta});
    }
    return localVcStore.insert({credential, meta});
  }
  return remoteVcStore.insert({credential, meta});
}

export function createCredential(
  {name, description, type, issuer, claim}) {
  const exampleBaseUri = 'https://wallet.example.com';
  let types = ['VerifiableCredential'];
  if(typeof type === 'string') {
    types.push(type);
  } else if(Array.isArray(type)) {
    types = types.concat(type);
  } else {
    throw new TypeError('"type" must be a string or an array.');
  }
  return {
    '@context': [
      'https://w3id.org/credentials/v1',
      'https://example.com/examples/v1' // FIXME: Set to real context
    ],
    id: `${exampleBaseUri}/credentials/${uuid()}`,
    type: types,
    name,
    description,
    issuer,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      ...claim
    },
    proof: {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      verificationMethod: `${exampleBaseUri}/${uuid()}/keys/1`,
      proofValue: 'z3MvGcVxzRzzpKF1HA11EjvfPZsN8NAb7kXBRfeTm3CBg2gcJLQM' +
        '5hZNmj6Ccd9Lk4C1YueiFZvkSx4FuHVYVouQk'
    }
  };
}

export async function getLogo() {
  //FIXME: Get profile/organization logo
  return null;
}

export function getFilterIcon(type) {
  if(type === 'Person') {
    return 'fas fa-user-circle';
  }
  if(type === 'Organization') {
    return 'fas fa-building';
  }
  if(type === 'All Credentials') {
    return 'fas fa-credit-card';
  }
}

export async function ensureLocalCredentials({
  credentials = [], remoteCredentials = [], localCredentials = null, profiles
}) {
  const profileIds = profiles.map(({id}) => id);

  // check for AV
  let localAvRecord;
  if(localCredentials) {
    localAvRecord = localCredentials.find(record => record.credential
      .type.includes('AgeVerificationContainerCredential'));
  } else {
    [localAvRecord] = await getLocalCredentialsByType({
      profileId: profileIds, type: 'AgeVerificationContainerCredential'
    });
  }
  const [remoteAvRecord] = await getRemoteCredentialsByType({
    profileId: profileIds, type: 'AgeVerificationContainerCredential'
  });

  if(!localAvRecord && remoteAvRecord) {
    // reissue tokens
    const parentId = remoteAvRecord.credential.id;
    const profileId = remoteAvRecord.meta.holder;
    await reissue({parentId, profileId, remoteAvRecord});
    const localVcStore = await getLocalVcStore({profileId});
    const types = ['PersonalPhotoCredential', 'AgeVerificationCredential'];
    const additionalRecords = await pMap(
      types,
      async type => getRemoteCredentialsByType({profileId, type}),
      {concurrency: 5});
    await pMap(
      additionalRecords,
      async ([record]) => addCredential({
        credential: record.credential,
        localVcStore,
        meta: record.meta
      }),
      {concurrency: 5});
    localCredentials = await getLocalDisplayableCredentials({
      profileId: profileIds
    });
  }
  credentials.push(remoteCredentials);
  credentials.push(localCredentials);
  return credentials.reduce((acc, val) => acc.concat(val), []);
}

export async function getAllDisplayableCredentials(profiles) {
  if(profiles && Array.isArray(profiles) && profiles.length > 0) {
    const credentials = [];
    const profileIds = profiles.map(({id}) => id);
    const remoteCredentials = await getRemoteDisplayableCredentials({
      profileId: profileIds
    });
    const localCredentials = await getLocalDisplayableCredentials({
      profileId: profileIds
    });
    return ensureLocalCredentials({
      credentials, remoteCredentials, localCredentials, profiles
    });
  }
  return [];
}

export async function sortCredentials(arr) {
  return arr.sort((a, b) => {
    const timestampA = getCredentialTimestamp(a);
    const timestampB = getCredentialTimestamp(b);
    if(timestampA < timestampB) {
      return -1;
    }
    if(timestampA > timestampB) {
      return 1;
    }
    return 0;
  });

}

function getCredentialTimestamp(credential) {
  const {validFrom, issuanceDate, proof} = credential;
  if(validFrom) {
    return validFrom;
  }
  if(issuanceDate) {
    return issuanceDate;
  }
  if(proof && typeof proof === 'object') {
    const proofs = Array.isArray(proof) ? proof : [proof];
    const [earliestProof] = proofs.sort((a, b) => {
      if(a.created < b.created) {
        return -1;
      }
      if(a.created > b.created) {
        return 1;
      }
      return 0;
    });
    return earliestProof.created;
  }
  return '';
}

function _hasTypeIn({credential, typeMap}) {
  return credential.type.find(credType => typeMap.has(credType));
}
