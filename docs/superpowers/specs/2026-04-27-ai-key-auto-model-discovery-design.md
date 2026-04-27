# AI Key Auto Model Discovery Design

## Goal
后台 AI 接入默认只输入 API Key，系统在连接测试成功后自动发现可用模型、注册模型，并为模块路由提供主模型与备用模型选择。

## Scope
- 保留现有 AI Provider Connection、Model Registry、Model Routing 边界。
- 新增一条“自动发现并配置”的后端服务能力和 HTTP 入口。
- 前端 AI 接入表单默认展示 API Key，高级设置保留 Provider/Base URL/连接名。
- 自动注册发现到的可用聊天模型，并设置同连接下的备用模型候选。

## Non-goals
- 不重写运行时调用链。
- 不绕过连接测试状态。
- 不做价格、上下文长度、视觉/embedding 能力的精准识别。
- 不明文回显 API Key。

## Key Assumptions
- 第一版面向 OpenAI Chat Compatible 接口。
- 自动模型发现依赖兼容 `/models` 能力；不能自动判断的厂商通过高级 Base URL 兜底。
- 只有测试通过的连接才自动注册模型。

## Acceptance
- 输入 API Key 后可创建连接、测试连接、发现模型。
- 测试失败时不注册模型，并返回安全错误摘要。
- 测试成功时模型进入现有注册表，后台可按模块选择主模型与备用模型。
