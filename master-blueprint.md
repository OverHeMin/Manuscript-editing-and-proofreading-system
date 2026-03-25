# 医学稿件处理系统总蓝图

**Date:** 2026-03-25  
**Status:** Consolidated master blueprint  
**Audience:** 人类负责人、主 AI、执行型 AI、评审型 AI

---

## 1. 项目定位

建设一套面向医学稿件处理的私有化系统，核心覆盖四个模块：

1. 审稿 / 筛稿
2. 编加 / 编辑
3. 校对
4. 医学知识库

系统定位不是医学百科，而是：

`面向医学稿件处理的 AI 工作平台`

---

## 2. 固定设计原则

- 知识库优先
- 证据可追溯
- 高风险问题保守输出
- 所有 AI 结论支持人工复核
- 审稿、编加、校对职责边界清晰
- 原稿与派生稿分离存储
- 模板和知识项可审核、可版本化
- 只有 `approved` 知识项可进入业务 AI 调用
- 学习成果必须先进入候选审核流
- 所有关键行为写入审计日志

---

## 3. V1 范围

### 3.1 必做

- 响应式 Web
- 支持手机浏览器和桌面浏览器
- `doc` / `docx` 上传
- `doc -> docx` 标准化转换
- 四大模块基础闭环
- 稿件类型识别
- 模板管理
- 知识库审核流
- 审稿结论输出
- 编加 `docx` 输出
- 校对 Word 批注输出
- 学习闭环基础版
- PDF `目录 - 正文 heading 一致性核对`
- 审计日志
- 基础权限控制

### 3.2 非目标

- 不做独立桌面客户端主线交付
- 不做通用 PDF 全文校对
- 不做黑盒自学习
- 不做上传案例后直接微调模型
- 不做未审核学习成果直接上线
- 不做 AI 对高风险医学问题直接拍板

### 3.3 V2 再做

- 通用 PDF 校对
- 更复杂规则引擎
- 学习稳定度评分与跨案例聚类
- 多 agent 分工执行链
- Electron 桌面客户端
- 商业数据库接口接入

---

## 4. 文件与访问策略

### 4.1 文件格式

- 正式支持：`doc`、`docx`
- 受限支持：`pdf`，仅用于目录 - 正文 heading 一致性核对

### 4.2 文件处理规则

- `doc` 必须先转为 `docx`
- 原始文件永不覆盖
- 所有结果作为派生资产保存

建议资产类型：

- `original`
- `normalized_docx`
- `edited_docx`
- `proofread_docx`
- `ai_report`
- `pdf_consistency_report`

---

## 5. 技术栈与仓库结构

### 5.1 技术栈

- 前端：`React + Vite + Ant Design`
- 后端：`NestJS`
- AI / 文档 Worker：`FastAPI`
- 数据库：`PostgreSQL`
- 向量检索：`pgvector`
- 队列：`Redis`
- 文件存储：`MinIO` 或 S3 兼容对象存储
- 文档工具：`LibreOffice`、`python-docx`
- OCR / PDF：`PaddleOCR`、`OCRmyPDF`、`GROBID`

### 5.2 推荐结构

```text
pnpm monorepo
├─ apps/
│  ├─ web
│  ├─ api
│  └─ worker-py
├─ packages/
│  ├─ contracts
│  ├─ config
│  ├─ prompts
│  └─ ui
└─ docs/
```

---

## 6. 角色与权限

固定角色：

- `admin`
- `screener`
- `editor`
- `proofreader`
- `knowledge_reviewer`
- `user`

权限原则：

- 普通用户可上传稿件、提交知识草稿
- 只有知识审核员可审批知识入库
- 只有已发布模板可被业务模块调用
- 上传、删除、下载、AI 输出、模板发布、知识审核都必须审计

---

## 7. 统一 AI 调用流程

所有业务模块统一走以下链路：

1. 文档结构解析
2. 稿件类型识别
3. 模板加载
4. 医学知识库检索
5. 外部中文权威公开源补检
6. 规则引擎判定
7. 大模型整合
8. 生成可解释输出

核心原则：

- 优先内部知识库
- 外部来源只做补检
- 高风险问题无法稳定判断时转人工复核
- 输出必须带证据引用和置信度

---

## 8. 稿件类型

固定识别：

- `clinical_study`
- `review`
- `meta_analysis`
- `case_report`
- `guideline_interpretation`
- `other`

---

## 9. 医学知识库

### 9.1 目标

- 为审稿、编加、校对提供稳定知识来源
- 分离固定规则与外部临时补充信息
- 按稿件类型、章节、风险标签精准路由
- 保证知识入库前必须审核

### 9.2 知识来源

- 手工录入
- 批量导入参考资料
- 从高价值案例生成待审核草稿
- 每日自动抓取公开中文医学权威来源后进入审核区

### 9.3 路由顺序

1. `approved`
2. `module_scope`
3. `manuscript_type`
4. `knowledge_kind`
5. `sections`
6. `risk_tags`
7. `tags`
8. `query`

### 9.4 模板关系

- 模板由知识库统一管理
- 先按稿件类型绑定
- 再按标签增强绑定
- V1 只做按稿件类型模板

---

## 10. 审稿模块

输出固定为：

- `accept`
- `revise`
- `reject`
- `manual_review`

核心关注维度：

