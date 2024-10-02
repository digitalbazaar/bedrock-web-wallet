# bedrock-web-wallet ChangeLog

## 14.6.1 - 2024-10-02

### Fixed
- Ensure VC 2.0 context is used when returning 2.0 VCs from OID4VCI.

## 14.6.0 - 2024-10-01

### Changed
- Use `@digitalbazaar/oid4-client@4.1` to get latest updates.

## 14.5.0 - 2024-09-30

### Changed
- Ensure VCDM mandatory fields of `issuer` and `issuanceDate` (for VC 1.x)
  are always included in selective-disclosure derived VCs.

## 14.4.0 - 2024-09-20

### Changed
- Use `@digitalbazaar/oid4-client@4` to get latest updates including
  support for processing `allOf` JSON schema usage in OID4VP authorization
  requests.

## 14.3.0 - 2024-09-18

### Added
- Add support for NFC render method transmission.

## 14.2.0 - 2024-09-16

### Changed
- Update dependencies.

### Fixed
- Use non-obsolete bbs-2023 cryptosuite.

## 14.1.1 - 2024-09-15

### Fixed
- Fix return value from `presentations.match()`, ensuring its
  shape is consistent whether there are matches or not.

## 14.1.0 - 2024-08-23

### Changed
- Use `@digitalbazaar/oid4-client@3.7.0`.
- Use `getCredentialOffer()` to obtain OID4VCI credential offer.

## 14.0.0 - 2024-08-06

### Changed
- **BREAKING**: Update peer dependencies.
  - `@bedrock/web@3.1.0`.
  - `@bedrock/web-account@6.1.0`.
  - `@bedrock/web-pouch-edv@8.1.0`.
  - `@bedrock/web-profile-manager@21` (major version update).
- **BREAKING**: Update dependencies.
  - `@digitalbazaar/security-document-loader@3`.
    - Adds VC 2.0 support.
  - `@digitalbazaar/vc@7`.
    - Adds VC 2.0 support.
  - `@digitalbazaar/vpqr@4.1.0`
    - Updates `cborld` compression codecs.
- Update minor, test, dev, and other dependencies.

## 13.6.0 - 2024-08-05

### Added
- Allow use of VC 2.0 verifiable presentations in exchanges.

## 13.5.0 - 2024-07-11

### Added
- Add ability to perform OID4VP when a presentation is required during
  OID4VCI.

### Fixed
- Fix context imports.

## 13.4.1 - 2024-01-19

### Changed
- Fix initial cryptosuite preference to be based on query's
  `acceptedCryptosuite` order.

## 13.4.0 - 2024-01-19

### Changed
- Prefer using `bbs` over `ecdsa-sd` for unlinkability advantages.

## 13.3.0 - 2024-01-17

### Added
- Add feature to generate `bbs-sd-2023` derived proofs.

## 13.2.0 - 2023-12-14

### Added
- Add `presentations.match()` API for matching a VPR against
  a credential store.
- Enable derivation of SD credentials using `ecdsa-sd-2023` when
  a VPR `QueryByExample` `credentialQuery` indicates it is an
  accepted cryptosuite and a match VC has an `ecdsa-sd-2023` proof.

## 13.1.0 - 2023-12-06

### Added
- Add support for signing presentation using `eddsa-rdfc-2022`.

## 13.0.0 - 2023-11-12

### Added
- **BREAKING**: A configurable proof allow list will now be used
  to prune presentations during VC exchange to ensure that only
  proofs on the allow list will be permitted in VCs in the
  presentation. This feature helps prevent users from sharing
  proof meta data that they haven't consented to sharing, such
  as meta data that helps them perform selective disclosure.

## 12.1.0 - 2023-10-25

### Added
- Add basic OID4VP support. There are many differences in OID4VP
  implementations in the ecosystem today and OID4VP is still in
  draft form. This implementation supports a profile of draft 20
  that uses LDP / Data Integrity secured VCs through the use of
  features from `@digitalbazaar/oid4-client@3.1` for converting
  a subset of VPRs to authorization requests and vice versa.
  This OID4VP implementation should be considered experimental
  as the ecosystem matures and changes are made.

