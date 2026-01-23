/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc. All rights reserved.
 */

import * as webWallet from '@bedrock/web-wallet';

/**
 * Tests for supportsNfc() - checks if a credential has valid NFC render method.
 *
 * Detection logic.
 *
 *  TemplateRenderMethod: requires outputPreference.mode array containing 'nfc'
 *  AND a template field.
 *
 *  NfcRenderingTemplate2024 (legacy): requires payload field.
 */
describe('NFC Renderer', function() {
  describe('supportsNfc()', function() {
    describe('Valid NFC Detection', function() {
      it('should return true for TemplateRenderMethod with ' +
        'outputPreference.mode containing "nfc"',
      async () => {
        // minimal valid structure
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

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(true);
      });

      it('should return true when mode array contains multiple values ' +
        'including "nfc"',
      async () => {
        // credentials can support multiple output modes
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
            outputPreference: {
              mode: ['qrcode', 'nfc', 'print']
            }
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(true);
      });

      it('should return true when renderMethod is an array with ' +
        'one NFC-compatible method',
      async () => {
        // credentials often have multiple render methods (SVG, PDF, NFC)
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: [
            {
              type: 'SvgRenderingTemplate2023',
              template: 'some-svg-data'
            },
            {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc']
              }
            }
          ]
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(true);
      });

      it('should return true with full TemplateRenderMethod structure',
        async () => {
          // Complete structure with all optional fields
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              name: 'Alice'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderEngine: 'fixed',
              renderProperty: ['/credentialSubject/name'],
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc'],
                mediaType: 'application/octet-stream'
              }
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({credential});
          should.exist(result);
          result.should.equal(true);
        }
      );
    });

    describe('Invalid NFC Detection - Missing Required Fields', function() {
      it('should return false when template is missing ' +
        '(pre-filters invalid methods)',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'John Doe'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderProperty: ['/credentialSubject/name'],
            outputPreference: {
              mode: ['nfc']
            }
            // missing template - will fail validation
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(false);
      });

      it('should return false when outputPreference is missing',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              // missing outputPreference
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({credential});
          should.exist(result);
          result.should.equal(false);
        }
      );

      it('should return false when outputPreference.mode is missing',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mediaType: 'application/octet-stream'
                // missing mode
              }
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({credential});
          should.exist(result);
          result.should.equal(false);
        }
      );

      it('should return false for credential without renderMethod',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123'
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({credential});
          should.exist(result);
          result.should.equal(false);
        }
      );

      it('should return false for credential with non-NFC renderMethod',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'SvgRenderingTemplate2023',
              template: 'some-svg-data'
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({credential});
          should.exist(result);
          result.should.equal(false);
        }
      );
    });

    describe('Invalid NFC Detection - Malformed outputPreference', function() {
      it('should return false when mode is a string instead of array',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                // mode MUST be an array, not a string
                mode: 'nfc'
              }
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({credential});
          should.exist(result);
          result.should.equal(false);
        }
      );

      it('should return false when mode array is empty',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: []
              }
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({credential});
          should.exist(result);
          result.should.equal(false);
        }
      );

      it('should return false when mode array does not contain "nfc"',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['qrcode', 'print']
              }
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({credential});
          should.exist(result);
          result.should.equal(false);
        }
      );

      it('should return false when mode value is case-different ("NFC")',
        async () => {
          // The implementation uses strict equality: modes.includes('nfc')
          // Uppercase "NFC" should not match
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['NFC']
              }
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({credential});
          should.exist(result);
          result.should.equal(false);
        }
      );
    });

    // backward compatibility with existing bedrock-web-wallet credentials
    describe('Legacy Format - NfcRenderingTemplate2024', function() {
      it('should return true for legacy NfcRenderingTemplate2024 ' +
        'with payload field',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'NfcRenderingTemplate2024',
            payload: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(true);
      });

      it('should return false for NfcRenderingTemplate2024 ' +
        'without payload field',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'NfcRenderingTemplate2024'
            // missing payload
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(false);
      });

      it('should return false for NfcRenderingTemplate2024 ' +
        'using template field instead of payload',
      async () => {
        // NfcRenderingTemplate2024 MUST use 'payload', not 'template'
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'NfcRenderingTemplate2024',
            template: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(false);
      });
    });
  });
});