- 实用价值
- 创新性
- 数据完整性
- 研究设计合理性
- 伦理合规
- 统计表达是否成立
- 结论是否被证据支持
- 模板要求章节是否齐全

强制人工复核条件包括：

- 命中知识项 `allowAutoDecision = false`
- 知识动作冲突
- 置信度低于阈值
- 只有外部补检证据且问题属于高风险
- 医学或统计问题无法稳定判断

---

## 11. 编加模块

编加模块不是普通润色，而是：

`按模板规则成稿`

重点处理维度：

- 标题规范
- 摘要结构化
- 引言逻辑
- 方法完整性
- 结果展示顺序
- 表格题名与单位统一
- 讨论与结论边界
- 栏目命名统一
- 术语统一
- 参考文献格式统一

编加知识调用优先级默认：

1. `template_constraint`
2. `rule`
3. `case_pattern`
4. `fact`

---

## 12. 校对模块

校对模块只做：

- 发现问题
- 输出结构化问题清单
- 写入 Word 批注
- 输出校对报告

不直接修改正文。

检查维度至少包括：

- 稿件结构
- 语言文字
- 医学术语
- 单位与数值
- 统计学表达
- 表格与图表
- 医学逻辑
- 研究设计
- 前后一致性
- 伦理与合规
- 证据优先级
- 不确定性控制

---

## 13. 学习层

### 13.1 定位

学习层是跨 `screening / editing / proofreading / knowledge` 的统一能力。

它不直接训练模型，而是做：

`human-feedback-to-knowledge conversion`

### 13.2 学习输入

- 原稿
- AI 输出
- 人工定稿
- 人工复核结果
- 审核动作
- 审计日志中的高价值差异

### 13.3 学习候选

- `rule_candidate`
- `case_pattern_candidate`
- `template_update_candidate`
- `prompt_optimization_candidate`

### 13.4 固定规则

- 所有候选默认进入 `draft` 或 `pending_review`
- 未审核候选不得参与生产决策
- 审核通过后才可回写知识、模板或 prompt 资产
- 不通过案例自动学习新的医学事实结论
- 不通过案例直接改写高风险医学或统计判断

---

## 14. PDF 目录 - 正文一致性核对

### 14.1 定位

这是校对模块中的受限 PDF 子能力，不是独立第五模块。

### 14.2 V1 核对范围

- 目录 heading 是否在正文中存在
- 层级是否一致
- 编号是否一致
- 顺序是否一致
- 页码是否明显不一致
- 是否缺失、重复或跳序

### 14.3 输出

- 结构化问题清单
- 问题严重级别
- 目录 / 正文 heading 片段
- 建议
- 理由

建议问题类型：

- `toc_missing_in_body`
- `body_missing_in_toc`
- `toc_level_mismatch`
- `toc_numbering_mismatch`
- `toc_order_mismatch`
- `toc_page_mismatch`
- `needs_manual_review`

---

## 15. 核心实体

至少需要这些核心实体：

- `Manuscript`
- `DocumentAsset`
- `KnowledgeItem`
- `TemplateDefinition`
- `ScreeningJob`
- `EditingJob`
- `ProofIssue`
- `ReviewedCaseSnapshot`
- `LearningCandidate`
- `PdfConsistencyJob`
- `PdfConsistencyIssue`
- `EvidenceReference`

---

## 16. API 分组

统一分组建议：

- `/auth`
- `/manuscripts`
- `/screening`
- `/editing`
- `/proofreading`
- `/learning`
- `/knowledge`
- `/templates`
- `/search`
- `/audit`
- `/jobs`

关键接口方向：

- `POST /manuscripts/upload`
- `POST /screening/review/:manuscriptId`
- `POST /editing/compose/:manuscriptId`
- `POST /proofreading/review/:manuscriptId`
- `POST /proofreading/pdf-consistency/:manuscriptId`
- `POST /learning/case-snapshots`
- `POST /learning/runs`
- `GET /learning/candidates`
- `POST /learning/candidates/:id/approve`
- `POST /knowledge/:id/review`

---

## 17. 前端页面

- 登录页
- 工作台
- 审稿页
- 编加页
- 校对页
- 学习候选页
- 学习审核页
- 医学知识库页

工作台至少显示：

- 四大模块入口
- 待办数量
- 最近任务
- AI 连接状态
- 知识审核待办

---

## 18. 审计要求

以下行为必须记录：

- 登录
- 上传稿件
- 删除稿件
- 下载稿件
- 审稿执行
- 编加执行
- 校对执行
- 学习案例快照生成
- 学习候选提炼
- 学习候选审批 / 驳回 / 归档
- PDF 一致性核对执行
- 知识提交
- 知识审批
- 模板创建
- 模板发布 / 归档
- AI 输出结果生成

---

## 19. 新项目重建顺序

### Phase 1

- monorepo 骨架
- web / api / worker-py
- contracts / config / prompts / ui
- 基础 schema

### Phase 2

- manuscripts / files / jobs 主线
- `doc -> docx`
- 文档解析
- 类型识别

### Phase 3

- knowledge / templates

### Phase 4

- screening
- editing
- proofreading
- PDF 一致性核对

### Phase 5

- learning layer
- 候选审核流
- 已批准资产回写

### Phase 6

- 规则引擎
- 审计
- 测试与内测
