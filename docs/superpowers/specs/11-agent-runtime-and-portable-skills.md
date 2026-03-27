# Agent 能力平台、外部工具集成与跨平台可迁移设计

## 目标

本章节定义：

- 如何把外部 Agent 工具或 Skill 思路纳入医学稿件处理系统后续架构
- 如何把当前协作中已证明有效的 `superpowers`、`gstack`、`subagent`、`skills` 思路转化为系统内能力层
- 如何避免系统依赖某一台电脑上的本地 Skill 目录、个人 CLI 环境或临时脚本
- 如何把“Agent 能力”沉淀为可部署、可迁移、可审计、可回滚的系统级能力

本章节服务于 Phase 2 及后续阶段，不要求 V1 foundation 立即实现全部能力，但要求从 Phase 2 开始预留正确接口与治理边界。

## 非目标

本章节明确不做：

- 不把 `~/.codex/skills`、`~/.claude`、个人 Prompt 目录作为生产依赖
- 不让外部 Agent 框架直接连接生产数据库并拥有自由写权限
- 不让“自我改进”绕过人工审核直接进入知识库、模板或生产路由
- 不把实验型研究 Agent 直接并入审稿、编加、校对主链路
- 不把 Agent Tooling 控制台直接开放给 `screener`、`editor`、`proofreader`、`knowledge_reviewer` 等业务角色

## 外部项目评估结论

### 可作为系统内能力参考的项目

`langchain-ai/deepagents`

- 适合借鉴为 `Agent Runtime` 的执行层与计划分解层
- 可借鉴点：planning、sub-agent 分解、工具调用、工作目录隔离、运行时编排
- 不建议直接裸接生产路径

`xerrors/Yuxi`

- 适合借鉴为知识库工作台、文档工作台和 Agent 运营后台
- 可借鉴点：文档上传解析、RAG、知识图谱、MCP、FastAPI + Vue + Docker 化部署
- 更适合借鉴后台结构与运营流程，不建议整仓直接嵌入主系统

`peterskoett/self-improving-agent`

- 适合借鉴为学习治理层与经验沉淀机制
- 可借鉴点：学习记录、错误归档、反馈回写、Hook 机制、经验文件结构
- 应转化为系统内“候选学习项 -> 审核 -> 发布”闭环

### 适合转化为系统资产的项目

`msitarzewski/agency-agents`

- 适合借鉴角色卡、Prompt 包、Skill 包的组织方式
- 不建议作为新的总控角色体系直接引入
- 应转化为系统内可版本化的 `AgentProfile` 与 `SkillPackage`

### 仅适合离线实验的项目

`karpathy/autoresearch`

- 适合借鉴离线实验与自动研究闭环
- 不适合接入生产稿件主链路
- 可作为未来“Prompt / 模型 / 模板”评测实验室的参考

## 系统级集成原则

未来系统不依赖“某台电脑装过哪些 Agent 工具”，而依赖以下系统能力：

### 1. Agent Runtime Adapter

统一抽象不同 Agent 框架，形成内部运行时接口。

建议支持：

- `DeepAgentsRuntime`
- `LangGraphRuntime`
- `InternalPromptRuntime`
- 未来可扩展其他运行时适配器

统一接口至少包括：

- 运行时名称
- 版本
- 可用工具列表
- 可用 Skill 包列表
- 运行时权限级别
- 沙盒模式
- 调用入口
- 审计字段

### 2. Tool / MCP Gateway

所有 Agent 调用系统能力时，必须走统一网关，而不是直接绕过业务层访问底层资源。

建议纳入统一网关的能力：

- 稿件读取
- 资产读取
- 知识检索
- 模板读取
- Prompt/Skill 读取
- 审计写入
- 学习候选提交
- 任务状态查询
- 模型路由查询

这样未来无论换电脑、换平台、换 Agent 框架，都只需要复用同一套网关接口。

### 3. Prompt / Skill Registry

把 Prompt、Skill、角色卡从个人电脑目录迁入系统级注册表。

建议新增系统资产：

- `agent_profiles`
- `skill_packages`
- `prompt_templates`
- `runtime_bindings`
- `tool_permissions`

每个 Skill 包至少应记录：

- 名称
- 描述
- 版本
- 适用模块
- 适用稿件类型
- 适用角色
- 依赖工具
- 审核状态
- 发布状态
- 回滚目标版本

### 4. Learning Governance Pipeline

把“AI 自主学习”限制为受治理的候选回写流程。

