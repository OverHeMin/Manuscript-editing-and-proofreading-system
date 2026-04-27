# Harness 质量可控改进方案

## 2026-04-26 Proofreading closure decisions

- Gold Set is not hidden backend-only config: the Harness datasets page now exposes a Medical proofreading Gold Set entry point for expected issues, false positive/false negative review, context consistency, statistics/table assertions, and release thresholds.
- Proofreading runs must persist a proofreadingLayerMatrix with document_structure, context_consistency, statistics_expression, table_proofreading, residual_discovery, and final_regression_readiness.
- Finalize must read the layer matrix: missing matrix or incomplete release-critical layers blocks final publishing.
- The human confirmation page must show both the proofreading layer quality matrix and segment audit evidence so reviewers can verify context, statistics, table, residual, and final-regression readiness before publishing.


## 目标

把“校对/编辑 run passed”升级为可审计的质量门禁：系统不仅证明流程跑完，还要证明规则命中、知识引用、残差发现、人工复核和误报/漏报都在可控范围内。

## 当前结论

- `run passed` 只能证明执行链路可用，不能证明内容质量达标。
- 真实模型验收必须显式启用真实执行器；测试执行器会固定产出，不能作为模型质量证据。
- Harness 仍然有价值：它能记录绑定、模型、知识命中、执行快照、人工确认、学习候选和验证结果，但需要补内容级断言。

## 质量门禁

1. **Gold Set 覆盖**
   - 每个稿件保存人工标注的 expected issues：位置、原文、问题类型、严重级别、建议处理方式。
   - 每个 expected issue 绑定至少一个来源：规则、知识、人工经验或期刊格式要求。
   - 验收指标：召回率、关键问题召回率、严重问题漏报数。

2. **规则命中断言**
   - 对强规则建立 deterministic assertion：输入片段、应命中的规则 ID、应进入的处理路径。
   - 验收指标：规则命中率、规则误触发率、规则输出是否进入人工确认或自动小修补。

3. **知识识别断言**
   - 对录入知识建立 retrieval assertion：查询上下文、应召回知识 ID、最低分数、必须引用字段。
   - 验收指标：知识召回率、错误知识引用率、未引用但应引用的知识数。

4. **残差抽检**
   - 规则/知识覆盖后，要求模型独立输出 residual issues，并标明“为什么不是已命中规则覆盖的问题”。
   - 抽检 residual issues 的有效性、重复率、可操作性。
   - 验收指标：残差有效率、重复率、人工升级为规则/知识候选比例。

5. **人工复核通过率**
   - 每个校对 issue 进入人工确认状态机：采纳、采纳并手改、驳回、仅人工处理、升级、转规则候选、转知识候选。
   - 验收指标：采纳率、驳回率、需手改率、高风险强制复核完成率。

6. **误报/漏报统计**
   - 误报：模型/规则提出但人工驳回的问题。
   - 漏报：gold set 中存在但系统未提出的问题。
   - 验收指标：按模块、规则、知识、模型版本、稿件类型分桶统计。

## 验收输出

每次真实验收报告应包含：

- 真实/测试执行器标记、模型名、provider、请求超时。
- 每篇稿件问题总数和每轮 pass 问题数。
- Harness binding、agent execution log、knowledge hits、rule hits。
- Gold set precision/recall、关键问题漏报、误报样例。
- 残差问题有效率和学习候选入队结果。
- 人工确认页截图和候选队列截图。

## 数据结构建议

- `quality_gold_cases`：稿件级 gold set。
- `quality_expected_issues`：人工标注问题。
- `quality_assertion_runs`：每次 Harness 质量断言运行。
- `quality_assertion_items`：规则命中、知识召回、残差、误报/漏报明细。
- `quality_human_review_metrics`：人工复核结果聚合。

## 发布门槛建议

- P0/P1 gold issue 召回率达到 100%。
- 总体召回率达到项目设定阈值，例如 ≥90%。
- 误报率低于项目设定阈值，例如 ≤20%。
- 强规则命中断言 100% 通过。
- 高风险问题 100% 进入人工确认。
- 残差有效问题能进入规则/知识候选队列，候选队列无 500。
