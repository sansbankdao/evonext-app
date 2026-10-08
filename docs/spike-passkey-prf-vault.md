# Spike — Passkey (WebAuthn PRF) Key Vault for EvoNext

Date: 2026-10-05. Status: proposal, not implemented.
Scope: web app (Next.js static export). React Native deferred to §7.

Sources reviewed before writing this (per request):
- `react-native-passkey` v3.6.2 — npm registry metadata + README
  (`github.com/f-23/react-native-passkey`). Native-only (iOS 15+/Android API 28+);
  `Passkey.create()`/`Passkey.get()` wrap the platform APIs; supports `largeBlob`
  (iOS 17+) and requests the `prf` extension.
- `passkey-server-example` — `github.com/f-23/passkey-server-example`, NestJS +
  `@simplewebauthn/server`, 4-endpoint ceremony. Verified from
  `src/routes/auth/auth.controller.ts`: it sends
  `extensions: { prf: { eval: { first, second } } }` in the auth options. That is
  the load-bearing pattern for what follows.

---

## 0. What already exists in this repo (verified)

| File | What it does | Verdict |
|---|---|---|
| `lib/passkey.ts` | `createPasskey`/`getPasskey` derive "entropy" as `SHA-256(rawId ‖ authenticatorData)` | **BROKEN by design** — see §1 |
| `lib/biometric-storage.ts` | WebAuthn gate + AES encrypt; `authenticate()` returns `true` after `navigator.credentials.get()` | Auth-only; **no real key derivation**; comment admits "you would verify the assertion signature here. For now, we trust…" |
| `lib/secure-storage.ts` | In-memory + sessionStorage for the WIF; `beforeunload`/`pagehide` wipes keys (F26 note: suspected "disconnect on Edit" cause) | Working, but fragile UX |
| `app/gifts/page.tsx` | Calls `createPasskey`/`getPasskey`, logs entropy to console | Demo only |
| `components/settings/biometric-settings.tsx` | UI for biometric toggle | Not rendered anywhere (AGENTS.md) |

`lib/dash-platform-client.ts` (L161–176) already has the fallback chain:
memory → `getPrivateKeyWithBiometric(identityId)`. **This is the integration point.**

---

## 1. Why the current `lib/passkey.ts` cannot work

It derives the vault key as:

```
entropy = SHA-256( credential.rawId ‖ authenticatorData )
```

`authenticatorData` in a WebAuthn **assertion** (`.get()`) contains the
**signature counter**, which the authenticator increments on every
authentication. Consequences:

1. `createPasskey` (attestation) and `getPasskey` (assertion) produce
   **different** `authenticatorData` → different entropy.
2. Two consecutive `getPasskey` calls produce different entropy (counter +1).
3. Therefore the "entropy" is **non-deterministic** — it can never re-derive the
   same key twice. Any wallet key or ciphertext keyed to it is unrecoverable.

It has not been caught because the only consumer (`gifts/page.tsx`) logs the
value and never reuses it. **Do not build on this function.** It must be
replaced, not patched.

Additionally, both it and `biometric-storage.ts` generate a fresh random
challenge client-side and never verify the signature — fine for a local KEK
vault (§3), but it means the current code provides **authentication theater**,
not key custody.

## 2. The correct primitive: WebAuthn `prf` extension

The passkey itself cannot hand you a private key. The value is the
**`hmac-secret` / PRF extension**: the authenticator computes a deterministic
32-byte secret from `(credential, salt)` using its internal, hardware-bound key.

```
prfOutput = HMAC-SHA-256( authenticatorSecret , SHA-256("WebAuthn PRF" ‖ 0x00 ‖ salt) )
```

- **Same passkey + same salt → same 32 bytes, forever, on every device the
  passkey syncs to** (iCloud Keychain, Google Password Manager).
- The secret never leaves the authenticator in the clear; the RP only receives
  the HMAC output.
- This is exactly what the `passkey-server-example` requests via
  `extensions: { prf: { eval: { first, second } } }`.

**Use `prfOutput` as a Key Encryption Key (KEK). Never as the identity key
directly.** Reasons: (a) you cannot choose/rotate it; (b) a KEK lets the user
keep their existing Dash identity key and just re-wrap it; (c) it composes with
the mnemonic as a separate custody path.

### PRF support matrix (why the mnemonic stays)
- Supported: platform authenticators (Touch ID / Face ID, Windows Hello,
  Android biometrics), synced passkeys.
- **Not supported: many hardware security keys (older YubiKeys), and some
  browser/authenticator combos.**
- The `create()` response reports it via
  `clientExtensionResults.prf.enabled`. **Gate the whole flow on that flag.**
- Conclusion: passkey = convenience unlock. The 12/24-word mnemonic remains the
  recovery root. Never let PRF be the *only* custody of a funded identity.

## 3. Proposed design — `lib/passkey-vault.ts` (client-only, no server)

