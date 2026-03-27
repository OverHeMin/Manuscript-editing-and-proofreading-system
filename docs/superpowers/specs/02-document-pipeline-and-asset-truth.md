# 文档管线与文件真源

## 真源原则

- 正式真源始终是 `DocumentAsset`
- 浏览器预览、ONLYOFFICE 会话、下载副本都不是真源
- 保存、确认、导出必须落正式资产记录

## 文档主链路

1. 上传原始稿件
2. 文件基础校验
3. `doc -> docx` 标准化
4. 结构解析
5. 生成预览资产或预览视图
6. 进入业务模块处理
7. 生成结果资产

## 资产类型

- `original`
- `normalized_docx`
- `screening_report`
- `edited_docx`
- `proofreading_draft_report`
- `final_proof_issue_report`
- `final_proof_annotated_docx`
- `pdf_consistency_report`
- `human_final_docx`
- `learning_snapshot_attachment`

## ONLYOFFICE 边界

- 用于预览、批注查看、协作评估
- 不允许覆盖旧资产
- 如需保存，必须生成新 `DocumentAsset`
- 必须记录父资产、来源会话、操作者、模块上下文

## 失败回退

- 标准化失败：任务失败并提示人工处理原稿
- 预览失败：允许下载原文件并保留失败审计
- 文档结构抽取失败：转人工复核，不伪造结构结论
