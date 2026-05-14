# 无签名版 eCoC 系统 MVP

更新时间：2026-04-30

## 1. 目标

本 MVP 用于在 RDW/KBA onboarding 和签名/签章方案完成前，先跑通除数字签名以外的制造商侧核心链路：

```text
VIN/车辆数据导入
  -> eCoC 草稿
  -> 内部字段校验
  -> IVI 2.0 prototype XML 生成
  -> 校验报告和 XML 证据归档
  -> RDW/KBA mock NAP 提交
  -> 幂等和防重复提交
```

## 2. 明确边界

- 当前生成的是 `IVI 2.0 prototype XML`，用于字段映射、流程验证和 NAP 技术讨论。
- 当前没有官方 IVI 2.0 XSD、Message Book、ICM，因此不能用于生产提交。
- 当前不做数字签名/签章，也不会伪造签名。
- Mock NAP 只验证系统流程和幂等控制，不代表 RDW/KBA 已接受。

## 3. 运行方式

```bash
npm start
```

打开：

```text
http://localhost:4173
```

运行 smoke test：

```bash
npm run smoke
```

## 4. 当前功能

| 功能 | 状态 |
| --- | --- |
| CSV 导入 VIN/车辆数据 | 已实现 |
| 为车辆创建 eCoC 草稿 | 已实现 |
| 内部业务规则校验 | 已实现 |
| 官方 XSD 校验 | 预留，待官方 XSD |
| ICM 校验 | 预留，待官方 ICM |
| IVI XML 生成 | 已实现 prototype |
| 签名/签章 | 暂不实现 |
| RDW/KBA mock 提交 | 已实现 |
| 防重复有效提交 | 已实现 |
| 证据归档 | 已实现，存于 `data/evidence/` |

## 5. 后续接入点

- 将 `generatePrototypeIviXml` 替换为基于官方 IVI 2.0 XSD/Message Book 的 XML generator。
- 增加 official XSD validator。
- 增加 ICM adapter。
- 增加 Signature Orchestrator，但私钥仍应在 manufacturer/EU representative 控制的 HSM/KMS/eIDAS seal provider 内。
- 将 mock RDW/KBA connector 替换为真实 NAP connector。

