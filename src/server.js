const http = require("http");
const fs = require("fs/promises");
const fssync = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { execFile } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
const EVIDENCE_DIR = path.join(DATA_DIR, "evidence");
const DB_PATH = path.join(DATA_DIR, "db.json");
const PORT = Number(process.env.PORT || 4173);
const OFFICIAL_EXAMPLE_DIR = path.join(ROOT, "ecoc_eucaris_download", "documentation", "IVI 2.0 Example files");

const IVI2_SCHEMA_PATH = path.join(
  ROOT,
  "ecoc_eucaris_download",
  "documentation",
  "IVI 2.0 Release documentation",
  "IVI 2.0 - Initial Vehicle Information XSD Scheme.xsd"
);
const OFFICIAL_SCHEMA_STATUS = fssync.existsSync(IVI2_SCHEMA_PATH)
  ? "official_ivi2_xsd_loaded_unsigned_signature_pending"
  : "official_ivi2_xsd_not_loaded";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  if (!fssync.existsSync(DB_PATH)) {
    await writeDb(defaultDb());
  }
}

function defaultDb() {
  return {
      manufacturers: [
        {
          id: "mfg-demo",
          legalName: "Demo OEM Ltd.",
          country: "CN",
          euRepresentativeName: "Demo EU Representative GmbH",
          euRepresentativeCountry: "DE",
          createdAt: now(),
        },
      ],
      vehicles: [],
      drafts: [],
      submissions: [],
      apiKeys: defaultApiKeys(),
      activeApiKeys: defaultActiveApiKeys(),
      settings: defaultSettings(),
      audit: [],
    };
}

function defaultSettings() {
  return {
    wvtaReference: {
      framework: "2018/858",
      approvalCountryPriority: "WVTA e-code",
      requiredFields: "VIN, WVTA, vehicle category, type, variant, version, type approval issue date",
      consistencyRule: "M/N/O categories must use 2018/858 WVTA certificate numbers.",
    },
    modelApiRouting: {
      defaultRule: "Route by WVTA / Approval number e-code.",
      m1: "e11/e24 use GB route; all other approval numbers use EU route.",
      n2: "e11/e24 use GB route; all other approval numbers use EU route.",
    },
    signingSubjects: {
      primary: "EU 代表处 1",
      secondary: "EU 代表处 2",
      gb: "GB 代表处",
      fallbackEnabled: true,
    },
    uploadSubjects: {
      primary: "RDW",
      secondary: "KAB",
      gb: "VCA",
      fallbackEnabled: true,
    },
    modelSettings: [],
  };
}

function defaultActiveApiKeys() {
  return { signing: "signing-eu-rep-1", upload: "upload-rdw" };
}

function defaultApiKeys() {
  return [
    {
      id: "signing-eu-rep-1",
      kind: "signing",
      provider: "EU Representative 1",
      label: "EU 代表处 1 · D-Trust 签章 API",
      keyRef: "eu_rep_1_dtrust_2026",
      mode: "mock",
      createdAt: now(),
    },
    {
      id: "signing-eu-rep-2",
      kind: "signing",
      provider: "EU Representative 2",
      label: "EU 代表处 2 · D-Trust 签章 API",
      keyRef: "eu_rep_2_dtrust_2026",
      mode: "mock",
      createdAt: now(),
    },
    {
      id: "signing-gb-rep",
      kind: "signing",
      provider: "GB Representative",
      label: "GB 代表处 · D-Trust 签章 API",
      keyRef: "gb_rep_dtrust_2026",
      mode: "mock",
      createdAt: now(),
    },
    {
      id: "upload-rdw",
      kind: "upload",
      provider: "RDW",
      label: "RDW 上传 API",
      keyRef: "rdw_nap_2026",
      mode: "mock",
      createdAt: now(),
    },
    {
      id: "upload-kab",
      kind: "upload",
      provider: "KAB",
      label: "KAB 上传 API",
      keyRef: "kab_nap_2026",
      mode: "mock",
      createdAt: now(),
    },
    {
      id: "upload-vca",
      kind: "upload",
      provider: "VCA",
      label: "VCA 上传 API",
      keyRef: "vca_nap_2026",
      mode: "mock",
      createdAt: now(),
    },
  ];
}