## 12.0.1 - 2023-10-18

### Fixed
- Revert peer deps:
  - `@bedrock/web@4.0` to v3.0.
  - `@bedrock/web-vc-store@9.0` to v8.0.1.

## 12.0.0 - 2023-10-16

### Changed
- **BREAKING**: Drop support for Node.js < 18.
- Update deps:
  - Use `@digitalbazaar/edv-client@16.0`. Drops support for Node.js < 18 and
    uses `@digitalbazaar/http-client@4` and `canonicalize@2`.
  - Use `@digitalbazaar/http-client@4`. Requires Node.js 18+.
  - Use `@digitalbazaar/vc@6.0.2`. Removes ODRL and VC examples contexts and
    fixes bug with option overrides for verifying presentations.
  - Use `did-veres-one@16`. Updated dependencies use the newer default safe
    mode of jsonld.
- Update peer deps:
  - Use `@bedrock/web@4.0`. Drops support for Node.js < 18.
  - Use `@bedrock/web-account@6.0`. Drops support for Node.js < 18 and uses
    `@digitalbazaar/http-client@4`.
  - Use `@bedrock/web-pouch-edv@8.0`. Drops support for Node.js < 18 and uses
    `@digitalbazaar/edv-client@16.0`
  - Use `@bedrock/web-profile-manager@20.0`. Drops support for Node.js < 18 and
    uses deps that requires Node.js 18+.
  - Use `@bedrock/web-session@6.0`. Drops support for Node.js < 18 and uses
    `@digitalbazaar/http-client@4.0`.
  - Use `@bedrock/web-vc-store@9.0.0`. Use `exports` instead of `module` and
    Requires Web Crypto API exists for testing. Drops support for Node.js < 18.

## 11.4.1 - 2023-08-31

### Fixed
- Do not cache VPR from CHAPI event if it is empty.
- Allow empty verifiable presentation in exchange; treat as `null`.

## 11.4.0 - 2023-08-09

### Changed
- Use `@digitalbazaar/oid4-client@3`.

## 11.3.3 - 2023-08-08

### Fixed
- Fix parsing of `protocols` in CHAPI store events.

## 11.3.2 - 2023-08-08

### Fixed
- Use `console.warn` instead of `console.error` on VP that cannot be
  parsed for CHAPI direct exchange processing.

## 11.3.1 - 2023-08-03

### Fixed
- Block list fake VC API demo exchange URLs.

## 11.3.0 - 2023-08-03

### Added
- Add `exchanges` export with `start()` function for starting an exchange
  based off of a CHAPI event. The returned `exchange` instance has an API
  that allows the next step of the exchange to be executed by calling `next()`,
  which returns a WHATWG streams-like result of `{value, done: true|false}`.
  The returned value is expected to be either `null` (only when `done` is
  `true`) or an object including one or both of `verifiablePresentation` or
  `verifiablePresentationRequest` indicating data to store and / or data
  that is requested (respectfully). Once the exchange is complete, the
  boolean `done` is set to `true`. The exchange can be closed via `close()`
  without error or with an error (by passing `{error}`) and must be
  closed after `done` is `true`. It can be canceled prematurely by calling
  `cancel()`.
- Add support for OID4VCI and VCAPI exchanges.

## 11.2.2 - 2023-06-08

### Fixed
- Add a `cryptoSuites.supported` alias for `cryptosuites.supportedSuites`. The
  exported value was renamed in the minor 11.2.0 release without backwards API
  compatibility support.

## 11.2.1 - 2023-05-05

### Fixed
- Enable key type `Ed25519VerificationKey2020` to be used with ed25519
  cryptosuites (`Ed25519Signature2018`, `Ed25519Signature2020`, or
  `eddsa-2022`).

