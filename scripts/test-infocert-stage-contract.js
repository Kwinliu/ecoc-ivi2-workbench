"use strict";

const assert = require("node:assert/strict");
const {
  INFOCERT_STAGE_CONTRACT,
  buildInfoCertOAuthForm,
  buildInfoCertHashSignRequest,
  infoCertCorrelationId,
} = require("../src/infocert-stage-contract");

const oauthForm = buildInfoCertOAuthForm();
assert.equal(oauthForm.get("grant_type"), "client_credentials");
assert.equal(oauthForm.get("scope"), "signature");
assert.equal(INFOCERT_STAGE_CONTRACT.applicationId, "desktop-signer");

assert.deepEqual(
  buildInfoCertHashSignRequest({
    pin: "pin-value",
    sat: "sat-value",
    requestId: "request-1",
    hash: "base64-hash",
  }),
  {
    applicationId: "desktop-signer",
    pin: "pin-value",
    authorization: { sat: "sat-value" },
    hashSignatures: [{ requestId: "request-1", hash: "base64-hash" }],
  }
);

assert.throws(
  () => buildInfoCertHashSignRequest({ pin: "pin", requestId: "request-1", hash: "hash" }),
  /certificate SAT/
);

const headers = new Headers({ "Infocert-Correlation-ID": "correlation-123" });
assert.equal(infoCertCorrelationId(headers), "correlation-123");

console.log("InfoCert STAGE contract tests passed.");