async function readDb() {
  await ensureStore();
  const db = JSON.parse(await fs.readFile(DB_PATH, "utf8"));
  let changed = false;
  const catalog = defaultApiKeys();
  const catalogIds = new Set(catalog.map((item) => item.id));
  if (!Array.isArray(db.apiKeys) || db.apiKeys.some((item) => !catalogIds.has(item.id))) {
    db.apiKeys = defaultApiKeys();
    changed = true;
  }
  if (!db.activeApiKeys) {
    db.activeApiKeys = defaultActiveApiKeys();
    changed = true;
  }
  if (!db.settings) {
    db.settings = defaultSettings();
    changed = true;
  }
  if (!catalogIds.has(db.activeApiKeys.signing) || !catalogIds.has(db.activeApiKeys.upload)) {
    db.activeApiKeys = defaultActiveApiKeys();
    changed = true;
  }
  if (changed) await writeDb(db);
  return db;
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function maskKeyRef(value) {
  const textValue = String(value || "");
  if (textValue.length <= 8) return `${textValue.slice(0, 2)}...`;
  return `${textValue.slice(0, 4)}...${textValue.slice(-4)}`;
}

function publicApiKey(item) {
  return {
    id: item.id,
    kind: item.kind,
    provider: item.provider,
    label: item.label,
    mode: item.mode,
    keyDisplay: maskKeyRef(item.keyRef),
  };
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function execFileText(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { ...options, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textFromWordXml(fragment) {
  const parts = [];
  for (const match of fragment.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)) {
    if (match[1] !== undefined) parts.push(decodeXmlEntities(match[1]));
    else parts.push(" ");
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

async function extractDocxDocumentXml(base64) {
  const buffer = Buffer.from(String(base64 || ""), "base64");
  if (buffer.length === 0) throw new Error("Word file is empty");
  if (buffer.length > 12 * 1024 * 1024) throw new Error("Word file is too large for this MVP");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "word-to-ivi-"));
  const file = path.join(dir, "input.docx");
  await fs.writeFile(file, buffer);
  try {
    return await execFileText("unzip", ["-p", file, "word/document.xml"]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function extractZipMember(base64, fileName, memberName) {
  const buffer = Buffer.from(String(base64 || ""), "base64");
  if (buffer.length === 0) throw new Error(`${fileName} is empty`);
  if (buffer.length > 12 * 1024 * 1024) throw new Error(`${fileName} is too large for this MVP`);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "upload-to-ivi-"));
  const file = path.join(dir, fileName);
  await fs.writeFile(file, buffer);
  try {
    return await execFileText("unzip", ["-p", file, memberName]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function columnNumber(cellRef) {
  let number = 0;
  for (const ch of String(cellRef || "").replace(/\d+/g, "")) {
    number = number * 26 + ch.charCodeAt(0) - 64;
  }
  return number;
}

function parseSharedStrings(xml) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXmlEntities([...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join(""))
  );
}

function parseWorksheetRows(sheetXml, sharedStrings) {
  const rows = [];
  for (const rowMatch of sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowIndex = Number(rowMatch[1]) - 1;
    const row = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c[^>]*r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = cellMatch[1];
      const attrs = cellMatch[2];
      const body = cellMatch[3];
      const inlineText = body.match(/<is>([\s\S]*?)<\/is>/)?.[1];
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      let value = decodeXmlEntities(rawValue);
      if (attrs.includes('t="s"')) value = sharedStrings[Number(rawValue)] || "";
      if (attrs.includes('t="inlineStr"') && inlineText) {
        value = decodeXmlEntities([...inlineText.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join(""));
      }
      row[columnNumber(ref) - 1] = String(value || "").replace(/\u00a0/g, " ").trim();
    }
    rows[rowIndex] = row;
  }
  return rows;
}

async function extractXlsxRows(base64) {
  const fileName = "input.xlsx";
  const buffer = Buffer.from(String(base64 || ""), "base64");
  if (buffer.length === 0) throw new Error("Excel file is empty");
  if (buffer.length > 12 * 1024 * 1024) throw new Error("Excel file is too large for this MVP");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "excel-to-ivi-"));
  const file = path.join(dir, fileName);
  await fs.writeFile(file, buffer);
  try {
    const sharedXml = await execFileText("unzip", ["-p", file, "xl/sharedStrings.xml"]).catch(() => "");
    const sheetXml = await execFileText("unzip", ["-p", file, "xl/worksheets/sheet1.xml"]);
    return parseWorksheetRows(sheetXml, parseSharedStrings(sharedXml));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s:：_\-./()（）[\]【】#]+/g, "");
}

const WORD_FIELD_ALIASES = {
  vin: ["vin", "vehicle identification number", "vehicleidentificationnumber", "车辆识别代号", "车辆识别号", "车架号"],
  manufacturerName: ["manufacturer", "manufacturer name", "manufacturername", "制造商", "生产厂", "制造厂名称"],
  manufacturerCountry: ["manufacturer country", "manufacturercountry", "制造商国家", "生产国"],
  manufacturerAddressLine1: ["manufacturer address", "manufactureraddressline1", "manufactureraddress", "制造商地址", "生产厂地址"],
  manufacturerPlaceOfResidence: ["manufacturer place", "manufacturerplaceofresidence", "制造商所在地", "制造商城市"],
  euRepresentativeName: ["eu representative", "eurepresentativename", "eu representative name", "欧盟代表", "欧盟授权代表"],
  euRepresentativeCountry: ["eu representative country", "eurepresentativecountry", "欧盟代表国家"],
  euRepresentativeAddressLine1: ["eu representative address", "eurepresentativeaddressline1", "欧盟代表地址"],
  euRepresentativePlaceOfResidence: ["eu representative place", "eurepresentativeplaceofresidence", "欧盟代表城市"],
  wvtaNumber: ["wvta", "type approval number", "typeapprovalnumber", "approval number", "型式批准号", "整车型式批准号"],
  typeApprovalIssueDate: ["type approval issue date", "typeapprovalissuedate", "approval issue date", "批准日期", "型式批准日期"],
  approvalAuthority: ["approval authority", "approvalauthority", "批准机构", "型式批准机构"],
  approvalCountry: ["approval country", "approvalcountry", "designated type approval country", "designatedtypeapprovalcountry", "批准国家"],
  vehicleCategory: ["vehicle category", "vehiclecategory", "category", "车辆类别", "类别"],
  make: ["make", "brand", "品牌", "商标"],
  commercialName: ["commercial name", "commercialname", "trade name", "商品名称", "商业名称"],
  type: ["type", "车型", "类型"],
  variant: ["variant", "变型"],
  version: ["version", "版本"],
  productionDate: ["production date", "date manufacture vehicle", "datemanufacturevehicle", "manufacture date", "生产日期", "制造日期"],
  intendedCountryRegistration: ["intended country registration", "intendedcountryregistration", "registration country", "目标注册国家", "注册国家"],
  typeApprovalType: ["type approval type", "typeapprovaltype"],
  provisionalTypeApprovalIndicator: ["provisional type approval indicator", "provisionaltypeapprovalindicator", "临时批准"],
  stageOfCompletion: ["stage of completion", "stageofcompletion", "完成阶段"],
  methodAttachmentStatutoryPlate: ["method attachment statutory plate", "methodattachmentstatutoryplate", "铭牌固定方式"],
  massRunningOrderKg: ["mass in running order", "massrunningorderkg", "massinrunningorder", "整备质量", "运行质量"],
  technicallyPermissibleMaximumLadenMassKg: [
    "technically permissible maximum laden mass",
    "technicallypermissiblemaximumladenmasskg",
    "technicallypermissiblemaximumladenmass",
    "最大允许总质量",
    "技术允许最大满载质量",
  ],
  lengthMm: ["length", "lengthmm", "5 length", "车长", "长度"],
  widthMm: ["width", "widthmm", "6 width", "车宽", "宽度"],
  heightMm: ["height", "heightmm", "7 height", "车高", "高度"],
  axles: ["number of axles", "numberofaxles", "axles", "1 number of axles", "轴数"],
  wheels: ["number of wheels", "numberofwheels", "wheels", "车轮数"],
  seats: ["number of seating positions including driver", "numberofseatingpositionsincludingdriver", "42 number of seating positions including driver", "seats", "座位数"],
  fuelType: ["fuel type", "fueltype", "燃料类型"],
  co2WLTP: ["co2 wltp", "co2wltp", "wltp co2", "co2"],
  emissionsClass: ["emissions class", "emissionsclass", "排放等级"],
  tyreFront: ["front tyre", "fronttyre", "tyrefront", "前轮胎"],
  tyreRear: ["rear tyre", "reartyre", "tyrerear", "后轮胎"],
  signerName: ["signer name", "signername", "签署人", "签名人"],
  signerPosition: ["signer position", "signerposition", "签署人职位", "签名人职务"],
  signatureLocation: ["signature location", "signaturelocation", "签署地点"],
  signatureDate: ["signature date", "signaturedate", "签署日期"],
};

function canonicalFieldName(key) {
  const normalized = normalizeKey(key);
  for (const [field, aliases] of Object.entries(WORD_FIELD_ALIASES)) {
    if (aliases.some((alias) => normalizeKey(alias) === normalized)) return field;
  }
  return null;
}

function extractWordFields(documentXml) {
  const rawPairs = [];
  const paragraphs = [];

  for (const tableMatch of documentXml.matchAll(/<w:tbl[\s\S]*?<\/w:tbl>/g)) {
    const table = tableMatch[0];
    for (const rowMatch of table.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)) {
      const cells = [...rowMatch[0].matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)]
        .map((cell) => textFromWordXml(cell[0]))
        .filter(Boolean);
      if (cells.length >= 2) rawPairs.push({ key: cells[0], value: cells.slice(1).join(" ") });
    }
  }

  const documentWithoutTables = documentXml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, " ");
  for (const paraMatch of documentWithoutTables.matchAll(/<w:p[\s\S]*?<\/w:p>/g)) {
    const textValue = textFromWordXml(paraMatch[0]);
    if (!textValue) continue;
    paragraphs.push(textValue);
    const pair = textValue.match(/^(.{2,80}?)[：:]\s*(.+)$/);
    if (pair) rawPairs.push({ key: pair[1], value: pair[2] });
  }

  const fields = {};
  for (const pair of rawPairs) {
    const field = canonicalFieldName(pair.key);
    if (field && pair.value && !fields[field]) fields[field] = pair.value.trim();
  }

  const fullText = paragraphs.join("\n");
  if (!fields.vin) {
    const vin = fullText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
    if (vin) fields.vin = vin[0].toUpperCase();
  }
  if (!fields.wvtaNumber) {
    const approval = fullText.match(/\be\d+\*[0-9/]+\*[A-Z0-9]+\*[0-9A-Z]+\b/i);
    if (approval) fields.wvtaNumber = approval[0];
  }
  if (!fields.vehicleCategory) {
    const category = fullText.match(/\b(M1|M2|M3|N1|N2|N3|O1|O2|O3|O4|L[1-7]e(?:-[A-Z0-9]+)?)\b/);
    if (category) fields.vehicleCategory = category[1];
  }

  return {
    fields,
    rawPairs,
    paragraphs,
    textPreview: fullText.slice(0, 4000),
  };
}

function cleanCocText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCocNumber(value) {
  return cleanCocText(value)
    .replace(/^\d+(?:\.\d+)*\.?\s*/, "")
    .replace(/\(\d+\)/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .trim();
}

function likelyPlaceholderValue(value) {
  const textValue = cleanCocText(value);
  if (!textValue) return true;
  if (/^(mm|kg|kw|cm3|kpa|db\(a\)|min-?1)$/i.test(textValue)) return true;
  if (
    /yes\/no|diesel\/petrol|class i\/class ii|front\/rear|mechanical\/electric|ovc-hev|type 1a\/type|and wheels|lower deck|upper deck|d:\s*\/v:/i.test(
      textValue
    )
  ) {
    return true;
  }
  return false;
}

function valueAfterColon(text) {
  const normalized = cleanCocText(text);
  const colon = normalized.indexOf(":");
  if (colon < 0) return "";
  const after = normalized.slice(colon + 1).trim();
  const value = after
    .replace(/\b(mm|kg|kw|cm3|kpa|km\/h|db\(a\)|min-?1)\b.*$/i, "")
    .trim();
  return likelyPlaceholderValue(value) ? "" : value;
}

function extractNumberAfter(label, text) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cleanCocText(text).match(new RegExp(`${escaped}\\s*:?\\s*(-?\\d+(?:[.,]\\d+)?)`, "i"));
  return match ? match[1].replace(",", ".") : "";
}

function extractExcelFields(rows) {
  const rawPairs = [];
  const lines = [];
  const fields = {};

  for (const row of rows) {
    const cells = (row || []).map(cleanCocText).filter(Boolean);
    if (!cells.length) continue;
    lines.push(cells.join(" | "));

    if (cells.length >= 2) {
      const firstIsItemNumber = /^\d+(?:\.\d+)*\.?$/.test(cells[0]);
      const key = firstIsItemNumber ? cells[1] : cells[0];
      const value = firstIsItemNumber ? cells.slice(2).join(" ") : cells.slice(1).join(" ");
      if (value && !likelyPlaceholderValue(value)) rawPairs.push({ key, value });
    }

    for (const cell of cells) {
      const inline = valueAfterColon(cell);
      if (inline) rawPairs.push({ key: stripCocNumber(cell.split(":")[0]), value: inline });

      const category = cell.match(/\bVEHICLE CATEGORY\s+([A-Z0-9][A-Z0-9.-]*)\b/i);
      if (category && !fields.vehicleCategory) fields.vehicleCategory = category[1].toUpperCase();

      if (/number of axles/i.test(cell)) {
        const axles = extractNumberAfter("Number of axles", cell);
        const wheels = extractNumberAfter("wheels", cell);
        if (axles && !fields.axles) fields.axles = axles;
        if (wheels && !fields.wheels) fields.wheels = wheels;
      }
    }
  }

  for (const pair of rawPairs) {
    const field = canonicalFieldName(stripCocNumber(pair.key));
    if (field && pair.value && !fields[field]) fields[field] = pair.value.trim();
  }

  const fullText = lines.join("\n");
  if (!fields.vin) {
    const vin = fullText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
    if (vin) fields.vin = vin[0].toUpperCase();
  }
  if (!fields.wvtaNumber) {
    const approval = fullText.match(/\be\d+\*[0-9/]+\*[A-Z0-9]+\*[0-9A-Z]+\b/i);
    if (approval) fields.wvtaNumber = approval[0];
  }

  return {
    fields,
    rawPairs,
    rows: rows.map((row) => (row || []).map(cleanCocText)),
    textPreview: fullText.slice(0, 4000),
  };
}

async function convertDocxToVehicle(body) {
  const fileName = String(body.fileName || "upload.docx");
  if (!/\.docx$/i.test(fileName)) throw new Error("Only .docx Word files are supported in this MVP");
  const documentXml = await extractDocxDocumentXml(body.base64);
  const extracted = extractWordFields(documentXml);
  const vehicle = normalizeVehicle({
    ...extracted.fields,
    sourceFileName: fileName,
    importSource: "word-docx",
  });
  return { vehicle, extracted };
}

async function convertXlsxToVehicle(body) {
  const fileName = String(body.fileName || "upload.xlsx");
  if (!/\.xlsx$/i.test(fileName)) throw new Error("Only .xlsx Excel files are supported in this MVP");
  const rows = await extractXlsxRows(body.base64);
  const extracted = extractExcelFields(rows);
  const vehicle = normalizeVehicle({
    ...extracted.fields,
    sourceFileName: fileName,
    importSource: "excel-xlsx",
  });
  return { vehicle, extracted };
}

function xmlTagValue(xml, name) {
  const match = String(xml || "").match(new RegExp(`<(?:[^:>]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[^:>]+:)?${name}>`, "i"));
  return match ? decodeXmlEntities(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

function extractXmlFields(xml) {
  const fields = {
    vin: xmlTagValue(xml, "VehicleIdentificationNumber"),
    wvtaNumber: xmlTagValue(xml, "TypeApprovalNumber"),
    approvalCountry: xmlTagValue(xml, "DesignatedTypeApprovalCountry"),
    vehicleCategory: xmlTagValue(xml, "VehicleCategory"),
    typeApprovalType: xmlTagValue(xml, "TypeApprovalType"),
    stageOfCompletion: xmlTagValue(xml, "StageOfCompletion"),
    type: xmlTagValue(xml, "Type"),
    variant: xmlTagValue(xml, "Variant"),
    version: xmlTagValue(xml, "Version"),
    typeApprovalIssueDate: xmlTagValue(xml, "TypeApprovalIssueDate"),
    productionDate: xmlTagValue(xml, "DateManufactureVehicle"),
    make: xmlTagValue(xml, "Make"),
    commercialName: xmlTagValue(xml, "CommercialName"),
    manufacturerName: xmlTagValue(xml, "ManufacturerName"),
    manufacturerAddressLine1: xmlTagValue(xml, "ManufacturerAddressLine1"),
    manufacturerPlaceOfResidence: xmlTagValue(xml, "ManufacturerPlaceOfResidence"),
    manufacturerCountry: xmlTagValue(xml, "ManufacturerCountryOfResidence"),
    signerName: xmlTagValue(xml, "SignerName"),
    signerPosition: xmlTagValue(xml, "SignerPosition"),
    signatureLocation: xmlTagValue(xml, "SignatureLocation"),
    signatureDate: xmlTagValue(xml, "SignatureDate"),
    massRunningOrderKg: xmlTagValue(xml, "MassInRunningOrder"),
    technicallyPermissibleMaximumLadenMassKg: xmlTagValue(xml, "TechnicallyPermissibleMaximumLadenMass"),
    lengthMm: xmlTagValue(xml, "Length"),
    widthMm: xmlTagValue(xml, "Width"),
    heightMm: xmlTagValue(xml, "Height"),
    fuelType: xmlTagValue(xml, "FuelType"),
  };
  for (const key of Object.keys(fields)) {
    if (!fields[key]) delete fields[key];
  }
  return {
    fields,
    textPreview: String(xml || "").slice(0, 4000),
    signaturePresent: /<Signature\b/i.test(xml),
  };
}

async function convertXmlToVehicle(body) {
  const fileName = String(body.fileName || "upload.xml");
  if (!/\.xml$/i.test(fileName)) throw new Error("Only .xml files are supported by this converter");
  const xml = Buffer.from(String(body.base64 || ""), "base64").toString("utf8");
  const extracted = extractXmlFields(xml);
  const vehicle = normalizeVehicle({
    ...extracted.fields,
    sourceFileName: fileName,
    importSource: "ivi-xml",
  });
  return { vehicle, extracted, xml };
}

function detectUploadKind(fileName) {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  if (ext === ".docx") return "word";
  if (ext === ".xlsx") return "excel";
  if (ext === ".xml") return "xml";
  if (ext === ".csv") return "csv";
  return "unsupported";
}

function upsertVehicle(db, vehicle) {
  const existingIndex = db.vehicles.findIndex((item) => item.vin === vehicle.vin);
  if (existingIndex >= 0) {
    db.vehicles[existingIndex] = { ...db.vehicles[existingIndex], ...vehicle, updatedAt: now() };
    return db.vehicles[existingIndex];
  }
  db.vehicles.push(vehicle);
  return vehicle;
}

async function draftFromVehicle(db, vehicle, source, originalXml = "") {
  const savedVehicle = upsertVehicle(db, vehicle);
  const draft = makeDraft(savedVehicle);
  if (source.signaturePresent) draft.signingStatus = "signed";
  const report = validateDraft(draft);
  const xml = originalXml && /<InitialVehicleInformation\b/i.test(originalXml) ? originalXml : generatePrototypeIviXml(draft);
  const relativePath = await saveEvidence(draft.id, source.xmlFileName, xml);
  draft.validationReport = report;
  draft.iviXmlPath = relativePath;
  draft.iviXmlHash = hash(xml);
  draft.status = report.passed ? "ivi_generated" : "validation_failed";
  if (source.signaturePresent) {
    draft.signedXmlPath = relativePath;
    draft.signedXmlHash = draft.iviXmlHash;
    draft.status = report.passed ? "signed" : draft.status;
  }
  db.drafts.push(draft);
  audit(db, `${source.kind}.convert_to_ivi`, "draft", draft.id, {
    vin: draft.vin,
    fileName: source.fileName,
    xmlHash: draft.iviXmlHash,
    validation: report.summary,
  });
  return { vehicle: savedVehicle, draft, report, xml };
}

async function processUploadFile(db, file) {
  const kind = detectUploadKind(file.fileName);
  try {
    if (kind === "unsupported") throw new Error("Unsupported file type");
    if (kind === "csv") {
      const csv = Buffer.from(String(file.base64 || ""), "base64").toString("utf8");
      const rows = parseCsv(csv);
      const created = [];
      const errors = [];
      for (const [index, row] of rows.entries()) {
        const vehicle = normalizeVehicle({ ...row, sourceFileName: file.fileName, importSource: "csv-batch" });
        if (!vehicle.vin) {
          errors.push({ row: index + 2, error: "VIN is required" });
          continue;
        }
        created.push(await draftFromVehicle(db, vehicle, { kind: "csv", fileName: file.fileName, xmlFileName: "ivi20-from-csv.xml" }));
      }
      return { fileName: file.fileName, kind, status: errors.length ? "partial" : "converted", created: created.map((item) => publicDraft(item.draft)), errors };
    }

    const converter =
      kind === "word" ? convertDocxToVehicle : kind === "excel" ? convertXlsxToVehicle : convertXmlToVehicle;
    const converted = await converter(file);
    if (!converted.vehicle.vin) {
      return {
        fileName: file.fileName,
        kind,
        status: "blocked",
        error: `VIN was not found in the ${kind} file`,
        extracted: converted.extracted,
      };
    }
    const created = await draftFromVehicle(
      db,
      converted.vehicle,
      {
        kind,
        fileName: file.fileName,
        xmlFileName: kind === "xml" ? "ivi20-uploaded.xml" : `ivi20-from-${kind}.xml`,
        signaturePresent: converted.extracted.signaturePresent,
      },
      converted.xml
    );
    return {
      fileName: file.fileName,
      kind,
      status: created.report.passed ? "converted" : "needs_fix",
      draft: publicDraft(created.draft),
      report: created.report,
      extracted: converted.extracted,
    };
  } catch (error) {
    return { fileName: file.fileName, kind, status: "failed", error: error.message };
  }
}

async function findFiles(dir, predicate) {
  const found = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await findFiles(fullPath, predicate)));
    else if (predicate(fullPath)) found.push(fullPath);
  }
  return found;
}

function audit(db, action, objectType, objectId, detail = {}) {
  db.audit.unshift({
    id: id("audit"),
    action,
    objectType,
    objectId,
    detail,
    at: now(),
  });
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    const next = csv[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        value += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(value.trim());
      value = "";
    } else if (ch === "\n") {
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
    } else if (ch !== "\r") {
      value += ch;
    }
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    rows.push(row);
  }
  if (rows.length === 0) return [];

  const headers = rows.shift().map((header) => header.trim());
  return rows
    .filter((fields) => fields.some((field) => field !== ""))
    .map((fields) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = fields[index] || "";
      });
      return record;
    });
}

