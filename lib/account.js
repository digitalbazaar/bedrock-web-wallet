/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {AccountService} from '@bedrock/web-account';
import {session} from '@bedrock/web-session';

export async function getPrimaryEmail() {
  if(!session.data.account) {
    return '';
  }
  const service = new AccountService();
  const {account} = await service.get({id: session.data.account.id});
  return account.email;
}
