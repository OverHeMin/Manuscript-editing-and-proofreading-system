# 知识、学习与精准检索

## 知识库原则

知识库必须支持：

- 添加
- 编辑
- 审核
- 版本化
- 绑定模板
- 检索调用

已批准知识不可直接原地覆盖，修改必须生成新版本草稿。

## 知识项结构

建议至少包含：

- `title`
- `canonical_text`
- `summary`
- `knowledge_kind`
- `module_scope`
- `manuscript_types`
- `sections`
- `risk_tags`
- `discipline_tags`
- `evidence_level`
- `source_type`
- `source_link`
- `status`
- `effective_at`
- `expires_at`
- `template_bindings`
- `aliases`

## 精准调用链

知识检索采用四层机制：

1. 任务上下文路由
2. 结构化过滤
3. 混合检索
4. 重排序

优先信号：

- 当前模块
- 稿件类型
- 当前章节
- 当前模板
- 风险标签
- 问题类型

## 知识包

- 每个模板族 / 模块模板绑定一组核心知识
- 运行时先召回模板知识包
- 再补动态检索结果

## 学习层

定义为 `human-feedback-to-knowledge conversion`。

最小颗粒度：

- `稿件类型 x 模块`

进入学习层前必须满足：

- 案例有学习价值
- 有人工最终稿或最终批注版
- 脱敏预检通过

学习候选类型：

- `rule_candidate`
- `case_pattern_candidate`
- `template_update_candidate`
- `prompt_optimization_candidate`
- `checklist_update_candidate`

统一由 `knowledge_reviewer` 审核。