function normalizeDate(value) {
  const textValue = String(value || "").trim();
  if (!textValue) return "";
  const iso = textValue.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = textValue.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return textValue;
}

function deriveApprovalCountry(value) {
  const match = String(value || "").match(/\b(e\d+)\*/i);
  return match ? match[1].toLowerCase() : "";
}

function normalizeIndicator(value, fallback = "") {
  const textValue = String(value || "").trim().toLowerCase();
  if (["y", "yes", "true", "1", "是"].includes(textValue)) return "Y";
  if (["n", "no", "false", "0", "否"].includes(textValue)) return "N";
  return fallback;
}

function normalizeTypeApprovalType(value) {
  const textValue = String(value || "").trim().toUpperCase();
  if (["EU", "ESS", "NSS"].includes(textValue)) return textValue;
  if (textValue === "EC") return "EU";
  return "EU";
}

function normalizeStageOfCompletion(value) {
  const textValue = String(value || "").trim().toUpperCase();
  if (["C", "I", "V"].includes(textValue)) return textValue;
  return "C";
}

function normalizePlateAttachment(value) {
  const textValue = String(value || "").trim().toUpperCase();
  if (["A1", "A2", "A3", "A4"].includes(textValue)) return textValue;
  return "A1";
}

function normalizeFuelType(value) {
  const textValue = String(value || "").trim().toUpperCase();
  const map = {
    PETROL: "B",
    GASOLINE: "B",
    BENZINE: "B",
    DIESEL: "D",
    HYDROGEN: "M",
  };
  if (["B", "D", "F", "M"].includes(textValue)) return textValue;
  return map[textValue] || "";
}

