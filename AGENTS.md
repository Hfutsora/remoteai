# Agent Notes

## Admin Backend: Go Only

- `apps/admin` 中的 NestJS 版本已停止维护，源码冻结，不再新增功能、修复业务问题或作为生产部署目标。
- 后端功能开发、问题修复、数据库升级和线上部署统一使用 `apps/admin-go`；管理页面继续使用 `apps/admin-ui`。
- NestJS 源码仅保留为历史接口契约和本地兼容对照测试基线。不要为更新契约或通过测试而修改已冻结的 NestJS 实现；新功能应在 Go 中实现并增加对应测试。
- 生产构建、部署配置和运维文档不得重新引入 NestJS 服务。更新和回滚均使用已经验证的 admin-go 镜像。
- `apps/admin-go/sql` 是数据库升级脚本目录；生产部署说明以 `apps/admin-go/DEPLOYMENT.md` 为准。
- admin-go 更新和回滚统一使用 `apps/admin-go/scripts/deployment_compose.py` 的 `check`、`up`、`verify`。
  保留当前容器记录的完整 Compose 文件列表；已启用 TURN 时必须保留 `compose.desktop-relay.yml`。
  部署前后核对中继端口和网络，不能仅凭 HTTP、聊天 WebSocket 或 STUN 正常就判定远程桌面可用。
- 新增 Go 接口时同步检查 `apps/admin-go/kong/existing-kong.example.yml` 的覆盖范围及鉴权规则；
  `go -C apps/admin-go test ./internal/server -run TestKong` 必须通过，线上已有路由也要保存在项目中。

## Automatic Commit and Push

- After completing the requested changes and verifying them successfully, automatically commit the changes made for the current task and push the current branch to its configured upstream. Do not wait for a separate request to commit or push.
- Never include unrelated existing changes in the commit. If verification fails, the branch has no configured upstream, or the push is blocked for a reason other than remote updates, report the issue instead of bypassing checks or rewriting history.
- If remote updates are detected before or during a push, fetch the configured upstream and attempt to merge it into the current branch. After a successful merge, rerun the relevant checks and push again.
- If the merge produces conflicts, immediately abort it with `git merge --abort`, preserve local commits and existing work, and stop the push. Report the conflict instead of resolving it automatically or forcing the push.
- Also include tracked files changed only by line-ending differences rather than leaving them uncommitted.

## User-Facing Prompts and Copy

- Write all user-facing prompts and copy in natural, clear, and easy-to-understand language. Do not mention implementation details, internal processes, or other technical details.
- Whenever a user request involves writing prompts or copy, proactively refine and improve the wording so it is concise, friendly, and accurate instead of simply repeating the user's original wording.
- Keep temporary messages, including hover tooltips, popovers, and confirmation prompts shown after a click, visually compact. Limit the text area to a maximum width of `400px`, which is roughly one line of 25 full-width Chinese characters at the standard body-text size. Wrap longer copy onto additional lines instead of widening the message.

## Internationalization: Single Package

- 后续国际化统一使用独立语言包 `packages/i18n`（`@remoteai/i18n`），作为翻译资源和语言元数据的唯一维护源。
  此要求覆盖各应用、共享模块、Rust/原生平台资源、浏览器扩展及构建脚本；冻结代码和第三方源码仍遵守原有维护边界。
- 所有新增或修改的可翻译用户文案都必须放入语言包，包括默认语言、回退文案、状态和错误提示、无障碍标签、权限说明、用户协议及结构化内容。
  不得在业务代码中新增独立翻译表、内联多语言对象、按语言分支返回的文案或硬编码的可翻译界面文本。
- 业务代码通过 `@remoteai/i18n` 的公开入口和现有应用适配层获取文案。新文案优先使用语义化键，完整句子通过参数插值表达，避免拼接翻译片段。
  语言选择、偏好持久化、订阅和平台接入逻辑可保留在应用中，翻译资源不得因此重新分散。
- Rust、系统权限、扩展清单和嵌入脚本等必须保留在平台目录的语言文件或文案区段，只能作为生成产物存在。
  在 `packages/i18n/platform/` 维护源文件，并通过 `packages/i18n/platform.json` 登记生成关系；禁止直接维护或手动修改生成副本。
