/*!
 * Copyright (c) 2018-2026 Digital Bazaar, Inc.
 */
import * as didMethodKey from '@digitalbazaar/did-method-key';
import * as EcdsaMultikey from '@digitalbazaar/ecdsa-multikey';
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import * as vc from '@digitalbazaar/vc';
import {
  getDIDAuthenticationOptions, normalizeQueryByExample
} from './exchanges/util.js';
import {config} from '@bedrock/web';
import {createDiscloseCryptosuite as createBbsDiscloseCryptosuite} from
  '@digitalbazaar/bbs-2023-cryptosuite';
import {createDiscloseCryptosuite as createEcdsaSdDiscloseCryptosuite} from
  '@digitalbazaar/ecdsa-sd-2023-cryptosuite';
import {DataIntegrityProof} from '@digitalbazaar/data-integrity';
import {driver as DidJwkDriver} from '@digitalbazaar/did-method-jwk';
import {documentLoader} from './documentLoader.js';
import {ensureLocalCredentials} from './ageCredentialHelpers.js';
import jsonpointer from 'json-pointer';
import {profileManager} from './state.js';
import {query as queryProcessor} from '@digitalbazaar/oid4-client';
import {supportedSuites} from './cryptosuites.js';

const DATA_INTEGRITY_CONTEXT_V1 = 'https://w3id.org/security/data-integrity/v1';
const VC_CONTEXT_V1 = 'https://www.w3.org/2018/credentials/v1';

const SUPPORTED_CRYPTOSUITES = new Map([
  [
    // by `signer.type`
    'Ed25519VerificationKey2020', new Set(
      ['eddsa-rdfc-2022', 'Ed25519Signature2020']),
    // by `signer.algorithm` (which can be a signing algorithm or ECC curve)
    'EdDSA', new Set(['eddsa-rdfc-2022', 'Ed25519Signature2020']),
    'Ed25519', new Set(['eddsa-rdfc-2022', 'Ed25519Signature2020']),
    'P-256', new Set(['ecdsa-rdfc-2019']),
    'P-384', new Set(['ecdsa-rdfc-2019'])
  ]
]);

const SUPPORTED_QUERY_TYPES = new Set(['DIDAuthentication', 'QueryByExample']);

const TEXT_ENCODER = new TextEncoder();

const didKeyDriver = didMethodKey.driver();
didKeyDriver.use({
  multibaseMultikeyHeader: 'z6Mk',
  fromMultibase: Ed25519Multikey.from
});
didKeyDriver.use({
  multibaseMultikeyHeader: 'zDna',
  fromMultibase: EcdsaMultikey.from
});
didKeyDriver.use({
  multibaseMultikeyHeader: 'z82L',
  fromMultibase: EcdsaMultikey.from
});
const didJwkDriver = DidJwkDriver();