function normalizeVehicle(row) {
  const vehicle = {};
  for (const [key, value] of Object.entries(row)) {
    vehicle[key.trim()] = typeof value === "string" ? value.trim() : value;
  }
  vehicle.vin = String(vehicle.vin || vehicle.VIN || "").toUpperCase();
  vehicle.id = vehicle.id || `veh_${vehicle.vin || crypto.randomBytes(4).toString("hex")}`;
  vehicle.manufacturerName = vehicle.manufacturerName || vehicle.manufacturer || "Demo OEM Ltd.";
  vehicle.manufacturerCountry = vehicle.manufacturerCountry || "CN";
  vehicle.manufacturerAddressLine1 = vehicle.manufacturerAddressLine1 || vehicle.manufacturerAddress || "";
  vehicle.manufacturerPlaceOfResidence = vehicle.manufacturerPlaceOfResidence || vehicle.manufacturerPlace || "";
  vehicle.euRepresentativeName = vehicle.euRepresentativeName || vehicle.euRepresentative || "";
  vehicle.euRepresentativeCountry = vehicle.euRepresentativeCountry || "";
  vehicle.euRepresentativeAddressLine1 = vehicle.euRepresentativeAddressLine1 || vehicle.euRepresentativeAddress || "";
  vehicle.euRepresentativePlaceOfResidence = vehicle.euRepresentativePlaceOfResidence || vehicle.euRepresentativePlace || "";
  vehicle.approvalCountry = vehicle.approvalCountry || vehicle.designatedTypeApprovalCountry || deriveApprovalCountry(vehicle.wvtaNumber);
  vehicle.typeApprovalType = normalizeTypeApprovalType(vehicle.typeApprovalType);
  vehicle.provisionalTypeApprovalIndicator = normalizeIndicator(vehicle.provisionalTypeApprovalIndicator, "N");
  vehicle.stageOfCompletion = normalizeStageOfCompletion(vehicle.stageOfCompletion);
  vehicle.methodAttachmentStatutoryPlate = normalizePlateAttachment(vehicle.methodAttachmentStatutoryPlate);
  vehicle.productionDate = normalizeDate(vehicle.productionDate);
  vehicle.typeApprovalIssueDate = normalizeDate(vehicle.typeApprovalIssueDate || vehicle.productionDate);
  vehicle.signatureDate = normalizeDate(vehicle.signatureDate || vehicle.productionDate);
  vehicle.fuelType = normalizeFuelType(vehicle.fuelType);
  vehicle.importedAt = now();
  return vehicle;
}

function makeDraft(vehicle) {
  return {
    id: id("draft"),
    vehicleId: vehicle.id,
    vin: vehicle.vin,
    status: "draft",
    signingStatus: "unsigned",
    napStatus: "not_submitted",
    iviReferenceId: crypto.randomUUID(),
    iviVersionNumber: 1,
    iviVersionDateTime: now(),
    xsdVersion: "IVI 2.0 official XSD pending",
    schemaStatus: OFFICIAL_SCHEMA_STATUS,
    mappingVersion: "prototype-mapping-0.1",
    snapshot: vehicle,
    validationReport: null,
    iviXmlPath: null,
    createdAt: now(),
    updatedAt: now(),
  };
}

function validateDraft(draft) {
  const v = draft.snapshot || {};
  const findings = [];
  const error = (code, field, message) => findings.push({ severity: "error", code, field, message });
  const warning = (code, field, message) => findings.push({ severity: "warning", code, field, message });
  const info = (code, field, message) => findings.push({ severity: "info", code, field, message });

  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v.vin || "")) {
    error("VIN_FORMAT", "vin", "VIN must be 17 characters and cannot contain I, O or Q.");
  }
  if (!v.manufacturerName) error("MANUFACTURER_REQUIRED", "manufacturerName", "Manufacturer legal name is required.");
  if (!v.wvtaNumber) error("WVTA_REQUIRED", "wvtaNumber", "WVTA approval number is required.");
  if (!v.approvalAuthority) error("APPROVAL_AUTHORITY_REQUIRED", "approvalAuthority", "Type-approval authority is required.");
  if (!v.approvalCountry) error("APPROVAL_COUNTRY_REQUIRED", "approvalCountry", "Designated type-approval country code is required, e.g. e1 or e6.");
  if (!v.vehicleCategory) error("VEHICLE_CATEGORY_REQUIRED", "vehicleCategory", "Vehicle category is required.");
  if (!/^(M[1-3]|N[1-3]|O[1-4]|L[1-7]e(?:-[A-Z0-9]+)?)$/.test(v.vehicleCategory || "")) {
    warning("VEHICLE_CATEGORY_REVIEW", "vehicleCategory", "Confirm the category is in scope for Regulation (EU) 2018/858.");
  }
  if (/^(M[1-3]|N[1-3]|O[1-4])$/.test(v.vehicleCategory || "") && !/2018\/858/.test(v.wvtaNumber || "")) {
    error("CERTIFICATE_2018_858_MISMATCH", "wvtaNumber/vehicleCategory", "M/N/O vehicle categories must be consistent with a 2018/858 WVTA certificate number.");
  }
  if (v.approvalCountry && v.wvtaNumber && deriveApprovalCountry(v.wvtaNumber) && v.approvalCountry !== deriveApprovalCountry(v.wvtaNumber)) {
    error("APPROVAL_COUNTRY_MISMATCH", "approvalCountry/wvtaNumber", "Designated type-approval country must match the e-code prefix in the WVTA number.");
  }
  if (!v.productionDate) error("PRODUCTION_DATE_REQUIRED", "productionDate", "Production date is required.");
  if (!v.typeApprovalIssueDate) error("TYPE_APPROVAL_ISSUE_DATE_REQUIRED", "typeApprovalIssueDate", "Type-approval issue date is required.");
  if (!v.type || !v.variant || !v.version) {
    error("TYPE_VARIANT_VERSION_REQUIRED", "type/variant/version", "Type, variant and version are required for CoC/IVI mapping.");
  }
  if (!v.make) error("MAKE_REQUIRED", "make", "Make is required for IVI 2.0 MakeTable.");
  if (!v.manufacturerAddressLine1 || !v.manufacturerPlaceOfResidence) {
    warning("MANUFACTURER_ADDRESS_INCOMPLETE", "manufacturerAddressLine1/manufacturerPlaceOfResidence", "Manufacturer address/place should be populated for final IVI.");
  }
  if (!v.signerName || !v.signerPosition || !v.signatureLocation || !v.signatureDate) {
    warning("SIGNER_INCOMPLETE", "signerName/signerPosition/signatureLocation/signatureDate", "Signing authority fields should be checked before production signing.");
  }
  if (!positiveNumber(v.massRunningOrderKg)) warning("MASS_RUNNING_ORDER_MISSING", "massRunningOrderKg", "Mass in running order should be populated.");
  if (!positiveNumber(v.technicallyPermissibleMaximumLadenMassKg)) {
    warning("MAX_LADEN_MASS_MISSING", "technicallyPermissibleMaximumLadenMassKg", "Technically permissible maximum laden mass should be populated.");
  }
  if (!positiveNumber(v.lengthMm) || !positiveNumber(v.widthMm) || !positiveNumber(v.heightMm)) {
    warning("DIMENSIONS_INCOMPLETE", "lengthMm/widthMm/heightMm", "Length, width and height should be populated.");
  }
  if (!v.fuelType) warning("FUEL_TYPE_MISSING", "fuelType", "Fuel or energy source should be populated.");

  if (draft.signingStatus === "signed") {
    info("SIGNATURE_INCLUDED", "signature", "Draft has a signed XML package.");
  } else {
    warning("SIGNATURE_NOT_INCLUDED", "signature", "This draft is not signed yet. Production submission needs XMLDSig signing.");
  }
  info("OFFICIAL_XSD_AVAILABLE", "schema", "Local IVI 2.0 XSD is present; full validation remains blocked until XMLDSig schema/signature integration is added.");

  const errors = findings.filter((item) => item.severity === "error").length;
  const warnings = findings.filter((item) => item.severity === "warning").length;
  return {
    id: id("validation"),
    draftId: draft.id,
    vin: draft.vin,
    passed: errors === 0,
    summary: { errors, warnings, total: findings.length },
    checks: {
      internalBusinessRules: errors === 0 ? "passed" : "failed",
      officialXsd: OFFICIAL_SCHEMA_STATUS,
      icm: "not_configured",
      signature: "excluded_from_mvp",
    },
    findings,
    generatedAt: now(),
  };
}