- 新增或修改文案时同步维护对应模块已发布语言的键和参数，沿用语言包声明的语言启用范围及回退策略。
  不得因资源集中而擅自扩大语言发布范围；具体资源组织和例外策略以 `packages/i18n/README.md` 为准。
- 只翻译展示文案，保留协议值、状态标识、数据库值和用户内容的原始语义。
  现有服务错误文本通过语言包的错误格式化接口在展示边界解码，不得通过翻译后的文案判断业务状态。
- 资源或语言元数据变更后运行 `npm run generate:i18n`，提交前确保 `npm run check:i18n` 通过。
  同时检查受影响入口的语言切换、回退和离线资源，禁止通过放宽检查、添加无依据的豁免或复制翻译来绕过语言包归属约束。

## Desktop Local, Remote, and Web Parity

- 后续涉及 PC 端的改动，默认在同一任务中同步修改 `apps/desktop` 的本地模式、远程模式和 `apps/web` 的 PC 页面，确保对应功能、界面效果、交互及文案一致，无需用户另行提醒；用户明确限定范围时，以用户要求为准。
- 从任一入口修改功能或修复问题时，都要检查另外两个入口的对应实现；能复用的业务逻辑、组件和样式优先放在共享模块，避免各端后续遗漏同步。
- 三个入口应保持一致的布局、视觉样式、操作反馈和状态展示，并适配各自窗口与桌面浏览器宽度；受平台能力限制无法完全一致时，应提供对应适配，并在交付时说明差异及原因。
- 完成前分别验证 PC 本地、PC 远程和 Web PC 的受影响功能与展示效果，并在交付时说明同步结果，不得只修改或验证其中一个入口就视为完成。

## Mobile and Web Parity

- 用户提出移动端或手机端改动时，默认在同一任务中同步修改 `apps/native` 和 `apps/web` 在移动端尺寸下的对应功能、界面效果、交互及文案，无需用户另行提醒；用户明确限定范围时，以用户要求为准。
- Web 的同步范围仅限移动端尺寸，不包含桌面宽屏；保持原生端与 Web 移动端的对应行为一致，并按各自布局适配。能复用的业务逻辑优先放在共享模块，避免两端后续遗漏同步。
- Android/iOS 系统能力等平台专属改动，不要求照搬到浏览器；应检查 Web 在移动端尺寸下是否需要对应适配，并在交付时说明未同步的部分及原因。
- 完成前分别验证原生端和 Web 移动端尺寸下受影响的功能与展示效果，并在交付时说明同步结果，不得只修改原生端就将移动端需求视为完成。

## Native Text Layout: Prevent Glyph Clipping

- 原生端新增或修改标题、列表入口、返回按钮、导航标签、状态提示等独立 `Text` 时，
  统一复用 `apps/native/src/theme/text.ts` 的 `textMetrics(fontSize, lineHeight)`，
  为中文、系统字体和回退字体保留完整的上下笔画空间，不要只设置 `fontSize`。
- Android 不要直接用固定 `lineHeight` 代替该工具；React Native 的显式行高可能覆盖字体度量，
  导致部分厂商字体被裁剪。保留工具提供的 `includeFontPadding`、上下留白和最小高度，
  让系统字体决定实际所需高度；iOS 沿用工具中的平台适配。
- 不要通过关闭字体缩放、缩小字号、固定文字容器高度或隐藏溢出来掩盖裁剪。
  父容器应允许随字体增大或换行而增长；横向文字按需要设置收缩和换行，避免挤压图标。
  图标字体、嵌套富文本等确有特殊排版要求时，应单独验证并说明不能直接复用的原因。
- 修复文字裁剪时，同时检查同一功能的页面标题、入口、返回栏和相关提示，避免只修复截图中的一处。
  Web 对应页面在移动端尺寸下同步检查行高、上下留白和换行，继续遵守移动端与 Web 同步要求。
- 完成前用 Android 真机分别检查默认字体和放大字体（至少系统字体缩放 1.0 和 1.3），
  查看截图确认中文上下笔画完整，并验证入口和返回操作。
  类型检查、构建通过或文字框尺寸正常不能替代视觉检查；无法真机验证时必须明确说明未验证范围。

