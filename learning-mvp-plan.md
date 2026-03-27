# 医学稿件处理系统 Learning MVP 实施计划

**Date:** 2026-03-25  
**Status:** High-level implementation plan

---

## 1. 目标

在现有四模块产品框架上，新增：

- reviewer-gated 学习层
- PDF 目录 - 正文一致性核对
- tools / skills 驱动的周期复盘能力

---

## 2. 主要新增域

### 2.1 Learning

新增核心对象：

- `ReviewedCaseSnapshot`
- `LearningRun`
- `LearningCandidate`

### 2.2 PDF Consistency

新增核心对象：

- `PdfConsistencyJob`
- `PdfConsistencyIssue`

---

## 3. 实施阶段

### Task 1. 新增共享 contracts 与枚举

补充：

- `LearningCandidateType`
- `LearningCandidateStatus`
- `PdfConsistencyIssueType`

并补齐：

- `ReviewedCaseSnapshot`
- `LearningCandidate`
- `PdfConsistencyJob`
- `PdfConsistencyIssue`

### Task 2. 落 reviewed case snapshot

当审稿、编加、校对完成且已有人类确认结果后，沉淀：

- manuscript id
- module scope
- AI 输出引用
- 人工最终输出引用
- diff summary
- template used

### Task 3. 生成 learning candidates

Worker 支持从 snapshot 批量生成：

- `rule_candidate`
- `case_pattern_candidate`
- `template_update_candidate`
- `prompt_optimization_candidate`

所有候选默认进入 `draft` 或 `pending_review`。

### Task 4. 构建 PDF consistency pipeline

Worker 支持：

- TOC 提取
- body heading 提取
- 归一化匹配
- 生成 issue 列表

### Task 5. 构建 reviewer UI

至少包含：

- learning candidate list
- review actions
- candidate provenance
- merge / reject / archive

### Task 6. 回写 approved assets

审核通过后：

- 规则类回写 knowledge
- 模板类回写 templates
- prompt 类回写 prompts 配置

未批准内容永不进入生产调用链。

---

## 4. 建议 API

- `POST /learning/case-snapshots`
- `GET /learning/case-snapshots`
- `POST /learning/runs`
- `GET /learning/runs`
- `GET /learning/candidates`
- `GET /learning/candidates/:id`
- `POST /learning/candidates/:id/approve`
- `POST /learning/candidates/:id/reject`
- `POST /learning/candidates/:id/archive`
- `POST /proofreading/pdf-consistency/:manuscriptId`
- `GET /proofreading/pdf-consistency/jobs/:id`
- `GET /proofreading/pdf-consistency/jobs/:id/issues`

---

## 5. 验收标准

Learning MVP 至少要证明：

- 已完成人工复核案例可沉淀为 snapshot
- 可从 snapshot 生成 learning candidate
- candidate 必须经过 reviewer 批准
- 批准后才能回写知识 / 模板 / prompt
- PDF 可生成结构化一致性问题列表

---

## 6. 风险控制

- 高风险医学内容不允许通过学习层自动放行
- prompt 优化候选不允许直接覆盖线上配置
- PDF 结构混乱时必须转人工复核
- 无内部知识支撑时保持保守输出
