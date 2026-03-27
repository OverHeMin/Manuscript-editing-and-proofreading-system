# 集成、功能开关与可扩展性

## 控制面固定分工

`superpowers`

- 需求、spec、plan、验收标准

`gstack`

- 工具调研、页面 QA、流程验证、上线巡检

`subagent`

- plan 批准后的受边界执行

补充原则：

- `superpowers / gstack / subagent` 继续作为固定分工，不新增同级总控角色
- 这三类能力进入系统后，应产品化为管理员专用治理层，而不是开放给业务角色直接使用

## 运行面功能服务

- `Temporal / Queue Orchestrator`
- `ONLYOFFICE / Document Interaction Layer`
- `Label Studio / Human Review Bench`
- `Presidio / Privacy Gate`
- `OCR Stack`
- `Evaluation Workbench`
- `Observability / Incident Desk`
- `Release Guard`

## 管理员专用 Agent Tooling Admin

建议预留后台中的管理员专用入口，统一承载：

- `Agent Runtime Registry`
- `Prompt / Skill Registry`
- `Sandbox Profile`
- `Evaluation Suite`
- `Release Check Profile`

固定边界：

- 只对 `admin` 与维护者开放
- 这里的“维护者”指部署与代码维护身份，不新增应用内业务角色
- 不对 `screener`、`editor`、`proofreader`、`knowledge_reviewer` 暴露完整控制台
- 业务角色只消费已包装完成的正式业务功能

## 建议预留的 Skill / Tool 类别

除文档主链路外，建议在架构层一并预留以下能力位：

- 文档与 OCR：`python-docx`、`LibreOffice`、`OCRmyPDF`、`PaddleOCR`、`GROBID`
- 医学领域：稿件类型判断、知识导入、模板绑定、风险守卫
- QA 与浏览器验证：浏览器自动化、视觉回归、流程 smoke
- 评测与发布：模型对比、Prompt/Skill 回归、benchmark、canary
- 安全与治理：依赖审计、密钥检查、权限沙箱、高风险操作防护
- 运维与恢复：发布校验、迁移检查、备份恢复、故障复盘

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

## 外部 Agent 工具与可迁移能力

- 外部 Agent 项目只允许以“系统级能力”方式接入
- 不依赖个人电脑的本地 Skill 目录、Prompt 目录或 CLI 安装状态
- 统一通过 `Agent Runtime Adapter`、`Tool / MCP Gateway`、`Prompt / Skill Registry` 接入
- 生产链路只允许调用已审核、已发布、可回滚的 Prompt / Skill / Tool 能力
- `superpowers / gstack / subagent / skills` 也应通过系统资产化方式落地，而不是依赖当前协作环境本身
- 详细设计见 `11-agent-runtime-and-portable-skills.md`