function positiveNumber(value) {
  return Number(value) > 0;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(name, value, indent = "    ") {
  return `${indent}<${name}>${escapeXml(value)}</${name}>`;
}

function maybeTag(name, value, indent = "    ") {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return tag(name, value, indent);
}

function requiredText(value, fallback) {
  const textValue = String(value || "").trim();
  return textValue || fallback;
}

function clampText(value, maxLength, fallback) {
  return requiredText(value, fallback).slice(0, maxLength);
}

function countryName(value) {
  const textValue = String(value || "").trim();
  const countries = {
    CN: "CHINA",
    DE: "GERMANY",
    NL: "NETHERLANDS",
    BE: "BELGIUM",
    JP: "JAPAN",
    FR: "FRANCE",
    ES: "SPAIN",
    IT: "ITALY",
    SE: "SWEDEN",
    AT: "AUSTRIA",
  };
  return countries[textValue.toUpperCase()] || textValue || "UNKNOWN";
}

function numericText(value) {
  const match = String(value || "").replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : "";
}

function pushOptional(lines, name, value, indent = "    ") {
  const line = maybeTag(name, value, indent);
  if (line) lines.push(line);
}

function generatePrototypeIviXml(draft) {
  const v = draft.snapshot || {};
  const referenceId = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    draft.iviReferenceId || ""
  )
    ? draft.iviReferenceId
    : crypto.randomUUID();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<InitialVehicleInformation xmlns="http://eu.ereg.initialvehicleinformation.v2">',
    "  <!-- Unsigned MVP output: IVI 2.0 XSD requires an XMLDSig Signature element before production submission. -->",
    "  <Header>",
    tag("IviReferenceId", referenceId, "    "),
    tag("IviVersionNumberXsd", "2.0", "    "),
    tag("IviVersionNumber", draft.iviVersionNumber, "    "),
    tag("IviVersionDateTime", draft.iviVersionDateTime, "    "),
  ];
  pushOptional(lines, "IntendedCountryRegistration", v.intendedCountryRegistration, "    ");
  lines.push(
    tag("DesignatedTypeApprovalCountry", requiredText(v.approvalCountry || deriveApprovalCountry(v.wvtaNumber), "e6"), "    "),
    "  </Header>",
    "  <CocDataGroup>",
    tag("VehicleIdentificationNumber", clampText(v.vin, 17, "UNKNOWNVIN0000000"), "    "),
    tag("TypeApprovalType", normalizeTypeApprovalType(v.typeApprovalType), "    "),
    tag("ProvisionalTypeApprovalIndicator", normalizeIndicator(v.provisionalTypeApprovalIndicator, "N"), "    "),
    tag("StageOfCompletion", normalizeStageOfCompletion(v.stageOfCompletion), "    "),
    tag("Type", clampText(v.type, 15, "UNKNOWN"), "    "),
    tag("Variant", clampText(v.variant, 25, "UNKNOWN"), "    "),
    tag("Version", clampText(v.version, 35, "UNKNOWN"), "    "),
    tag("VehicleCategory", clampText(v.vehicleCategory, 20, "M1"), "    "),
    tag("MethodAttachmentStatutoryPlate", normalizePlateAttachment(v.methodAttachmentStatutoryPlate), "    "),
    tag("TypeApprovalNumber", clampText(v.wvtaNumber, 35, "UNKNOWN"), "    "),
    tag("TypeApprovalIssueDate", normalizeDate(v.typeApprovalIssueDate || v.productionDate || now().slice(0, 10)), "    "),
    "    <SigningAuthorityTable>",
    "      <SigningAuthorityGroup>",
    tag("SignerName", clampText(v.signerName, 150, v.manufacturerName || "UNKNOWN SIGNER"), "        "),
    tag("SignerPosition", clampText(v.signerPosition, 80, "AUTHORIZED REPRESENTATIVE"), "        "),
    tag("SignatureLocation", clampText(v.signatureLocation, 80, v.manufacturerPlaceOfResidence || "UNKNOWN"), "        "),
    tag("SignatureDate", normalizeDate(v.signatureDate || v.productionDate || now().slice(0, 10)), "        "),
    "      </SigningAuthorityGroup>",
    "    </SigningAuthorityTable>",
    "    <MakeTable>",
    "      <MakeGroup>",
    tag("Make", clampText(v.make, 52, v.manufacturerName || "UNKNOWN"), "        "),
    "      </MakeGroup>",
    "    </MakeTable>"
  );
  pushOptional(lines, "DateManufactureVehicle", v.productionDate, "    ");

  pushOptional(lines, "CommercialNameTable", "", "    ");
  if (v.commercialName) {
    lines.push(
      "    <CommercialNameTable>",
      "      <CommercialNameGroup>",
      tag("CommercialName", clampText(v.commercialName, 100, "UNKNOWN"), "        "),
      "      </CommercialNameGroup>",
      "    </CommercialNameTable>"
    );
  }

  lines.push(
    "    <ManufacturerTable>",
    "      <ManufacturerGroup>",
    tag("ManufacturerStageNumber", numericText(v.manufacturerStageNumber) || "1", "        "),
    tag("ManufacturerName", clampText(v.manufacturerName, 150, "UNKNOWN MANUFACTURER"), "        "),
    tag("ManufacturerAddressLine1", clampText(v.manufacturerAddressLine1, 150, "ADDRESS NOT PROVIDED"), "        "),
    tag("ManufacturerPlaceOfResidence", clampText(v.manufacturerPlaceOfResidence, 80, "PLACE NOT PROVIDED"), "        "),
    tag("ManufacturerCountryOfResidence", clampText(countryName(v.manufacturerCountry), 80, "UNKNOWN"), "        "),
    "      </ManufacturerGroup>",
    "    </ManufacturerTable>"
  );

  if (v.euRepresentativeName) {
    lines.push(
      "    <EURepresentativeGroup>",
      tag("EURepresentativeName", clampText(v.euRepresentativeName, 150, "UNKNOWN"), "      "),
      tag("EURepresentativeAddressLine1", clampText(v.euRepresentativeAddressLine1, 150, "ADDRESS NOT PROVIDED"), "      "),
      tag("EURepresentativePlaceOfResidence", clampText(v.euRepresentativePlaceOfResidence, 80, "PLACE NOT PROVIDED"), "      "),
      tag("EURepresentativeCountryOfResidence", clampText(countryName(v.euRepresentativeCountry), 80, "UNKNOWN"), "      "),
      "    </EURepresentativeGroup>"
    );
  }

  const construction = [];
  pushOptional(construction, "NumberOfAxles", numericText(v.axles), "      ");
  pushOptional(construction, "NumberOfWheels", numericText(v.wheels), "      ");
  pushOptional(construction, "NumberOfSeatingPositionsIncludingDriver", numericText(v.seats), "      ");
  if (construction.length) lines.push("    <GeneralConstructionGroup>", ...construction, "    </GeneralConstructionGroup>");

  const dimensions = [];
  pushOptional(dimensions, "Length", numericText(v.lengthMm), "      ");
  pushOptional(dimensions, "Width", numericText(v.widthMm), "      ");
  pushOptional(dimensions, "Height", numericText(v.heightMm), "      ");
  if (dimensions.length) lines.push("    <DimensionGroup>", ...dimensions, "    </DimensionGroup>");

  const masses = [];
  pushOptional(masses, "MassInRunningOrder", numericText(v.massRunningOrderKg), "      ");
  pushOptional(masses, "TechnicallyPermissibleMaximumLadenMass", numericText(v.technicallyPermissibleMaximumLadenMassKg), "      ");
  if (masses.length) lines.push("    <MassGroup>", ...masses, "    </MassGroup>");

  pushOptional(lines, "FuelType", v.fuelType, "    ");
  lines.push(
    "  </CocDataGroup>",
    "</InitialVehicleInformation>",
    ""
  );
  return lines.join("\n");
}

