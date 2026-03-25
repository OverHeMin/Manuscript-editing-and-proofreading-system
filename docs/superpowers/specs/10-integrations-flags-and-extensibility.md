# 集成、功能开关与可扩展性

## 控制面固定分工

`superpowers`

- 需求、spec、plan、验收标准

`gstack`

- 工具调研、页面 QA、流程验证、上线巡检

`subagent`

- plan 批准后的受边界执行

## 运行面功能服务

- `Temporal / Queue Orchestrator`
- `ONLYOFFICE / Document Interaction Layer`
- `Label Studio / Human Review Bench`
- `Presidio / Privacy Gate`
- `OCR Stack`

## 模块化接口

预留统一合同：

- `Module Registry`
- `Job Contract`
- `Asset Contract`
- `Template Contract`
- `Audit Contract`
- `AI Contract`
- `Review Contract`

## API 版本化

- 采用 `/api/v1/...`
- 为 Web、小程序、导入工具和第三方集成提供统一 API
- 重大不兼容变更才进入 `v2`

## 功能开关与灰度

建议按环境、角色、模块、模板族设置开关。

典型对象：

- 新模型
- 新模板版本
- 新 OCR 方案
- 微信小程序入口
- 新知识检索策略

## 第三方依赖治理

每个依赖都应记录：

- 用途
- 所属模块
- 替代方案
- 不可用时降级策略
- 升级窗口