export async function createSignOptions({
  profileId,
  authnOption,
  verifiablePresentationRequest
}) {
  // build parameters required to create sign options...
  const params = {};

  // get acceptable options from DIDAuthentication query
  const didAuthnOptions = getDIDAuthenticationOptions({
    vpr: verifiablePresentationRequest
  });
  console.log('did authn options', didAuthnOptions);
  // FIXME: if `acceptedCryptosuites` is empty, return `undefined` for sign
  // options, but only in a major revision as backwards compatibility requires
  // always signing

  // use existing `signer`, if appropriate
  const {
    invocationSigner: profileSigner
  } = await profileManager.getProfileSigner({profileId});
  if(authnOption.type === 'ProfileId') {
    params.signer = profileSigner;
  } else if(authnOption.type === 'CredentialSubjectId') {
    // FIXME: sign signer according to VC meta specified in `authnOption`
    // params.signer =
    throw new Error('Not implemented');
  }

  // get signer supported cryptosuites
  const signerSupported = SUPPORTED_CRYPTOSUITES.get(params.signer?.type) ??
    SUPPORTED_CRYPTOSUITES.get(params.signer?.algorithm);

  // FIXME: remove in next major revision
  // for backwards compatibility; if no `acceptedCryptosuites` are specified,
  // use signer's supported suites, in the future, return undefined
  // `signOptions` since no signature was requested
  let {acceptedCryptosuites} = didAuthnOptions;
  if(!(acceptedCryptosuites?.length > 0)) {
    // default to `P-256` signatures if no `signer` yet for widest interop
    const supported = signerSupported ?? SUPPORTED_CRYPTOSUITES.get('P-256');
    acceptedCryptosuites = [...supported].map(cryptosuite => ({cryptosuite}));
  }

  // pick an acceptable cryptosuite
  for(const {cryptosuite} of acceptedCryptosuites) {
    // skip any cryptosuites not supported by `signer`
    if(signerSupported && !signerSupported.has(cryptosuite)) {
      continue;
    }
    const createSuite = supportedSuites.get(cryptosuite);
    if(createSuite) {
      params.createSuite = createSuite;
      params.cryptosuite = cryptosuite;
      break;
    }
  }

  console.log('authnOption', authnOption);

  // create a new identifier if requested
  if(authnOption.type === 'NewId') {
    // FIXME: create new `holder` identifier as needed (create a
    // `did:key` DID and store key material, decoupling from "holder"
    // semantic); if share/authentication purpose is for VC-2FA then it
    // can be stored with the received VC(s), but if for another purpose,
    // it needs to be stored elsewhere or it won't be reusable

    // create new entity
    // FIXME: additional params include on-device, portable key, or WebKMS key
    const algorithm = params.cryptosuite.startsWith('ecdsa') ?
      'P-256' : 'Ed25519';
    params.newEntity = await _createEntity({
      didMethod: 'key', algorithm
    });
    params.signer = params.newEntity.signer;
  }

  // confirm there is a compatible cryptosuite
  const {signer, cryptosuite, newEntity} = params;
  _checkSignerCryptosuite({acceptedCryptosuites, signer});

  // return sign options
  return {
    profileId,
    signer,
    cryptosuite,
    suite: params.createSuite({signer}),
    newEntity
  };
}

export function getCompatibleSignerCryptosuites({
  acceptedCryptosuites, signer
} = {}) {
  const supported = SUPPORTED_CRYPTOSUITES.get(signer.type) ??
    SUPPORTED_CRYPTOSUITES.get(signer.algorithm);
  const accepted = new Set(acceptedCryptosuites.map(ac => ac?.cryptosuite));
  return accepted.intersection(supported);
}

