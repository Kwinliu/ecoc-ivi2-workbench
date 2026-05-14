# eCoC/EUCARIS 申报系统

本项目面向汽车制造商，建设制造商侧的 eCoC（Electronic Certificate of Conformity）申报与管控系统，用于生成、校验、签署、提交和追踪 IVI/eCoC 数据，并通过被授权的 National Access Point（NAP）接入后续 EUCARIS 交换链路。

## 当前交付

- [eCoC / IVI2 工作台使用说明](docs/11-user-manual.md)：面向操作人员的详细页面说明、批量上传、车型设定、校验、签章、上传和提交历史检索流程。
- [无签名版 eCoC 系统 MVP](docs/09-unsigned-mvp-system.md)：本地运行的导入、草稿、校验、IVI XML 生成、mock NAP 和证据归档系统。
- [IVI 2.0 公开资料检索结果](docs/10-ivi2-search-results.md)：已找到的公开资料、缺失的 XSD/Message Book/ICM，以及可先用于系统改造的字段线索。
- [官方样本与资料缓存](ecoc_eucaris_download/README.md)：用于本地开发和校验的样本 XML、PDF、XSD、Message Book 和相关手册缓存。

## 核心边界

- 制造商侧系统不假设能直接访问 EUCARIS。EUCARIS 官方说明其是主管机关之间的交换机制，私营主体通常需通过国家联系人、主管机关或 NAP 路径接入。
- IVI/eCoC 的 XSD、Message Book、WSDL、示例报文、证书和测试环境参数必须以目标 NAP、主管机关、EUCARIS/EREG 正式资料为准。
- 本项目先建立可审计、可版本化、可插拔的申报中台，避免把任何尚未确认的报文细节硬编码进业务流程。

## 推荐下一步

1. 确定目标市场、型式批准机关和首选 NAP。
2. 获取 IVI 2.0 相关 XSD、Message Book、Release Notes、WSDL/服务说明、测试环境证书和样例。
3. 选定技术栈；若制造商没有强约束，建议后端采用 Java/Kotlin + Spring Boot，数据库采用 PostgreSQL，对 XML Schema、SOAP/WSDL、XML Signature、mTLS/HSM 支持更成熟。
4. 按 [实施路线与验收](docs/02-roadmap-and-acceptance.md) 的 MVP 范围进入原型开发。

## 本地运行

```bash
npm start
```

浏览器访问 `http://localhost:4173`。

## Word 转 IVI2 XML

工作台首页已加入 `.docx` 上传转换入口。当前 MVP 会从 Word 表格和“字段: 值”段落中抽取 VIN、WVTA、制造商、车型、类别、质量、尺寸、签署人等字段，生成未签名的 IVI 2.0 XML 草稿，并保存校验报告与 XML 证据文件。

## Excel 转 IVI2 XML

工作台首页也支持 `.xlsx` 上传。当前 MVP 会解析第一个工作表，从 CoC 字段模板或“字段/值”表中抽取字段；如果 Excel 只包含 CoC 项目说明而没有 VIN、WVTA、制造商等必填数据，系统会显示已识别字段并阻止生成不可提交的 XML。

## 批量签章与上传

工作台支持一个上传入口批量处理 `.docx`、`.xlsx`、`.xml` 和 `.csv` 文件，生成 IVI2 草稿后可批量校验、批量签章并批量上传 NAP。生产目标流程是：系统生成待签 XML 的 hash / 签章载荷并提交到 D-Trust 签章服务器，取得签章结果后生成签章 XML 包，再上传到 RDW/KBA/VCA。签章和上传均通过车型设定表中的 API 选择驱动，页面只显示脱敏 Key 标识。当前 D-Trust、RDW、KBA、VCA 适配器为本地 mock 回执，生产接入时替换为真实 API endpoint、证书、mTLS 和错误码映射。

生产提交前仍需补齐真实 CoC 字段映射、ICM 检查、正式 XMLDSig/D-Trust 签章服务、RDW/KBA/VCA acceptance/production endpoint，以及环境变量形式的 API Key 和证书配置。