function publicDraft(draft) {
  return {
    ...draft,
    snapshot: undefined,
    type: draft.snapshot?.type || "",
    variant: draft.snapshot?.variant || "",
    version: draft.snapshot?.version || "",
    hasXml: Boolean(draft.iviXmlPath),
    hasSignedXml: Boolean(draft.signedXmlPath),
    validationSummary: draft.validationReport ? draft.validationReport.summary : null,
  };
}

async function saveEvidence(draftId, filename, content) {
  const dir = path.join(EVIDENCE_DIR, draftId);
  await fs.mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, content);
  return path.relative(ROOT, fullPath);
}

async function getEvidenceFile(relativePath) {
  const fullPath = path.resolve(ROOT, relativePath);
  if (!fullPath.startsWith(EVIDENCE_DIR)) throw new Error("Invalid evidence path");
  return fs.readFile(fullPath, "utf8");
}

function selectApiKey(db, kind, requestedId) {
  const keyId = requestedId || db.activeApiKeys?.[kind];
  const apiKey = db.apiKeys.find((item) => item.kind === kind && item.id === keyId);
  if (!apiKey) throw new Error(`${kind} API key is not configured`);
  if (apiKey.mode === "disabled") throw new Error(`${apiKey.label} is disabled`);
  return apiKey;
}

function findModelSetting(db, draft) {
  const v = draft.snapshot || {};
  const type = String(v.type || "").trim().toLowerCase();
  const wvta = String(v.wvtaNumber || "").trim().toLowerCase();
  return (db.settings?.modelSettings || []).find((item) => {
    const itemType = String(item.modelType || "").trim().toLowerCase();
    const itemWvta = String(item.wvtaNumber || "").trim().toLowerCase();
    if (!itemType && !itemWvta) return false;
    if (itemType && itemType !== type) return false;
    if (itemWvta && itemWvta !== wvta) return false;
    return true;
  });
}

function resolveSigningApiKey(db, draft) {
  const modelSetting = findModelSetting(db, draft);
  if (modelSetting?.signingApiKeyId) {
    const configured = db.apiKeys.find((item) => item.kind === "signing" && item.id === modelSetting.signingApiKeyId);
    if (configured) return configured;
  }
  const v = draft.snapshot || {};
  const country = String(v.approvalCountry || deriveApprovalCountry(v.wvtaNumber) || "").toLowerCase();
  if (["e11", "e24"].includes(country)) {
    return db.apiKeys.find((item) => item.id === "signing-gb-rep") || selectApiKey(db, "signing");
  }
  if (["e2", "e3", "e4", "e5", "e6", "e9", "e13"].includes(country)) {
    return db.apiKeys.find((item) => item.id === "signing-eu-rep-2") || selectApiKey(db, "signing");
  }
  return db.apiKeys.find((item) => item.id === "signing-eu-rep-1") || selectApiKey(db, "signing");
}

function resolveUploadApiKey(db, draft) {
  const modelSetting = findModelSetting(db, draft);
  if (modelSetting?.uploadApiKeyId) {
    const configured = db.apiKeys.find((item) => item.kind === "upload" && item.id === modelSetting.uploadApiKeyId);
    if (configured) return configured;
  }
  const v = draft.snapshot || {};
  const approvalCountry = String(v.approvalCountry || deriveApprovalCountry(v.wvtaNumber) || "").toLowerCase();
  if (["e11", "e24"].includes(approvalCountry)) {
    return db.apiKeys.find((item) => item.id === "upload-vca") || selectApiKey(db, "upload");
  }
  return db.apiKeys.find((item) => item.id === "upload-rdw") || selectApiKey(db, "upload");
}

function routingDecision(db, draft) {
  const approvalCountry = draft.snapshot?.approvalCountry || deriveApprovalCountry(draft.snapshot?.wvtaNumber);
  const region = ["e11", "e24"].includes(String(approvalCountry || "").toLowerCase()) ? "GB" : "EU";
  const signing = resolveSigningApiKey(db, draft);
  const upload = resolveUploadApiKey(db, draft);
  return {
    draftId: draft.id,
    vin: draft.vin,
    certificate: {
      wvtaNumber: draft.snapshot?.wvtaNumber || "",
      approvalCountry,
      uploadRegion: region,
    },
    signing: publicApiKey(signing),
    upload: publicApiKey(upload),
  };
}

function unsignedXmlWithoutClosingRoot(xml) {
  return String(xml || "").replace(/\s*<\/InitialVehicleInformation>\s*$/i, "");
}

function makeMockSignatureXml(xml, draft, apiKey) {
  const digest = hash(xml);
  const signatureId = `SIG-${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
  return `${unsignedXmlWithoutClosingRoot(xml)}
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>${digest}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${hash(`${digest}|${apiKey.keyRef}|${draft.id}`).toUpperCase()}</SignatureValue>
    <KeyInfo>
      <KeyName>${escapeXml(apiKey.label)}</KeyName>
    </KeyInfo>
    <Object Id="${signatureId}">Mock D-Trust API seal status for local acceptance testing.</Object>
  </Signature>
</InitialVehicleInformation>
`;
}

async function signDraft(db, draft, apiKey) {
  const report = validateDraft(draft);
  draft.validationReport = report;
  if (!report.passed) {
    draft.status = "validation_failed";
    return { draft, status: "blocked", error: "Validation errors must be fixed before signing", report };
  }
  if (!draft.iviXmlPath) {
    const xml = generatePrototypeIviXml(draft);
    draft.iviXmlPath = await saveEvidence(draft.id, "ivi20-before-signing.xml", xml);
    draft.iviXmlHash = hash(xml);
  }
  const xml = await getEvidenceFile(draft.iviXmlPath);
  const signedXml = /<Signature\b/i.test(xml) ? xml : makeMockSignatureXml(xml, draft, apiKey);
  const signedXmlPath = await saveEvidence(draft.id, "ivi20-signed.xml", signedXml);
  draft.signedXmlPath = signedXmlPath;
  draft.signedXmlHash = hash(signedXml);
  draft.signingStatus = "signed";
  draft.signatureProvider = apiKey.provider;
  draft.signatureApiKeyId = apiKey.id;
  draft.signatureReceipt = {
    id: `DTRUST-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
    status: "sealed",
    provider: apiKey.provider,
    mode: apiKey.mode,
    keyDisplay: maskKeyRef(apiKey.keyRef),
    at: now(),
  };
  draft.status = "signed";
  draft.updatedAt = now();
  audit(db, "draft.sign", "draft", draft.id, { provider: apiKey.provider, apiKeyId: apiKey.id, receipt: draft.signatureReceipt.id });
  return { draft, status: "signed", receipt: draft.signatureReceipt };
}

async function uploadDraft(db, draft, apiKey) {
  if (draft.signingStatus !== "signed" || !draft.signedXmlPath) {
    return { draft, status: "blocked", error: "Signed XML is required before RDW upload" };
  }
  const idempotencyKey = hash(`${draft.vin}|${draft.iviReferenceId}|${draft.signedXmlHash}`);
  const acceptedDuplicate = db.submissions.find((item) => item.idempotencyKey === idempotencyKey && item.status === "accepted");
  if (acceptedDuplicate) {
    return { draft, status: "duplicate", error: "Duplicate effective submission blocked", submission: acceptedDuplicate };
  }
  const submission = {
    id: id("sub"),
    draftId: draft.id,
    vin: draft.vin,
    nap: apiKey.provider,
    mode: apiKey.mode,
    status: "accepted",
    messageId: `${apiKey.provider}-${crypto.randomBytes(7).toString("hex").toUpperCase()}`,
    idempotencyKey,
    unsigned: false,
    apiKeyId: apiKey.id,
    apiKeyDisplay: maskKeyRef(apiKey.keyRef),
    receipt: {
      code: `${apiKey.provider}_ACCEPTED_MOCK`,
      message: `Mock ${apiKey.provider} API accepted the signed IVI package for local workflow testing.`,
    },
    createdAt: now(),
  };
  db.submissions.unshift(submission);
  draft.napStatus = "rdw_accepted";
  draft.uploadApiKeyId = apiKey.id;
  draft.status = "uploaded";
  draft.updatedAt = now();
  audit(db, "draft.upload_nap", "draft", draft.id, { nap: apiKey.provider, submissionId: submission.id, apiKeyId: apiKey.id });
  return { draft, status: "accepted", submission };
}

