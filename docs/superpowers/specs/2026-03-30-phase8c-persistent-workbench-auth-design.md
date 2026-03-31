# Phase 8C Persistent Workbench Auth Design

**Goal**

让 `apps/web` 脱离开发态假会话入口，支持真实登录到持久化 API runtime，并让现有知识审稿 / 学习审稿工作台在 persistent runtime 下可直接使用。

## Scope

本阶段只覆盖：

- Web 登录宿主
- 当前会话读取
- 退出登录
- 知识审稿 workbench 的 persistent 模式接入
- 学习审稿 / 学习回写 workbench 的 persistent 模式接入

本阶段不覆盖：

- 所有 admin workbench 的完整 web 实现
- 稿件上传、文档资产、导出主链路的真实持久化
- Prompt / Skill Registry 的 persistent UI
- 小程序登录

## Problem

当前 API 已经具备持久化认证与治理注册表 runtime，但 `apps/web` 仍然存在两个明显断点：

1. `App.tsx` 只支持开发态假会话引导。
2. 非开发模式直接显示占位内容，无法真实登录和进入 workbench。

这导致 persistent runtime 已经能跑，但 web 还不能作为真实治理入口使用。

## Proposed Approach

### 1. API 增加最小闭环认证会话接口

在现有 `/api/v1/auth/local/login` 基础上补两个接口：

- `GET /api/v1/auth/session`
  返回当前会话用户信息
- `POST /api/v1/auth/logout`
  清理当前会话并清除 cookie

这样 web 不需要知道 session cookie 细节，只需要通过标准接口判断：

- 是否已登录
- 当前登录的是谁
- 是否可退出

### 2. HttpAuthRuntime 扩展为可读会话、可清理会话

`HttpAuthRuntime` 当前只支持：

- 登录
- 强制读取会话
- 生成登录 cookie

本阶段扩展为还支持：

- 可选读取当前会话
- 清理当前会话
- 生成清理 cookie 头

demo runtime 与 persistent runtime 都实现同一接口，保证 API route 不需要分支判断。

### 3. Web 改为模式化宿主，而不是 DEV-only 宿主

`apps/web` 入口改为根据 `VITE_APP_ENV` 决定工作模式：

- `local`
  继续使用现有 demo backend 自动登录能力
- `dev|staging|prod`
  走真实登录宿主

真实登录宿主职责：

- 首次加载时尝试读取当前会话
- 未登录时显示登录表单
- 登录成功后加载 role-aware workbench host
- 支持退出登录并回到登录页

### 4. Workbench 页面保持现有 API client，不重写控制器

知识审稿和学习审稿页面当前已经通过 `browser-http-client` 走 cookie 请求。Phase 8C 不重写现有控制器，只把宿主层切换到真实会话。

这样可以避免无意义重构，最大化复用 Phase 7B 的 workbench 实现。

## UX Contract

### Demo 模式

- 页面仍可自动进入 workbench
- 继续通过 demo 账号自动向本地 API 换取 cookie
- 保留当前开发联调效率

### Persistent 模式

- 首屏先检测 session
- 有 session 直接进入 host
- 无 session 显示登录页
- 登录失败显示明确错误
- 登录成功后显示当前用户、角色和可见 workbench
- 提供退出登录按钮

## Data Flow

### Persistent 登录流

1. Web 启动
2. 请求 `GET /api/v1/auth/session`
3. 若 200，构建 `AuthSessionViewModel`
4. 若 401，显示登录表单
5. 用户提交 `POST /api/v1/auth/local/login`
6. 后端设置 HttpOnly cookie
7. Web 再次请求 `GET /api/v1/auth/session`
8. 成功后进入 `WorkbenchHost`

### Persistent 退出流

1. 用户点击退出
2. Web 请求 `POST /api/v1/auth/logout`
3. 后端撤销 session 并下发清空 cookie
4. Web 清空本地会话状态
5. 返回登录页

## Testing Strategy

### API

- 登录后能读取当前 session
- logout 后 session 不再可读
- demo runtime 与 persistent runtime 都通过同一接口契约

### Web

- demo 模式仍会自动 bootstrap
- persistent 模式无 session 时进入登录页
- persistent 模式登录成功后进入 workbench host
- persistent 模式 logout 后回到登录页

## Risks

### Risk 1: 把 demo 模式与 persistent 模式耦死

规避方式：

- 用明确的 mode helper
- 宿主逻辑拆分为 demo bootstrap 与 persistent auth 两条路径

### Risk 2: workbench 页面继续依赖 forged actorRole

现有 API 已以服务端 session 为准，body 中 actorRole 只是兼容字段。Phase 8C 不扩散修改控制器，只保证真实 cookie 会话存在。

### Risk 3: persistent runtime 仍有 mixed-mode 域

本阶段只把 web 接到已经持久化的治理面。不会把 manuscripts/assets 假装成已完整持久化。

## Acceptance Criteria

- `apps/web` 在非 local 模式下不再显示占位页
- 用户可通过真实登录进入 workbench host
- 用户可读取当前 session 并退出登录
- 知识审稿 workbench 可在 persistent runtime 下工作
- 学习审稿 / 学习回写 workbench 可在 persistent runtime 下工作
- demo 模式不回归
