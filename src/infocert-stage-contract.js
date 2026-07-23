"use strict";

const INFOCERT_STAGE_CONTRACT = Object.freeze({
  providerLabel: "Safehomo · InfoCert eSeal STAGE · Hash XAdES",
  oauthUrl: "https://idpstage.infocert.digital/auth/realms/delivery/protocol/openid-connect/token",
  apiBaseUrl: "https://apistage.infocert.digital/signature/v1",
  oauthScope: "signature",
  applicationId: "desktop-signer",
  signerHeader: "X-signer-id",
  correlationHeaders: Object.freeze([
    "Infocert-Correlation-ID",
    "InfoCert-Correlation-ID",
    "x-correlation-id",
    "x-request-id",
  ]),
});

function requiredContractValue(name, value) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`InfoCert STAGE request is missing ${name}`);
  return normalized;
}

function buildInfoCertOAuthForm(scope = INFOCERT_STAGE_CONTRACT.oauthScope) {
  return new URLSearchParams({
    grant_type: "client_credentials",
    scope: requiredContractValue("OAuth scope", scope),
  });
}

function buildInfoCertHashSignRequest({
  applicationId = INFOCERT_STAGE_CONTRACT.applicationId,
  pin,
  sat,
  requestId,
  hash,
} = {}) {
  return {
    applicationId: requiredContractValue("applicationId", applicationId),
    pin: requiredContractValue("certificate PIN", pin),
    authorization: {
      sat: requiredContractValue("certificate SAT", sat),
    },
    hashSignatures: [
      {
        requestId: requiredContractValue("requestId", requestId),
        hash: requiredContractValue("hash", hash),
      },
    ],
  };
}

function infoCertCorrelationId(headers) {
  if (!headers || typeof headers.get !== "function") return "";
  for (const name of INFOCERT_STAGE_CONTRACT.correlationHeaders) {
    const value = headers.get(name);
    if (value) return value;
  }
  return "";
}

module.exports = {
  INFOCERT_STAGE_CONTRACT,
  buildInfoCertOAuthForm,
  buildInfoCertHashSignRequest,
  infoCertCorrelationId,
};
