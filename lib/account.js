/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {AccountService} from 'bedrock-web-account';
import {getSession} from 'bedrock-web-session';
import {
  getAllDisplayableCredentials, sortCredentials
} from './credentialHelpers.js';
import {profileManager} from './state.js';

export async function getPrimaryEmail() {
  const session = await getSession();
  if(!session.data.account) {
    return '';
  }
  const service = new AccountService();
  const {account} = await service.get({id: session.data.account.id});
  return account.email;
}

export async function getName() {
  const profiles = await profileManager.getProfiles({type: 'Person'});
  const allCredentials = (await getAllDisplayableCredentials(profiles))
    .map(({credential}) => credential);
  const sortedCredentials = await sortCredentials(allCredentials);
  const firstName = sortedCredentials[0].credentialSubject.givenName;
  const lastName = sortedCredentials[0].credentialSubject.familyName;
  return firstName + ' ' + lastName;
}