export async function match({
  verifiablePresentationRequest, credentialStore
} = {}) {
  console.log('VPR to match against', verifiablePresentationRequest);
  if(!(verifiablePresentationRequest?.query && credentialStore)) {
    // nothing to match against
    return {flat: [], and: []};
  }

  // ensures local credentials are made present on the device
  await ensureLocalCredentials({credentialStore});

  // get query from VPR and normalize to an array
  const {query} = verifiablePresentationRequest;
  const queries = Array.isArray(query) ? query.slice() : [query];

  console.log('Queries parsed from VPR', queries);

  // get queries by group
  const {maxQueries} = config.wallet.exchanges.limits;
  const groups = new Map();
  const unsupportedGroupIds = new Set();
  for(const query of queries) {
    if(!SUPPORTED_QUERY_TYPES.has(query?.type)) {
      // mark groups with other queries as unsupported and skip
      unsupportedGroupIds.add(query.group);
      continue;
    }
    // skip previously marked unsupported group
    if(unsupportedGroupIds.has(query.group)) {
      continue;
    }

    // get/create group
    let group = groups.get(query.group);
    if(!group) {
      groups.set(query.group, group = []);
    }

    // only `QueryByExample` requires special processing, other types pass
    // through
    if(query.type !== 'QueryByExample') {
      group.push(query);
      continue;
    }

    // filter and normalize all `QueryByExample` queries; if any uses
    // deprecated array for `credentialQuery`, create a new `QueryByExample`
    // by cloning
    if(Array.isArray(query.credentialQuery)) {
      const {credentialQuery, ...rest} = query;
      for(const each of credentialQuery) {
        group.push(normalizeQueryByExample({
          query: {
            ...rest,
            credentialQuery: each
          }
        }));
      }
    } else {
      group.push(normalizeQueryByExample({query}));
    }
  }

  // cap groups by query limits
  let totalQueries = 0;
  for(const [groupId, group] of groups) {
    if((group.size + totalQueries) > maxQueries) {
      groups.delete(groupId);
    } else {
      totalQueries += group.size;
    }
  }

  // each `group` is an OR condition against other groups; satisfying a single
  // group will satisify the VPR; each query within a group is an `AND`
  // condition -- they must all be satisfied to satisfy the group
  const groupResults = new Map();
  for(const [groupId, group] of groups.entries()) {
    const and = [];
    const promises = [];
    for(const query of group) {
      const matches = [];

      // presently, only `QueryByExample` matches VCs; this skips trying to
      // match VCs against `DIDAuthentication` queries, whilst not erroneously
      // skipping groups that include `DIDAuthentication`
      if(query.type !== 'QueryByExample') {
        // return no matches
        and.push({id: globalThis.crypto.randomUUID(), query, matches});
        continue;
      }

      console.log('Adding query for processing', query);

      // add results in order and await population later
      and.push({id: globalThis.crypto.randomUUID(), query, matches});

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
    const result = {
      flat: _removeDuplicates({matches: allMatches}),
      and
    };
    console.log('Match result', result, 'group', groupId);

    groupResults.set(groupId, result);
  }

  // FIXME: for backwards compatibility, a single group match result is
  // returned along with the group results; the single group chosen is either
  // the default (`undefined`) group or the first group processed
  const defaultGroupResult = groupResults.get(undefined) ??
    groupResults.get(groupResults.keys()[0]);
  return {
    ...defaultGroupResult,
    groupResults
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
  challenge, domain, presentation, suite,
  // for backwards compatibility:
  profileId, acceptedCryptosuites, acceptedProofTypes
} = {}) {
  if(!suite) {
    // for backwards compatiblity only; a suite should always be passed that
    // was appropriate determined by `acceptedCryptosuites` and the available
    // signers
    suite = await _createFallbackSuite({
      profileId, acceptedCryptosuites, presentation, acceptedProofTypes
    });
  } else {
    console.log('SUITE1', suite);
  }
  return vc.signPresentation({
    presentation,
    documentLoader,
    domain,
    challenge,
    suite
  });
}

function _adjustPointers(pointers) {
  console.log('JSON pointers to adjust', pointers);

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

function _checkSignerCryptosuite({acceptedCryptosuites, signer}) {
  const compatible = getCompatibleSignerCryptosuites({
    acceptedCryptosuites, signer
  });
  if(compatible.size === 0) {
    const accepted = acceptedCryptosuites.map(ac => ac?.cryptosuite);
    const names = [...accepted].join(', ');
    throw new Error(
      'No supported cryptosuite matches one of the accepted cryptosuites ' +
      `(${names}).`);
  }
  return compatible;
}

async function _createEntity({
  didMethod = 'key', algorithm = 'Ed25519'
} = {}) {
  let verificationKeyPair;
  let multikey;
  if(algorithm.startsWith('P-')) {
    verificationKeyPair = await EcdsaMultikey.generate({curve: algorithm});
    multikey = await verificationKeyPair.export({secretKey: true});
  } else {
    verificationKeyPair = await Ed25519Multikey.generate();
    multikey = await verificationKeyPair.export({secretKey: true});
  }
  let {didDocument} = await didKeyDriver.fromKeyPair({verificationKeyPair});
  const {id: did} = didDocument;
  verificationKeyPair.id = didDocument.verificationMethod[0].id;
  verificationKeyPair.controller = did;
  const signer = verificationKeyPair.signer();
  signer.algorithm = algorithm;
  let jwk;
  if(algorithm.startsWith('P-')) {
    jwk = await EcdsaMultikey.toJwk({keyPair: verificationKeyPair});
  } else {
    jwk = await Ed25519Multikey.toJwk({keyPair: verificationKeyPair});
  }
  if(didMethod === 'jwk') {
    ({didDocument} = await didJwkDriver.fromJwk({jwk}));
    signer.id = didDocument.verificationMethod[0].id;
  }
  return {did: didDocument.id, signer, verificationKeyPair, multikey, jwk};
}

async function _createFallbackSuite({
  profileId, acceptedCryptosuites, presentation,
  // backwards compatibility:
  acceptedProofTypes
}) {
  // normalize `acceptedProofTypes` into standard `acceptedCryptosuites` for
  // backwards-compatibility
  if(acceptedProofTypes && !acceptedCryptosuites) {
    acceptedCryptosuites = acceptedProofTypes.map(
      ({name}) => ({cryptosuite: name}));
  }

  // note this `_createDefaultSuite()` helper is for backwards compatibility
  // and generally should not be run; however, if it is run, it may select
  // a signer that is incompatible with the `acceptedCryptosuites`; the fix
  // for this is to make an appropriate signer and suite selection before
  // any conditional where this function is called as a last resort because
  // no suite has been chosen
  const {
    invocationSigner: signer
  } = await profileManager.getProfileSigner({profileId});

  // pick a suite from the accepted cryptosuites, initialized to a special
  // backwards compatibility case (or `undefined` if it does not apply)
  let createSuite = _handleLegacyDraftCryptosuites({presentation});
  if(!createSuite && Array.isArray(acceptedCryptosuites) &&
    acceptedCryptosuites.length > 0) {
    // check if the signer type maps to an accepted cryptosuite
    _checkSignerCryptosuite({acceptedCryptosuites, signer});
    for(const {cryptosuite} of acceptedCryptosuites) {
      createSuite = supportedSuites.get(cryptosuite);
      if(createSuite) {
        break;
      }
    }
  }
  // if no suite constructor chosen yet, use default
  if(!createSuite) {
    createSuite = supportedSuites.get(config.wallet.defaults.signatureSuite);
  }
  return createSuite({signer});
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
  const {credentialQuery} = vprQuery;
  if(credentialQuery.acceptedCryptosuites.length === 0) {
    // verifier does not mention any accepted SD cryptosuites, so nothing to do
    return;
  }

  // convert `vprQuery.credentialQuery.example` to JSON pointers, modulo
  // `@context` field (the `@context` field is assumed to already have been
  // matched during prior processing); any VCDM mandatory pointers will be
  // automatically added based on each `match` VC version (e.g., `/issuer`,
  // `/issuanceDate` for VC 1.x)
  const {example} = credentialQuery;
  const object = {...example};
  delete object['@context'];
  console.log('Generating JSON pointers from', object);
  const pointers = _adjustPointers(Object.keys(jsonpointer.dict(object)));
  console.log(
    'Parsed selective disclosure pointers from example:',
    {example, pointers});

  // FIXME: move `presentationHeader` construction inside `_deriveCredential`
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
  const {acceptedCryptosuites} = credentialQuery;
  const acceptedCryptosuiteSet = new Set(acceptedCryptosuites.map(
    ac => ac?.cryptosuite));
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
  // proof types (cryptosuites)
}

async function _getLocalMatches({vprQuery, credentialStore}) {
  const results = [];
  const {credentialQuery} = vprQuery;
  const exampleType = Array.isArray(credentialQuery.example.type) ?
    credentialQuery.example.type.slice() : [credentialQuery.example.type];
  // FIXME: local matches currently only supports `OverAgeTokenCredential` and
  // if it is requested, it will be removed from the `vprQuery` as processed
  if(exampleType.includes('OverAgeTokenCredential')) {
    const matches = [];
    results.push({credentialQuery, matches});

    // FIXME: optimize away clone
    // query for *only* the over age token credential
    const clonedQuery = {
      ...vprQuery,
      credentialQuery: {
        ...credentialQuery,
        example: {...credentialQuery.example, type: 'OverAgeTokenCredential'}
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
      matches.push({id: globalThis.crypto.randomUUID(), record: records[0]});
    }
  }

  // FIXME: generically get other local matches

  return results;
}

// gets matches for a VPR `query` of type `QueryByExample`
async function _getMatches({
  verifiablePresentationRequest, vprQuery, credentialStore
}) {
  // get local matches (presently only checks for a single VC type and will
  // add a result entry if it was checked at all)
  const results = await _getLocalMatches({vprQuery, credentialStore});

  // only run remote storage check if the local one did not match
  if(results.length === 0) {
    // convert `vprQuery` into remote query language to get remote matches;
    // this always produces a single remote query for a single
    // `credentialQuery`
    const {
      queries: [query]
    } = await credentialStore.remote.convertVPRQuery({vprQuery});

    // run remote query
    const {documents: records} = await credentialStore.remote.find({query});
    // add results based on matching `credentialQuery`
    results.push({
      id: globalThis.crypto.randomUUID(),
      credentialQuery: vprQuery.credentialQuery,
      matches: records.map(record => ({record}))
    });
  }

  // post-process all results
  for(const result of results) {
    const {credentialQuery, matches} = result;
    const map = queryProcessor.queryByExample.toJsonPointerMap(credentialQuery);

    // filter matches from storage against full `queryByExample`
    result.matches = matches.filter(
      ({record: {content: credential}}) =>
        queryProcessor.credentialMatches({credential, map}));

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
