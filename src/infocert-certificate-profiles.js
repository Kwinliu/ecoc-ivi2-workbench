"use strict";

const INFOCERT_SIGNING_API_KEY_ID = "signing-infocert-stage";
const CERTIFICATE_SECRET_SUFFIXES = Object.freeze({
  signerId: "SIGNER_ID",
  certificateId: "CERTIFICATE_ID",
  pin: "PIN",
  sat: "SAT",
  certificatePemPath: "CERTIFICATE_PEM_PATH",
});

function cleanText(value, maxLength = 240) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeProfileId(value, fallback = "certificate") {
  const normalized = cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeSecretRefPrefix(value, profileId = "certificate") {
  let prefix = cleanText(value, 120)
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  if (!prefix) {
    prefix = normalizeProfileId(profileId, "certificate").toUpperCase().replace(/-/g, "_");
  }
  if (!prefix.startsWith("INFOCERT_CERT_")) prefix = `INFOCERT_CERT_${prefix}`;
  return prefix;
}

function certificateSecretRefs(prefix) {
  return Object.fromEntries(
    Object.entries(CERTIFICATE_SECRET_SUFFIXES).map(([key, suffix]) => [key, `${prefix}_${suffix}`])
  );
}

function normalizeSigningCertificateProfile(profile = {}, options = {}) {
  const fallbackId = options.fallbackId || "certificate";
  const id = normalizeProfileId(profile.id || profile.label || profile.organizationName, fallbackId);
  const secretRefPrefix = normalizeSecretRefPrefix(profile.secretRefPrefix, id);
  const status = cleanText(profile.status || "active", 24).toLowerCase();
  const rdwRegistrationStatus = cleanText(profile.rdwRegistrationStatus || "pending", 32).toLowerCase();
  return {
    id,
    apiKeyId: INFOCERT_SIGNING_API_KEY_ID,
    label: cleanText(profile.label || profile.organizationName || id, 120),
    manufacturerId: normalizeProfileId(
      profile.manufacturerId || profile.manufacturerName || profile.organizationName || id,
      id
    ),
    manufacturerName: cleanText(profile.manufacturerName || profile.organizationName, 180),
    organizationName: cleanText(profile.organizationName, 180),
    role: ["oem", "eu_representative", "gb_representative"].includes(cleanText(profile.role).toLowerCase())
      ? cleanText(profile.role).toLowerCase()
      : "oem",
    market: cleanText(profile.market, 40).toUpperCase(),
    modelType: cleanText(profile.modelType, 80),
    wvtaNumber: cleanText(profile.wvtaNumber, 120),
    secretRefPrefix,
    subject: cleanText(profile.subject, 240),
    issuer: cleanText(profile.issuer, 240),
    serialNumber: cleanText(profile.serialNumber, 120),
    validFrom: cleanText(profile.validFrom, 40),
    validTo: cleanText(profile.validTo, 40),
    fingerprint: cleanText(profile.fingerprint, 160),
    rdwRegistrationStatus: ["pending", "registered", "not_required", "rejected"].includes(rdwRegistrationStatus)
      ? rdwRegistrationStatus
      : "pending",
    status: status === "disabled" ? "disabled" : "active",
    notes: cleanText(profile.notes, 500),
  };
}

function normalizeSigningCertificateProfiles(profiles = []) {
  const byId = new Map();
  for (const [index, profile] of (Array.isArray(profiles) ? profiles : []).entries()) {
    const normalized = normalizeSigningCertificateProfile(profile, { fallbackId: `certificate-${index + 1}` });
    byId.set(normalized.id, normalized);
  }
  return [...byId.values()];
}

function maskSecret(value = "") {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 8) return `${text.slice(0, 2)}...`;
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function signingCertificateProfileAvailability(profile, environment = process.env) {
  const normalized = normalizeSigningCertificateProfile(profile);
  const refs = certificateSecretRefs(normalized.secretRefPrefix);
  if (normalized.status === "disabled") {
    return {
      configured: false,
      missingEnv: [],
      reason: "证书档案已停用。",
      certificateDisplay: "",
      pemConfigured: false,
    };
  }
  const requiredRefs = [refs.signerId, refs.certificateId, refs.pin, refs.sat];
  const missingEnv = requiredRefs.filter((name) => !String(environment[name] || "").trim());
  return {
    configured: missingEnv.length === 0,
    missingEnv,
    reason: missingEnv.length ? `证书尚未配置，缺少环境变量：${missingEnv.join(", ")}` : "",
    certificateDisplay: maskSecret(environment[refs.certificateId]),
    pemConfigured: Boolean(String(environment[refs.certificatePemPath] || "").trim()),
  };
}

function publicSigningCertificateProfile(profile, environment = process.env) {
  const normalized = normalizeSigningCertificateProfile(profile);
  return {
    ...normalized,
    ...signingCertificateProfileAvailability(normalized, environment),
    secretRefs: certificateSecretRefs(normalized.secretRefPrefix),
  };
}

function publicSigningCertificateProfiles(profiles = [], environment = process.env) {
  return normalizeSigningCertificateProfiles(profiles).map((profile) =>
    publicSigningCertificateProfile(profile, environment)
  );
}

function selectSigningCertificateProfile(profiles = [], options = {}) {
  const activeProfiles = normalizeSigningCertificateProfiles(profiles)
    .filter((profile) => profile.status === "active");
  const byId = new Map(activeProfiles.map((profile) => [profile.id, profile]));
  const matches = typeof options.matches === "function" ? options.matches : () => true;
  if (options.requestedId) {
    const requested = byId.get(options.requestedId);
    if (!requested) throw new Error(`签章证书档案不存在或已停用：${options.requestedId}`);
    if (!matches(requested)) {
      throw new Error(`所选证书“${requested.label}”不适用于当前 VIN 的厂家、车型、WVTA 或市场。`);
    }
    return requested;
  }
  if (options.routedId) {
    const routed = byId.get(options.routedId);
    if (!routed) throw new Error(`厂家或车型关系绑定的签章证书不存在或已停用：${options.routedId}`);
    if (!matches(routed)) {
      throw new Error(`厂家或车型关系绑定的证书“${routed.label}”不适用于当前 VIN。请修正厂家证书绑定。`);
    }
    return routed;
  }
  const matching = activeProfiles.filter(matches);
  if (matching.length === 1) return matching[0];
  if (!activeProfiles.length) {
    throw new Error("尚未配置 OEM 或代表处签章证书。请先添加厂家证书档案并配置对应环境变量。");
  }
  if (!matching.length) {
    throw new Error("没有适用于当前 VIN 厂家的签章证书。请检查厂家绑定以及证书的车型、WVTA 或市场范围。");
  }
  throw new Error("当前 VIN 的厂家匹配到多张签章证书，系统不会自动猜测。请绑定证书，或在本次签章时明确选择。");
}

function infoCertCertificateConfig(profile, environment = process.env) {
  const normalized = normalizeSigningCertificateProfile(profile);
  const availability = signingCertificateProfileAvailability(normalized, environment);
  if (!availability.configured) throw new Error(availability.reason);
  const refs = certificateSecretRefs(normalized.secretRefPrefix);
  return {
    profile: normalized,
    signerId: String(environment[refs.signerId]).trim(),
    certificateId: String(environment[refs.certificateId]).trim(),
    pin: String(environment[refs.pin]).trim(),
    sat: String(environment[refs.sat]).trim(),
    certificatePemPath: String(environment[refs.certificatePemPath] || "").trim(),
  };
}

module.exports = {
  INFOCERT_SIGNING_API_KEY_ID,
  CERTIFICATE_SECRET_SUFFIXES,
  certificateSecretRefs,
  infoCertCertificateConfig,
  normalizeSecretRefPrefix,
  normalizeSigningCertificateProfile,
  normalizeSigningCertificateProfiles,
  publicSigningCertificateProfile,
  publicSigningCertificateProfiles,
  selectSigningCertificateProfile,
  signingCertificateProfileAvailability,
};
