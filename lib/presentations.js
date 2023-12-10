/*!
 * Copyright (c) 2018-2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import {_checkSignerType} from './helpers.js';
import {config} from '@bedrock/web';
import {documentLoader} from './documentLoader.js';
import {ensureLocalCredentials} from './ageCredentialHelpers.js';
import jsonpointer from 'json-pointer';
import {profileManager} from './state.js';
import {supportedSuites} from './cryptoSuites.js';

// FIXME: implement
export async function match({
  credentialStore, verifiablePresentationRequest
} = {}) {
  if(!(verifiablePresentationRequest?.query && credentialStore)) {
    // nothing to match against
    return [];
  }

  // ensures local credentials are made present on the device
  await ensureLocalCredentials({credentialStore});

  // get query from VPR and normalize to an array
  const {query} = verifiablePresentationRequest;
  const queries = Array.isArray(query) ? query : [query];

  // FIXME: place a cap on `queries.length` by truncating if too long

  // each query in the array should be treated as an `AND` conditional
  // (required), so build matches for each and return them
  const results = [];
  const promises = [];
  for(const query of queries) {
    const matches = [];

    // presently, only `QueryByExample` is supported
    if(query?.type !== 'QueryByExample') {
      // unsupported type, return no matches
      results.push({query, matches});
      continue;
    }

    // add results in order and await population later
    results.push({query, matches});

    // populate `QueryByExample` matches
    promises.push(_matchQueryByExample({query, credentialStore, matches}));
  }

  // await all match population promises
  // FIXME: use a p-fun library to properly handle concurrency and retries
  await Promise.all(promises);

  // produce flat results for convenience
  const allMatches = [];
  for(const {matches} of results) {
    allMatches.push(...matches);
  }
  return {
    flat: _removeDuplicates({matches: allMatches}),
    results
  };
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

async function _deriveCredentials({vprQuery, matches}) {
  // can assume a single `vprQuery.credentialQuery` due to prior processing
  const {credentialQuery} = vprQuery;
  const {acceptedCryptosuites, example} = credentialQuery;
  if(!acceptedCryptosuites?.length > 0) {
    // verifier does not mention any accepted SD cryptosuites, so nothing to do
    return;
  }

  // convert `vprQuery.credentialQuery.example` to JSON pointers, modulo
  // `@context` field (the `@context` field is assumed to already have been
  // matched during prior processing)
  const object = {...example};
  delete object['@context'];
  const pointers = _prunePointers(Object.keys(jsonpointer.dict(object)));

  // FIXME: for each match, if `content` has no understood SD proof, skip it,
  // otherwise generate a derived VC for each SD proof that is both understood
  // by the wallet and in `credentialQuery.acceptedCryptosuites`, setting
  // match.derived[<cryptosuite>] = derived VC

  // FIXME: implement
}

// FIXME: add other necessary params such as selective pointers
// async function _deriveCredential({verifiableCredential} = {}) {
//   // FIXME: implement
//   throw new Error('Not implemented.');
// }

async function _getLocalMatches({vprQuery, credentialStore}) {
  // prepare to update VPR query based on already local VC types
  vprQuery = {...vprQuery};

  // normalize `OR` `credentialQuery` to an array
  vprQuery.credentialQuery = Array.isArray(vprQuery.credentialQuery) ?
    vprQuery.credentialQuery : [vprQuery.credentialQuery];

  // FIXME: getting local matches presently only supports checking the first
  // entry in `vpr.credentialQuery`; any additional ones will be ignored;
  // future code should be made generic
  const matches = [];
  const [first] = vprQuery.credentialQuery;
  const firstExampleType = Array.isArray(first.example.type) ?
    first.example.type.slice() : [first.example.type];
  // FIXME: local matches currently only supports `OverAgeTokenCredential` and
  // if it is requested, it will be removed from the `vprQuery` as processed
  if(firstExampleType.includes('OverAgeTokenCredential')) {
    // query for *only* the over age token credential
    const clonedQuery = {
      ...vprQuery,
      credentialQuery: {
        ...first,
        example: {...first.example, type: 'OverAgeTokenCredential'}
      }
    };

    const {queries: [q]} = await credentialStore.local.convertVPRQuery(
      {vprQuery: clonedQuery});
    const {documents: results} = await credentialStore.local.find({
      // only return 1 over age token
      query: q, limit: 1
    });
    // adds only the first OverAgeTokenCredential to matches array
    if(results.length > 0) {
      matches.push(results[0]);
    }

    // remove `credentialQuery` from VPR as processed
    vprQuery.credentialQuery.shift();
  }

  // FIXME: generically get other local matches

  return {matches, vprQuery};
}

async function _getMatches({vprQuery, credentialStore}) {
  // FIXME: place cap on max length of `vprQuery.credentialQuery` by
  // truncating if it is too long

  // get local matches and updated VPR query that has removed any queries
  // that were processed exclusively against local storage
  const {
    matches: localMatches,
    vprQuery: updatedQuery
  } = await _getLocalMatches({vprQuery, credentialStore});

  // see if there is anything to match against remote storage
  let matches = localMatches;
  if(updatedQuery.credentialQuery.length > 0) {
    // convert `vprQuery` into remote query language and get remote matches
    // const {queries: q} = await credentialStore.remote.convertVPRQuery(
    //   {vprQuery});
    const {queries} = await credentialStore.remote.convertVPRQuery({vprQuery});

    // FIXME: run a different remote query for each query in `queries` in
    // parallel... and then create derived VCs from each one based on their
    // order and matching against `vprQuery.credentialQuery`

    // run a remote query for each `OR` query in `queries`
    // FIXME: use a p-fun library to properly handle concurrency and retries
    await Promise.all(queries.map(async (query, index) => {
      const {documents} = await credentialStore.remote.find({query});
      // create derived VCs for each result based on matching `credentialQuery`
      const credentialQuery = vprQuery.credentialQuery[index];
      const updatedQuery = {...vprQuery, credentialQuery};
      await _deriveCredentials({vprQuery: updatedQuery, matches: documents});
      matches.push(...documents);
    }));
  }

  // FIXME: create a more generalized filter mechanism for vc search
  matches = matches.filter(_openBadgeFilter({vprQuery}));

  return matches;
}

function _openBadgeFilter({vprQuery}) {
  // FIXME: this does not consider `credentialQuery` as an array
  return ({content}) => {
    const {example} = vprQuery.credentialQuery;
    return example?.credentialSubject?.achievement?.id ===
      content?.credentialSubject?.achievement?.id;
  };
}

async function _matchQueryByExample({query, credentialStore, matches}) {
  matches.push(...await _getMatches({vprQuery: query, credentialStore}));
}

// remove duplicate matches according to ID -- provided that a match has
// no derived VCs
function _removeDuplicates({matches}) {
  const ids = new Set();
  return matches.filter(match => {
    // derived VCs are present, not a duplicate
    if(match.derived) {
      return true;
    }

    const {id} = match;
    if(ids.has(id)) {
      // no derived VCs, is a duplicate
      return false;
    }
    ids.add(id);
    return true;
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

function _prunePointers(pointers) {
  pointers = _pruneShallowPointers(pointers);

  // make `type` pointers generic
  return pointers.map(pointer => {
    const index = pointer.indexOf('/type/');
    return index !== -1 ? pointer : pointer.slice(0, index) + '/type';
  });
}

// gets only the deepest pointers from the given list of pointers, for example,
// `['/a/b', '/a/b/c', '/a/b/c/d']` will be pruned to: `['/a/b/c/d']`
function _pruneShallowPointers(pointers) {
  const deep = [];
  for(const pointer of pointers) {
    let isDeep = true;
    for(const p of pointers) {
      if(pointer.length < p.length && p.startsWith(pointer)) {
        isDeep = false;
        break;
      }
    }
    if(isDeep) {
      deep.push(pointer);
    }
  }
  return deep;
}
