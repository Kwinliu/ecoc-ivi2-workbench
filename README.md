# eCoC / IVI2 Workbench

本项目是制造商侧 eCoC（Electronic Certificate of Conformity）/ IVI2 工作台原型，用于批量导入 CoC 文件、生成 IVI2 XML 草稿、校验 CoC 内容、编排 D-Trust 签章和 RDW/KBA/VCA 上传流程。

## 当前交付

- [系统架构说明](docs/ARCHITECTURE.md)：当前公开代码仓的模块、数据边界、签章/上传接口边界和验证方式。
- [工作台使用说明](docs/11-user-manual.md)：批量上传、上传列表、校验区、车型设定、签章、上传和提交历史检索流程。
- [官方样本与资料缓存](ecoc_eucaris_download/README.md)：用于本地开发和校验的样本 XML、PDF、XSD、Message Book 和相关手册缓存。

## 核心边界

- 制造商侧系统不假设能直接访问 EUCARIS。EUCARIS 官方说明其是主管机关之间的交换机制，私营主体通常需通过国家联系人、主管机关或 NAP 路径接入。
- IVI/eCoC 的 XSD、Message Book、WSDL、示例报文、证书和测试环境参数必须以目标 NAP、主管机关、EUCARIS/EREG 正式资料为准。
- 当前 D-Trust 签章、RDW/KBA/VCA 上传均为本地 mock connector。生产环境需要接入真实 endpoint、API Key、证书、mTLS、XMLDSig 和错误码映射。
- 真实 API Key、证书、私钥、本地数据库和证据文件不进入公开仓库。`data/`、`.env` 已在 `.gitignore` 中排除。

## 本地运行

```bash
npm start
```

浏览器访问 `http://localhost:4173`。

## 测试

```bash
npm run smoke
```

## 支持的输入

- Word `.docx`
- Excel `.xlsx`
- IVI XML `.xml`
- CSV `.csv`

## 批量签章与上传

工作台支持一个上传入口批量处理 `.docx`、`.xlsx`、`.xml` 和 `.csv` 文件，生成 IVI2 草稿后可批量校验、批量签章并批量上传 NAP。

签章目标流程：系统生成待签 XML 的 hash / 签章载荷并提交到 D-Trust 签章服务器，取得签章结果后生成签章 XML 包。

上传目标流程：系统把签章后的 XML 包上传到 RDW/KBA/VCA，并保存 Message ID、状态和回执。

签章和上传均通过车型设定表中的 API 选择驱动，页面只显示脱敏 Key 标识。当前适配器为本地 mock 回执。

## 公开仓库内容

本仓库只发布代码、当前系统文档、官方样本/资料缓存和环境变量模板。内部讨论文档、本地运行数据、真实密钥和下载工具包不发布。
