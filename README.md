# whitelabel-claude

一键为 Claude Code 接入任意兼容 Anthropic Messages API 的大模型服务，同时支持换皮为自定义品牌。

## 功能

- **多 API 接入** — DeepSeek、Kimi、OpenRouter、硅基流动、自建中转，开箱即用
- **品牌替换** — 自定义名称、欢迎页、颜色、Logo，协议层自动保护不误改
- **中文 UI** — 可选汉化欢迎页、按钮、提示文案
- **遥测禁用** — 自动屏蔽 Datadog / Growthbook 等上报
- **配置隔离** — 独立 `CLAUDE_CONFIG_DIR`，与官方 Claude Code 互不干扰，可同时运行
- **一键打包** — 生成 zip 分发包，接收方只需 Node.js 即可使用

## 它是什么

这是一个 [Claude Code Skill](https://docs.anthropic.com/en/docs/claude-code/skills)。在 Claude Code 会话中说"白标"、"换皮"、"接 DeepSeek"、"/whitelabel" 等关键词即可触发。

Skill 会自动：

1. 定位本机已安装的 `cli.js`（或从 zip 包提取）
2. 用 **Protect → Replace → Restore** 三步法安全 patch
3. 生成平台启动脚本（`.bat` / `.sh`）
4. 可选打包为 zip 分发

## 快速开始

### 作为 Skill 使用（推荐）

```bash
# 在 Claude Code 中直接说：
> 帮我接 DeepSeek
> 白标成 MyBrand，接 OpenRouter
> /whitelabel
```

### 手动使用

```bash
# 1. 准备 cli.js（从已安装的 Claude Code 复制）
mkdir mybrand-dist
cp $(node -e "console.log(require.resolve('@anthropic-ai/claude-code/cli.js'))") mybrand-dist/

# 2. 编辑 patch.js 配置项，然后执行
node mybrand-dist/patch.js mybrand-dist/cli.js

# 3. 验证
node mybrand-dist/cli.js --version
```

## 支持的 API 端点

| 服务 | Base URL |
|------|----------|
| DeepSeek | `https://api.deepseek.com` |
| Kimi Code | `https://api.kimi.com/coding/` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| 硅基流动 | `https://api.siliconflow.cn/v1` |
| 自建中转 | `https://your-domain.com` |

## 可定制项

| 参数 | 说明 | 默认 |
|------|------|------|
| 品牌名 | 替换 UI 中的 "Claude Code" | 可选 |
| API 端点 | 目标服务 base URL | 必填（接第三方时）|
| API Key | 第三方 API 的 key | 必填（接第三方时）|
| 中文 UI | 欢迎页汉化 | 否 |
| 品牌色 | RGB 三个数字 | `215,119,87` |
| Logo 风格 | `default` / `look-left` / `look-right` / `arms-up` / `bot-mini` / `pixel-cat` / `star` / `custom` | `default` |

## Patch 原理

**Protect → Replace → Restore** 三步法：

1. **Protect** — 将 50+ 个协议层字符串（User-Agent `claude-cli/`、npm 包名、环境变量名、SDK 类名）替换为占位符
2. **Replace** — 在占位符保护下做品牌/UI/颜色替换，不会误伤协议层
3. **Restore** — 还原占位符（API 域名按需替换为新端点）

> 不做保护直接替换，会把 HTTP User-Agent 改掉，第三方服务端校验客户端标识会 403。

## 产出结构

```
mybrand-dist/
├── cli.js            # 已 patch
├── package.json
├── vendor/           # 当前平台的 native addon
├── mybrand.bat       # Windows 启动脚本
├── mybrand.sh        # macOS/Linux 启动脚本
└── patch.js          # 留着方便重新 patch
```

## 常见问题

| 症状 | 原因 | 解法 |
|------|------|------|
| 403 "客户端异常" | User-Agent 被改 | 检查 `claude-cli/` 是否还在 cli.js 里 |
| 401 明明 key 对 | 全局 OAuth 抢占 | 确认用了 `ANTHROPIC_AUTH_TOKEN` |
| AUTH_TOKEN 也 401 | OAuth 文件被直接读 | 确认 `CLAUDE_CONFIG_DIR` 指向独立空目录 |
| 工具调用报 400 | 中转不支持 tool_search | 启动脚本加 `ENABLE_TOOL_SEARCH=false` |
| vendor 报错 | 平台 native addon 缺失 | 确认提取了对应平台的 vendor/ |

## License

MIT