统一链路应为：

`运行结果 -> 人工修正 -> 候选学习项 -> 审核 -> 发布到知识/模板/Prompt`

候选类型建议包括：

- `rule_candidate`
- `case_pattern_candidate`
- `template_update_candidate`
- `prompt_optimization_candidate`
- `skill_update_candidate`

### 5. Offline Research Lab

实验型 Agent 或自动研究框架不直接进入生产路径，而进入离线实验层。

建议将以下对象限定在实验室：

- `autoresearch` 类自动研究能力
- 新 Prompt 评测
- 新模型对比
- 新模板 A/B 测试
- 新 Skill 包回归实验

实验层输出只能形成：

- 评测报告
- 对照数据
- 候选建议

不得直接改写生产知识、模板、模型路由。

## 系统内能力映射

除了吸收外部 GitHub 项目的思路，系统还应把当前协作中最有价值的能力产品化为后台治理层，而不是继续依赖某个助手环境本身。

### 1. `superpowers` -> 方案与治理层

应沉淀为后台中的 `Design Governance Center`，负责：

- 需求澄清记录
- spec / plan 资产管理
- 决策日志
- 验收标准
- 模板评测集维护
- 发布前治理检查

它的职责是“定义怎么做、何时能上线”，而不是直接代替业务模块执行。

### 2. `gstack` -> 验证与发布保障层

应沉淀为 `Verification Ops Center`，负责：

- 浏览器流程 QA
- 视觉回归检查
- smoke test
- benchmark 基线对比
- canary 上线巡检
- 发布证据归档

它的职责是“验证结果是否可靠”，而不是替代模板治理或直接修改生产数据。

### 3. `subagent` -> 受控执行编排层

应沉淀为 `Bounded Execution Orchestrator`，负责：

- 已批准 plan 下的任务拆分
- 受边界约束的子任务执行
- 批量数据整理
- 评测任务执行
- 离线实验任务编排

它的职责是“在批准边界内执行”，不负责改需求、不负责改验收口径。

### 4. `skills` -> 可版本化能力包

应沉淀为系统级 `Skill Registry`，每个 Skill 包都应可审计、可发布、可回滚。

建议按以下类别组织：

- `document_pipeline_skills`
- `medical_domain_skills`
- `knowledge_ingest_skills`
- `template_and_prompt_skills`
- `qa_and_browser_skills`
- `evaluation_and_canary_skills`
- `security_and_compliance_skills`
- `debug_and_incident_skills`
- `release_and_migration_skills`

这些 Skill 包属于“功能能力”，不是新的同级决策角色。

### 5. 建议一并纳入的高价值能力

除前述外，建议在系统设计阶段就预留以下能力位：

- `Evaluation Workbench`：模板评测、模型对比、Prompt/Skill 回归
- `Observability & Incident Desk`：日志、指标、告警、故障复盘
- `Sandbox Policy Manager`：高风险工具和写操作权限控制
- `Release Guard`：发布前检查、回滚预案、证据归档
- `Backup & Recovery Assistant`：备份校验、恢复演练、迁移校验
- `Security Review Pack`：依赖审计、密钥检查、权限风险扫描
- `Medical Knowledge Ops`：知识导入、审核、绑定、去重与失效治理

这些能力都更适合作为后台治理与运维能力，而不是作为日常业务用户入口。

## 角色暴露边界

本方案固定如下边界：

- V1 到后续增强阶段，`Agent Tooling Admin` 默认只对 `admin` 与受信任维护者开放
- 这里的“维护者”指部署、代码维护、运维侧身份，不新增应用内业务角色
- `screener`、`editor`、`proofreader`、`knowledge_reviewer`、普通业务用户不直接接触 Runtime、Skill Registry、实验台、沙盒策略与发布控制台
- 业务角色只使用已经包装完成的审稿、编加、校对、知识审核等正式功能
- 如果后续确实需要下放局部能力，也应开放“受限入口”，而不是把完整 Agent 控制台交给业务角色

## 跨电脑与跨平台可迁移要求

### 1. 运行依赖必须容器化

建议将外部 Agent 相关运行单元以容器或独立服务部署：

- `agent-runtime`
- `mcp-gateway`
- `knowledge-workbench`
- `evaluation-lab`
- `learning-review-worker`

### 2. 配置必须声明式管理

不得依赖手工配置的本地目录。

必须可配置化的内容包括：

