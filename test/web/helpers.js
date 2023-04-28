/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as webSession from '@bedrock/web-session';
import * as webWallet from '@bedrock/web-wallet';
import {RegisterController} from '@bedrock/web-account';

export async function createAccount({email}) {
  if(webSession.session) {
    await webSession.session.end();
  }
  const ctrl = new RegisterController();
  ctrl.state.email = email;
  let account;
  try {
    account = await ctrl.register();
  } catch(e) {
    console.log(e);
    throw e;
  }
  await webSession.session.refresh();
  console.log(account, '<><><>account');
  return account;
}

export async function createProfile({name, email}) {
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
  const {profile} = await webWallet.helpers.createProfile({
    profileAgentContent, profileContent, profileOptions
  });
  return profile;
}
