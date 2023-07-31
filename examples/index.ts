// Copyright (c) 2023 Cloudflare, Inc.
// Licensed under the Apache-2.0 license found in the LICENSE file or at https://opensource.org/licenses/Apache-2.0

import { webcrypto } from 'node:crypto';

if (typeof crypto === 'undefined') {
    global.crypto = webcrypto as unknown as Crypto;
}

async function examples() {
    console.log("examples here")
}

examples().catch((e: Error) => {
    console.log(`Error: ${e.message}`);
    console.log(`Stack: ${e.stack}`);
    process.exit(1);
});