- Agent Runtime 地址
- MCP Gateway 地址
- Skill Registry 存储位置
- Prompt Registry 存储位置
- 沙盒策略
- 默认模型与可选模型
- 外部工具白名单

### 3. 资产必须可导出导入

以下对象必须支持导出与导入：

- Agent Profile
- Skill Package
- Prompt Template
- Runtime Binding
- Tool Permission Policy

### 4. 平台切换不改变业务接口

当系统从本地电脑迁移到新服务器、云主机或新电脑时，业务模块仍只依赖：

- `Module Contract`
- `AI Contract`
- `Tool/MCP Gateway`
- `Prompt / Skill Registry`

而不是依赖某个具体 CLI 或某个用户目录。

## 与现有固定分工的关系

现有固定分工保持不变：

- `superpowers` 负责需求、spec、plan、验收标准
- `gstack` 负责调研、评审、视觉与流程验证
- `subagent` 负责 plan 批准后的边界内执行

外部 Agent 项目不替代上述总控分工，只作为系统运行层或治理层的能力来源。

结论：

- `agency-agents` 不应成为新的总控角色体系
- `deepagents` 不应替代 `superpowers / gstack / subagent`
- `Yuxi` 不应替代主系统后台
- 它们只能作为可控的系统内能力或设计参考
- `superpowers / gstack / subagent / skills` 应被产品化为管理员专用能力层，而不是继续依赖外部协作环境

## Phase 2 纳入范围

Phase 2 建议正式纳入以下内容：

- `Agent Runtime Registry` 最小骨架
- `Tool / MCP Gateway` 最小骨架
- `Prompt / Skill Registry` 最小骨架
- `Agent Tooling Admin` 后台配置页预留
- `Sandbox Profile` 最小骨架
- `Evaluation Suite` 最小骨架
- `Knowledge Workbench` 与 Agent 层的接口预留

Phase 2 不要求完成：

- 多 Runtime 全量接入
- 自主学习自动发布
- 自动研究实验室正式上线

## Phase 3+ 递进路线

### Phase 3

- 知识库工作台增强
- Prompt / Skill Registry 与模板治理打通
- 知识调用日志与命中评估
- Skill 分类与发布治理
- 评测集与运行记录沉淀

### Phase 4

- 审稿 / 编加 / 校对模块接入统一 Agent Runtime
- 模块级 Agent Profile
- 模块级 Tool 权限策略
- admin 专用验证台接入浏览器 QA、基线对比与发布验证

### Phase 5

- Learning Governance 与 Skill/Prompt 回写闭环
- 候选学习项回写 Prompt、模板、规则
- Knowledge Ops 与 Skill Registry 联动治理

### Phase 6

- Offline Research Lab
- Runtime A/B 评测
- 新模型、新 Skill、新 Prompt 的实验审核闭环
- 可观测性、故障复盘与安全审计能力成熟化

## 数据模型建议

建议未来新增以下实体：

- `AgentRuntime`
- `AgentProfile`
- `SkillPackage`
- `PromptAsset`
- `RuntimeBinding`
- `ToolPermissionPolicy`
- `AgentExecutionLog`
- `SkillUpdateCandidate`
- `ExperimentRun`
- `SandboxProfile`
- `EvaluationSuite`
- `EvaluationRun`
- `ReleaseCheckProfile`

## 审计与安全要求

所有 Agent 运行必须可审计：

- 谁发起的
- 是否有批准记录
- 使用了哪个 Runtime
- 使用了哪个模型
- 使用了哪些工具
- 读取了哪些知识项
- 命中了哪个模板版本
- 生成了哪些候选学习项
- 是否涉及人工确认
- 运行时使用了哪个沙盒策略
- 输出了哪些验证证据

所有生产态 Agent 必须满足：

- 默认只读优先
- 最小权限
- 明确工具白名单
- 高风险动作二次确认
- 变更可回滚

## 最终结论

未来系统可以并且应该吸收外部 Agent 工具或 Skill 的优势，但必须以“平台化集成”的方式实现：

- 依赖系统级 Runtime，而不是个人电脑 Skill 目录
- 依赖统一 Gateway，而不是直接访问底层资源
- 依赖 Registry，而不是散落 Prompt 文件
- 依赖 Learning Governance，而不是黑箱自我改进
- 依赖管理员专用的治理与验证能力层，而不是把复杂 Agent 能力直接暴露给业务用户

这套设计的目标不是“把某个 GitHub 项目装进系统”，而是把这些项目的可用思想沉淀为你自己的长期可维护能力层。