## Tauri 2 WebView Window Creation On Windows

- Do not create a `WebviewWindowBuilder` from a synchronous Tauri command on Windows. In this repo, opening the Token Usage window from a sync `#[tauri::command]` produced a native window shell, but the WebView content stayed white, the close button did not work reliably, and DevTools could not be opened.
- Use an `async fn` command for window creation instead. The working fix was changing `show_token_usage_window` from a synchronous command to `pub(crate) async fn show_token_usage_window(...) -> Result<(), String>`.
- If adding a new Tauri window label, also add it to `apps/desktop/src-tauri/capabilities/default.json`. For Token Usage, the label is `token-usage`.
- Prefer hash routing for single-page subwindows loaded from packaged assets, for example `WebviewUrl::App("index.html#token-usage".into())`, and keep the frontend route parser compatible with both query and hash routes.
- For auxiliary windows that previously got stuck, add a Rust-side close fallback in `on_window_event` that destroys the specific window label instead of hiding the main app.

## Tauri UI Responsiveness and Polling

- Do not expose blocking work through a synchronous `#[tauri::command]` when the frontend can call it during rendering, loading, polling, automatic refresh, or event handling. A synchronous command can block the Windows UI message thread and make the application appear frozen.
- Implement commands as `async fn` and move blocking work to `tauri::async_runtime::spawn_blocking` whenever the operation can wait on a `Mutex` or `RwLock`, access SQLite, read or write files, call blocking network APIs, inspect processes, or perform other potentially slow system work. Use native asynchronous I/O when it is already available.
- Never wait for a shared lock on the UI thread. This is especially important when another task can hold the lock across a network request, SQLite busy timeout, database migration, or filesystem scan.
- Keep database serialization guards alive for the complete read or write operation, not only while opening the connection or initializing the schema. UI callers must await the asynchronous command without performing database work themselves.
- Polling callbacks must be single-flight. If the previous refresh is still running, skip the next interval instead of starting an overlapping request. Clear timers and subscriptions when the component unmounts or the feature becomes inactive.
- High-frequency polling, such as the two-second proxy session refresh, must not synchronously scan conversation metadata, Provider files, model catalogs, or token-usage databases. Move the complete operation off the UI thread, including any helper functions it calls.
- If the headless web compatibility layer needs to call an asynchronous Tauri command, adapt it explicitly in its request worker, for example with the existing `block_on` helper. Do not change the desktop command back to a synchronous function for web compatibility.
- For changes to proxy, Provider, concurrent-routing, cloud-sync, or token-usage UI flows, verify responsiveness while requests are active and while the relevant polling view is open. Run Rust formatting and tests plus the desktop TypeScript/Vite production build before handing off the change.


## Clean Code Constraints

1. A single source file should generally not exceed **500 lines**. If it does, split it by responsibility.
2. A single function should generally not exceed **50 lines**.
3. A single React component should generally not exceed **200 lines**.
4. A single custom Hook should generally not exceed **150 lines**.
5. A function should have no more than **4 parameters**. Use an options object when more parameters are needed.
6. Control-flow nesting should not exceed **3 levels**. Prefer early returns to reduce nesting.
7. The cyclomatic complexity of a single function should not exceed **10**.
8. A single line of code should not exceed **120 characters**.
9. Each module should have one clear responsibility. Avoid God Objects and God Functions.
10. Avoid using `any`. If its use is truly necessary, the reason must be documented. Prefer `unknown` where appropriate.
11. Avoid magic numbers and magic strings. Extract them into meaningful constants.
12. Avoid duplicated code, but do not introduce unnecessary abstractions solely for the sake of DRY.
13. In React, separate business logic from presentation logic. Extract complex logic into custom Hooks or standalone functions.
14. Each `useEffect` should handle one clearly defined side effect or synchronization responsibility.
15. Avoid deeply nested ternary expressions and overly complex conditional logic in JSX.
16. Variable, function, and type names must clearly express their business meaning. Avoid meaningless abbreviations.
17. Comments should explain design decisions, constraints, and exceptional cases rather than restating what the code already does.
18. Do not keep commented-out code, dead code, unused variables, or unused dependencies.
19. Modules should communicate through public interfaces. Do not depend on another module's internal implementation details.
20. When modifying existing code, prioritize local consistency and avoid unrelated large-scale refactoring for small changes.
21. Rust source files should generally not exceed **500 lines**. Split large files by domain or responsibility.
22. A single Rust function should generally not exceed **50 lines**. Complex logic should be extracted into smaller functions or dedicated modules.
23. Tauri `command` functions should remain thin. They should primarily handle input validation, permission checks, state access, and delegation to service-layer logic.
24. Do not place complex business logic directly inside `#[tauri::command]` functions.
25. `main.rs` and `lib.rs` should only contain application bootstrap, plugin registration, command registration, and high-level module wiring. Avoid business logic in these files.
26. Organize Rust code by responsibility, for example:

