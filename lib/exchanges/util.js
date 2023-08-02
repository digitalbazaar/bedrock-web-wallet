/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import {prettify} from '../helpers.js';
import {supportedSuites} from '../cryptoSuites.js';

export function getDIDAuthenticationOptions({vpr} = {}) {
  const options = {};

  const {challenge, domain} = vpr;
  options.challenge = challenge;
  options.domain = domain;

  // find first (and should be only) `DIDAuthentication` query
  let {query} = vpr;
  if(!Array.isArray(query)) {
    query = [query];
  }
  options.didAuthentication = query.find(q => q?.type === 'DIDAuthentication');

  // backwards compatibility (cover two older mechanisms for specifying
  // acceptable cryptosuites; either `acceptedProofTypes` or even older
  // software used `supportedProofTypes`)
  options.acceptedProofTypes =
    vpr.acceptedProofTypes ?? vpr.supportedProofTypes;

  // normalize to `acceptedProofTypes` for now as this is used internally
  if(!options.acceptedProofTypes &&
    options.didAuthentication?.acceptedCryptoSuites) {
    options.acceptedProofTypes = options.didAuthentication
      .acceptedCryptoSuites.map(ac => ac.cryptosuite);
  }

  console.log('DIDAuthentication options: ', prettify(options, null, 2));

  // FIXME: move validation code to a separate function
  const {acceptedProofTypes} = options;
  if(acceptedProofTypes) {
    let hasAcceptedProofType = false;
    for(const {name} of acceptedProofTypes) {
      if(supportedSuites.has(name)) {
        hasAcceptedProofType = true;
      }
    }

    if(!hasAcceptedProofType) {
      const error = new Error(
        'The site is requesting credentials that are not supported ' +
        'by this wallet.');
      error.name = 'ValidationError';
      error.details = 'None of the "acceptedProofTypes" are supported.';
      throw error;
    }
  }

  return options;
}