function matchRoute(method, pathname) {
  const draftMatch = pathname.match(/^\/api\/drafts\/([^/]+)(?:\/([^/]+))?$/);
  return { method, pathname, draftMatch };
}

async function api(req, res, pathname) {
  const route = matchRoute(req.method, pathname);
  const db = await readDb();

  if (req.method === "GET" && pathname === "/api/health") {
    return json(res, 200, { ok: true, at: now(), signature: "excluded_from_mvp" });
  }

  if (req.method === "GET" && pathname === "/api/dashboard") {
    const counts = {
      vehicles: db.vehicles.length,
      drafts: db.drafts.length,
      validationFailed: db.drafts.filter((d) => d.status === "validation_failed").length,
      iviGenerated: db.drafts.filter((d) => d.status === "ivi_generated" || d.iviXmlPath).length,
      signed: db.drafts.filter((d) => d.signingStatus === "signed").length,
      uploaded: db.drafts.filter((d) => d.status === "uploaded" || d.napStatus === "rdw_accepted").length,
      mockAccepted: db.submissions.filter((s) => s.status === "accepted").length,
    };
    return json(res, 200, { counts, officialSchemaStatus: OFFICIAL_SCHEMA_STATUS });
  }

  if (req.method === "GET" && pathname === "/api/api-keys") {
    return json(res, 200, {
      active: db.activeApiKeys,
      keys: db.apiKeys.map(publicApiKey),
      routingMode: "automatic_by_2018_858_certificate",
      routingRules: [
        "签章主体：按 WVTA / Approval number 的 e-code 自动判定 EU 或 GB；e11/e24 走 GB 代表处，其余走 EU 代表处。",
        "上传主体：按 WVTA / Approval number 的 e-code 自动判定 EU 或 GB；e11/e24 走 GB/VCA，其余走 EU/RDW。",
      ],
    });
  }

  if (req.method === "GET" && pathname === "/api/settings") {
    return json(res, 200, { settings: { ...defaultSettings(), ...(db.settings || {}) } });
  }

  if (req.method === "POST" && pathname === "/api/settings") {
    const body = await readBody(req);
    db.settings = {
      ...defaultSettings(),
      ...(body.settings || {}),
      wvtaReference: { ...defaultSettings().wvtaReference, ...(body.settings?.wvtaReference || {}) },
      modelApiRouting: { ...defaultSettings().modelApiRouting, ...(body.settings?.modelApiRouting || {}) },
      signingSubjects: { ...defaultSettings().signingSubjects, ...(body.settings?.signingSubjects || {}) },
      uploadSubjects: { ...defaultSettings().uploadSubjects, ...(body.settings?.uploadSubjects || {}) },
      modelSettings: Array.isArray(body.settings?.modelSettings) ? body.settings.modelSettings : [],
    };
    audit(db, "settings.update", "settings", "workflow", {});
    await writeDb(db);
    return json(res, 200, { settings: db.settings });
  }

  if (req.method === "POST" && pathname === "/api/api-keys/active") {
    const body = await readBody(req);
    for (const kind of ["signing", "upload"]) {
      if (!body[kind]) continue;
      const exists = db.apiKeys.some((item) => item.kind === kind && item.id === body[kind]);
      if (!exists) return json(res, 400, { error: `${kind} API key does not exist` });
      db.activeApiKeys[kind] = body[kind];
    }
    audit(db, "api_keys.switch", "apiKey", "active", { active: db.activeApiKeys });
    await writeDb(db);
    return json(res, 200, { active: db.activeApiKeys, keys: db.apiKeys.map(publicApiKey) });
  }

  if (req.method === "POST" && pathname === "/api/uploads/batch") {
    const body = await readBody(req);
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return json(res, 400, { error: "No files uploaded" });
    const results = [];
    for (const file of files) results.push(await processUploadFile(db, file));
    audit(db, "upload.batch_convert", "upload", "batch", { files: files.length });
    await writeDb(db);
    return json(res, 200, { results, drafts: db.drafts.map(publicDraft) });
  }

  if (req.method === "POST" && pathname === "/api/examples/load-official-samples") {
    const files = await findFiles(OFFICIAL_EXAMPLE_DIR, (filePath) => filePath.toLowerCase().endsWith(".xml"));
    const results = [];
    for (const filePath of files) {
      const base64 = await fs.readFile(filePath, "base64");
      results.push(await processUploadFile(db, { fileName: path.basename(filePath), base64 }));
    }
    audit(db, "examples.load_official_samples", "upload", "official_samples", { files: files.length });
    await writeDb(db);
    return json(res, 200, { results, drafts: db.drafts.map(publicDraft) });
  }

  if (req.method === "POST" && pathname === "/api/drafts/batch-validate") {
    const body = await readBody(req);
    const ids = Array.isArray(body.draftIds) && body.draftIds.length ? body.draftIds : db.drafts.map((draft) => draft.id);
    const results = [];
    for (const draft of db.drafts.filter((item) => ids.includes(item.id))) {
      const report = validateDraft(draft);
      draft.validationReport = report;
      draft.status = report.passed ? (draft.signingStatus === "signed" ? "signed" : "validated") : "validation_failed";
      draft.updatedAt = now();
      await saveEvidence(draft.id, "validation-report.json", JSON.stringify(report, null, 2));
      results.push({ draft: publicDraft(draft), report });
    }
    audit(db, "draft.batch_validate", "draft", "batch", { count: results.length });
    await writeDb(db);
    return json(res, 200, { results });
  }

  if (req.method === "POST" && pathname === "/api/drafts/batch-sign") {
    const body = await readBody(req);
    const ids = Array.isArray(body.draftIds) && body.draftIds.length ? body.draftIds : db.drafts.map((draft) => draft.id);
    const results = [];
    for (const draft of db.drafts.filter((item) => ids.includes(item.id))) {
      const apiKey = resolveSigningApiKey(db, draft);
      const result = await signDraft(db, draft, apiKey);
      results.push({ ...result, draft: publicDraft(result.draft), apiKey: publicApiKey(apiKey), routing: routingDecision(db, draft) });
    }
    await writeDb(db);
    return json(res, 200, { routingMode: "automatic_by_2018_858_certificate", results });
  }

  if (req.method === "POST" && pathname === "/api/drafts/batch-upload") {
    const body = await readBody(req);
    const ids = Array.isArray(body.draftIds) && body.draftIds.length ? body.draftIds : db.drafts.map((draft) => draft.id);
    const results = [];
    for (const draft of db.drafts.filter((item) => ids.includes(item.id))) {
      const apiKey = resolveUploadApiKey(db, draft);
      const result = await uploadDraft(db, draft, apiKey);
      results.push({ ...result, draft: publicDraft(result.draft), apiKey: publicApiKey(apiKey), routing: routingDecision(db, draft) });
    }
    await writeDb(db);
    return json(res, 200, { routingMode: "automatic_by_2018_858_certificate", results, submissions: db.submissions });
  }

  if (req.method === "POST" && pathname === "/api/convert/word-to-ivi") {
    const body = await readBody(req);
    const { vehicle, extracted } = await convertDocxToVehicle(body);
    if (!vehicle.vin) return json(res, 422, { error: "VIN was not found in the Word file", extracted });

    const existingIndex = db.vehicles.findIndex((item) => item.vin === vehicle.vin);
    const savedVehicle =
      existingIndex >= 0
        ? { ...db.vehicles[existingIndex], ...vehicle, updatedAt: now() }
        : vehicle;
    if (existingIndex >= 0) db.vehicles[existingIndex] = savedVehicle;
    else db.vehicles.push(savedVehicle);

    const draft = makeDraft(savedVehicle);
    const report = validateDraft(draft);
    const xml = generatePrototypeIviXml(draft);
    const relativePath = await saveEvidence(draft.id, "ivi20-from-word.xml", xml);
    draft.validationReport = report;
    draft.iviXmlPath = relativePath;
    draft.iviXmlHash = hash(xml);
    draft.status = report.passed ? "ivi_generated" : "validation_failed";
    db.drafts.push(draft);

    audit(db, "word.convert_to_ivi", "draft", draft.id, {
      vin: draft.vin,
      fileName: body.fileName || "upload.docx",
      xmlHash: draft.iviXmlHash,
      validation: report.summary,
    });
    await writeDb(db);
    return json(res, 200, {
      vehicle: savedVehicle,
      draft: publicDraft(draft),
      report,
      extracted,
      xml,
      xmlHash: draft.iviXmlHash,
      xmlPath: relativePath,
    });
  }

  if (req.method === "POST" && pathname === "/api/convert/excel-to-ivi") {
    const body = await readBody(req);
    const { vehicle, extracted } = await convertXlsxToVehicle(body);
    if (!vehicle.vin) return json(res, 422, { error: "VIN was not found in the Excel file", extracted });

    const existingIndex = db.vehicles.findIndex((item) => item.vin === vehicle.vin);
    const savedVehicle =
      existingIndex >= 0
        ? { ...db.vehicles[existingIndex], ...vehicle, updatedAt: now() }
        : vehicle;
    if (existingIndex >= 0) db.vehicles[existingIndex] = savedVehicle;
    else db.vehicles.push(savedVehicle);

    const draft = makeDraft(savedVehicle);
    const report = validateDraft(draft);
    const xml = generatePrototypeIviXml(draft);
    const relativePath = await saveEvidence(draft.id, "ivi20-from-excel.xml", xml);
    draft.validationReport = report;
    draft.iviXmlPath = relativePath;
    draft.iviXmlHash = hash(xml);
    draft.status = report.passed ? "ivi_generated" : "validation_failed";
    db.drafts.push(draft);

    audit(db, "excel.convert_to_ivi", "draft", draft.id, {
      vin: draft.vin,
      fileName: body.fileName || "upload.xlsx",
      xmlHash: draft.iviXmlHash,
      validation: report.summary,
    });
    await writeDb(db);
    return json(res, 200, {
      vehicle: savedVehicle,
      draft: publicDraft(draft),
      report,
      extracted,
      xml,
      xmlHash: draft.iviXmlHash,
      xmlPath: relativePath,
    });
  }

  if (req.method === "GET" && pathname === "/api/vehicles") {
    return json(res, 200, { vehicles: db.vehicles });
  }

  if (req.method === "POST" && pathname === "/api/vehicles/import") {
    const body = await readBody(req);
    const rows = parseCsv(body.csv || body.raw || "");
    const imported = [];
    const errors = [];
    for (const [index, row] of rows.entries()) {
      const vehicle = normalizeVehicle(row);
      if (!vehicle.vin) {
        errors.push({ row: index + 2, message: "VIN is required" });
        continue;
      }
      const existingIndex = db.vehicles.findIndex((item) => item.vin === vehicle.vin);
      if (existingIndex >= 0) {
        db.vehicles[existingIndex] = { ...db.vehicles[existingIndex], ...vehicle, updatedAt: now() };
        imported.push(db.vehicles[existingIndex]);
      } else {
        db.vehicles.push(vehicle);
        imported.push(vehicle);
      }
    }
    audit(db, "vehicles.import", "vehicle", "batch", { imported: imported.length, errors: errors.length });
    await writeDb(db);
    return json(res, 200, { imported: imported.length, errors, vehicles: imported });
  }

  if (req.method === "POST" && pathname === "/api/drafts") {
    const body = await readBody(req);
    const requestedIds = Array.isArray(body.vehicleIds) ? body.vehicleIds : [];
    const vehicles = requestedIds.length ? db.vehicles.filter((v) => requestedIds.includes(v.id)) : db.vehicles;
    const created = [];
    for (const vehicle of vehicles) {
      const existing = db.drafts.find((draft) => draft.vehicleId === vehicle.id && draft.status !== "archived");
      if (existing) continue;
      const draft = makeDraft(vehicle);
      db.drafts.push(draft);
      created.push(publicDraft(draft));
      audit(db, "draft.create", "draft", draft.id, { vin: draft.vin });
    }
    await writeDb(db);
    return json(res, 201, { created });
  }

  if (req.method === "GET" && pathname === "/api/drafts") {
    return json(res, 200, { drafts: db.drafts.map(publicDraft) });
  }

  if (req.method === "GET" && pathname === "/api/submissions") {
    return json(res, 200, { submissions: db.submissions });
  }

  if (route.draftMatch) {
    const draftId = route.draftMatch[1];
    const action = route.draftMatch[2] || "";
    const draft = db.drafts.find((item) => item.id === draftId);
    if (!draft) return json(res, 404, { error: "Draft not found" });

    if (req.method === "GET" && !action) {
      return json(res, 200, { draft });
    }

    if (req.method === "POST" && action === "validate") {
      const report = validateDraft(draft);
      draft.validationReport = report;
      draft.status = report.passed ? "validated" : "validation_failed";
      draft.updatedAt = now();
      await saveEvidence(draft.id, "validation-report.json", JSON.stringify(report, null, 2));
      audit(db, "draft.validate", "draft", draft.id, { passed: report.passed, summary: report.summary });
      await writeDb(db);
      return json(res, 200, { draft: publicDraft(draft), report });
    }

    if (req.method === "POST" && action === "generate-ivi") {
      if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(draft.iviReferenceId || "")) {
        draft.iviReferenceId = crypto.randomUUID();
      }
      const xml = generatePrototypeIviXml(draft);
      const relativePath = await saveEvidence(draft.id, "ivi20-prototype.xml", xml);
      draft.iviXmlPath = relativePath;
      draft.iviXmlHash = hash(xml);
      draft.status = "ivi_generated";
      draft.updatedAt = now();
      audit(db, "draft.generate_ivi", "draft", draft.id, { xmlHash: draft.iviXmlHash });
      await writeDb(db);
      return json(res, 200, { draft: publicDraft(draft), xmlPath: relativePath, xmlHash: draft.iviXmlHash });
    }

    if (req.method === "GET" && action === "xml") {
      if (!draft.iviXmlPath) return json(res, 404, { error: "IVI XML has not been generated" });
      return text(res, 200, await getEvidenceFile(draft.iviXmlPath), "application/xml; charset=utf-8");
    }

    if (req.method === "GET" && action === "validation-report") {
      if (!draft.validationReport) return json(res, 404, { error: "Validation has not been run" });
      return json(res, 200, draft.validationReport);
    }

    if (req.method === "POST" && action === "sign") {
      await readBody(req);
      const apiKey = resolveSigningApiKey(db, draft);
      const result = await signDraft(db, draft, apiKey);
      await writeDb(db);
      return json(res, result.status === "blocked" ? 409 : 200, { ...result, draft: publicDraft(result.draft), apiKey: publicApiKey(apiKey), routing: routingDecision(db, draft) });
    }

    if (req.method === "GET" && action === "signed-xml") {
      if (!draft.signedXmlPath) return json(res, 404, { error: "Signed XML has not been generated" });
      return text(res, 200, await getEvidenceFile(draft.signedXmlPath), "application/xml; charset=utf-8");
    }

    if (req.method === "POST" && action === "upload-rdw") {
      await readBody(req);
      const apiKey = resolveUploadApiKey(db, draft);
      const result = await uploadDraft(db, draft, apiKey);
      await writeDb(db);
      return json(res, result.status === "accepted" ? 200 : 409, { ...result, draft: publicDraft(result.draft), apiKey: publicApiKey(apiKey), routing: routingDecision(db, draft) });
    }

    if (req.method === "POST" && action === "mock-submit") {
      const body = await readBody(req);
      const nap = String(body.nap || "RDW").toUpperCase();
      if (!["RDW", "KBA"].includes(nap)) return json(res, 400, { error: "NAP must be RDW or KBA" });
      if (!draft.iviXmlPath) return json(res, 409, { error: "Generate IVI XML before mock submission" });
      if (draft.validationReport && !draft.validationReport.passed) {
        return json(res, 409, { error: "Validation errors must be resolved before mock submission", report: draft.validationReport });
      }
      const idempotencyKey = hash(`${draft.vin}|${draft.iviReferenceId}|${draft.iviVersionNumber}`);
      const acceptedDuplicate = db.submissions.find((item) => item.idempotencyKey === idempotencyKey && item.status === "accepted");
      if (acceptedDuplicate) {
        return json(res, 409, { error: "Duplicate effective submission blocked", existing: acceptedDuplicate });
      }
      const submission = {
        id: id("sub"),
        draftId: draft.id,
        vin: draft.vin,
        nap,
        mode: "mock",
        status: "accepted",
        messageId: `MSG-${crypto.randomBytes(7).toString("hex").toUpperCase()}`,
        idempotencyKey,
        unsigned: true,
        receipt: {
          code: "MOCK_ACCEPTED_UNSIGNED",
          message: "Mock NAP accepted the unsigned prototype package. Production submission remains blocked until signing is integrated.",
        },
        createdAt: now(),
      };
      db.submissions.unshift(submission);
      draft.napStatus = "mock_accepted";
      draft.updatedAt = now();
      audit(db, "draft.mock_submit", "draft", draft.id, { nap, submissionId: submission.id });
      await writeDb(db);
      return json(res, 200, { submission, draft: publicDraft(draft) });
    }
  }

  return json(res, 404, { error: "Not found" });
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = path.resolve(WEB_DIR, `.${safePath}`);
  if (!fullPath.startsWith(WEB_DIR)) return text(res, 403, "Forbidden");
  try {
    const body = await fs.readFile(fullPath);
    const ext = path.extname(fullPath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(body);
  } catch {
    text(res, 404, "Not found");
  }
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname);
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error.message || "Internal server error" });
  }
}

ensureStore()
  .then(() => {
    http.createServer(handle).listen(PORT, () => {
      console.log(`eCoC unsigned MVP running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
