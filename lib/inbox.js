/*!
 * Copyright (c) 2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/web';
import {getProfileEdvClient, profileManager} from '@bedrock/web-wallet';
import {httpClient} from '@digitalbazaar/http-client';

export async function initiateVcExchange({
  profileId, vcExchangeUrl, vcExchangeRedirectUrl
}) {
  const {data} = await _sendInboxZcaps({
    profileId, vcExchangeUrl, vcExchangeRedirectUrl
  });
  const [interactService] = data.verifiablePresentationRequest.interact.service;
  return {redirectUrl: interactService.serviceEndpoint};
}

export async function transferCredentials({
  profileId, credentialStore
}) {
  // get all messages from inbox
  const {edvClient} = await _getInbox({profileId});
  const {documents} = await edvClient.find({has: 'content.type'});

  const promises = [];
  for(const doc of documents) {
    const {payload} = doc.content;
    if(payload && payload.data) {
      let {verifiableCredential} = payload.data;
      if(!verifiableCredential) {
        continue;
      }

      verifiableCredential = Array.isArray(verifiableCredential) ?
        verifiableCredential : [verifiableCredential];

      const promise = credentialStore.add({
        credentials: verifiableCredential
      }).then(() => edvClient.delete({doc}));

      promises.push(promise);
    }
  }

  await Promise.all(promises);

  return {count: promises.length};
}

async function _sendInboxZcaps({
  profileId, vcExchangeUrl, vcExchangeRedirectUrl
}) {
  // get inbox and VC exchange URL in parallel
  const [inbox, {data}] = await Promise.all([
    _getInbox({profileId}),
    httpClient.post(vcExchangeUrl)
  ]);
  profileId = inbox.profileId;
  const {edvClient} = inbox;

  const {verifiablePresentationRequest} = data;
  let {
    query, interact: {service: interactService}
  } = verifiablePresentationRequest;

  query = Array.isArray(query) ? query : [query];
  interactService = Array.isArray(interactService) ?
    interactService : [interactService];

  const {capabilityQuery} = query.find(q => q.type === 'ZcapQuery');
  const {serviceEndpoint: interactServiceEndpoint} = interactService
    .find(s => s.type === 'UnmediatedPresentationService2021');
  const edvDocZcapRequest = _getZcapRequest({
    capabilityQuery, referenceId: 'inbox-edv-document'
  });
  const hmacZcapRequest = _getZcapRequest({
    capabilityQuery, referenceId: 'inbox-edv-hmac'
  });
  const keyAgreementKeyZcapRequest = _getZcapRequest({
    capabilityQuery, referenceId: 'inbox-edv-keyAgreementKey'
  });

  // generate ID for EDV doc to write to; max message size is 10 MiB
  const docId = await edvClient.generateId();

  // delegate edv doc, hmac, and key agreement key zcaps to controller
  const edvId = _getEdvId(edvClient.capability.invocationTarget);
  const hmacKeystoreId = _getKeystoreId(edvClient.hmac);
  const keyAgreementKeyKeystoreId = _getKeystoreId(edvClient.keyAgreementKey);
  // expiration is 15 minutes in the future
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  const [zcapEdvDoc, zcapHmac, zcapKeyAgreementKey] = await Promise.all([
    profileManager.delegateCapability({
      profileId,
      request: {
        ...edvDocZcapRequest,
        invocationTarget: `${edvId}/documents/${docId}`,
        capability: `urn:zcap:root:${encodeURIComponent(edvId)}`,
        expires
      }
    }),
    profileManager.delegateCapability({
      profileId,
      request: {
        ...hmacZcapRequest,
        invocationTarget: edvClient.hmac.kmsId,
        capability: `urn:zcap:root:${encodeURIComponent(hmacKeystoreId)}`,
        expires
      }
    }),
    profileManager.delegateCapability({
      profileId,
      request: {
        ...keyAgreementKeyZcapRequest,
        invocationTarget: edvClient.keyAgreementKey.kmsId,
        capability:
          `urn:zcap:root:${encodeURIComponent(keyAgreementKeyKeystoreId)}`,
        expires
      }
    })
  ]);

  const zcaps = {
    [edvDocZcapRequest.referenceId]: zcapEdvDoc,
    [hmacZcapRequest.referenceId]: zcapHmac,
    [keyAgreementKeyZcapRequest.referenceId]: zcapKeyAgreementKey,
  };

  const presentation = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    capability: zcaps
  };

  if(!!query.find(q => q.type === 'RedirectUrlQuery')) {
    presentation.redirectUrl = vcExchangeRedirectUrl ||
      config.vcExchangeRedirectUrl;
  }

  return httpClient.put(interactServiceEndpoint, {json: presentation});
}

async function _getInbox({profileId} = {}) {
  if(!profileId) {
    // choose first profile ID
    ([profileId] = await profileManager.getProfileIds({useCache: true}));
  }
  const {edvClient} = await getProfileEdvClient({
    profileId,
    referenceIdPrefix: config.wallet.defaults.edvs.inbox
  });
  edvClient.ensureIndex({attribute: 'content.type', unique: false});
  return {profileId, edvClient};
}

function _getZcapRequest({capabilityQuery, referenceId}) {
  const zcapRequest = capabilityQuery.find(q => q.referenceId === referenceId);
  if(!zcapRequest) {
    const msg = `ZCAP Request with referenceId "${referenceId}" not found.`;
    console.error(msg, {capabilityQuery});
    throw new Error(msg);
  }

  return zcapRequest;
}

function _getEdvId(edvCollectionInvocationTarget) {
  return edvCollectionInvocationTarget.slice(
    0, edvCollectionInvocationTarget.lastIndexOf('/documents'));
}

function _getKeystoreId(key) {
  const id = key.kmsId || key.id;
  return id.slice(0, id.lastIndexOf('/keys/'));
}
