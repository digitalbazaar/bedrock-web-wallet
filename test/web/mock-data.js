/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
export const mockCredential = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    {
      ex: 'https://example.org/examples#',
      schema: 'http://schema.org/',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      BachelorDegree: 'ex:BachelorDegree',
      UniversityDegreeCredential: 'ex:UniversityDegreeCredential',
      degree: 'ex:degree',
      name: {
        '@id': 'schema:name',
        '@type': 'rdf:HTML'
      }
    },
    'https://w3id.org/security/suites/ed25519-2020/v1'
  ],
  id: 'http://example.gov/credentials/3732',
  type: [
    'VerifiableCredential',
    'UniversityDegreeCredential'
  ],
  issuer: 'did:key:z6MkmHipNuE35C6ona8Hkgpq3mpn4C3rX5kp1SjwcZ7HCWnH',
  issuanceDate: '2020-03-11T23:09:06.803Z',
  credentialSubject: {
    id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
    degree: {
      type: 'BachelorDegree',
      name: 'Bachelor of Science and Arts'
    }
  },
  proof: {
    type: 'Ed25519Signature2020',
    created: '2021-05-11T18:44:41Z',
    // eslint-disable-next-line max-len
    verificationMethod: 'did:key:z6MkmHipNuE35C6ona8Hkgpq3mpn4C3rX5kp1SjwcZ7HCWnH#z6MkmHipNuE35C6ona8Hkgpq3mpn4C3rX5kp1SjwcZ7HCWnH',
    proofPurpose: 'assertionMethod',
    // eslint-disable-next-line max-len
    proofValue: 'zqvrFELnqNYWBEsqkHPhqxXuQaNf3dpsQ3s6dLgkS1jAtAwXfwxf2TirW4kyPAUHNU3TXbS7JT38aF4jtnXGwiBT'
  }
};
