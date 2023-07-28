/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
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

  return options;
}
