# 产品范围与硬边界

## 产品定义

系统定位为 `面向医学稿件处理的 AI 工作平台`，不是医学百科、通用问答产品或黑盒自进化系统。

V1 固定覆盖：

- `screening`
- `editing`
- `proofreading`
- `knowledge`
- `PDF 目录 - 正文 heading 一致性核对`

## 文件与交付边界

- 正式主文件格式：`doc`、`docx`
- `doc` 必须先转为 `docx`
- PDF 仅用于受限一致性核对
- 正式真源永远是 `DocumentAsset`
- 在线预览与协作不替代正式文件资产

## 生产态 AI 边界

- 仅允许调用 `approved` 的知识、模板、规则、prompt、checklist
- 外部公开来源不直接进入生产证据链
- 所有 AI 结论必须带证据引用和置信度
- 高风险医学或统计问题不稳定时统一输出 `需人工复核`

## 模块输出规则

- `screening`：AI 可直接输出最终审稿报告
- `editing`：AI 可直接输出最终编加稿
- `proofreading`：AI 先输出草稿，人工确认后生成最终稿

## 组织与角色

- 系统为单机构内部系统
- 固定角色：`admin`、`screener`、`editor`、`proofreader`、`knowledge_reviewer`、`user`
- 采用“权限可见 + 自主处理”的工作台模式

## 不允许做的事

- 上传案例后直接微调模型
- 静默重训练
- 未审核学习成果直接影响生产
- 直接覆盖已发布模板、已批准知识或原始稿件
