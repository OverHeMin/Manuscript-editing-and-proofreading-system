# 医学稿件处理系统发给新 AI 的第一条消息

把下面整段发给新项目里的 AI：

```md
我要重新建立一个新的“医学稿件处理系统”项目。

在开始前，请先阅读这些文档：

1. `docs/handoff/final-handoff-brief.md`
2. `docs/handoff/master-blueprint.md`
3. `docs/handoff/rebuild-plan.md`
4. `docs/handoff/learning-mvp-design.md`
5. `docs/handoff/learning-mvp-plan.md`
6. `docs/handoff/new-project-init-pack.md`

请严格按下面顺序工作，不要跳步骤：

1. 先复述你对系统的结构化理解
2. 再指出你认为当前蓝图里是否还有冲突、缺口或需要补充澄清的地方
3. 再输出你建议的新项目 spec 文档拆分方案
4. 再输出按阶段推进的 implementation plan
5. 先不要写代码

你必须遵守这些固定约束：

- 这是“面向医学稿件处理的 AI 工作平台”，不是医学百科
- 四大模块固定为：审稿/筛稿、编加/编辑、校对、医学知识库
- V1 只正式支持 doc/docx，doc 必须统一转换成 docx 后再处理
- 校对模块不直接改正文，只输出结构化问题清单和 Word 批注
- V1 另有一个受限 PDF 能力：`目录 - 正文 heading 一致性核对`
- 知识库必须先审核，只有 approved 知识项允许进入 AI 下游调用
- 所有高风险医学问题默认保守，无法稳定判断时统一输出“需人工复核”
- 所有 AI 结论必须带证据引用和置信度
- 所有关键动作都要写入审计日志
- 学习层是跨审稿、编加、校对、知识治理的统一能力
- 学习功能必须走：`原稿/AI 输出/人工定稿或人工复核结果 -> 候选项 -> 人工审核 -> 已批准知识/模板/prompt 资产`
- 候选项至少包括：`rule_candidate`、`case_pattern_candidate`、`template_update_candidate`、`prompt_optimization_candidate`
- 不允许通过上传案例直接微调模型、静默重训练，或让未审核学习成果直接影响生产输出

请先输出：

1. 结构化系统理解
2. 你发现的冲突或缺口
3. spec 目录结构建议
4. implementation plan 草案
5. 建议优先开始的第一阶段
6. 学习候选审核流与 PDF 目录 - 正文一致性核对的落地方案

先停在这里，等我确认后再进入实现。
```
