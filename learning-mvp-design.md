# 医学稿件处理系统 Learning MVP 设计

**Date:** 2026-03-25  
**Status:** Confirmed MVP direction

---

## 1. MVP 重定义

这个 MVP 不再只是四模块编辑平台，而是：

`review-first editorial processing + human-feedback learning loop + limited PDF consistency checking`

---

## 2. 新增的三项核心能力

### 2.1 人工反馈学习

系统必须支持：

- 收集已完成人工复核的处理案例
- 比较 AI 输出与人工最终结果
- 从差异中提取可复用模式
- 生成待审核学习候选

这不是模型微调，而是：

`human-feedback-to-knowledge conversion`

### 2.2 受限 PDF 能力

系统必须支持：

- PDF 目录抽取
- 正文 heading 抽取
- 目录与正文的一致性核对

不做通用 PDF 全文校对。

### 2.3 tools / skills 辅助自我优化

系统必须支持：

- 周期性复盘已完成案例
- 自动生成学习候选
- 审核后再决定是否影响生产资产

tools / skills 只能帮助生成候选，不得绕过审核治理。

---

## 3. 学习层设计

### 3.1 学习来源

- 原稿
- AI 输出
- 人工定稿
- 人工复核结果
- 审核动作
- 审计日志
- 稿件类型
- 使用模板
- 问题类别

### 3.2 学习候选类型

- `rule_candidate`
- `case_pattern_candidate`
- `template_update_candidate`
- `prompt_optimization_candidate`

### 3.3 安全规则

所有学习成果必须先走审核流。

允许状态：

- `draft`
- `pending_review`
- `approved`
- `rejected`
- `archived`

未审核候选不得直接改变生产行为。

### 3.4 V1 里“越来越聪明”的含义

只允许表现为：

- 已批准知识检索更稳
- 案例模式匹配更稳
- 模板选择更稳
- prompt 与检查清单使用更稳

不允许：

- 静默重训练
- 隐藏微调
- 生产自修改

---

## 4. PDF 一致性核对设计

### 4.1 范围

只支持一个工作流：

`目录 - 正文 heading 一致性核对`

### 4.2 检查项

- TOC heading 是否在正文中存在
- heading 层级是否一致
- heading 编号是否一致
- 顺序是否一致
- 页码是否明显不一致
- 是否缺失、重复或跳序

### 4.3 输出

- 结构化问题清单
- 严重级别
- excerpt 或 heading 对
- 建议
- 理由

问题类型建议：

- `toc_missing_in_body`
- `body_missing_in_toc`
- `toc_level_mismatch`
- `toc_numbering_mismatch`
- `toc_order_mismatch`
- `toc_page_mismatch`
- `needs_manual_review`

### 4.4 非范围

- 通用 PDF 全文校对
- 版式级出版 QA
- 书签修复
- 链接校验

---

## 5. 产品表达

对外和对内都应该把这套 MVP 说成：

`知识库优先、人工复核兜底、可持续学习但必须审核的医学稿件处理系统`
