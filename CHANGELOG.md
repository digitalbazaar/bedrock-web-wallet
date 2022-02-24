# bedrock-web-wallet ChangeLog

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
