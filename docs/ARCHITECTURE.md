# eCoC 基线架构

更新时间：2026-07-23

本文只描述当前公开代码仓中的系统实现，不包含商务申请路径、内部论证材料或本地运行数据。

## 1. 系统定位

本项目是制造商侧 eCoC / IVI2 工作台原型，用于验证以下链路：

1. 批量导入 CoC 文件或车辆数据。
2. 抽取 VIN、Approval Number、Type、Variant、Version 等字段。
3. 生成 IVI2 XML 草稿。
4. 按车型设定中的 COC 校验范本比对上传 CoC。
5. 通过单一 Safehomo InfoCert 连接，按制造商和车型范围选择证书并生成 XAdES/XMLDSig。
6. 按车型设定或 Approval Number e-code 选择上传 API。
7. 保存提交历史，支持检索和追溯。

当前 InfoCert STAGE 签章适配包含真实请求契约与 XAdES/XMLDSig 处理，凭据齐备时才会调用外部服务；本地测试可显式启用 mock。RDW、KBA、VCA 上传连接器仍为本地 mock。

## 2. 页面模块

页面由 `web/index.html`、`web/styles.css`、`web/app.js` 组成，入口为 `http://localhost:4173/`。

主要模块：

- 看板：显示车辆、草稿、校验、签章、上传数量。
- CoC 草稿批量上传：支持 Word、Excel、IVI XML、CSV，用于导入并创建草稿。
- 上传列表：以表格展示车辆草稿，支持勾选和批量处理。
- 校验区：点击校验后显示被选车辆的问题表格。
- 签章证书与车型设定：维护厂家证书档案、证书适用范围、Type、Approval Number、上传 API 和 CoC 校验范本。
- 提交历史：显示 NAP 上传结果，并支持关键词检索。

## 3. 后端模块

后端入口为 `src/server.js`，使用 Node.js 原生 HTTP 服务实现。

核心职责：

- 静态页面服务。
- 文件上传与字段抽取。
- 草稿数据管理。
- IVI2 XML 草稿生成。
- 基于车型 COC 校验范本的比对校验。
- eCoC / 电子 CoC 结构化数据完整性提示。
- 车型设定保存与匹配。
- InfoCert STAGE OAuth、证书查询和 HashSign 调用。
- XAdES/XMLDSig 组装与返回签章值本地验签。
- 单一平台连接下的多厂家证书档案和严格路由。
- RDW/KBA/VCA mock 上传。
- 提交历史和审计记录。

`src/workbench-store.js` 在存储 seam 后提供 PostgreSQL 与 JSON 两个适配。日常本地开发和客户部署默认使用 PostgreSQL；JSON 适配仅用于快速测试和旧数据兼容。证据文件写入 `data/evidence/`，该目录已在 `.gitignore` 中排除。

## 4. 数据和配置

公开仓库包含：

- 源代码：`src/`、`web/`、`scripts/`
- 当前使用说明：`README.md`、`docs/USER_MANUAL.md`
- 当前架构说明：`docs/ARCHITECTURE.md`
- 官方样本和资料缓存：`ecoc_eucaris_download/`
- 公开参考资料：`references/`
- 环境变量模板：`.env.example`
- PostgreSQL schema：`db/postgres/`
- 本地 PostgreSQL Compose：`compose.yaml`

公开仓库不包含：

- PostgreSQL 数据卷和本地证据文件
- 真实 API Key、证书、私钥或密码
- 下载的 NAP 工具包二进制文件
- 内部商务、申请路径、托管模式或项目论证文档

## 5. 签章和上传边界

签章实现边界：

1. 系统生成待签 IVI2 XML。
2. 后端按制造商精确匹配证书，并用车型、WVTA、市场范围进一步收窄；多个候选会阻断。
3. 系统以 Safehomo 的单一 InfoCert OAuth 客户端获取访问令牌，再用厂家证书的 `X-signer-id`、Certificate ID、PIN 和 SAT 调用 HashSign。
4. 系统把返回签章值合入 XAdES/XMLDSig，并用返回证书在本地验签。
5. 系统保存 request ID、correlation ID、证书档案 ID 和签章证据。

平台 client secret、证书 ID、PIN、SAT 和 PEM 路径只从环境变量读取。设置接口只保存环境变量名的前缀，不保存或返回密钥值。

上传目标流程：

1. 系统确认草稿已基于车型 COC 校验范本完成校验。
2. 系统确认存在签章后的 XML 包。
3. 系统根据车型设定或 Approval Number e-code 选择 RDW、KBA 或 VCA；`e11/g11/n11` 走 GB/VCA，EU 27 个成员国 e-code 走 EU 路径。
4. 系统上传签章 XML 包。
5. 系统保存 Message ID、状态和回执。

当前 NAP 代码只实现 mock 回执，不能代表真实 NAP 已接受。

## 6. eCoC 数据提示

车型设定区上传的 COC 校验范本会按 eCoC / 电子 CoC 的结构化数据与交换要求做完整性提示。当前依据是 Regulation (EU) 2018/858 Article 37、Commission Implementing Regulation (EU) 2021/133，以及 Commission Implementing Regulation (EU) 2024/1061 对安全交换和只读访问的补充。系统把当前可抽取字段映射到 IVI2 XML 路径，并输出缺失项提示。

该提示只用于帮助维护车型对照文件，不参与车辆草稿阻断逻辑。车辆草稿校验仍只基于上传 CoC 与车型 COC 校验范本的比对结果。

## 7. eCoC 法规边界

当前法规边界按以下层级理解：

- Regulation (EU) 2018/858 Article 36：纸面 CoC 的签发义务、完整填写、防伪和纸面 CoC 实施法授权。
- Regulation (EU) 2018/858 Article 37：电子 CoC / structured data 的义务和访问机制；Article 37(8) 授权 Commission 另行制定电子格式、结构、交换方式和安全要求。
- Commission Implementing Regulation (EU) 2021/133：电子 CoC 的 basic format、structure 和 means of exchange。
- Commission Implementing Regulation (EU) 2024/1061：电子 CoC secure exchange、read-only access，并修订 2021/133。

因此，本系统以 eCoC / 电子 CoC 的数据和交换要求为准；2020/683 的纸面 CoC 模板不作为当前系统校验基准。

## 8. 验证

语法检查：

```bash
node --check src/server.js
node --check web/app.js
node --check scripts/smoke-test.js
```

Smoke test：

```bash
npm test
```
