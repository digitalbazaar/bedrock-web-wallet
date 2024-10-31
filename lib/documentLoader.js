/*!
 * Copyright (c) 2015-2024 Digital Bazaar, Inc. All rights reserved.
 */
import * as didVeresOne from 'did-veres-one';
import {contexts as ageContexts} from '@digitalbazaar/age-verification-context';
import {defaultDocumentLoader} from '@digitalbazaar/vc';
import {contexts as diContexts} from '@digitalbazaar/data-integrity-context';
import {contexts as ed255192018Contexts} from 'ed25519-signature-2018-context';
import {httpClient} from '@digitalbazaar/http-client';
import {securityLoader} from '@digitalbazaar/security-document-loader';
import {constants as zcapConstants} from '@digitalbazaar/zcap';

const loader = securityLoader();
loader.addDocuments({
  documents: [
    ...ageContexts,
    ...diContexts,
    ...ed255192018Contexts
  ]
});
loader.addStatic(zcapConstants.ZCAP_CONTEXT_URL, zcapConstants.ZCAP_CONTEXT);
const didVeresOneDriver = didVeresOne.driver({mode: 'test'});
loader.protocolHandlers.get('did').use(didVeresOneDriver);

export const securityDocumentLoader = loader.build();

const loaders = [
  defaultDocumentLoader,
  securityDocumentLoader,
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
