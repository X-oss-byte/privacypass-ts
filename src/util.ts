// Copyright (c) 2023 Cloudflare, Inc.
// Licensed under the Apache-2.0 license found in the LICENSE file or at https://opensource.org/licenses/Apache-2.0

import * as asn1js from 'asn1js';

// Convert a RSA-PSS key into a RSA Encryption key.
// This is required because browsers do not support import RSA-PSS keys.
//
// Chromium: https://www.chromium.org/blink/webcrypto/#supported-key-formats
// Firefox: https://github.com/mozilla/pkipolicy/blob/master/rootstore/policy.md#511-rsa
//
// Documentation: https://www.rfc-editor.org/rfc/rfc4055#section-6
export function convertRSASSAPSSToEnc(keyRSAPSSEncSpki: Uint8Array): Uint8Array {
    const RSAEncryptionAlgID = '1.2.840.113549.1.1.1';
    const schema = new asn1js.Sequence({
        value: [
            new asn1js.Sequence({ name: 'algorithm' }),
            new asn1js.BitString({ name: 'subjectPublicKey' }),
        ],
    });
    const cmp = asn1js.verifySchema(keyRSAPSSEncSpki, schema);
    if (cmp.verified != true) {
        throw new Error('bad parsing');
    }

    const keyASN = new asn1js.Sequence({
        value: [
            new asn1js.Sequence({
                value: [
                    new asn1js.ObjectIdentifier({ value: RSAEncryptionAlgID }),
                    new asn1js.Null(),
                ],
            }),
            cmp.result.subjectPublicKey,
        ],
    });

    return new Uint8Array(keyASN.toBER());
}

function algorithm() {
    const RSAPSSAlgID = '1.2.840.113549.1.1.10';
    const publicKeyParams = new asn1js.Sequence({
        value: [
            new asn1js.Constructed({
                idBlock: {
                    tagClass: 3, // CONTEXT-SPECIFIC
                    tagNumber: 0, // [0]
                },
                value: [
                    new asn1js.Sequence({
                        value: [
                            new asn1js.ObjectIdentifier({ value: '2.16.840.1.101.3.4.2.2' }), // sha-384
                        ],
                    }),
                ],
            }),
            new asn1js.Constructed({
                idBlock: {
                    tagClass: 3, // CONTEXT-SPECIFIC
                    tagNumber: 1, // [1]
                },
                value: [
                    new asn1js.Sequence({
                        value: [
                            new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.1.8' }), // pkcs1-MGF
                            new asn1js.Sequence({
                                value: [
                                    new asn1js.ObjectIdentifier({
                                        value: '2.16.840.1.101.3.4.2.2',
                                    }), // sha-384
                                ],
                            }),
                        ],
                    }),
                ],
            }),
            new asn1js.Constructed({
                idBlock: {
                    tagClass: 3, // CONTEXT-SPECIFIC
                    tagNumber: 2, // [2]
                },
                value: [
                    new asn1js.Integer({ value: 48 }), // sLen = 48
                ],
            }),
        ],
    });

    return new asn1js.Sequence({
        value: [new asn1js.ObjectIdentifier({ value: RSAPSSAlgID }), publicKeyParams],
    });
}

// Exports a RSA-PSS key as RSASSA-PSS.
// This is required because browsers do not support exporting RSA-PSS keys.
//
// Chromium: https://www.chromium.org/blink/webcrypto/#supported-key-formats
// Firefox: https://github.com/mozilla/pkipolicy/blob/master/rootstore/policy.md#511-rsa
//
// Documentation: https://www.rfc-editor.org/rfc/rfc4055#section-6
export function convertEncToRSASSAPSS(keyEncRSAPSSSpki: Uint8Array): Uint8Array {
    const algorithmID = algorithm();

    // I'm not sure how to access the spki directly as a BitString, therefore using any to access the Sequence value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s2 = asn1js.fromBER(keyEncRSAPSSSpki).result as any;
    const spki = s2.valueBlock.value[1];

    const asn = new asn1js.Sequence({
        value: [algorithmID, spki],
    });

    return new Uint8Array(asn.toBER());
}

export function joinAll(a: ArrayBuffer[]): ArrayBuffer {
    let size = 0;
    for (const ai of a) {
        size += ai.byteLength;
    }

    const buffer = new ArrayBuffer(size);
    const view = new Uint8Array(buffer);
    let offset = 0;
    for (const ai of a) {
        view.set(new Uint8Array(ai), offset);
        offset += ai.byteLength;
    }

    return buffer;
}