## 11.2.0 - 2023-05-05

### Added
- Throw an error if the profile used in `presentations.sign()` (by passing
  `profileId`) cannot sign using one of the passed `acceptedProofTypes`.
  Practically speaking, only the `Ed25519Signature2020` proof type is supported
  at this time.
- Add tests for `presentations.sign()`.

### Fixed
- Fix conditionals to check if `acceptedProofTypes` is a non-empty array in
  `presentations.sign()`.

## 11.1.0 - 2023-04-20

### Added
- Add `eddsa-2022` to supported signature suites.

## 11.0.1 - 2023-02-09

### Fixed
- Merge the contents of `profileContent` to the `profile` returned from
  `createProfile()` in `lib/helpers.js`.

## 11.0.0 - 2023-01-24

### Changed
- **BREAKING**: Update peer deps:
  - `@bedrock/web-account@5`.
  - This requires an indirect dependency of `@bedrock/account@9` that
    changes include database layout and record format changes that are
    incompatible with previous releases.

## 10.0.1 - 2022-12-17

### Fixed
- Do not throw for expired age verification credentials during reissuance
  request; allow the reissue endpoint to decide how to handle them.

## 10.0.0 - 2022-11-13

### Changed
- **BREAKING**: Update signature / vc libraries to get better safe mode
  protections by default.

## 9.1.0 - 2022-11-07

### Changed
- Remove unnecessary proof type checks on received VCs.

## 9.0.1 - 2022-09-22

### Fixed
- Use `startsWith` for DID method checks.

## 9.0.0 - 2022-08-19

### Changed
- **BREAKING**: Use `exports` instead of `module`.
- Update dependencies.
- Lint module.

## 8.2.0 - 2022-08-11

### Added
- Add support for credentials without an `id` property.

### Changed
- Use `@bedrock/web-vc-store@7.4` to get storage features for VCs without
  `id` property.

## 8.1.1 - 2022-06-03

### Fixed
- Changed default store option to add bundle contents first *as a bug fix*.

## 8.1.0 - 2022-06-03

### Added
- Add `options` section to `credentialStore[<store name>]`. These options
  will be passed to the store when it is constructed and should be set
  before initializing the wallet.

### Changed
- Update `@bedrock/web-vc-store` to v7.3 to get additional features.

## 8.0.0 - 2022-05-30

### Changed
- **BREAKING**: Update peer deps:
  - Use `@bedrock/web-pouch-edv@6`.
- **BREAKING**: This version uses the new `indexeddb` adapter for better
  performance and concurrency with the pouch EDV implementation. Old
  pouch EDV storage will be made obsolete and not migrated or deleted;
  new storage will be created.

## 7.3.0 - 2022-05-29

### Changed
- Allow `profileId` to be optionally specified when starting an inbox
  VC exchange; otherwise fallback to the default behavior of using
  the first profile on the authenticated account.
- Perform more steps in parallel when performing an inbox VC exchange to
  improve performance.

## 7.2.1 - 2022-05-26

### Fixed
- Ensure profile cache is updated after changing profile content on
  initial profile creation.

## 7.2.0 - 2022-05-17

### Changed
- Use profile cache, if available, when processing inbox. Update
  `@bedrock/web-profile-manager@17.1` peer dep to get profile cache feature.

## 7.1.0 - 2022-05-12

### Changed
- Optimistically fetch VCs during reissuance to reduce waiting on network
  in common cases.

## 7.0.0 - 2022-05-05

### Changed
- **BREAKING**: Use `@digitalbazaar/edv-client@14` with new blind attribute
  version. This version must be paired against
  `@bedrock/web-profile-manager@17` and
  `@bedrock/web-pouch-edv@5` which are incompatible with
  previous versions without performing a migration of all EDV documents from
  blind attribute version 1 to version 2.

## 6.1.2 - 2022-05-03

### Fixed
- Fix parsing of local EDV ID.

