# Passkey and mobile operation

## Passkey model

EditForge uses WebAuthn for passkey registration and authentication.

- The recovery password is required for initial enrollment unless Google sign-in is configured.
- A verified allowlisted Google account can recover the studio and rotate a lost recovery password.
- Registration is available only inside an authenticated studio session at `/security`.
- Authentication requires user verification through the device, such as a fingerprint, face, PIN, or nearby-device approval.
- The private key never reaches EditForge. The durable store contains the credential ID, public key, signature counter, transport hints, and non-secret device metadata.
- Registration and authentication challenges expire after five minutes and are consumed once.
- A maximum of five passkeys may be registered.
- The credential store lives under `EDITFORGE_DATA_DIR`, which maps to the persistent `/data` volume in Compose.

Production relying-party defaults:

```env
EDITFORGE_PASSKEY_RP_ID=editforge.online
EDITFORGE_PASSKEY_ORIGIN=https://editforge.online
EDITFORGE_PASSKEY_NAME=EditForge
```

Change the RP ID or origin only when the public hostname changes. Existing passkeys are scoped to their original relying party.

## First enrollment

1. Sign in once with the recovery password or the allowlisted Google account.
2. Open `/security` from Departments, Systems, Security.
3. Name the passkey and select **Create passkey**.
4. Complete the browser or device verification prompt.
5. Use a private window to verify **Continue with passkey** on `/login`.

## Google recovery sign-in

Create a Google Cloud Web OAuth client and use this exact authorized redirect URI:

```text
https://editforge.online/api/auth/google/callback
```

Then configure all four variables below. The Google button is hidden unless the
client ID, client secret, and allowlisted email are complete.

```env
GOOGLE_CLIENT_ID=<web OAuth client id>
GOOGLE_CLIENT_SECRET=<web OAuth client secret>
EDITFORGE_GOOGLE_ALLOWED_EMAIL=<owner Google account>
EDITFORGE_GOOGLE_REDIRECT_ORIGIN=https://editforge.online
```

After Google or passkey authentication, open `/security` to set a new recovery
password. Recovery passwords must be 16 to 128 characters. EditForge writes only
a salted scrypt verifier to its persistent data store.

## Mobile app

EditForge ships as an installable Progressive Web App.

- The manifest uses standalone display mode and EditForge theme colors.
- The service worker caches only versioned application assets and public app icons. It does not cache protected media, API responses, HTML navigation, credentials, project state, or render outputs.
- Mobile navigation uses a persistent safe-area-aware dock for Home, Canvas, Floor Agent, Projects, and Jobs.
- The installed app uses the same production authentication, durable project store, uploads, provider queue, and artifact delivery paths as the desktop site.

On Android or ChromeOS, use **Install mobile app** when it appears or choose **Install app** from the browser menu. On iPhone or iPad, use Safari’s Share menu and choose **Add to Home Screen**.
