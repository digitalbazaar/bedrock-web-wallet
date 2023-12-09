/*!
 * Copyright (c) 2019-2023 Digital Bazaar, Inc. All rights reserved.
 */
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

  return {valid: true};
}