```text
src-tauri/src/
├── commands/
├── services/
├── models/
├── state/
├── errors/
├── utils/
├── platform/
├── lib.rs
└── main.rs
```

27. Avoid large catch-all files such as `commands.rs`, `utils.rs`, or `models.rs`. Split them into domain-specific modules when they grow significantly.
28. Avoid `unwrap()` and `expect()` in production code unless failure represents a truly unrecoverable invariant. Prefer proper error propagation with `Result`.
29. Do not silently discard errors using patterns such as:

```rust
let _ = some_fallible_operation();
```

unless ignoring the error is intentional and documented.

30. Define meaningful application error types instead of returning arbitrary strings from internal Rust APIs.
31. Use `thiserror`-style typed errors for internal application logic where appropriate. Convert errors into frontend-safe representations only at the Tauri boundary.
32. Do not expose sensitive internal error details, filesystem paths, credentials, tokens, or stack information directly to the frontend.
33. Shared mutable state must have a clearly defined ownership model. Avoid unnecessary global mutable state.
34. When using `Mutex`, `RwLock`, or other synchronization primitives, keep lock scopes as short as possible.
35. Never hold a synchronous lock across an `.await` point.
36. Avoid blocking operations inside async Tauri commands. CPU-intensive or blocking I/O operations should be delegated to appropriate blocking tasks or worker threads.
37. Avoid unnecessary `clone()` calls. Prefer borrowing when ownership does not need to be transferred.
38. Avoid excessive use of `Arc<Mutex<T>>`. Use it only when shared ownership and mutation are actually required.
39. Prefer enums and strongly typed structures over string-based state or mode identifiers.

For example, prefer:

```rust
enum AccountStatus {
    Active,
    Disabled,
    Expired,
}
```

over:

```rust
let status = "active";
```

40. All data crossing the Tauri IPC boundary should use explicit serializable request and response types.
41. Do not expose large internal Rust structs directly through Tauri commands merely because they implement `Serialize`. Define dedicated DTOs when appropriate.
42. Validate all data received from the frontend. Never assume IPC input is trusted.
43. File paths received from the frontend must be validated before filesystem operations are performed.
44. Shell commands, process execution, filesystem access, and network operations must follow the principle of least privilege.
45. Never construct shell commands by directly concatenating untrusted frontend input.
46. Avoid exposing generic commands such as:

```rust
execute_command(command: String)
read_file(path: String)
write_file(path: String, content: String)
```

unless strict validation and permission restrictions are implemented.

47. Tauri capabilities and permissions should follow the principle of least privilege. Only enable APIs and scopes actually required by the application.
48. Platform-specific behavior should be isolated behind dedicated modules instead of scattering `#[cfg(...)]` blocks throughout business logic.

Prefer:

```text
platform/
├── windows.rs
├── macos.rs
└── linux.rs
```

rather than many unrelated platform checks across the codebase.

49. Unsafe Rust is prohibited unless absolutely necessary. Every `unsafe` block must include a comment explaining the safety invariant.
50. Run `cargo fmt` and ensure the code passes `cargo clippy` without unjustified warnings.
51. Do not suppress Clippy warnings globally merely to make CI pass. Suppress individual warnings only when there is a documented reason.
52. Public functions, complex domain types, and non-obvious invariants should have appropriate Rust documentation comments.
53. Unit tests should cover important pure business logic independently from the Tauri command layer.
54. Tauri commands should be testable indirectly by keeping business logic outside the IPC layer.
