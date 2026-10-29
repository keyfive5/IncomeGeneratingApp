// iOS App Store signing for Kerf through the App Store Connect API, with no
// interactive Apple login. Registers the bundle id and makes an App Store
// provisioning profile against the team's existing distribution certificate
// (the one Overload signs with), so no new certificate is minted and nothing
// another project relies on gets revoked. Writes credentials.json for EAS.
//
// Usage: node scripts/gen-ios-creds.mjs
import fs from 'fs';
import path from 'path';
import { api, ROOT } from './asc-lib.mjs';

const CRED = path.join(ROOT, 'credentials');
const BUNDLE = 'com.hasanzafar.kerf';
const BUNDLE_NAME = 'Kerf';
const PROFILE_NAME = 'Kerf AppStore';
const CERT_SOURCE = 'D:/StrongAlternative';
const CERT_ID = 'DNL88X8YD9';

async function ensureBundleId() {
  const list = await api('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE)}&limit=200`);
  const found = (list.data || []).find((b) => b.attributes.identifier === BUNDLE);
  if (found) {
    console.log('• bundle id exists:', found.id);
    return found.id;
  }
  const created = await api('POST', '/v1/bundleIds', {
    data: { type: 'bundleIds', attributes: { identifier: BUNDLE, name: BUNDLE_NAME, platform: 'IOS' } },
  });
  console.log('• bundle id registered:', created.data.id);
  return created.data.id;
}

async function checkCertificate() {
  const cert = await api('GET', `/v1/certificates/${CERT_ID}`);
  const exp = new Date(cert.data.attributes.expirationDate);
  if (exp < new Date()) throw new Error(`certificate ${CERT_ID} expired ${exp.toISOString()}`);
  console.log(`• distribution certificate ${CERT_ID} valid until ${exp.toISOString().slice(0, 10)}`);
}

async function createProfile(bundleIdId) {
  const existing = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&limit=200`);
  for (const p of existing.data || []) {
    console.log('• removing stale profile:', p.id);
    await api('DELETE', `/v1/profiles/${p.id}`).catch(() => {});
  }
  const created = await api('POST', '/v1/profiles', {
    data: {
      type: 'profiles',
      attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundleIdId } },
        certificates: { data: [{ type: 'certificates', id: CERT_ID }] },
      },
    },
  });
  fs.writeFileSync(path.join(CRED, 'kerf.mobileprovision'), Buffer.from(created.data.attributes.profileContent, 'base64'));
  console.log('• provisioning profile created:', created.data.id);
}

const bundleIdId = await ensureBundleId();
await checkCertificate();
await createProfile(bundleIdId);
fs.copyFileSync(path.join(CERT_SOURCE, 'credentials', 'dist.p12'), path.join(CRED, 'dist.p12'));
const source = JSON.parse(fs.readFileSync(path.join(CERT_SOURCE, 'credentials.json'), 'utf8'));
fs.writeFileSync(
  path.join(ROOT, 'credentials.json'),
  JSON.stringify(
    {
      ios: {
        provisioningProfilePath: 'credentials/kerf.mobileprovision',
        distributionCertificate: { path: 'credentials/dist.p12', password: source.ios.distributionCertificate.password },
      },
    },
    null,
    2,
  ) + '\n',
);
console.log('\n✓ credentials.json written (password copied, not printed).');
