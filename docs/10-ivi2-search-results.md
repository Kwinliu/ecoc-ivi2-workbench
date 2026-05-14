# IVI 2.0 公开资料检索结果

检索日期：2026-04-30

## 1. 结论

已经找到并下载了 EReg 公开发布的 IVI 2.0 说明性材料，但尚未找到可匿名直接下载的正式 `Initialvehicleinformation2.0.xsd` 文件。

当前可确认：

- IVI 2.0 是存在的，EReg ReadMe 明确列出 `Initialvehicleinformation2.0.xsd`。
- 公开可下载的材料包括 ReadMe、Guidelines、Change Overview。
- IVI 2.0 使用新的 namespace：`http://eu.era.initialvehicleinformation.v2`。
- IVI 2.0 不向后兼容 1.x。
- 2.0 只包含 CoC 数据，1.x 中的 national data group 和 technical data group 已移除。
- 2.0 的签名成为强制项，`sig:Signature` 不再是可选字段。
- 真实 XSD、Message Book、ICM 和官方样例仍需通过 EReg/eCOC/EUCARIS/RDW/KBA 资料渠道获取或由 NAP operator 提供。

## 2. 已下载到本地的公开材料

| 文件 | 本地路径 | 公开 URL |
| --- | --- | --- |
| IVI 2.0 ReadMe v1.1 | `references/ivi2-public/ivi-20-readme-v11.pdf` | https://www.ereg-association.eu/media/3127/ivi-20-readme-v11.pdf |
| IVI 2.0 Guidelines v1.1 | `references/ivi2-public/ivi-20-guidelines-v11.pdf` | https://www.ereg-association.eu/media/3130/ivi-20-guidelines-initial-vehicle-information-v11.pdf |
| IVI 2.0 Change Overview v1.1 | `references/ivi2-public/ivi-20-change-overview-v11.pdf` | https://www.ereg-association.eu/media/3129/ivi-20-change-overview-v11.pdf |
| IVI 1.11 XSD, only for comparison | `references/ivi1-public/version-111-initialvehicleinformation.xsd` | https://www.ereg-association.eu/media/3114/version-111-initialvehicleinformation-xsd-scheme.xsd |

同时已从 PDF 提取文本到同目录 `.txt`，便于检索和系统字段分析。

## 3. 仍缺的正式资料

| 资料 | 状态 | 获取路径 |
| --- | --- | --- |
| `Initialvehicleinformation2.0.xsd` | 文档确认存在，但未找到匿名下载 URL | 向 RDW/KBA/NAP operator 或 `eucaris2help@rdw.nl` 申请。 |
| IVI 2.0 Message Book | ReadMe 说明 2025-07-15 交付第一版，但公开搜索未确认可匿名下载 | 向 RDW/KBA/NAP operator 申请。 |
| IVI 2.0 ICM Checking Module | ReadMe 提到新 ICM 和 cloud solution，但未找到公开可用入口 | 向 RDW/KBA/NAP operator 申请。 |
| 官方成功/失败样例 XML | 未找到 | 向 RDW/KBA/NAP operator 申请。 |
| RDW/KBA WSDL/API/回执/错误码 | 未公开 | onboarding 后获取。 |

## 4. 可以先用于系统改造的 IVI 2.0 事实

### 4.1 Namespace

Change Overview v1.1 显示 IVI 2.0 XSD 使用：

```xml
targetNamespace="http://eu.era.initialvehicleinformation.v2"
```

系统中的 prototype XML 可以先把 namespace 改为该 namespace，并继续标注 `prototype-not-for-production`，但不能声称通过官方 XSD。

### 4.2 关键结构变化

ReadMe v1.1 的重点变化：

- IVI 2.0 只包含 CoC 数据。
- 数据组尽量按 EU regulations 组织。
- national data group 和 technical data group 已移除。
- 字段命名和布局按 EU regulations 调整。
- 字段定义、层级和枚举存在变化。
- IVI 2.0 不向后兼容 1.x。

### 4.3 强制字段线索

Change Overview v1.1 列出的全类别强制字段包括：

- `sig:Signature`
- `IviReferenceId`
- `IviVersionNumberXsd`
- `IviVersionNumber`
- `IviVersionDateTime`
- `TypeApprovalCountry`
- `VehicleIdentificationNumber`
- `TypeApprovalType`
- `StageOfCompletion`
- `Type`
- `Variant`
- `Version`
- `VehicleCategory`
- `TypeApprovalNumber`
- `TypeApprovalIssueDate`
- `SignerName`
- `SignerPosition`
- `SignatureLocation`
- `SignatureDate`
- `ManufacturerStageNumber`
- `ManufacturerName`

强制出现的 groups/tables 包括：

- `CocDataGroup`
- `SigningAuthorityTable`
- `MakeTable`
- `ManufacturerTable`
- `GeneralConstructionGroup`
- `MassGroup`
- `DimensionGroup`

注意：这些来自 Change Overview，不等同于完整 XSD 或完整 Message Book。

### 4.4 签名要求

Guidelines v1.1 明确：

- IVI 2.0 中 digital signature mandatory。
- 从 2026-07-05 起，所有 IVI files 至少需要 eIDAS compliant advanced seals certificates。
- eCoC 只能由 manufacturer 或 EU representative 签署。
- manufacturer 和 EU representative 都必须在 WVTA 中合规载明。

### 4.5 版本和纠错元数据

Guidelines v1.1 将以下元数据放入 Header：

- `IviReferenceId`
- `IviVersionNumberXsd`
- `IviVersionNumber`
- `IviVersionDateTime`
- `IntendedCountryRegistration`
- `DesignatedTypeApprovalCountry`

这对当前系统的数据模型非常有用，应马上替换现有 prototype 字段命名。

## 5. 不能做的事

- 不能用 IVI 1.11 XSD 冒充 IVI 2.0。
- 不能只凭 Change Overview 反推完整 XSD。
- 不能把当前 prototype XML 标记为 IVI 2.0 compliant。
- 不能跳过 ICM/Message Book，只做 XSD 校验。

## 6. 建议下一步

1. 立即向 RDW/KBA/EUCARIS 申请正式 `Initialvehicleinformation2.0.xsd`、Message Book、ICM 和样例。
2. 当前系统先根据公开材料做“字段名和 header 结构靠近 IVI 2.0”的 prototype。
3. 保留明显标识：`officialXsdLoaded=false`、`productionSubmissionAllowed=false`。
4. 拿到 XSD 后，第一优先级是把 XML generator 改成 schema-driven generator，并接入 XSD validation。

