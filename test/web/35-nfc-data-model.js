/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc. All rights reserved.
 */
import * as webWallet from '@bedrock/web-wallet';

/**
 * Tests for TemplateRenderMethod data model structure validation.
 *
 * TemplateRenderMethod structure:
 * ```
 * {
 *  "type": "TemplateRenderMethod",  // required.
 *  "renderEngine": "fixed",
 *  "renderProperty": ["/path/to/field"],
 *  "template": "data:...|z...|u...",  // required (string).
 *  "outputPreference": {
 *    "mode": ["nfc"],  // required, must include 'nfc'.
 *    "mediaType": "application/octet-stream"
 *  }
 * }
 * ```
 * Note: outputPreference.mode, template requirement, and type validation
 * are covered in 15-nfc-support.js.
 * This file focuses on optional fields and field interactions.
 */
describe('NFC Renderer', function() {
  describe('Data Model - TemplateRenderMethod Structure', function() {
    describe('type Field', function() {
      it('should fail when type is not TemplateRenderMethod',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'UnknownRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          const supportsNfc = webWallet.nfcRenderer.supportsNfc({credential});
          supportsNfc.should.equal(false);
        }
      );

      it('should fail when type field is missing',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          const supportsNfc = webWallet.nfcRenderer.supportsNfc({credential});
          supportsNfc.should.equal(false);
        }
      );
    });

    describe('renderEngine Field', function() {
      // renderEngine is reserved for future use (e.g., 'fixed')
      // current implementation ignores this field for NFC

      it('should succeed with renderEngine set to "fixed"',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderEngine: 'fixed',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );

      it('should succeed with unknown renderEngine value (ignored)',
        async () => {
          // unknown values are ignored in current implementation
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderEngine: 'xyz',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
        }
      );
    });

    describe('outputPreference.mediaType Field', function() {
      it('should succeed with mediaType set to application/octet-stream',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc'],
                mediaType: 'application/octet-stream'
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );

      it('should succeed without mediaType (optional field)',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc']
                // no mediaType
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
        }
      );

      it('should succeed with different mediaType value (not enforced)',
        async () => {
          // mediaType is informational, not enforced by current implementation
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc'],
                mediaType: 'application/cbor'
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
        }
      );
    });

    describe('Unknown Fields Handling', function() {
      it('should ignore unknown fields in renderMethod',
        async () => {
          // per JSON-LD processing, unknown fields are ignored
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc']
              },
              unknownField: 'should be ignored',
              anotherUnknown: {nested: 'value'}
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );

      it('should ignore unknown fields in outputPreference',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc'],
                unknownPref: 'ignored'
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
        }
      );
    });

    describe('Complete Structure', function() {
      it('should succeed with all optional fields present',
        async () => {
          // complete structure as per W3C spec
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              name: 'Alice Smith',
              dateOfBirth: '1990-01-15'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderEngine: 'fixed',
              renderProperty: [
                '/credentialSubject/name',
                '/credentialSubject/dateOfBirth'
              ],
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc'],
                mediaType: 'application/octet-stream'
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
          should.exist(result.bytes);
          result.bytes.should.be.an.instanceof(Uint8Array);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );

      it('should succeed with minimal required fields only',
        async () => {
          // minimum viable NFC render method
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
        }
      );
    });

    describe('Multiple Render Methods', function() {
      it('should select NFC method from array of render methods',
        async () => {
          // credentials often have multiple render methods
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: [
              {
                type: 'SvgRenderingTemplate2023',
                template: 'data:image/svg+xml;base64,PHN2Zz4...'
              },
              {
                type: 'TemplateRenderMethod',
                template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
                outputPreference: {
                  mode: ['nfc']
                }
              },
              {
                type: 'TemplateRenderMethod',
                template: 'data:application/pdf;base64,JVBERi0...',
                outputPreference: {
                  mode: ['print']
                }
              }
            ]
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          // should use the NFC method, not SVG or print
          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );

      it('should use first NFC method when multiple exist',
        async () => {
          // "First NFC" encodes to SGlyc3QgTkZD
          // "Second NFC" would be different
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: [
              {
                type: 'TemplateRenderMethod',
                template: 'data:application/octet-stream;base64,Rmlyc3QgTkZD',
                outputPreference: {
                  mode: ['nfc']
                }
              },
              {
                type: 'TemplateRenderMethod',
                template:
                  'data:application/octet-stream;base64,U2Vjb25kIE5GQw==',
                outputPreference: {
                  mode: ['nfc']
                }
              }
            ]
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('First NFC');
        }
      );
    });
  });
});