Self-custodial model: the Dash identity key never leaves the client. The passkey
is a local KEK source; **no server verification is required** (unlike the
server-example's session flow). This keeps EvoNext's static-export, no-backend
architecture intact.

### Data model (localStorage / IndexedDB)
```
evonext_pv_<identityId> = {
  credentialId : base64url,   // the passkey's rawId
  salt         : base64url,   // 32 bytes, fixed per identity
  iv           : base64url,   // 12 bytes, AES-GCM
  ciphertext   : base64url,   // AES-GCM(KEK, identityPrivateKeyWIF)
  version      : 1,
  createdAt    : number
}
```
The ciphertext + salt + credentialId are **not secret**; secrecy lives in the
authenticator's hardware key.

### Flow A — Enroll ("Secure this identity with a passkey")
1. Preconditions: user is connected; identity private key (WIF) is in memory;
   `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` true.
2. Generate `salt = crypto.getRandomValues(32)`.
3. `navigator.credentials.create({ publicKey: { rp:{name:'EvoNext',id:hostname},
   user:{…}, challenge: random(32), pubKeyCredParams:[{alg:-7,type:'public-key'}],
   authenticatorSelection:{authenticatorAttachment:'platform',
   residentKey:'preferred', userVerification:'required'},
   extensions:{ prf:{ eval:{ first: salt } } } } })`
4. Read `credential.getClientExtensionResults().prf`. **If
   `prf.enabled !== true` → abort, offer mnemonic-only custody.**
5. Derive KEK: `KEK = HKDF-SHA256(prf.results.first, salt, info="evonext-pv-kek")`.
   (HKDF via `crypto.subtle.importKey('raw', …)` + `deriveBits`; do NOT use the
   raw PRF output directly as the AES key.)
6. `iv = crypto.getRandomValues(12)`;
   `ciphertext = AES-GCM(KEK, utf8(WIF), iv)`.
7. Persist the record; zero the WIF from the enrollment buffer.
8. UX: "Passkey unlock enabled. Your recovery phrase is still the master backup —
   keep it safe."

### Flow B — Unlock (login / sign)
1. Read the record; `navigator.credentials.get({ publicKey: {
   challenge: random(32), rpId: hostname,
   allowCredentials:[{id: credentialId, type:'public-key'}],
   userVerification:'required',
   extensions:{ prf:{ eval:{ first: salt } } } } })`
2. `prf.results.first` → same KEK (HKDF, same salt/info).
3. `AES-GCM-decrypt(ciphertext, iv, KEK)` → WIF.
4. Hand the WIF to the existing custody path (memory / `secure-storage`).

### Integration point
`dash-platform-client.ts` L161–176 fallback chain becomes:
```
memory  →  passkey-vault (if record exists)  →  biometric-storage (legacy)  →  prompt user
```
This also fixes the F26 `secure-storage` "disconnect on Edit" pain: the key can
be re-derived from the passkey after a page unload instead of being lost.

## 4. WebAuthn types note
The repo targets TS5 + DOM lib. `prf` extension typing is in
`@types/webauthn` / recent TS DOM lib; if the ambient types lag, cast the
extension objects (`as PublicKeyCredentialCreationOptions` /
`…RequestOptions`) exactly as `lib/passkey.ts` already does. The runtime
browser API is what matters; the types are a compile-time nicety.

## 5. Security properties & limits
- **Phishing resistance**: WebAuthn binds to `rpId = hostname`; a lookalike
  origin cannot trigger the authenticator. (Stronger than password/PIN.)
- **Hardware binding**: PRF secret lives in the secure enclave / TPM.
- **Ciphertext-at-rest is safe**: AES-GCM-256 under an HKDF-derived KEK.
- **No replay protection needed locally**: we never verify the assertion
  signature; we only consume the PRF output, which requires physical presence +
  user verification. The random challenge is included for spec compliance.
- **Limit**: if the user deletes the passkey AND loses the mnemonic, the key is
  gone. This is inherent to self-custody; surface it in UX.
- **Limit**: PRF output is identical across devices sharing the synced passkey —
  by design (that's the cross-device unlock feature), but it means a compromised
  cloud keychain account that exports the passkey compromises the vault. The
  mnemonic has the same property; document it.

## 6. What we do NOT adopt from the server example
- No NestJS/session challenge store — EvoNext has no auth server.
- No `verifyRegistrationResponse`/`verifyAuthenticationResponse` — optional
  hardening, unnecessary for a local KEK vault.
- No `android:apk-key-hash` origin — web-only for now.

## 7. React Native path (future)
When the native app happens (`.well-known/apple-app-site-association` +
`assetlinks.json` already ship — add `webcredentials` / `get_login_creds`
entries): swap `navigator.credentials` for `react-native-passkey`
(`Passkey.create`/`Passkey.get`), keep the identical PRF-salt → HKDF → AES-GCM
vault logic. `largeBlob` (iOS 17+) could store the encrypted WIF *inside* the
credential instead of localStorage, but is iOS-only and less portable than PRF —
prefer PRF for parity with web.

## 8. Open questions before implementation
1. Per-identity salt (recommended, isolates identities) vs per-credential —
   confirm multi-identity UX (one passkey unlocking several identities needs a
   `residentKey`/discoverable credential + per-identity salts).
2. Whether to keep `biometric-storage.ts` as legacy fallback or migrate its
   records to the vault on first unlock.
3. PIN/password fallback for PRF-unsupported authenticators — out of scope here
   but needed for full coverage.
4. Node test harness: WebAuthn is browser-only; unit tests must mock
   `navigator.credentials` + `crypto.subtle`. (Existing vitest setup mocks the
   wasm SDK the same way.)

## 9. Recommendation
Proceed with §3 as a new `lib/passkey-vault.ts`, **deprecating**
`lib/passkey.ts` (broken) and routing `biometric-storage.ts` through it.
Ship behind a settings toggle "Passkey unlock (beta)" until PRF-support data
from real devices confirms the matrix in §2.
