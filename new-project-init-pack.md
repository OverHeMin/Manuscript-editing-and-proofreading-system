# 医学稿件处理系统新项目初始化指令包

**Date:** 2026-03-25  
**Purpose:** 新项目建立后，交给 AI 的初始化说明。

---

## 1. 使用方式

建议顺序：

1. 新建空项目目录
2. 把 `docs/handoff/` 放进新项目
3. 开启新 AI 会话
4. 先发主提示词
5. 让 AI 先输出系统理解、spec 拆分和 implementation plan
6. 确认后再允许实现

---

## 2. 启动前提

新项目 AI 默认应认为以下环境已准备：

- `git`
- `node`
- `pnpm`
- `bun`
- `python`
- `docker`
- `LibreOffice`
- `PostgreSQL`
- `Redis`
- `MinIO`
- `gstack`
- `superpowers`
- `subagent`
- `PaddleOCR`
- `OCRmyPDF`
- `GROBID`

优先检查：

- `pnpm --version`
- `python --version`
- `docker ps`
- LibreOffice 路径
- Playwright / gstack 浏览器是否可启动
- OCR / PDF 服务链路是否可用

---

## 3. 推荐目录结构

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

## 4. AI 协作规则

- `superpowers`：需求澄清、方案设计、计划拆分、最终验收
- `subagent`：plan 已批准后的任务拆分与执行
- `gstack`：页面流程验证、设计复核、QA

禁止：

- 未写 spec 就直接实现
- 未写 implementation plan 就大规模搭建
- 用 `subagent` 擅自扩需求
- 用 `gstack` 取代主方案设计

---

## 5. 主提示词

```md
我要重新建立一个新的“医学稿件处理系统”项目。

请严格按以下顺序工作，不要跳步骤：

1. 先阅读 `docs/handoff/final-handoff-brief.md`
2. 再阅读 `docs/handoff/master-blueprint.md`、`docs/handoff/learning-mvp-design.md`、`docs/handoff/learning-mvp-plan.md`
3. 先输出你对系统的结构化理解
4. 再输出 spec 文档拆分方案
5. 再输出 implementation plan
6. 等 spec 和 plan 确认后，再开始实现

你必须遵守这些硬约束：

- 这是“面向医学稿件处理的 AI 工作平台”，不是医学百科
- 四大模块固定为：审稿/筛稿、编加/编辑、校对、医学知识库
- V1 只正式支持 doc/docx，doc 必须统一转换为 docx 再处理
- 校对模块不直接改正文，只输出结构化问题清单和 Word 批注
- V1 限定支持 1 个 PDF 子能力：`目录 - 正文 heading 一致性核对`
- 知识库必须先审核，只有 approved 知识项允许进入 AI 下游调用
- 所有高风险医学问题默认保守，无法稳定判断时统一输出“需人工复核”
- 所有 AI 结论必须带证据引用和置信度
- 所有关键动作都要写入审计日志
- 学习层是跨模块统一能力
- 候选项至少包括：`rule_candidate`、`case_pattern_candidate`、`template_update_candidate`、`prompt_optimization_candidate`
- 不允许上传案例后直接微调模型
- 不允许未审核学习成果直接影响生产输出

技术栈优先使用：

- React + Vite + Ant Design
- NestJS
- FastAPI
- PostgreSQL
- pgvector
- Redis
- MinIO 或其他 S3 兼容对象存储
- LibreOffice + python-docx
```

---

## 6. 第二条提示词

```md
当前请不要写代码。

请先完成这五件事：

1. 用 1 份简洁结构化摘要说明你理解的系统范围
2. 给出你建议的 spec 文档目录树
3. 给出按阶段推进的 implementation plan
4. 列出第一个里程碑的任务清单
5. 单独标出你准备如何实现“学习候选审核流”和“PDF 目录 - 正文一致性核对”
```

---

## 7. 一句话策略

`先让 AI 固定系统理解、spec 和 plan，再让它实现。`
