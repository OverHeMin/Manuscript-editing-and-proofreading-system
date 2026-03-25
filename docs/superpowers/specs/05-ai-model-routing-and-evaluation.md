# AI 模型治理、路由与评测

## Model Registry

后台维护统一模型目录，至少记录：

- `provider`
- `model_name`
- `model_version`
- `allowed_modules`
- `is_prod_allowed`
- `cost_profile`
- `rate_limit`
- `fallback_model_id`

## 模型选择层级

1. 系统默认模型
2. 模块默认模型
3. 模板覆盖模型
4. 任务级临时指定模型

任务级指定只能使用白名单模型。

## 生产切换规则

模型切换前必须：

- 进入 `ModelRegistry`
- 完成基础评测
- 完成模块 / 模板评测
- 定义回滚模型
- 记录切换审计

## fallback 与灰度

- 支持主模型失败时切备用模型
- 支持新模型灰度
- 支持同模板下模型对照评测

## 审计

每次 AI 调用记录：

- provider
- model
- model version
- 模块
- 模板版本
- 任务 ID
- 耗时
- token / 成本摘要
