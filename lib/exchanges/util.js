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
  options.acceptedCryptosuites = didAuthnQueries[0]?.acceptedCryptoSuites;

  // for backwards-compatibility, map `acceptedCryptosuites` to
  // `acceptedProofTypes`
  if(options.acceptedCryptosuites) {
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
  if(query.acceptedCryptoSuites) {
    // query is already normal
    return query.acceptedCryptoSuites;
  }

  // normalize to standard `acceptedCryptosuites` from older mechanisms...
  if(query.acceptedCryptoSuites) {
    // handle different casing
    const {acceptedCryptoSuites, ...rest} = query;
    return {...rest, acceptedCryptosuites: acceptedCryptoSuites};
  }

  // handle VPR-level expression with:
  // "acceptedProofTypes": [{name: <cryptosuiteName>}]
  // "supportedProofTypes": [{name: <cryptosuiteName>}]
  const acceptedProofTypes = vpr.acceptedProofTypes ?? vpr.supportedProofTypes;
  if(acceptedProofTypes) {
    const acceptedCryptosuites = acceptedProofTypes.map(
      ({name}) => ({cryptosuite: name}));
    return {...query, acceptedCryptosuites};
  }

  return query;
}
