/*!
 * Copyright (c) 2019-2024 Digital Bazaar, Inc. All rights reserved.
 */
const constants = {
  CREDENTIALS_CONTEXT_V1_URL: 'https://www.w3.org/2018/credentials/v1',
  CREDENTIALS_CONTEXT_V2_URL: 'https://www.w3.org/ns/credentials/v2',
  VERIFIABLE_PRESENTATION: 'VerifiablePresentation'
};

const vcContext = {
  type: 'array',
  minItems: 1,
  // the first context must be the VC context
  items: [{
    oneOf: [{
      const: constants.CREDENTIALS_CONTEXT_V1_URL
    }, {
      const: constants.CREDENTIALS_CONTEXT_V2_URL
    }]
  }],
  // additional contexts maybe strings or objects
  additionalItems: {
    anyOf: [{type: 'string'}, {type: 'object'}]
  }
};

const verifiablePresentation = {
  title: 'Verifiable Presentation',
  type: 'object',
  required: [
    '@context',
    'type'
  ],
  properties: {
    '@context': {
      title: 'JSON-LD context',
      description: 'A JSON-LD Context',
      anyOf: [{
        const: constants.CREDENTIALS_CONTEXT_V1_URL
      }, {
        const: constants.CREDENTIALS_CONTEXT_V2_URL
      },
      vcContext]
    },
    type: {
      title: 'JSON-LD type',
      description: 'A JSON-LD Type',
      anyOf: [{
        const: constants.VERIFIABLE_PRESENTATION
      }, {
        type: 'array',
        items: [{const: constants.VERIFIABLE_PRESENTATION}],
        additionalItems: true
      }]
    },
    holder: {type: 'string'},
    verifiableCredential: {
      title: 'Verifiable Credential',
      anyOf: [{
        type: 'object',
      }, {
        type: 'array',
        items: {type: 'object'}
      }]
    },
    capability: {
      type: 'array',
      title: 'Capability',
      items: {type: 'object'}
    },
    proof: {type: 'object'}
  }
};

export const schemas = [{
  type: constants.VERIFIABLE_PRESENTATION,
  schema: verifiablePresentation
}];
