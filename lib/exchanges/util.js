/*!
 * Copyright (c) 2023-2026 Digital Bazaar, Inc. All rights reserved.
 */
import {prettify} from '../helpers.js';
import {supportedSuites} from '../cryptosuites.js';

export function getDIDAuthenticationOptions({vpr} = {}) {
  const options = {};

  const {challenge, domain} = vpr;
  options.challenge = challenge;
  options.domain = domain;

  // find and normalize all `DIDAuthentication` queries
  const queries = Array.isArray(vpr.query) ? vpr.query : [vpr.query];
  const didAuthnQueries = queries
    .filter(q => q?.type === 'DIDAuthentication')
    .map(query => _normalizeDIDAuthenticationQuery({vpr, query}));

  // for now, only the first `DIDAuthentication` query is selected; in the
  // future, processing should be done by `group` (which can be `undefined`)
  // so only the `DIDAuthentication` query in the `group` of choice for
  // presentation is selected
  if(Array.isArray(didAuthnQueries[0]?.acceptedCryptoSuites)) {
    // normalize `acceptedCryptosuites` to objects
    options.acceptedCryptosuites = didAuthnQueries[0].acceptedCryptoSuites
      .map(e => typeof e === 'string' ? ({cryptosuite: e}) : e);

    // for backwards-compatibility, map `acceptedCryptosuites` to
    // `acceptedProofTypes`
    options.acceptedProofTypes = options.acceptedCryptosuites.map(
      ({cryptosuite}) => ({name: cryptosuite}));
  }

  console.log('DIDAuthentication options: ', prettify(options, null, 2));

  // FIXME: move validation code to a separate function
  const {acceptedCryptosuites} = options;
  if(acceptedCryptosuites) {
    let hasAcceptedCryptosuite = false;
    for(const {cryptosuite} of acceptedCryptosuites) {
      if(supportedSuites.has(cryptosuite)) {
        hasAcceptedCryptosuite = true;
      }
    }

    if(!hasAcceptedCryptosuite) {
      const error = new Error(
        'The site is requesting credentials that are not supported ' +
        'by this wallet.');
      error.name = 'ValidationError';
      error.details = 'None of the "acceptedCryptoSuites" are supported.';
      throw error;
    }
  }

  return options;
}

function _normalizeDIDAuthenticationQuery({vpr, query}) {
  const {
    acceptedCryptosuites, acceptedCryptoSuites: mispelled, ...rest
  } = query;

  if(acceptedCryptosuites) {
    if(Array.isArray(acceptedCryptosuites)) {
      // normalize `acceptedCryptosuites` and leave out
      // misspelled `acceptedCryptoSuites`
      return {
        ...rest,
        acceptedCryptosuites:
          _normalizeAcceptedCryptosuites(acceptedCryptosuites)
      };
    }
    // remove invalid `acceptedCryptosuites` value
    query = {...rest};
  }

  // normalize to standard `acceptedCryptosuites` from older mechanisms...

  // handle mispelling that was used for a while
  if(mispelled) {
    if(Array.isArray(mispelled)) {
      return {
        ...rest,
        acceptedCryptosuites:
          _normalizeAcceptedCryptosuites(mispelled)
      };
    }
    // remove invalid mispelling value
    query = {...rest};
  }

  // handle VPR-level expression with:
  // "acceptedProofTypes": [{name: <cryptosuiteName>}]
  // "supportedProofTypes": [{name: <cryptosuiteName>}]
  const acceptedProofTypes = vpr.acceptedProofTypes ?? vpr.supportedProofTypes;
  if(Array.isArray(acceptedProofTypes)) {
    const acceptedCryptosuites = acceptedProofTypes
      .filter(e => e?.name)
      .map(({name}) => ({cryptosuite: name}));
    return {...rest, acceptedCryptosuites};
  }

  return query;
}

function _normalizeAcceptedCryptosuites(acceptedCryptosuites) {
  // remove any invalid values; normalize to objects
  return acceptedCryptosuites
    .filter(e => e && (typeof e === 'string' || e.cryptosuite))
    .map(e => typeof e === 'string' ? ({cryptosuite: e}) : e);
}
