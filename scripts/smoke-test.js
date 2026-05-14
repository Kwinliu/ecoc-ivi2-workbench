const assert = require("assert");
const fs = require("fs/promises");
const { execFile, spawn } = require("child_process");
const os = require("os");
const path = require("path");

const PORT = 4183;
const base = `http://localhost:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function execFilePromise(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  return { response, data };
}

function wordParagraph(label, value) {
  return `<w:p><w:r><w:t>${label}: ${value}</w:t></w:r></w:p>`;
}

async function createSampleDocx() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ivi-word-smoke-"));
  const wordDir = path.join(dir, "word");
  await fs.mkdir(wordDir, { recursive: true });
  const rows = [
    ["VIN", "WVWZZZ1JZXW000001"],
    ["Manufacturer name", "Demo OEM Ltd."],
    ["Manufacturer country", "CN"],
    ["Manufacturer address", "1 Demo Road"],
    ["Manufacturer place", "Shanghai"],
    ["WVTA", "e1*2018/858*00001*00"],
    ["Approval authority", "KBA"],
    ["Vehicle category", "M1"],
    ["Make", "Demo"],
    ["Commercial name", "DemoCar"],
    ["Type", "T1"],
    ["Variant", "V1"],
    ["Version", "001"],
    ["Production date", "2026-04-01"],
    ["Type approval issue date", "2026-03-01"],
    ["Intended country registration", "DE"],
    ["Signer name", "Jane Certifier"],
    ["Signer position", "Technical Director"],
    ["Signature location", "Shanghai"],
    ["Signature date", "2026-04-01"],
  ];
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${rows.map(([label, value]) => wordParagraph(label, value)).join("\n")}
</w:body></w:document>`;
  await fs.writeFile(path.join(wordDir, "document.xml"), documentXml);
  const docxPath = path.join(dir, "sample.docx");
  await execFilePromise("zip", ["-qr", docxPath, "word/document.xml"], { cwd: dir });
  const base64 = await fs.readFile(docxPath, "base64");
  return { dir, base64 };
}

function cell(ref, value, shared) {
  let index = shared.indexOf(value);
  if (index < 0) {
    index = shared.length;
    shared.push(value);
  }
  return `<c r="${ref}" t="s"><v>${index}</v></c>`;
}

