# 医学稿件处理系统重建实施计划

**Date:** 2026-03-25  
**Status:** Rebuild plan from empty repo

---

## 1. 总体目标

从一个全新 monorepo 重新搭建医学稿件处理系统 V1，使其具备：

- 稿件接收
- 知识库审核流
- 审稿
- 编加
- 校对
- PDF 目录 - 正文一致性核对
- 学习候选审核流
- 审计与基础 AI 路由闭环

---

## 2. 重建顺序

### Phase 1：搭骨架

- 建 monorepo
- 建 `apps/web`
- 建 `apps/api`
- 建 `apps/worker-py`
- 建 `packages/contracts`
- 建 `packages/config`
- 建 `packages/prompts`
- 建 `packages/ui`
- 建基础数据库 schema

### Phase 2：打通稿件主线

- 上传稿件
- `doc -> docx`
- 文档解析
- 文件登记
- jobs 主线
- 下载链路

### Phase 3：做知识库与模板

- 知识提交页
- 知识审核页
- `approved` 路由逻辑
- 模板管理
- 模板发布 / 归档

### Phase 4：接三大业务模块

- 审稿
- 编加
- 校对

### Phase 5：接 PDF 一致性核对

- 上传或选择 PDF
- TOC 抽取
- body heading 抽取
- issue 列表输出

### Phase 6：接 learning layer

- reviewed case snapshots
- learning runs
- learning candidates
- 审核流
- approved assets 回写

### Phase 7：规则、审计与验证

- 规则引擎
- 审计日志
- 风险分级
- 人工复核逻辑
- 单元测试
- 集成测试
- 关键 e2e

---

## 3. 第一阶段最小里程碑

第一阶段完成后，至少应能证明：

- 项目骨架可启动
- web / api / worker-py 目录明确
- contracts / config 可构建
- manuscripts / files / jobs 基础模型存在
- 至少有一条从稿件创建到文件登记的最小链路

---

## 4. 默认验证要求

在宣布阶段完成前，至少运行：

- `lint`
- `typecheck`
- 核心测试
- 关键 e2e

---

## 5. 固定执行纪律

- 先写 spec，再写 implementation plan，再实现
- `superpowers` 控总流程
- `subagent` 只在 plan 已批准后用于任务拆分
- `gstack` 用于流程验证、设计复核和 QA