## 6.1.1 - 2022-05-03

### Fixed
- Do not wait for non-critical deletion of VCs post reissue.

## 6.1.0 - 2022-04-22

### Added
- Add wallet inbox utilities.

## 6.0.1 - 2022-04-19

### Fixed
- Ensure remote container VC is deleted when no photo credential is present.

## 6.0.0 - 2022-04-18

### Changed
- **BREAKING**: Updated peer dependencies:
  - `@bedrock/web-profile-manager@16`.
- **BREAKING**: This version of the library only works with a server that
  supports backend profile provisioning and access management initialization.
  A server that previously did not support this can be updated to support it
  by installing `@bedrock/profile@17` and `@bedrock/profile-http@16`. This
  upgrade should not change the database structure but will result in removing
  any old profiles that are determined to be broken / unusable, enabling
  users to move beyond any bugs generated by the old corrupted state.
- **BREAKING**: Profile options must be passed separately from profile content
  in `createProfile`.

### Removed
- Remove unused `config.wallet.defaults.edvs.users` config variable.

## 5.0.0 - 2022-04-10

### Changed
- **BREAKING**: Rename package to `@bedrock/web-wallet`.
- **BREAKING**: Convert to module (ESM).

## 4.3.2 - 2022-04-07

### Fixed
- Delete remote age VC if personal photo is missing during reissue.

## 4.3.1 - 2022-04-06

### Fixed
- Handle corrupted or invalidated age VCs during reissue process.

## 4.3.0 - 2022-03-27

### Changed
- Update peer deps:
  - `bedrock-web-profile-manager@14`.

## 4.2.0 - 2022-03-18

### Changed
- Remove unused config vars.

## 4.1.0 - 2022-03-10

### Changed
- Improve age VC refresh code. If a local bundled age VC does
  not match the remote copy, remove it and refresh the remote
  copy.

## 4.0.0 - 2022-03-10

### Changed
- **BREAKING**: Use `@digitalbazaar/age-verification-context@2`.

## 3.0.2 - 2022-03-09

### Fixed
- Ensure VC AV bundle is deleted if container VC ID was not given
  as reissue param.

## 3.0.1 - 2022-03-09

### Fixed
- Ensure `id` is set when passed to credential storage `delete`.

## 3.0.0 - 2022-03-01

### Changed
- **BREAKING**: Use `@digitalbazaar/webkms-client@10` and
  `@digitalbazaar/edv-client@13`.
- **BREAKING**: Require `bedrock-web-profile-manager@13` and
  `bedrock-web-pouch-edv@3` as a peer dependencies.

## 2.1.0 - 2022-02-23

### Added
- Add `inbox` EDV on profile creation.

## 2.0.0 - 2022-02-23

### Changed
- **BREAKING**: Use `bedrock-web-profile-manager@12`,
  `@digitalbazaar/edv-client@12`, and `bedrock-web-pouch-edv@2`. These new
  versions compute encrypted indexes for EDVs differently (more privacy
  preserving) and are therefore incompatible with previous versions.

## 1.2.1 - 2022-02-23

### Fixed
- Fix cache key for profile EDVs (add `referenceIdPrefix` to namespace).

## 1.2.0 - 2022-02-21

### Changed
- Use `@digitalbazaar/age-verification-context` v1.0. This new package
  offers the same feature and API as the old dependency.

## 1.1.0 - 2022-02-21

### Changed
- Remove `_getReferenceId()` from `lib/config.js`.
- Move `onboardLink` to config.

### Added
- Add missing dependencies.

## 1.0.3 - 2022-02-16

### Fixed
- Ensure photo VC is rebundled during age VC reissuance.

## 1.0.2 - 2022-02-16

### Fixed
- Fix typo in `reissue` query.

## 1.0.1 - 2022-02-15

### Fixed
- Fix local credential query bugs.
- Fix bundle filtering bugs.

## 1.0.0 - 2020-02-10

- See git history for changes.
