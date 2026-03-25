# 医学稿件处理系统最终交接总入口

**Date:** 2026-03-25  
**Status:** Final handoff brief  
**Purpose:** 给新项目 AI 的总入口，先统一理解、边界和优先级，再进入 spec 和 implementation plan。

---

## 1. 先读什么

新项目 AI 的阅读优先顺序固定为：

1. `docs/handoff/final-handoff-brief.md`
2. `docs/handoff/master-blueprint.md`
3. `docs/handoff/learning-mvp-design.md`
4. `docs/handoff/learning-mvp-plan.md`
5. `docs/handoff/rebuild-plan.md`
6. `docs/handoff/new-project-init-pack.md`

如果多份文档冲突：

- 学习闭环、PDF 范围、自我优化边界，以 `learning-mvp-design.md` 为准
- 详细实体、API、页面、阶段顺序，以 `master-blueprint.md` 和 `rebuild-plan.md` 为准

---

## 2. 系统一句话定义

这是一个：

`面向医学稿件处理的 AI 工作平台`

不是医学百科，不是通用问答产品，也不是放任 AI 黑盒自进化的系统。

---

## 3. 当前生效的 MVP

当前正式方向是：

`保守型学习闭环 MVP`

它由三部分组成：

- 四大业务模块
- reviewer-gated 学习层
- 受限 PDF 一致性核对能力

四大模块固定为：

- `screening` 审稿 / 筛稿
- `editing` 编加 / 编辑
- `proofreading` 校对
- `knowledge` 医学知识库

---

## 4. 绝不能变的硬边界

- V1 正式主文件格式是 `doc`、`docx`
- `doc` 必须统一转换成 `docx` 后再处理
- 校对模块不直接改正文，只输出结构化问题清单和 Word 批注
- 知识库必须先审核，只有 `approved` 知识项允许进入生产 AI 调用
- 所有高风险医学问题默认保守，无法稳定判断时统一输出“需人工复核”
- 所有 AI 结论必须带证据引用和置信度
- 所有关键动作都写入审计日志
- 不允许通过上传案例直接微调模型
- 不允许静默重训练
- 不允许未审核学习成果直接影响生产输出

---

## 5. “AI 学习”在本项目里是什么意思

学习输入可以来自：

- 原稿
- AI 输出
- 人工定稿
- 人工复核结果
- 审核动作
- 审计日志中的高价值差异

学习候选至少包括：

- `rule_candidate`
- `case_pattern_candidate`
- `template_update_candidate`
- `prompt_optimization_candidate`

学习候选状态至少包括：

- `draft`
- `pending_review`
- `approved`
- `rejected`
- `archived`

V1 中“AI 变聪明”只允许表现为：

- 更稳地调用已批准知识
- 更稳地匹配已批准案例模式
- 更稳地选择模板
- 更稳地使用已批准 prompt 和检查清单

不包括隐藏模型更新、静默重训练和生产自修改。

---

## 6. PDF 能力边界

V1 只支持一个 PDF 子能力：

`目录 - 正文 heading 一致性核对`

只做：

- 目录 heading 是否在正文中存在
- heading 层级是否一致
- 编号是否一致
- 顺序是否一致
- 页码是否明显不一致
- 是否缺失、重复或跳序

不做：

- 通用 PDF 全文校对
- 语言质量审校
- 版式视觉 QA
- 书签与链接修复

---

## 7. 三类工具的固定分工

- `superpowers`：需求澄清、方案设计、计划拆分、最终验收
- `subagent`：只在 plan 已批准后做任务拆分与执行
- `gstack`：页面流程验证、设计复核、QA、浏览器自动化检查

统一原则：

- 不让 `gstack` 替代总方案设计
- 不让 `subagent` 擅自改需求
- 不让任何工具绕过审核流

---

## 8. 当前环境基线

新项目 AI 可以默认当前机器具备这些环境：

- LibreOffice 路径：`C:\Program Files\LibreOffice\program\soffice.exe`
- Python venv：`C:\Users\Min\.venvs\medical-manuscript-py311\Scripts\python.exe`
- Python 版本：`3.11.9`
- 本地浏览器包：`C:\Users\Min\Downloads\AI Tools\chrome-win64.zip`
- gstack 目录：`C:\Users\Min\gstack-codex`

当前已验证运行过的关键服务包括：

- Postgres `5432`
- Redis `6379`
- MinIO `9000/9001`
- GROBID `8070`
- ONLYOFFICE `8088`
- Label Studio `8081`

---

## 9. 新项目 AI 的第一阶段目标

第一阶段只做骨架和主线：

1. monorepo 骨架
2. `web / api / worker-py`
3. `contracts / config / prompts / ui`
4. `manuscripts / files / jobs`
5. 基础数据库 schema

然后再接：

- knowledge / templates
- screening / editing / proofreading
- PDF 一致性核对
- learning layer

---

## 10. 对新 AI 的固定要求

新 AI 启动后必须先输出：

1. 结构化系统理解
2. 冲突与缺口
3. spec 文档拆分方案
4. implementation plan
5. 学习候选审核流落地方案
6. PDF 目录 - 正文一致性核对落地方案

在人工明确允许前，不得直接进入实现。
