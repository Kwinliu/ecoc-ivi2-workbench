const state = {
  vehicles: [],
  drafts: [],
  submissions: [],
  apiKeys: [],
  activeApiKeys: {},
  settings: null,
  selectedDraftId: null,
  currentXml: "",
  currentXmlName: "ivi20-from-word.xml",
};

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === "string" ? body : body.error || "Request failed";
    const error = new Error(message);
    error.body = body;
    throw error;
  }
  return body;
}

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMetrics(dashboard) {
  const items = [
    ["vehicles", "车辆"],
    ["drafts", "草稿"],
    ["validationFailed", "校验失败"],
    ["iviGenerated", "已生成 XML"],
    ["signed", "已签章"],
    ["uploaded", "已上传"],
    ["mockAccepted", "API 已受理"],
  ];
  $("metrics").innerHTML = items
    .map(([key, label]) => `<div class="metric"><strong>${dashboard.counts[key]}</strong><span>${label}</span></div>`)
    .join("");
  $("schemaStatus").textContent = dashboard.officialSchemaStatus?.includes("loaded")
    ? "IVI 2.0 官方 XSD 已加载"
    : "IVI 2.0 官方 XSD 未加载";
}

function apiKeyOptions(kind, selectedId = "") {
  return state.apiKeys
    .filter((item) => item.kind === kind)
    .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.label)} · ${escapeHtml(item.keyDisplay)}</option>`)
    .join("");
}

function certificateRoleLabel(role) {
  return (
    {
      oem: "OEM",
      eu_representative: "欧盟代表处",
      gb_representative: "英国代表处",
    }[role] || role || "OEM"
  );
}

function certificateProfileId(value) {
  const base = (
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `certificate-${Date.now()}`
  );
  const used = new Set((state.settings?.signingCertificateProfiles || []).map((item) => item.id));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function certificateProfileOptions(selectedId = "") {
  const profiles = state.settings?.signingCertificateProfiles || [];
  return [
    `<option value="">按制造商自动匹配</option>`,
    ...profiles
      .filter((item) => item.status !== "disabled")
      .map((item) => {
        const selected = item.id === selectedId ? "selected" : "";
        const availability = item.configured ? "已配置" : "待配置";
        return `<option value="${escapeHtml(item.id)}" ${selected}>${escapeHtml(item.label)} · ${escapeHtml(item.manufacturerName)} · ${availability}</option>`;
      }),
  ].join("");
}

function editableCertificateProfile(profile = {}) {
  return {
    id: profile.id || "",
    label: profile.label || "",
    manufacturerName: profile.manufacturerName || "",
    organizationName: profile.organizationName || "",
    role: profile.role || "oem",
    market: profile.market || "",
    modelType: profile.modelType || "",
    wvtaNumber: profile.wvtaNumber || "",
    secretRefPrefix: profile.secretRefPrefix || "",
    subject: profile.subject || "",
    issuer: profile.issuer || "",
    serialNumber: profile.serialNumber || "",
    validFrom: profile.validFrom || "",
    validTo: profile.validTo || "",
    fingerprint: profile.fingerprint || "",
    rdwRegistrationStatus: profile.rdwRegistrationStatus || "pending",
    status: profile.status || "active",
    notes: profile.notes || "",
  };
}

function renderInfoCertConnection() {
  const connection = state.apiKeys.find((item) => item.id === "signing-infocert-stage");
  if (!connection) {
    $("infoCertConnection").innerHTML = `<strong>InfoCert STAGE</strong><span class="connection-bad">公共签章连接未载入</span>`;
    return;
  }
  const stateClass = connection.configured ? "connection-good" : "connection-warn";
  const stateText = connection.configured
    ? "平台连接已配置"
    : `平台连接待配置：${(connection.missingEnv || []).join("、")}`;
  $("infoCertConnection").innerHTML = `
    <div>
      <strong>${escapeHtml(connection.label)}</strong>
      <span>全系统共用一条技术连接，签章身份由下方厂家证书决定。</span>
    </div>
    <span class="${stateClass}">${escapeHtml(stateText)}</span>`;
}

function renderCertificateProfiles(profiles) {
  const body = $("certificateProfilesBody");
  if (!body) return;
  body.innerHTML =
    profiles
      .map((item, index) => {
        const scopes = [
          item.market ? `市场 ${item.market}` : "",
          item.modelType ? `车型 ${item.modelType}` : "",
          item.wvtaNumber ? `WVTA ${item.wvtaNumber}` : "",
        ].filter(Boolean);
        const configured = item.configured
          ? `<span class="audit-ok">已配置</span>`
          : `<span class="audit-notice" title="${escapeHtml((item.missingEnv || []).join(", "))}">待配置</span>`;
        const rdwStatus =
          {
            registered: "已登记",
            not_required: "无需登记",
            rejected: "登记被拒",
            pending: "待登记",
          }[item.rdwRegistrationStatus] || item.rdwRegistrationStatus;
        return `<tr>
          <td><strong>${escapeHtml(item.label)}</strong><div class="meta">${escapeHtml(certificateRoleLabel(item.role))}</div></td>
          <td>${escapeHtml(item.manufacturerName || "未填写")}</td>
          <td>${escapeHtml(item.organizationName || "未填写")}</td>
          <td>${escapeHtml(scopes.join(" · ") || "全部车型与市场")}</td>
          <td>${configured}<div class="meta mono">${escapeHtml(item.secretRefPrefix)}</div></td>
          <td>${escapeHtml(rdwStatus)}</td>
          <td><button class="secondary" data-action="removeCertificateProfile" data-index="${index}" type="button">删除</button></td>
        </tr>`;
      })
      .join("") ||
    `<tr><td colspan="7">暂无厂家证书档案。添加后，系统会按制造商和适用范围进行签章路由。</td></tr>`;
}

function renderSettings(settings) {
  state.settings = settings;
  const defaultUpload = state.activeApiKeys.upload || state.apiKeys.find((item) => item.kind === "upload")?.id || "";
  renderInfoCertConnection();
  renderCertificateProfiles(settings.signingCertificateProfiles || []);
  if ($("settingModelSigningCertificate")) {
    $("settingModelSigningCertificate").innerHTML = certificateProfileOptions();
  }
  if ($("settingModelUpload")) $("settingModelUpload").innerHTML = apiKeyOptions("upload", defaultUpload);
  if ($("modelSettingsBody")) renderModelSettings(settings.modelSettings || []);
}

function collectSettings() {
  const modelSettings = [...document.querySelectorAll(".model-setting-row")].map((row) => ({
    modelType: row.querySelector('[data-field="modelType"]').value.trim(),
    wvtaNumber: row.querySelector('[data-field="wvtaNumber"]').value.trim(),
    signingApiKeyId: "signing-infocert-stage",
    signingCertificateProfileId: row.querySelector('[data-field="signingCertificateProfileId"]').value,
    uploadApiKeyId: row.querySelector('[data-field="uploadApiKeyId"]').value,
    templateFileName: row.querySelector('[data-field="templateFileName"]').value.trim(),
    templateBase64: row.querySelector('[data-field="templateBase64"]').value,
    templateAudit: JSON.parse(row.querySelector('[data-field="templateAudit"]').value || "null"),
  }));
  return {
    ...(state.settings || {}),
    signingCertificateProfiles: (state.settings?.signingCertificateProfiles || []).map(editableCertificateProfile),
    modelSettings: modelSettings.filter((item) => item.modelType || item.wvtaNumber),
  };
}

function renderTemplateAudit(audit) {
  if (!audit) return `<span class="muted">未检查</span>`;
  if (audit.status === "ok") return `<span class="audit-ok">完整</span>`;
  if (audit.status === "notice") {
    const missing = (audit.missing || []).map((item) => `${item.label} (${item.dataRef})`).join("、");
    return `<span class="audit-notice" title="${escapeHtml(missing)}">提示 ${escapeHtml(audit.missing?.length || 0)} 项缺失</span>`;
  }
  return `<span class="muted">${escapeHtml(audit.message || "未检查")}</span>`;
}

function renderModelSettings(modelSettings) {
  $("modelSettingsBody").innerHTML =
    modelSettings
      .map(
        (item, index) => `<tr class="model-setting-row" data-index="${index}">
          <td><input data-field="modelType" value="${escapeHtml(item.modelType || "")}" /></td>
          <td><input data-field="wvtaNumber" value="${escapeHtml(item.wvtaNumber || "")}" /></td>
          <td><select data-field="signingCertificateProfileId">${certificateProfileOptions(item.signingCertificateProfileId)}</select></td>
          <td><select data-field="uploadApiKeyId">${apiKeyOptions("upload", item.uploadApiKeyId)}</select></td>
          <td>
            <input data-field="templateFileName" value="${escapeHtml(item.templateFileName || "")}" placeholder="未上传" readonly />
            <input data-field="templateBase64" value="${escapeHtml(item.templateBase64 || "")}" type="hidden" />
            <input data-field="templateAudit" value="${escapeHtml(JSON.stringify(item.templateAudit || null))}" type="hidden" />
          </td>
          <td>${renderTemplateAudit(item.templateAudit)}</td>
          <td><button class="secondary" data-action="removeModelSetting" data-index="${index}" type="button">删除</button></td>
        </tr>`
      )
      .join("") || `<tr><td colspan="7">暂无车型设定。按上方顺序录入车型、Approval Number、API 和 COC 校验范本。</td></tr>`;
}

function renderPreviewOptions() {
  if (!$("previewDraftSelect")) return;
  const options = state.drafts
    .filter((draft) => draft.hasXml || draft.hasSignedXml)
    .map((draft) => `<option value="${escapeHtml(draft.id)}">${escapeHtml(draft.vin || draft.id)} · ${escapeHtml(statusLabel(draft.status))}</option>`)
    .join("");
  $("previewDraftSelect").innerHTML = options || `<option value="">暂无可预览 XML</option>`;
}

function statusLabel(value) {
  return (
    {
      accepted: "已受理",
      blocked: "已阻止",
      draft: "草稿",
      failed: "失败",
      generated: "已生成",
      ivi_generated: "已生成 XML",
      mock_accepted: "API 已受理",
      not_submitted: "未上传",
      pending: "处理中",
      signed: "已签章",
      unsigned: "未签章",
      uploaded: "已上传",
      validated: "校验通过",
      validation_failed: "校验未通过",
      validation_unavailable: "无法校验",
    }[value] || value || "未开始"
  );
}

function validationSummaryLabel(summary) {
  return summary ? `${summary.errors} 错误 / ${summary.warnings} 警告` : "未校验";
}

function severityLabel(severity) {
  return {
    error: "错误",
    warning: "警告",
    info: "信息",
  }[severity] || severity || "信息";
}

const findingText = {
  VIN_FORMAT: ["VIN 格式不正确", "VIN 应为 17 位，且不能包含 I、O 或 Q。"],
  MANUFACTURER_REQUIRED: ["制造商名称缺失", "请补充制造商法定名称。"],
  WVTA_REQUIRED: ["WVTA 批准号缺失", "请补充 WVTA 型式批准编号。"],
  APPROVAL_AUTHORITY_MAPPING_MISSING: ["型式批准机构映射缺失", "后台尚未维护该 Approval Number 前缀对应的型式批准机构。"],
  COC_TEMPLATE_FIELD_MISSING: ["范本字段缺失", "上传数据缺少 COC 校验范本中的对应字段。"],
  COC_TEMPLATE_FIELD_MISMATCH: ["与范本不一致", "上传数据与 COC 校验范本不一致。"],
  APPROVAL_COUNTRY_REQUIRED: ["型式批准国家缺失", "请补充指定型式批准国家代码，例如 e1 或 e6。"],
  VEHICLE_CATEGORY_REQUIRED: ["车辆类别缺失", "请补充车辆类别。"],
  VEHICLE_CATEGORY_REVIEW: ["车辆类别需复核", "请确认该车辆类别属于 Regulation (EU) 2018/858 的适用范围。"],
  CERTIFICATE_2018_858_MISMATCH: ["2018/858 证书不一致", "M/N/O 类车辆应使用与 2018/858 一致的 WVTA 证书编号。"],
  APPROVAL_COUNTRY_MISMATCH: ["批准国家与 WVTA 不一致", "指定型式批准国家应与 WVTA 编号中的 e-code 前缀一致。"],
  PRODUCTION_DATE_REQUIRED: ["生产日期缺失", "请补充车辆生产日期。"],
  TYPE_APPROVAL_ISSUE_DATE_REQUIRED: ["型式批准签发日期缺失", "请补充型式批准签发日期。"],
  TYPE_VARIANT_VERSION_REQUIRED: ["Type / Variant / Version 缺失", "请补充 Type、Variant 和 Version，用于 CoC/IVI 映射。"],
  MAKE_REQUIRED: ["品牌缺失", "请补充 Make 字段，用于 IVI 2.0 MakeTable。"],
  generated: ["XML 已生成", "XML 已生成。"],
  failed: ["处理失败", "处理失败。"],
  accepted: ["上传已受理", "上传接口已受理。"],
  blocked: ["上传被阻止", "上传前需要完成必要条件。"],
};

const fieldText = {
  approvalAuthority: "型式批准机构",
  approvalCountry: "型式批准国家",
  "approvalCountry/wvtaNumber": "批准国家 / WVTA 编号",
  manufacturerAddressLine1: "制造商地址",
  "manufacturerAddressLine1/manufacturerPlaceOfResidence": "制造商地址 / 所在地",
  manufacturerName: "制造商名称",
  massRunningOrderKg: "运行状态质量",
  technicallyPermissibleMaximumLadenMassKg: "技术允许最大装载质量",
  productionDate: "生产日期",
  schema: "Schema 校验",
  signature: "签章",
  signerName: "签署人",
  "signerName/signerPosition/signatureLocation/signatureDate": "签署人 / 职位 / 地点 / 日期",
  typeApprovalIssueDate: "型式批准签发日期",
  "type/variant/version": "Type / Variant / Version",
  vehicleCategory: "车辆类别",
  vin: "VIN",
  wvtaNumber: "WVTA 编号",
  "wvtaNumber/vehicleCategory": "WVTA 编号 / 车辆类别",
  lengthMm: "长度",
  "lengthMm/widthMm/heightMm": "长度 / 宽度 / 高度",
  fuelType: "燃料/能源类型",
  make: "品牌",
  tyreFront: "前轮轮胎",
  tyreRear: "后轮轮胎",
  "tyreFront/tyreRear": "前轮 / 后轮轮胎",
  manufacturerCountry: "制造商国家",
  commercialName: "商业名称",
  type: "Type",
  variant: "Variant",
  version: "Version",
  typeApprovalType: "型式批准类型",
  stageOfCompletion: "完成阶段",
  widthMm: "宽度",
  heightMm: "高度",
};

function findingTitle(item) {
  if (item.code === "COC_TEMPLATE_FIELD_MISSING" || item.code === "COC_TEMPLATE_FIELD_MISMATCH") {
    return item.message || findingText[item.code]?.[0] || item.code;
  }
  return findingText[item.code]?.[0] || item.code || "校验项";
}

function findingMessage(item) {
  return findingText[item.code]?.[1] || item.message || "请检查该字段。";
}

function fieldLabel(field) {
  return fieldText[field] || field || "schema";
}

function renderFindingRows(findings) {
  const rows = findings.filter((item) => item.severity === "error" || item.severity === "warning");
  if (!rows.length) return `<tr><td colspan="3">未发现阻断项或警告。</td></tr>`;
  return rows
    .map(
      (item) => `<tr>
        <td><span class="severity-dot ${escapeHtml(item.severity)}">${escapeHtml(severityLabel(item.severity))}</span></td>
        <td>${escapeHtml(fieldLabel(item.field))}</td>
        <td>${escapeHtml(findingTitle(item))}</td>
      </tr>`
    )
    .join("");
}

function renderReport(data) {
  const node = $("reportOutput");
  if (!node) return;
  $("validationPanel")?.removeAttribute("hidden");
  if (!data) {
    node.innerHTML = `<div class="empty-state">暂无校验结果</div>`;
    return;
  }
  const reports = Array.isArray(data.results)
    ? data.results.map((item) => item.report || item).filter(Boolean)
    : [data.report || data];
  node.innerHTML = reports
    .map((report) => {
      if (report.unavailable) {
        return `<article class="report-card compact unavailable">
          <div class="report-head">
            <div>
              <strong>${escapeHtml(report.vin || "未识别 VIN")}</strong>
              <span>未完成校验</span>
            </div>
            <span class="status validation_unavailable">无法校验</span>
          </div>
          <div class="empty-state">${escapeHtml(report.unavailableReason || "缺少 COC 校验范本，无法完成校验。")}</div>
        </article>`;
      }
      const findings = report.findings || [];
      const summary = report.summary || { errors: 0, warnings: 0, total: findings.length };
      const visibleTotal = (summary.errors || 0) + (summary.warnings || 0);
      const total = Math.max(visibleTotal, 1);
      const bar = [
        ["error", summary.errors || 0],
        ["warning", summary.warnings || 0],
      ];
      return `<article class="report-card compact ${report.passed ? "passed" : "failed"}">
        <div class="report-head">
          <div>
            <strong>${escapeHtml(report.vin || "未识别 VIN")}</strong>
            <span>错误 ${escapeHtml(summary.errors || 0)} · 警告 ${escapeHtml(summary.warnings || 0)}</span>
          </div>
          <span class="status ${report.passed ? "validated" : "validation_failed"}">${report.passed ? "通过" : "需处理"}</span>
        </div>
        <div class="inspection-bar" aria-label="校验问题分布">
          ${bar
            .filter(([, value]) => value > 0)
            .map(([severity, value]) => `<span class="${escapeHtml(severity)}" title="${escapeHtml(severityLabel(severity))} ${escapeHtml(value)}" style="width: ${(value / total) * 100}%"></span>`)
            .join("")}
        </div>
        <table class="validation-table">
          <thead><tr><th>级别</th><th>项目</th><th>问题</th></tr></thead>
          <tbody>${renderFindingRows(findings)}</tbody>
        </table>
      </article>`;
    })
    .join("");
}

function formatXml(xml) {
  const compact = String(xml || "")
    .replace(/>\s+</g, "><")
    .replace(/</g, "\n<")
    .trim();
  let indent = 0;
  return compact
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      if (/^<\//.test(line)) indent = Math.max(indent - 1, 0);
      const output = `${"  ".repeat(indent)}${line}`;
      if (/^<[^!?/][^>]*[^/]?>$/.test(line) && !/^<[^>]+>.*<\/[^>]+>$/.test(line)) indent += 1;
      return output;
    })
    .join("\n");
}

function showXml(xml, fileName, draftId = "", kind = "xml") {
  state.currentXml = xml;
  state.currentXmlName = fileName;
  if ($("previewDraftSelect") && draftId) $("previewDraftSelect").value = draftId;
  if ($("previewXmlKind")) $("previewXmlKind").value = kind;
  if ($("xmlOutput")) $("xmlOutput").textContent = formatXml(xml);
}

function renderVehicles() {
  if (!$("vehiclesBody")) return;
  $("vehiclesBody").innerHTML =
    state.vehicles
      .map(
        (vehicle) => `<tr>
          <td>${escapeHtml(vehicle.vin)}</td>
          <td>${escapeHtml(vehicle.manufacturerName)}</td>
          <td>${escapeHtml(vehicle.wvtaNumber)}</td>
          <td>${escapeHtml(vehicle.vehicleCategory)}</td>
          <td>${escapeHtml(vehicle.intendedCountryRegistration)}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="5">暂无车辆。请导入 CSV。</td></tr>`;
}

function statusTone(value, validationSummary) {
  if (value === "validation_failed" || validationSummary?.errors > 0) return "bad";
  if (value === "not validated" || value === "unsigned" || value === "not_submitted") return "neutral";
  if (value === "pending") return "warn";
  return "good";
}

function currentDraftStatus(draft) {
  if (draft.napStatus === "accepted" || draft.napStatus === "uploaded" || draft.status === "uploaded") {
    return { stage: "上传", value: "已上传", tone: "good" };
  }
  if (draft.napStatus && draft.napStatus !== "not_submitted") {
    return { stage: "上传", value: statusLabel(draft.napStatus), tone: statusTone(draft.napStatus) };
  }
  if (draft.validationSummary?.errors > 0 || draft.status === "validation_failed") {
    return { stage: "校验", value: "未通过", tone: "bad" };
  }
  if (draft.status === "validation_unavailable") {
    return { stage: "校验", value: "无法校验", tone: "warn" };
  }
  if (draft.signingStatus === "signed") {
    return { stage: "签章", value: "已签章", tone: "good" };
  }
  if (draft.validationSummary || draft.status === "validated" || draft.status === "ivi_generated") {
    return { stage: "校验", value: "通过", tone: "good" };
  }
  return { stage: "校验", value: "待校验", tone: "neutral" };
}

function renderDrafts() {
  $("draftsBody").innerHTML =
    state.drafts
      .map((draft) => {
        const current = currentDraftStatus(draft);
        return `<tr>
          <td><input type="checkbox" class="draft-check" value="${escapeHtml(draft.id)}" checked /></td>
          <td><strong class="mono">${escapeHtml(draft.vin)}</strong></td>
          <td><div class="mono truncate" title="${escapeHtml(draft.iviReferenceId)}">${escapeHtml(draft.iviReferenceId)}</div></td>
          <td>${escapeHtml(draft.type || "")}</td>
          <td>${escapeHtml(draft.variant || "")}</td>
          <td>${escapeHtml(draft.version || "")}</td>
          <td class="pipeline-status">
            <div class="stage-flow">
              <span class="stage-chip ${escapeHtml(current.tone)}"><strong>${escapeHtml(current.stage)}</strong>${escapeHtml(current.value)}</span>
            </div>
          </td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="7">暂无草稿。请先上传文件。</td></tr>`;
}

function renderSubmissions() {
  const query = ($("submissionSearchInput")?.value || "").trim().toLowerCase();
  const submissions = query
    ? state.submissions.filter((item) =>
        [item.createdAt, item.vin, item.nap, item.status, item.messageId, item.receipt?.message].some((value) =>
          String(value || "").toLowerCase().includes(query)
        )
      )
    : state.submissions;
  $("submissionsBody").innerHTML =
    submissions
      .map(
        (item) => `<tr>
          <td>${escapeHtml(new Date(item.createdAt).toLocaleString())}</td>
          <td>${escapeHtml(item.vin)}</td>
          <td>${escapeHtml(item.nap)}</td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.messageId)}</td>
          <td>${escapeHtml(item.receipt?.message || "")}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="6">${query ? "没有匹配的提交记录。" : "暂无提交记录。"}</td></tr>`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(reader.error || new Error("读取 Word 文件失败。"));
    reader.readAsDataURL(file);
  });
}

function selectedDraftIds() {
  return [...document.querySelectorAll(".draft-check:checked")].map((input) => input.value);
}

async function filesToPayload(files) {
  const payload = [];
  for (const file of files) {
    payload.push({ fileName: file.name, base64: await fileToBase64(file) });
  }
  return payload;
}

async function batchUploadFiles(files = [...$("batchFileInput").files]) {
  if (!files.length) return toast("请选择 Word、Excel、XML 或 CSV 文件。");
  toast(`正在处理 ${files.length} 个文件...`);
  const result = await api("/api/uploads/batch", {
    method: "POST",
    body: JSON.stringify({ files: await filesToPayload(files) }),
  });
  toast(`已处理 ${result.results.length} 个文件。`);
  await refresh();
}

async function loadOfficialSamples() {
  const result = await api("/api/examples/load-official-samples", { method: "POST", body: "{}" });
  toast(`已载入 ${result.results.length} 个官方 IVI2 XML 样本。`);
  await refresh();
}

async function batchValidate() {
  const draftIds = selectedDraftIds();
  const result = await api("/api/drafts/batch-validate", { method: "POST", body: JSON.stringify({ draftIds }) });
  renderReport(result);
  toast(`已校验 ${result.results.length} 个草稿。`);
  await refresh();
}

async function batchSign() {
  const draftIds = selectedDraftIds();
  const result = await api("/api/drafts/batch-sign", {
    method: "POST",
    body: JSON.stringify({ draftIds }),
  });
  renderReport({ results: result.results.map((item) => item.report).filter(Boolean) });
  toast(`签章完成：${result.results.filter((item) => item.status === "signed").length}/${result.results.length}`);
  await refresh();
}

async function batchUploadRdw() {
  const draftIds = selectedDraftIds();
  const result = await api("/api/drafts/batch-upload", {
    method: "POST",
    body: JSON.stringify({ draftIds }),
  });
  renderReport({
    vin: "批量上传",
    passed: result.results.every((item) => item.status === "accepted"),
    summary: { errors: result.results.filter((item) => item.status !== "accepted").length, warnings: 0, total: result.results.length },
    findings: result.results.map((item) => ({
      severity: item.status === "accepted" ? "info" : "error",
      code: item.status,
      field: item.draft?.vin || "draft",
      message: item.submission?.receipt?.message || item.error || "上传完成",
    })),
  });
  toast(`NAP 上传完成：${result.results.filter((item) => item.status === "accepted").length}/${result.results.length}`);
  await refresh();
}

async function batchGenerateXml() {
  const draftIds = selectedDraftIds();
  const results = [];
  for (const id of draftIds) {
    try {
      const result = await api(`/api/drafts/${id}/generate-ivi`, { method: "POST", body: "{}" });
      results.push({ status: "generated", draft: result.draft, xmlHash: result.xmlHash });
    } catch (error) {
      results.push({ status: "failed", draftId: id, error: error.message });
    }
  }
  renderReport({
    vin: "批量生成 XML",
    passed: results.every((item) => item.status === "generated"),
    summary: { errors: results.filter((item) => item.status !== "generated").length, warnings: 0, total: results.length },
    findings: results.map((item) => ({
      severity: item.status === "generated" ? "info" : "error",
      code: item.status,
      field: item.draft?.vin || item.draftId,
      message: item.xmlHash ? `XML hash ${item.xmlHash.slice(0, 10)}...` : item.error,
    })),
  });
  toast(`生成 XML：${results.filter((item) => item.status === "generated").length}/${results.length}`);
  await refresh();
}

async function refresh() {
  const [dashboard, vehicles, drafts, submissions, apiKeys, settings] = await Promise.all([
    api("/api/dashboard"),
    api("/api/vehicles"),
    api("/api/drafts"),
    api("/api/submissions"),
    api("/api/api-keys"),
    api("/api/settings"),
  ]);
  state.vehicles = vehicles.vehicles;
  state.drafts = drafts.drafts;
  state.submissions = submissions.submissions;
  state.apiKeys = apiKeys.keys;
  state.activeApiKeys = apiKeys.active;
  state.settings = settings.settings;
  renderMetrics(dashboard);
  renderSettings(settings.settings);
  renderPreviewOptions();
  renderVehicles();
  renderDrafts();
  renderSubmissions();
}

async function saveSettings() {
  const result = await api("/api/settings", {
    method: "POST",
    body: JSON.stringify({ settings: collectSettings() }),
  });
  renderSettings(result.settings);
  toast("设定已保存。");
}

async function addModelSetting() {
  const modelType = $("settingModelType").value.trim();
  const wvtaNumber = $("settingModelWvta").value.trim();
  const templateFile = $("settingModelTemplate").files[0];
  if (!modelType || !wvtaNumber) return toast("请先填写车型和 Approval Number。");
  state.settings = state.settings || {};
  state.settings.modelSettings = collectSettings().modelSettings;
  const modelSetting = {
    modelType,
    wvtaNumber,
    signingApiKeyId: "signing-infocert-stage",
    signingCertificateProfileId: $("settingModelSigningCertificate").value,
    uploadApiKeyId: $("settingModelUpload").value,
    templateFileName: templateFile?.name || "",
    templateBase64: templateFile ? await fileToBase64(templateFile) : "",
  };
  if (modelSetting.templateBase64) {
    const result = await api("/api/settings/template-audit", {
      method: "POST",
      body: JSON.stringify({ modelSetting }),
    });
    modelSetting.templateAudit = result.templateAudit;
    if (result.templateAudit?.status === "notice") {
      toast(`eCoC 数据提示：${result.templateAudit.missing.length} 个信息项缺失，不阻塞流程。`);
    }
  }
  state.settings.modelSettings.push(modelSetting);
  $("settingModelType").value = "";
  $("settingModelWvta").value = "";
  $("settingModelTemplate").value = "";
  renderModelSettings(state.settings.modelSettings);
}

async function addCertificateProfile() {
  const label = $("certificateLabel").value.trim();
  const manufacturerName = $("certificateManufacturer").value.trim();
  const organizationName = $("certificateOrganization").value.trim();
  if (!label || !manufacturerName || !organizationName) {
    return toast("请填写档案名称、制造商名称和证书法律主体。");
  }
  state.settings = state.settings || {};
  state.settings.modelSettings = collectSettings().modelSettings;
  state.settings.signingCertificateProfiles = [
    ...(state.settings.signingCertificateProfiles || []).map(editableCertificateProfile),
    {
      id: certificateProfileId(label),
      label,
      manufacturerName,
      organizationName,
      role: $("certificateRole").value,
      market: $("certificateMarket").value.trim(),
      modelType: $("certificateModelType").value.trim(),
      wvtaNumber: $("certificateWvta").value.trim(),
      secretRefPrefix: $("certificateSecretRefPrefix").value.trim(),
      rdwRegistrationStatus: "pending",
      status: "active",
    },
  ];
  [
    "certificateLabel",
    "certificateManufacturer",
    "certificateOrganization",
    "certificateMarket",
    "certificateModelType",
    "certificateWvta",
    "certificateSecretRefPrefix",
  ].forEach((id) => {
    $(id).value = "";
  });
  renderCertificateProfiles(state.settings.signingCertificateProfiles);
  $("settingModelSigningCertificate").innerHTML = certificateProfileOptions();
  renderModelSettings(state.settings.modelSettings);
}

async function convertWord() {
  const file = $("wordInput").files[0];
  if (!file) return toast("请选择 .docx Word 文件。");
  const base64 = await fileToBase64(file);
  const result = await api("/api/convert/word-to-ivi", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, base64 }),
  });
  state.currentXml = result.xml;
  state.currentXmlName = `${result.vehicle.vin || "ivi20"}-unsigned-ivi2.xml`;
  renderReport(result.report);
  showXml(result.xml, state.currentXmlName);
  if ($("wordFieldsOutput")) $("wordFieldsOutput").textContent = JSON.stringify(result.extracted.fields, null, 2);
  toast(`Word 已转换为 IVI2 XML，hash ${result.xmlHash.slice(0, 10)}...`);
  await refresh();
}

async function convertExcel() {
  const file = $("excelInput").files[0];
  if (!file) return toast("请选择 .xlsx Excel 文件。");
  const base64 = await fileToBase64(file);
  try {
    const result = await api("/api/convert/excel-to-ivi", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, base64 }),
    });
    state.currentXml = result.xml;
    state.currentXmlName = `${result.vehicle.vin || "ivi20"}-unsigned-ivi2.xml`;
    renderReport(result.report);
    showXml(result.xml, state.currentXmlName);
    if ($("excelFieldsOutput")) $("excelFieldsOutput").textContent = JSON.stringify(result.extracted.fields, null, 2);
    toast(`Excel 已转换为 IVI2 XML，hash ${result.xmlHash.slice(0, 10)}...`);
    await refresh();
  } catch (error) {
    if (error.body?.extracted) {
      if ($("excelFieldsOutput")) $("excelFieldsOutput").textContent = JSON.stringify(error.body.extracted.fields, null, 2);
      renderReport({
        vin: "未识别 VIN",
        passed: false,
        summary: { errors: 1, warnings: 0, total: 1 },
        findings: [
          {
            severity: "error",
            code: "VIN_REQUIRED",
            field: "vin",
            message: "Excel 已解析，但缺少生成 IVI2 XML 必需字段。请补 VIN、制造商、WVTA、Type/Variant/Version 等字段。",
          },
        ],
      });
    }
    throw error;
  }
}

async function importCsv() {
  const csv = $("csvInput")?.value.trim();
  if (!csv) return toast("请先粘贴 CSV。");
  const result = await api("/api/vehicles/import", { method: "POST", body: JSON.stringify({ csv }) });
  toast(`导入 ${result.imported} 条车辆数据。`);
  await refresh();
}

async function createDrafts() {
  const result = await api("/api/drafts", { method: "POST", body: JSON.stringify({}) });
  toast(`创建 ${result.created.length} 个 eCoC 草稿。`);
  await refresh();
}

async function validateDraft(id) {
  const result = await api(`/api/drafts/${id}/validate`, { method: "POST", body: "{}" });
  renderReport(result.report);
  toast(result.report.unavailable ? "缺少 COC 校验范本，无法完成校验。" : result.report.passed ? "校验通过，可以生成 XML。" : "校验与范本不一致，请检查字段。");
  await refresh();
}

async function generateXml(id) {
  const result = await api(`/api/drafts/${id}/generate-ivi`, { method: "POST", body: "{}" });
  state.currentXml = await fetchXml(id);
  state.currentXmlName = `${result.draft.vin || "ivi20"}-unsigned-ivi2.xml`;
  showXml(state.currentXml, state.currentXmlName, id, "xml");
  toast(`已生成 IVI XML，hash ${result.xmlHash.slice(0, 10)}...`);
  await refresh();
}

async function fetchXml(id) {
  const response = await fetch(`/api/drafts/${id}/xml`);
  if (!response.ok) throw new Error("XML 尚未生成。");
  return response.text();
}

async function viewXml(id) {
  state.currentXml = await fetchXml(id);
  const draft = state.drafts.find((item) => item.id === id);
  state.currentXmlName = `${draft?.vin || "ivi20"}-unsigned-ivi2.xml`;
  showXml(state.currentXml, state.currentXmlName, id, "xml");
  toast("已加载 XML。");
}

async function previewSelectedXml() {
  const id = $("previewDraftSelect").value;
  const kind = $("previewXmlKind").value;
  if (!id) return toast("暂无可预览的 XML。");
  const response = await fetch(`/api/drafts/${id}/${kind}`);
  if (!response.ok) throw new Error(kind === "signed-xml" ? "签章 XML 尚未生成。" : "XML 尚未生成。");
  state.currentXml = await response.text();
  const draft = state.drafts.find((item) => item.id === id);
  state.currentXmlName = `${draft?.vin || "ivi20"}-${kind === "signed-xml" ? "signed" : "unsigned"}-ivi2.xml`;
  showXml(state.currentXml, state.currentXmlName, id, kind);
  toast("XML 预览已更新。");
}

async function signDraft(id) {
  const result = await api(`/api/drafts/${id}/sign`, {
    method: "POST",
    body: "{}",
  });
  renderReport(result.report || result);
  toast(`签章状态：${result.status}`);
  await refresh();
}

async function viewSignedXml(id) {
  const response = await fetch(`/api/drafts/${id}/signed-xml`);
  if (!response.ok) throw new Error("签章 XML 尚未生成。");
  state.currentXml = await response.text();
  const draft = state.drafts.find((item) => item.id === id);
  state.currentXmlName = `${draft?.vin || "ivi20"}-signed-ivi2.xml`;
  showXml(state.currentXml, state.currentXmlName, id, "signed-xml");
  toast("已加载签章 XML。");
}

async function uploadRdw(id) {
  const result = await api(`/api/drafts/${id}/upload-rdw`, {
    method: "POST",
    body: "{}",
  });
  renderReport({
    vin: result.draft?.vin,
    passed: result.status === "accepted",
    summary: { errors: result.status === "accepted" ? 0 : 1, warnings: 0, total: 1 },
    findings: [
      {
        severity: result.status === "accepted" ? "info" : "error",
        code: result.status,
        field: result.apiKey?.provider || "NAP",
        message: result.submission?.receipt?.message || result.error || "上传完成",
      },
    ],
  });
  toast(`NAP 上传状态：${result.status}`);
  await refresh();
}

async function mockSubmit(id, nap) {
  const result = await api(`/api/drafts/${id}/mock-submit`, {
    method: "POST",
    body: JSON.stringify({ nap }),
  });
  toast(`${nap} mock accepted: ${result.submission.messageId}`);
  await refresh();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  try {
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (button.id === "saveSettingsButton") await saveSettings();
    if (button.id === "batchValidateButton") await batchValidate();
    if (button.id === "batchGenerateButton") await batchGenerateXml();
    if (button.id === "batchSignButton") await batchSign();
    if (button.id === "batchUploadRdwButton") await batchUploadRdw();
    if (button.id === "previewXmlButton") await previewSelectedXml();
    if (button.id === "addCertificateProfileButton") await addCertificateProfile();
    if (button.id === "addModelSettingButton") await addModelSetting();
    if (button.id === "convertWordButton") await convertWord();
    if (button.id === "convertExcelButton") await convertExcel();
    if (button.id === "importButton") await importCsv();
    if (button.id === "createDraftsButton") await createDrafts();
    if (button.id === "refreshButton") await refresh();
    if (action === "validate") await validateDraft(id);
    if (action === "generate") await generateXml(id);
    if (action === "viewXml") await viewXml(id);
    if (action === "sign") await signDraft(id);
    if (action === "viewSignedXml") await viewSignedXml(id);
    if (action === "uploadRdw") await uploadRdw(id);
    if (action === "submitRdw") await mockSubmit(id, "RDW");
    if (action === "submitKba") await mockSubmit(id, "KBA");
    if (action === "removeModelSetting") {
      state.settings.modelSettings = collectSettings().modelSettings.filter((_, index) => index !== Number(button.dataset.index));
      renderModelSettings(state.settings.modelSettings);
    }
    if (action === "removeCertificateProfile") {
      state.settings.modelSettings = collectSettings().modelSettings;
      const profiles = (state.settings.signingCertificateProfiles || []).map(editableCertificateProfile);
      const removed = profiles[Number(button.dataset.index)];
      state.settings.signingCertificateProfiles = profiles.filter((_, index) => index !== Number(button.dataset.index));
      state.settings.modelSettings = state.settings.modelSettings.map((item) => ({
        ...item,
        signingCertificateProfileId:
          item.signingCertificateProfileId === removed?.id ? "" : item.signingCertificateProfileId,
      }));
      renderCertificateProfiles(state.settings.signingCertificateProfiles);
      $("settingModelSigningCertificate").innerHTML = certificateProfileOptions();
      renderModelSettings(state.settings.modelSettings);
    }
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.id === "batchFileInput") {
    try {
      await batchUploadFiles([...event.target.files]);
      event.target.value = "";
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (event.target.id === "selectAllDrafts") {
    document.querySelectorAll(".draft-check").forEach((input) => {
      input.checked = event.target.checked;
    });
    return;
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "submissionSearchInput") {
    renderSubmissions();
  }
});

const uploadDrop = $("uploadDrop");
if (uploadDrop) {
  ["dragenter", "dragover"].forEach((type) => {
    uploadDrop.addEventListener(type, (event) => {
      event.preventDefault();
      uploadDrop.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    uploadDrop.addEventListener(type, (event) => {
      event.preventDefault();
      uploadDrop.classList.remove("dragging");
    });
  });
  uploadDrop.addEventListener("drop", async (event) => {
    const files = [...(event.dataTransfer?.files || [])];
    try {
      await batchUploadFiles(files);
    } catch (error) {
      toast(error.message);
    }
  });
}

refresh().catch((error) => toast(error.message));
