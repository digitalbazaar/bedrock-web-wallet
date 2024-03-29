/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import * as webWallet from '@bedrock/web-wallet';
import {config} from '@bedrock/web';

export async function initializeWebWallet({edvBaseUrl}) {
  config.wallet.defaults.edvBaseUrl = edvBaseUrl;
  await webWallet.initialize();
}

export async function createProfile({name, email, accountId}) {
  const profileContent = {
    name,
    shared: false,
    type: [
      'User',
      'Person'
    ]
  };
  const profileAgentContent = {
    email,
    name: 'root',
    type: ['User', 'Person'],
    access: 'full'
  };
  const profileOptions = {
    didMethod: 'v1',
    didOptions: {
      mode: 'test'
    }
  };
  // Add account id to session
  webWallet.profileManager.session.data = {
    account: {
      id: accountId
    }
  };
  // Add account id to profileManager
  webWallet.profileManager.accountId = accountId;

  return webWallet.helpers.createProfile({
    profileAgentContent, profileContent, profileOptions
  });
}

export function createUnsignedPresentation({
  profileId, presentationId, verifiableCredential
}) {
  // create an unsigned presentation
  const unsignedPresentation = vc.createPresentation({
    holder: profileId,
    id: presentationId,
    verifiableCredential
  });
  return unsignedPresentation;
}

export function assertSignedPresentation({
  signedPresentation, credential, presentationId, profileId, expectedProofType,
  expectedCryptosuite
} = {}) {
  signedPresentation.verifiableCredential[0].should.eql(credential);
  signedPresentation.type.should.eql(['VerifiablePresentation']);
  signedPresentation.id.should.equal(presentationId);
  signedPresentation.holder.should.equal(profileId);
  signedPresentation.should.have.property('proof');
  signedPresentation.proof.type.should.equal(expectedProofType);
  if(expectedCryptosuite) {
    signedPresentation.proof.cryptosuite.should.equal(expectedCryptosuite);
  }
}
