# Code and Release Audit

更新时间：2026-05-15

本文记录公开仓库发布前的全量审计结果。审计范围包括代码、页面、说明书、公开文件清单、敏感信息和自动化验证。

## 1. 审计范围

已检查：

- `src/server.js`
- `web/index.html`
- `web/styles.css`
- `web/app.js`
- `scripts/smoke-test.js`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/USER_MANUAL.md`
- `.env.example`
- `.gitignore`
- 公开样本与资料缓存索引

未纳入公开发布：

- `data/`
- `.env`
- 真实 API Key、证书、私钥或密码
- 下载的 NAP 工具包二进制文件
- 内部商务、申请路径、托管模式或项目论证文档

## 2. 修正项

本轮审计已修正：

- 上传区标题统一为“CoC 草稿批量上传”。
- 使用说明改名为 `docs/USER_MANUAL.md`，避免公开文档以旧编号开头。
- 说明书、README 和架构说明中的文档链接已同步。
- 上传主体拼写统一为 `KBA`，并把 mock API id 改为 `upload-kba`。
- 后端启动日志从旧的 unsigned MVP 文案改为当前 Workbench 文案。
- NAP 上传阻断错误从 RDW 专属文案改为通用 NAP 文案。
- smoke test 增加 `upload-kba` API 配置断言。
- 型式批准机构改为由 Approval Number e-code 后台推断，不再作为 CoC 必填错误。
- 补齐 EU 27 个成员国 e-code 到上传路径的基础映射，并将 `e11/g11/n11` 作为 GB/VCA 路径。
- CoC 校验改为只基于车型设定中的 COC 校验范本；未上传或未匹配范本时显示无法校验，不加入额外后台判定。
- 车型 COC 校验范本上传时增加 eCoC / 电子 CoC 结构化数据完整性提示，提示不阻塞流程。

## 3. 安全和敏感信息

检查结果：

- 未发现真实 API Key、GitHub token、OpenAI key、私钥块或常见云密钥模式。
- `.env.example` 只包含变量名，不包含真实密钥。
- `.gitignore` 排除了 `.env`、`.env.*`、`data/`、`node_modules/`、日志、构建产物和下载工具包。
- 前端只显示脱敏 keyRef；真实生产密钥应由后端环境变量读取。

## 4. 公开文件清单

公开仓库保留：

- 代码：`src/`、`web/`、`scripts/`
- 当前系统说明：`README.md`、`docs/ARCHITECTURE.md`、`docs/USER_MANUAL.md`、`docs/AUDIT.md`
- 环境变量模板：`.env.example`
- 官方样本和资料缓存：`ecoc_eucaris_download/`
- 公开参考资料：`references/`

公开仓库排除：

- 本地数据库和证据：`data/`
- 旧编号内部文档：`docs/01-*.md` 到 `docs/10-*.md`
- NAP 工具包：`ecoc_eucaris_download/tools/`

## 5. 验证命令

已执行并通过：

```bash
node --check src/server.js
node --check web/app.js
node --check scripts/smoke-test.js
npm run smoke
```

已执行并通过：

- Markdown 本地链接检查。
- Git tracked files 范围检查。
- 敏感信息模式扫描。
- KBA/KAB 拼写一致性检查。

## 6. 剩余边界

当前仓库仍是本地原型：

- InfoCert STAGE 签章已实现公开请求契约、HashSign、XAdES/XMLDSig 组装和本地验签；真实凭据与证书不在仓库中。
- RDW/KBA/VCA 上传为 mock。
- 生产环境还需要完成 InfoCert 账号与证书准入、NAP mTLS、错误码映射和密钥生命周期管理。
- eCoC 数据提示目前覆盖当前可抽取并可映射到 IVI2 XML 的字段；完整逐项数据集、交换协议和正式规则引擎仍需继续扩展。
