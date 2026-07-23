# eCoC / IVI2 Workbench

本项目是制造商侧 eCoC（Electronic Certificate of Conformity）/ IVI2 工作台原型，用于批量导入 CoC 文件、生成 IVI2 XML 草稿、基于车型 COC 校验范本比对 CoC 内容、编排 InfoCert XAdES 签章和 RDW/KBA/VCA 上传流程。

## 当前交付

- [系统架构说明](docs/ARCHITECTURE.md)：当前公开代码仓的模块、数据边界、签章/上传接口边界和验证方式。
- [工作台使用说明](docs/USER_MANUAL.md)：CoC 草稿批量上传、上传列表、校验区、车型设定、签章、上传和提交历史检索流程。
- [代码与发布审计](docs/AUDIT.md)：本次公开发布前的代码、文档、敏感信息、公开文件清单和测试审计结果。
- [官方样本与资料缓存](ecoc_eucaris_download/README.md)：用于本地开发和校验的样本 XML、PDF、XSD、Message Book 和相关手册缓存。

## 核心边界

- 制造商侧系统不假设能直接访问 EUCARIS。EUCARIS 官方说明其是主管机关之间的交换机制，私营主体通常需通过国家联系人、主管机关或 NAP 路径接入。
- IVI/eCoC 的 XSD、Message Book、WSDL、示例报文、证书和测试环境参数必须以目标 NAP、主管机关、EUCARIS/EREG 正式资料为准。
- CoC 校验只基于车型设定中上传的 COC 校验范本进行；未上传或未匹配范本时无法完成校验，不加入额外后台判定。
- 车型 COC 校验范本上传时会按 eCoC / 电子 CoC 数据与交换要求做结构化数据完整性提示；提示不阻塞流程。
- 当前代码包含 InfoCert STAGE OAuth、证书查询、HashSign、XAdES/XMLDSig 组装和本地验签适配；真实调用仅在服务器完整配置平台连接和厂家证书环境变量后启用。RDW/KBA/VCA 上传仍为本地 mock connector。
- 真实 API Key、证书、私钥、本地数据库和证据文件不进入公开仓库。`data/`、`.env` 已在 `.gitignore` 中排除。

## 本地运行

```bash
npm start
```

浏览器访问 `http://localhost:4173`。

## 测试

```bash
npm test
```

## 支持的输入

- Word `.docx`
- Excel `.xlsx`
- IVI XML `.xml`
- CSV `.csv`

## 批量签章与上传

工作台支持一个上传入口批量处理 `.docx`、`.xlsx`、`.xml` 和 `.csv` 文件，生成 IVI2 草稿后可批量校验、批量签章并批量上传 NAP。

批量校验会按 Type + Approval Number 匹配车型设定，并使用该设定上传的 COC 校验范本作为唯一校验依据。

签章目标流程：Safehomo 使用一条 InfoCert 平台连接；系统按 CoC 制造商和车型/WVTA/市场范围选择该制造商或正式代表持有的证书，生成待签 XML 的 digest，并通过 InfoCert HashSign 取得签章值后组装 XAdES/XMLDSig。多张候选证书会阻断并要求明确绑定，系统不会猜测。

上传目标流程：系统把签章后的 XML 包上传到 RDW/KBA/VCA，并保存 Message ID、状态和回执。

签章证书通过车型设定表绑定或按制造商唯一匹配；证书 ID、PIN、SAT 和 PEM 路径只以环境变量引用保存。上传仍由车型设定或 Approval Number e-code 路由：`e11/g11/n11` 走 GB/VCA，EU 27 个成员国 e-code 走 EU 路径。当前 NAP 适配器为本地 mock 回执。

## 公开仓库内容

本仓库只发布代码、当前系统文档、官方样本/资料缓存和环境变量模板。内部讨论文档、本地运行数据、真实密钥和下载工具包不发布。
