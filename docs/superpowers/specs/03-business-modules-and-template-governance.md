# 业务模块与模板治理

## 稿件类型

支持人工勾选优先，AI 自动识别作为辅助。

建议固定类型：

- `clinical_study`
- `review`
- `systematic_review`
- `meta_analysis`
- `case_report`
- `guideline_interpretation`
- `expert_consensus`
- `diagnostic_study`
- `basic_research`
- `nursing_study`
- `methodology_paper`
- `brief_report`
- `other`

## 模板治理

采用混合模式：

- `TemplateFamily`：按稿件类型组织
- `ModuleTemplate`：在模板族下分别维护 `screening`、`editing`、`proofreading`

## 模板核心能力

- 后台创建草稿模板
- 编辑模板规则、prompt、checklist、知识绑定
- 版本管理
- 只有 `admin` 可发布
- 已发布模板不可原地覆盖

## 模块规则

`screening`

- 输出最终审稿报告
- 核心关注研究设计、伦理、统计、结构完整性

`editing`

- 输出最终编加稿
- 核心关注结构成稿、术语统一、栏目规范

`proofreading`

- 先输出草稿
- 人工确认后生成最终问题清单与最终批注版

## 模板与模块关系

- 每种稿件类型可有 3 套模块模板
- 新增稿件类型优先新增模板族，而不是改现有逻辑
