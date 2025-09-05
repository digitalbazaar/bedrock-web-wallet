/*!
 * Copyright (c) 2018-2024 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import {_checkSignerType} from './helpers.js';
import {config} from '@bedrock/web';
import {createDiscloseCryptosuite as createBbsDiscloseCryptosuite} from
  '@digitalbazaar/bbs-2023-cryptosuite';
import {createDiscloseCryptosuite as createEcdsaSdDiscloseCryptosuite} from
  '@digitalbazaar/ecdsa-sd-2023-cryptosuite';
import {DataIntegrityProof} from '@digitalbazaar/data-integrity';
import {documentLoader} from './documentLoader.js';
import {ensureLocalCredentials} from './ageCredentialHelpers.js';
import jsonpointer from 'json-pointer';
import {matchCredentials} from './queryByExample.js';
import {profileManager} from './state.js';
import {supportedSuites} from './cryptoSuites.js';
import {v4 as uuid} from 'uuid';

const DATA_INTEGRITY_CONTEXT_V1 = 'https://w3id.org/security/data-integrity/v1';
const VC_CONTEXT_V1 = 'https://www.w3.org/2018/credentials/v1';

const TEXT_ENCODER = new TextEncoder();

export async function match({
  verifiablePresentationRequest, credentialStore
} = {}) {
  if(!(verifiablePresentationRequest?.query && credentialStore)) {
    // nothing to match against
    return {flat: [], and: []};
  }

  // ensures local credentials are made present on the device
  await ensureLocalCredentials({credentialStore});

  // get query from VPR and normalize to an array
  const {query} = verifiablePresentationRequest;
  const queries = Array.isArray(query) ? query.slice() : [query];

  // place a cap on `queries.length` by truncating if too long
  const {maxQueries} = config.wallet.exchanges.limits;
  if(queries.length > maxQueries) {
    queries.length = maxQueries;
  }

  // each query in the array should be treated as an `AND` conditional
  // (required), so build matches for each and return them
  const and = [];
  const promises = [];
  for(const query of queries) {
    const matches = [];

    // presently, only `QueryByExample` is supported
    if(query?.type !== 'QueryByExample') {
      // unsupported type, return no matches
      and.push({id: uuid(), query, matches});
      continue;
    }

    // add results in order and await population later
    and.push({id: uuid(), query, matches});

    // populate `QueryByExample` matches
    promises.push(_matchQueryByExample({
      verifiablePresentationRequest,
      query, credentialStore, matches
    }));
  }

  // await all match population promises
  // FIXME: use a p-fun library to properly handle concurrency and retries
  await Promise.all(promises);

  // produce flat results for convenience
  const allMatches = [];
  for(const {matches} of and) {
    // each entry in `matches` has `{id, credentialQuery, matches}`
    for(const match of matches) {
      allMatches.push(...match.matches);
    }
  }
  return {
    flat: _removeDuplicates({matches: allMatches}),
    and
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

  // pick a suite from the accepted proof types, initialized to a special
  // backwards compatibility case (or `undefined` if it does not apply)
  let suite = _handleLegacyDraftCryptosuites({presentation});
  if(!suite && Array.isArray(acceptedProofTypes) &&
    acceptedProofTypes.length > 0) {
    // check if the signer type is in the acceptedProofTypes
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

async function _deriveCredential({
  verifiableCredential, proof, pointers, presentationHeader
} = {}) {
  // detect / adjust issuer ID pointer
  let issuerPtr = pointers.indexOf('/issuer/id');
  if(issuerPtr === -1) {
    issuerPtr = pointers.indexOf('/issuer');
  } else if(typeof verifiableCredential.issuer === 'string') {
    pointers = pointers.slice();
    pointers[issuerPtr] = '/issuer';
  }

  // always include `issuer`
  if(issuerPtr === -1) {
    pointers = pointers.slice();
    pointers.push(verifiableCredential.issuer?.id ? '/issuer/id' : '/issuer');
  }

  // always include `issuanceDate` for VC 1.x credentials
  if(verifiableCredential['@context']?.[0] === VC_CONTEXT_V1 &&
    !pointers.includes('/issuanceDate')) {
    pointers = pointers.slice();
    pointers.push('/issuanceDate');
  }

  console.log('Deriving credential from:', {verifiableCredential, pointers});

  try {
    const {id: proofId, cryptosuite} = proof;
    let derivedCredential;
    if(proof.cryptosuite === 'bbs-2023') {
      // try to generate BBS derived VC
      derivedCredential = await vc.derive({
        verifiableCredential,
        suite: new DataIntegrityProof({
          cryptosuite: createBbsDiscloseCryptosuite({
            presentationHeader,
            selectivePointers: pointers
          })
        }),
        documentLoader
      });
      return {cryptosuite, derivedCredential};
    }
    if(cryptosuite === 'ecdsa-sd-2023') {
      // try to generate ECDSA-SD derived VC
      derivedCredential = await vc.derive({
        verifiableCredential,
        suite: new DataIntegrityProof({
          cryptosuite: createEcdsaSdDiscloseCryptosuite({
            proofId,
            selectivePointers: pointers
          })
        }),
        documentLoader
      });
      return {cryptosuite, derivedCredential};
    }
  } catch(error) {
    console.log('Error trying to derive credential: ', {error});
  }
}

async function _deriveCredentials({
  verifiablePresentationRequest, vprQuery, matches
}) {
  // can assume a single `vprQuery.credentialQuery` due to prior processing
  const {credentialQuery} = vprQuery;
  // normalize `acceptedCryptosuites` and sanitize `example` inputs
  let {acceptedCryptosuites = [], example = {}} = credentialQuery;
  if(!Array.isArray(acceptedCryptosuites)) {
    acceptedCryptosuites = [acceptedCryptosuites];
  }
  if(!(example && typeof example === 'object')) {
    example = {};
  }
  if(acceptedCryptosuites.length === 0) {
    // verifier does not mention any accepted SD cryptosuites, so nothing to do
    return;
  }

  // convert `vprQuery.credentialQuery.example` to JSON pointers, modulo
  // `@context` field (the `@context` field is assumed to already have been
  // matched during prior processing); any VCDM mandatory pointers will be
  // automatically added based on each `match` VC version (e.g., `/issuer`,
  // `/issuanceDate` for VC 1.x)
  const object = {...example};
  delete object['@context'];
  const pointers = _adjustPointers(Object.keys(jsonpointer.dict(object)));
  console.log(
    'Parsed selective disclosure pointers from example:',
    {example, pointers});

  // use `domain` and `challenge` from `verifiablePresentationRequest`
  // in `presentationHeader`
  let presentationHeader;
  const {challenge, domain} = verifiablePresentationRequest;
  if(domain !== undefined && challenge !== undefined) {
    presentationHeader = TEXT_ENCODER.encode(
      JSON.stringify({challenge, domain}));
  }

  // FIXME: for each match, if `content` has no understood SD proof, skip it,
  // otherwise generate a derived VC for each SD proof that is both understood
  // by the wallet and in `credentialQuery.acceptedCryptosuites`, setting
  // match.derived[<cryptosuite>] = derived VC
  const acceptedCryptosuiteSet = new Set(acceptedCryptosuites);
  for(const match of matches) {
    const {record: {content: verifiableCredential}} = match;
    match.derived = [];
    if(!verifiableCredential.proof) {
      // no `proof` on VC, cannot generate derived VC
      continue;
    }
    const proofs = Array.isArray(verifiableCredential.proof) ?
      verifiableCredential.proof : [verifiableCredential.proof];
    const map = new Map();
    for(const proof of proofs) {
      if(!(proof.type === 'DataIntegrityProof' &&
        acceptedCryptosuiteSet.has(proof.cryptosuite))) {
        // unknown proof type or unacceptable `cryptosuite`
        continue;
      }
      const derived = await _deriveCredential(
        {verifiableCredential, proof, pointers, presentationHeader});
      if(derived) {
        console.log('Derived credential', proof.cryptosuite, derived);
        map.set(proof.cryptosuite, derived);
      }
    }
    // order results based on accepted cryptosuite preference
    for(const acceptedCryptosuite of acceptedCryptosuiteSet) {
      const derived = map.get(acceptedCryptosuite);
      if(derived) {
        match.derived.push(derived);
      }
    }
  }

  // FIXME: setting a privacy rating within `match.derived` or alongside it
  // in some way would be useful; need to signal to UIs selective disclosure
  // (data minimization) and unlinkability likelihood -- also unlinkability for
  // verifiers vs. for regulators and similar for well-known VC types vs. via
  // proof types
}

async function _getLocalMatches({vprQuery, credentialStore}) {
  // FIXME: getting local matches presently only supports checking the first
  // entry in `vpr.credentialQuery`; any additional ones will be ignored;
  // future code should be made generic
  // note: each `credentialQuery` is an `or` condition with its own results
  const results = [];
  const [first] = vprQuery.credentialQuery;
  const firstExampleType = Array.isArray(first.example.type) ?
    first.example.type.slice() : [first.example.type];
  // FIXME: local matches currently only supports `OverAgeTokenCredential` and
  // if it is requested, it will be removed from the `vprQuery` as processed
  if(firstExampleType.includes('OverAgeTokenCredential')) {
    const matches = [];
    results.push({credentialQuery: first, matches});

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
    const {documents: records} = await credentialStore.local.find({
      // only return 1 over age token
      query: q, limit: 1
    });
    // adds only the first OverAgeTokenCredential to matches array
    if(records.length > 0) {
      matches.push({id: uuid(), record: records[0]});
    }

    // remove `credentialQuery` from VPR as processed
    vprQuery.credentialQuery.shift();
  }

  // FIXME: generically get other local matches

  return results;
}

// gets matches for a VPR `query` of type `QueryByExample`
async function _getMatches({
  verifiablePresentationRequest, vprQuery, credentialStore
}) {
  // normalize `OR` `credentialQuery` to an array and copy it to allow
  // updates as each `credentialQuery` is fulfilled
  vprQuery = {
    ...vprQuery,
    credentialQuery: Array.isArray(vprQuery.credentialQuery) ?
      vprQuery.credentialQuery.slice() : [vprQuery.credentialQuery]
  };

  // place cap on max length of `vprQuery.credentialQuery` by truncating if it
  // is too long
  const {maxCredentialQueries} = config.wallet.exchanges.limits
    .queryTypes.QueryByExample;
  if(vprQuery.credentialQuery.length > maxCredentialQueries) {
    vprQuery.credentialQuery.length = maxCredentialQueries;
  }

  // get local matches and updated VPR query that has removed any queries
  // that were processed exclusively against local storage
  const results = await _getLocalMatches({vprQuery, credentialStore});

  // see if there is anything to match against remote storage
  if(vprQuery.credentialQuery.length > 0) {
    // convert `vprQuery` into remote query language to get remote matches
    const {queries} = await credentialStore.remote.convertVPRQuery({vprQuery});

    // run a remote query for each `OR` query in `queries`
    // FIXME: use a p-fun library to properly handle concurrency and retries
    await Promise.all(queries.map(async (query, index) => {
      const {documents: records} = await credentialStore.remote.find({query});
      // add results based on matching `credentialQuery`
      const credentialQuery = vprQuery.credentialQuery[index];
      results.push({
        id: uuid(),
        credentialQuery,
        matches: records.map(record => ({record}))
      });
    }));
  }

  // post-process all results
  for(const result of results) {
    const {credentialQuery, matches} = result;

    // apply filters:
    // remove any matches that do not include the requested context
    // match any open badge achievement ID
    // FIXME: add more generalized matching
    result.matches = matches
      .filter(_matchContextFilter({credentialQuery}));

    // Full query by example matching implemented via queryByExample module
    // Process all credentials at once for efficiency
    if(credentialQuery?.example) {

      const allContents = result.matches.map(match => match.record.content);
      const matchingContents = matchCredentials(allContents, credentialQuery);

      // Map results back to original records using reference comparison
      result.matches = result.matches.filter(match =>
        matchingContents.includes(match.record.content)
      );
    }

    result.matches =
        result.matches.filter(_openBadgeFilter({credentialQuery}));

    // create derived VCs for each match based on specific `credentialQuery`
    const updatedQuery = {...vprQuery, credentialQuery};
    await _deriveCredentials({
      verifiablePresentationRequest,
      vprQuery: updatedQuery, matches: result.matches
    });
  }
  return results;
}

function _handleLegacyDraftCryptosuites({presentation}) {
  // special backwards compatibility case: always use `Ed25519Signature2020`
  // if using a v1 presentation and `data-integrity/v1` context is present in
  // any VCs
  if(presentation['@context'].includes(VC_CONTEXT_V1) &&
    presentation.verifiableCredential) {
    const credentials = Array.isArray(presentation.verifiableCredential) ?
      presentation.verifiableCredential : [presentation.verifiableCredential];
    if(credentials.some(credential => credential['@context']?.includes(
      DATA_INTEGRITY_CONTEXT_V1))) {
      return supportedSuites.get('Ed25519Signature2020');
    }
  }
}

function _openBadgeFilter({credentialQuery}) {
  return ({record: {content}}) => {
    const {example} = credentialQuery;
    return example?.credentialSubject?.achievement?.id ===
      content?.credentialSubject?.achievement?.id;
  };
}

function _matchContextFilter({credentialQuery}) {
  // get expected context
  let expectedContext = credentialQuery?.example?.['@context'];
  if(expectedContext === undefined) {
    // no context specified, allow any result
    return () => true;
  }
  // normalize to an array
  if(!Array.isArray(expectedContext)) {
    expectedContext = [expectedContext];
  }
  // map to an array of strings for later comparison
  expectedContext = expectedContext.map(
    ctx => typeof ctx === 'string' ? ctx : JSON.stringify(ctx));
  return ({record: {content}}) => {
    // normalize record context to an array if present
    let recordContext = content['@context'];
    if(recordContext !== undefined && !Array.isArray(recordContext)) {
      recordContext = [recordContext];
    }
    // map to an array of strings for later comparison
    recordContext = recordContext.map(
      ctx => typeof ctx === 'string' ? ctx : JSON.stringify(ctx));

    // if every context value in `expectedContext` is present in
    // `recordContext`, then accept the record
    return expectedContext.every(c => recordContext.includes(c));
  };
}

async function _matchQueryByExample({
  verifiablePresentationRequest, query, credentialStore, matches
}) {
  matches.push(...await _getMatches({
    verifiablePresentationRequest, vprQuery: query, credentialStore
  }));
}

// remove duplicate matches according to `record` ID -- provided that a match
// has no derived VCs
function _removeDuplicates({matches}) {
  const ids = new Set();
  return matches.filter(match => {
    // derived VCs are present, not a duplicate
    if(match.derived?.length > 0) {
      return true;
    }

    // use `match.record.meta.id` for comparison
    const {record: {meta: {id}}} = match;
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

function _adjustPointers(pointers) {
  // ensure `credentialSubject` is included in any reveal, presume that if
  // it isn't present that the entire credential subject was requested
  const hasCredentialSubject = pointers.some(
    pointer => pointers.includes('/credentialSubject/') ||
      pointer.endsWith('/credentialSubject'));
  if(!hasCredentialSubject) {
    pointers = pointers.slice();
    pointers.push('/credentialSubject');
  }

  pointers = _pruneShallowPointers(pointers);

  // make `type` pointers generic
  return pointers.map(pointer => {
    const index = pointer.indexOf('/type/');
    return index === -1 ? pointer : pointer.slice(0, index) + '/type';
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
