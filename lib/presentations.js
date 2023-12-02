/*!
 * Copyright (c) 2018-2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import {_checkSignerType} from './helpers.js';
import {config} from '@bedrock/web';
import {documentLoader} from './documentLoader.js';
import {ensureLocalCredentials} from './ageCredentialHelpers.js';
import {profileManager} from './state.js';
import {supportedSuites} from './cryptoSuites.js';

export async function deriveCredential({verifiableCredential} = {}) {
  // FIXME: implement
  throw new Error('Not implemented.');
}

// FIXME: implement
export async function match({
  credentialStore, verifiablePresentationRequest
} = {}) {
  // FIXME: get query from VPR
  const {query} = verifiablePresentationRequest;

  // ensures local credentials are made present on the device
  await ensureLocalCredentials({credentialStore});

  // FIXME: make query processor smarter; independent execution of multiple
  //   queries may result in duplicates
  // FIXME: use a p-fun library to properly handle concurrency and retries
  let records = await Promise.all(
    credentialQuery.map(query => _getRecords({query, profileId})));
  records = removeDuplicatesById({records: records.flat()});

  // FIXME: convert records into:
  // {meta, content, derived} ... or something similar that includes derived
  // credential, if any, from VPR specifics; do this in parallel with above
  return records;
}

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


// FIXME:

async function _getRecords({query, profileId}) {
  // FIXME: remove this extra clone, fix up
  // Clone is done here to prevent Vue from calling the function multiple times
  // due to "query" being set inside of a computed function.
  const vprQuery = JSON.parse(JSON.stringify(query));

  const credentialQuery = Array.isArray(vprQuery.credentialQuery) ?
    vprQuery.credentialQuery : [vprQuery.credentialQuery];

  // convert VPR query into local queries...
  const credentialStore = await getCredentialStore({
    // FIXME: determine how password will be provided / set; currently
    // set to `profileId`
    // FIXME: this code shouldn't be called in a component anyway
    profileId, password: profileId
  });

  // FIXME: all code here assumes a single `credentialQuery` of type
  //        `QueryByExample`
  const [firstCredentialQuery] = credentialQuery;
  const firstCredentialQueryExampleType = firstCredentialQuery.example.type;
  const records = [];
  if(firstCredentialQueryExampleType.includes('OverAgeTokenCredential')) {
    // query for *only* the over age token credential
    firstCredentialQuery.example.type = 'OverAgeTokenCredential';
    const {queries: [q]} = await credentialStore.local.convertVPRQuery({
      vprQuery
    });
    const {documents: results} = await credentialStore.local.find({
      // only return 1 over age token
      query: q, limit: 1
    });
    // adds only the first OverAgeTokenCredential to records array
    records.push(results[0]);

    // remove local credential from type in query and restore its value
    const index = firstCredentialQueryExampleType.indexOf(
      'OverAgeTokenCredential'
    );
    firstCredentialQueryExampleType.splice(index, 1);
    firstCredentialQuery.example.type = firstCredentialQueryExampleType;
  }
  if(firstCredentialQuery.example.type.length === 0) {
    return records;
  }
  const {queries: q} = await credentialStore.remote.convertVPRQuery({
    vprQuery
  });
  // FIXME: Flattened query should be removed. Must be able to process query
  //        as-is to properly apply and-or logic to results.
  const {documents: results} = await credentialStore.remote.find({
    // flatten the query: [[{type: A}], [{type: B}, {type: C}], [{type: D}]]
    //         into   =>  [{type: A}, {type: B}, {type: C}, {type: D}]
    // so that it can be processed by VerifiableCredentialStore.find()
    query: q.flat()
  });
  records.push(...results);
  // FIXME: Create a more generalized filter mechanism for vc search.
  return records.filter(openBadgeFilter({vprQuery}));
}

function openBadgeFilter({vprQuery}) {
  return ({content}) => {
    const {example} = vprQuery.credentialQuery;
    // eslint-disable-next-line max-len
    return example?.credentialSubject?.achievement?.id === content?.credentialSubject?.achievement?.id;
  };
}

// FIXME: maybe keep `createContainers` in bedrock-vue-wallet
async function createContainers({credentialStore, records}) {
  // FIXME: change this; it is hacky -- build virtual VCs instead somehow
  const recordsClone = JSON.parse(JSON.stringify(records));
  const credentials = [];
  let containerCredential;
  for(const record of recordsClone) {
    const type = record.content.type;
    if(type.includes('OverAgeTokenCredential')) {
      if(!containerCredential) {
        ({content: containerCredential} = await credentialStore.local.get({
          id: record.meta.bundledBy[0]
        }));
      }
      record.content.name = 'Over Age Token Credential';
      record.content.description =
        'This credential can be used to prove that you are over ' +
        'a particular age.';
      record.content.issuer = containerCredential.issuer;
      credentials.push(record.content);
      continue;
    }
    credentials.push(record.content);
  }
  return credentials;
}

function queryContainsType({credentialQuery, types}) {
  const results = credentialQuery.filter(q => types.includes(q.type));
  return results.length > 0;
}

function removeDuplicatesById({records}) {
  const ids = new Set();
  const results = [];

  for(const record of records) {
    const recordId = record.id;

    const found = ids.has(recordId);
    if(found) {
      continue;
    }

    ids.add(recordId);
    results.push(record);
  }

  return results;
}
