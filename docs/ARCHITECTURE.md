# eCoC / IVI2 Workbench Architecture

更新时间：2026-05-15

本文只描述当前公开代码仓中的系统实现，不包含商务申请路径、内部论证材料或本地运行数据。

## 1. 系统定位

本项目是制造商侧 eCoC / IVI2 工作台原型，用于验证以下链路：

1. 批量导入 CoC 文件或车辆数据。
2. 抽取 VIN、Approval Number、Type、Variant、Version 等字段。
3. 生成 IVI2 XML 草稿。
4. 按车型设定中的 COC 校验范本比对上传 CoC。
5. 按车型设定选择签章 API，并生成签章流程记录。
6. 按车型设定或 Approval Number e-code 选择上传 API。
7. 保存提交历史，支持检索和追溯。

当前 D-Trust、RDW、KBA、VCA 连接器为本地 mock。生产环境需要替换为真实 endpoint、API Key、证书、mTLS、XMLDSig 和错误码映射。

## 2. 页面模块

页面由 `web/index.html`、`web/styles.css`、`web/app.js` 组成，入口为 `http://localhost:4173/`。

主要模块：

- 看板：显示车辆、草稿、校验、签章、上传数量。
- CoC 草稿批量上传：支持 Word、Excel、IVI XML、CSV，用于导入并创建草稿。
- 上传列表：以表格展示车辆草稿，支持勾选和批量处理。
- 校验区：点击校验后显示被选车辆的问题表格。
- 车型设定区：维护 Type、Approval Number、签章 API、上传 API 和 CoC 校验范本。
- 提交历史：显示 NAP 上传结果，并支持关键词检索。

## 3. 后端模块

后端入口为 `src/server.js`，使用 Node.js 原生 HTTP 服务实现。

核心职责：

- 静态页面服务。
- 文件上传与字段抽取。
- 草稿数据管理。
- IVI2 XML 草稿生成。
- 基于车型 COC 校验范本的比对校验。
- 车型设定保存与匹配。
- D-Trust mock 签章。
- RDW/KBA/VCA mock 上传。
- 提交历史和审计记录。

本地运行数据写入 `data/`，该目录已在 `.gitignore` 中排除，不会进入公开仓库。

## 4. 数据和配置

公开仓库包含：

- 源代码：`src/`、`web/`、`scripts/`
- 当前使用说明：`README.md`、`docs/USER_MANUAL.md`
- 当前架构说明：`docs/ARCHITECTURE.md`
- 官方样本和资料缓存：`ecoc_eucaris_download/`
- 公开参考资料：`references/`
- 环境变量模板：`.env.example`

公开仓库不包含：

- 本地数据库和证据文件：`data/`
- 真实 API Key、证书、私钥或密码
- 下载的 NAP 工具包二进制文件
- 内部商务、申请路径、托管模式或项目论证文档

## 5. 签章和上传边界

签章目标流程：

1. 系统生成待签 IVI2 XML。
2. 系统对待签 XML 生成 hash / digest / signing payload。
3. 系统把签章请求发送给 D-Trust。
4. D-Trust 返回签章结果。
5. 系统把签章结果合入 IVI/eCoC XML 包。

上传目标流程：

1. 系统确认草稿已基于车型 COC 校验范本完成校验。
2. 系统确认存在签章后的 XML 包。
3. 系统根据车型设定或 Approval Number e-code 选择 RDW、KBA 或 VCA；`e11/g11/n11` 走 GB/VCA，EU 27 个成员国 e-code 走 EU 路径。
4. 系统上传签章 XML 包。
5. 系统保存 Message ID、状态和回执。

当前代码只实现 mock 回执，不能代表真实 NAP 已接受。

## 6. 验证

语法检查：

```bash
node --check src/server.js
node --check web/app.js
node --check scripts/smoke-test.js
```

Smoke test：

```bash
npm run smoke
```