async function createSampleXlsx() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ivi-excel-smoke-"));
  const xlDir = path.join(dir, "xl");
  await fs.mkdir(path.join(xlDir, "worksheets"), { recursive: true });
  await fs.mkdir(path.join(xlDir, "_rels"), { recursive: true });
  await fs.mkdir(path.join(dir, "_rels"), { recursive: true });
  const shared = [];
  const rows = [
    ["VIN", "WVWZZZ1JZXW000002"],
    ["Manufacturer name", "Demo OEM Ltd."],
    ["Manufacturer country", "CN"],
    ["Manufacturer address", "1 Demo Road"],
    ["Manufacturer place", "Shanghai"],
    ["WVTA", "e1*2018/858*00001*00"],
    ["Approval authority", "KBA"],
    ["Vehicle category", "M1"],
    ["Make", "Demo"],
    ["Type", "T1"],
    ["Variant", "V1"],
    ["Version", "001"],
    ["Production date", "2026-04-01"],
    ["Type approval issue date", "2026-03-01"],
  ];
  const sheetRows = rows
    .map((row, rowIndex) => {
      const r = rowIndex + 1;
      return `<row r="${r}">${cell(`A${r}`, row[0], shared)}${cell(`B${r}`, row[1], shared)}</row>`;
    })
    .join("");
  const sharedXml = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared
    .map((value) => `<si><t>${value}</t></si>`)
    .join("")}</sst>`;
  const sheetXml = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  await fs.writeFile(path.join(dir, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`);
  await fs.writeFile(path.join(dir, "_rels/.rels"), `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  await fs.writeFile(path.join(xlDir, "workbook.xml"), `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  await fs.writeFile(path.join(xlDir, "_rels/workbook.xml.rels"), `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  await fs.writeFile(path.join(xlDir, "sharedStrings.xml"), sharedXml);
  await fs.writeFile(path.join(xlDir, "worksheets/sheet1.xml"), sheetXml);
  const xlsxPath = path.join(dir, "sample.xlsx");
  await execFilePromise("zip", ["-qr", xlsxPath, "[Content_Types].xml", "_rels", "xl"], { cwd: dir });
  const base64 = await fs.readFile(xlsxPath, "base64");
  return { dir, base64 };
}

async function main() {
  const server = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: path.join(os.tmpdir(), `ecoc-smoke-${Date.now()}`) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await wait(800);
    let result = await request("/api/health");
    assert.equal(result.response.status, 200);
    assert.equal(result.data.ok, true);

    const csv = [
      "vin,manufacturerName,manufacturerCountry,euRepresentativeName,euRepresentativeCountry,wvtaNumber,approvalAuthority,vehicleCategory,make,commercialName,type,variant,version,productionDate,intendedCountryRegistration,massRunningOrderKg,technicallyPermissibleMaximumLadenMassKg,lengthMm,widthMm,heightMm,axles,seats,fuelType,co2WLTP,emissionsClass,tyreFront,tyreRear",
      "WVWZZZ1JZXW000001,Demo OEM Ltd.,CN,Demo EU Rep GmbH,DE,e1*2018/858*00001*00,KBA,M1,Demo,DemoCar,T1,V1,001,2026-04-01,DE,1500,2100,4500,1800,1500,2,5,Petrol,120,Euro 6,205/55 R16,205/55 R16",
    ].join("\n");

    result = await request("/api/vehicles/import", { method: "POST", body: JSON.stringify({ csv }) });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.imported, 1);

    result = await request("/api/drafts", { method: "POST", body: JSON.stringify({}) });
    assert.equal(result.response.status, 201);
    assert.ok(result.data.created.length >= 1);
    const draftId = result.data.created[0].id;

    result = await request(`/api/drafts/${draftId}/validate`, { method: "POST", body: JSON.stringify({}) });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.report.passed, true);

    result = await request(`/api/drafts/${draftId}/generate-ivi`, { method: "POST", body: JSON.stringify({}) });
    assert.equal(result.response.status, 200);
    assert.ok(result.data.xmlHash);

    result = await request("/api/api-keys");
    assert.equal(result.response.status, 200);
    assert.ok(result.data.keys.some((item) => item.kind === "signing" && item.keyDisplay.includes("...")));
    assert.ok(result.data.keys.some((item) => item.id === "signing-eu-rep-1"));
    assert.ok(result.data.keys.some((item) => item.id === "upload-kba"));
    assert.ok(result.data.keys.some((item) => item.id === "upload-vca"));

    result = await request(`/api/drafts/${draftId}/sign`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.status, "signed");
    assert.ok(result.data.receipt.id.startsWith("DTRUST-"));
    assert.equal(result.data.apiKey.id, "signing-eu-rep-1");

    result = await request(`/api/drafts/${draftId}/upload-rdw`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.status, "accepted");
    assert.equal(result.data.apiKey.id, "upload-rdw");
    assert.ok(result.data.submission.messageId.startsWith("RDW-"));

    result = await request(`/api/drafts/${draftId}/mock-submit`, { method: "POST", body: JSON.stringify({ nap: "RDW" }) });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.submission.status, "accepted");

    const sampleDocx = await createSampleDocx();
    result = await request("/api/convert/word-to-ivi", {
      method: "POST",
      body: JSON.stringify({ fileName: "sample.docx", base64: sampleDocx.base64 }),
    });
    await fs.rm(sampleDocx.dir, { recursive: true, force: true });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.vehicle.vin, "WVWZZZ1JZXW000001");
    assert.ok(result.data.xml.includes("http://eu.ereg.initialvehicleinformation.v2"));
    assert.ok(result.data.xml.includes("<CocDataGroup>"));

    const sampleXlsx = await createSampleXlsx();
    result = await request("/api/convert/excel-to-ivi", {
      method: "POST",
      body: JSON.stringify({ fileName: "sample.xlsx", base64: sampleXlsx.base64 }),
    });
    await fs.rm(sampleXlsx.dir, { recursive: true, force: true });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.vehicle.vin, "WVWZZZ1JZXW000002");
    assert.ok(result.data.xml.includes("<VehicleIdentificationNumber>WVWZZZ1JZXW000002</VehicleIdentificationNumber>"));

    console.log("Smoke test passed");
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
