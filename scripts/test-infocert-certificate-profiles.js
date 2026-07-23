"use strict";

const assert = require("node:assert/strict");
const {
  INFOCERT_SIGNING_API_KEY_ID,
  certificateSecretRefs,
  infoCertCertificateConfig,
  normalizeSigningCertificateProfiles,
  publicSigningCertificateProfiles,
  selectSigningCertificateProfile,
} = require("../src/infocert-certificate-profiles");

const normalized = normalizeSigningCertificateProfiles([
  {
    id: "Geely EU Representative",
    apiKeyId: "another-api",
    label: "Geely EU Representative",
    manufacturerId: "geely",
    manufacturerName: "Geely Automobile",
    organizationName: "Geely EU Representative GmbH",
    role: "eu_representative",
    secretRefPrefix: "geely eu",
    signerId: "must-not-be-stored",
    certificateId: "must-not-be-stored",
    pin: "must-not-be-stored",
    sat: "must-not-be-stored",
  },
  { id: "OEM-TWO", label: "OEM Two", role: "oem" },
]);

assert.equal(normalized.length, 2);
assert.equal(normalized[0].apiKeyId, INFOCERT_SIGNING_API_KEY_ID);
assert.equal(normalized[0].secretRefPrefix, "INFOCERT_CERT_GEELY_EU");
assert.equal(normalized[0].manufacturerId, "geely");
assert.equal(Object.prototype.hasOwnProperty.call(normalized[0], "pin"), false);
assert.equal(Object.prototype.hasOwnProperty.call(normalized[0], "sat"), false);
assert.equal(Object.prototype.hasOwnProperty.call(normalized[0], "signerId"), false);
assert.equal(Object.prototype.hasOwnProperty.call(normalized[0], "certificateId"), false);

const refs = certificateSecretRefs(normalized[0].secretRefPrefix);
const environment = {
  [refs.signerId]: "signer-geely",
  [refs.certificateId]: "certificate-geely-001",
  [refs.pin]: "pin-value",
  [refs.sat]: "sat-value",
};
const publicProfiles = publicSigningCertificateProfiles(normalized, environment);
assert.equal(publicProfiles[0].configured, true);
assert.equal(publicProfiles[1].configured, false);
assert.equal(publicProfiles[0].certificateDisplay.includes("certificate-geely-001"), false);

const certificateConfig = infoCertCertificateConfig(normalized[0], environment);
assert.equal(certificateConfig.signerId, "signer-geely");
assert.equal(certificateConfig.certificateId, "certificate-geely-001");

const sameManufacturerProfiles = normalizeSigningCertificateProfiles([
  { id: "geely-oem", manufacturerId: "geely", manufacturerName: "Geely Automobile", label: "OEM eSeal" },
  { id: "geely-representative", manufacturerId: "geely", manufacturerName: "Geely Automobile", label: "EU Representative eSeal" },
]);
assert.throws(
  () => selectSigningCertificateProfile(sameManufacturerProfiles, {
    matches: (profile) => profile.manufacturerId === "geely",
  }),
  /匹配到多张签章证书/
);
assert.equal(
  selectSigningCertificateProfile(sameManufacturerProfiles, {
    requestedId: "geely-representative",
    matches: (profile) => profile.manufacturerId === "geely",
  }).id,
  "geely-representative"
);
assert.throws(
  () => selectSigningCertificateProfile(sameManufacturerProfiles, {
    routedId: "geely-representative",
    matches: () => false,
  }),
  /不适用于当前 VIN/
);

console.log("InfoCert multi-certificate profile tests passed.");
