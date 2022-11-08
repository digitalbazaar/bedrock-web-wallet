/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as helpers from './helpers.js';
import Ajv from 'ajv';
import {schemas} from './validatorSchemas.js';

const ajv = new Ajv({verbose: true});
const SCHEMAS = new Map();

schemas.forEach(({type, schema}) => {
  SCHEMAS.set(type, schema);
});

export function validate({type, doc}) {
  if(!type) {
    throw new Error('"type" must be specified.');
  }
  if(!(typeof type === 'string' || Array.isArray(type))) {
    throw new Error('"type" must be a string or an array.');
  }
  if(!(doc && typeof doc === 'object')) {
    throw new Error('"doc" must be specified.');
  }

  const types = Array.isArray(type) ? type : [type];

  for(type of types) {
    if(!SCHEMAS.has(type)) {
      throw new Error(`Can't find schema for "type": ${type}`);
    }
    const valid = ajv.validate(SCHEMAS.get(type), doc);
    if(!valid) {
      throw ajv.errors;
    }
  }

  // FIXME: determine best approach to unknown proof types
  /*for(const credential of doc.verifiableCredential) {
    if(credential.proof) {
      if(!helpers.supportedProofTypes.has(credential.proof.type)) {
        throw new Error('Proof "type" is not supported.');
      }
    }
  }*/

  return {valid: true};
}
