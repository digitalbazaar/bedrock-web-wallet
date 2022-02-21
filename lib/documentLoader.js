/*!
 * Copyright (c) 2015-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as didVeresOne from 'did-veres-one';
import * as ed25519Ctx2018 from 'ed25519-signature-2018-context';
import ageContext from '@digitalbazaar/age-verification-context';
import {constants as zcapConstants} from '@digitalbazaar/zcap';
import {httpClient} from '@digitalbazaar/http-client';
import {securityLoader} from '@digitalbazaar/security-document-loader';
import vc from '@digitalbazaar/vc';
import webkmsCtx from '@digitalbazaar/webkms-context';

const {defaultDocumentLoader} = vc;
const didVeresOneDriver = didVeresOne.driver({mode: 'test'});

const loader = securityLoader();
loader.addStatic(ageContext.CONTEXT_URL_V1,
  ageContext.CONTEXT_V1);
loader.addStatic(ed25519Ctx2018.CONTEXT_URL, ed25519Ctx2018.CONTEXT);
loader.addStatic(zcapConstants.ZCAP_CONTEXT_URL, zcapConstants.ZCAP_CONTEXT);
loader.addStatic(webkmsCtx.CONTEXT_URL, webkmsCtx.CONTEXT);
loader.protocolHandlers.get('did').use(didVeresOneDriver);

export const securityDocumentLoader = loader.build();

const loaders = [
  defaultDocumentLoader,
  didLoader,
  // FIXME: Enable caching and loading trusted contexts before going to Web
  // FIXME: need better handling and / or surfacing of untrusted web contexts
  webLoader
];

export async function documentLoader(url) {
  let result;

  for(const loader of loaders) {
    try {
      result = await loader(url);
    } catch(e) {
      // this loader failed move on to the next
      continue;
    }
    if(result) {
      return result;
    }
  }
  // failure, throw
  throw new Error(`Failed to load document: ${url}`);
}

async function didLoader(url) {
  if(!url.startsWith('did:')) {
    throw new Error('NotFoundError');
  }
  let result;
  try {
    result = await securityDocumentLoader(url);
  } catch(e) {
    throw new Error('NotFoundError');
  }

  return {
    contextUrl: null,
    document: result,
    documentUrl: url
  };
}

async function webLoader(url) {
  if(!url.startsWith('https:')) {
    throw new Error('NotFoundError');
  }
  let result;
  try {
    result = await httpClient.get(url);
  } catch(e) {
    throw new Error('NotFoundError');
  }

  return {
    contextUrl: null,
    document: result.data,
    documentUrl: url
  };
}
