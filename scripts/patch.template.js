#!/usr/bin/env node
/**
 * Claude Code White-label Patcher
 * Protect → Replace → Restore 三步法
 *
 * 用法: node patch.js <cli.js路径>
 *
 * 配置项（由 SKILL.md 的 Step 2 填入）：
 */
const BRAND_NAME   = '__BRAND_NAME__';   // e.g. "Xiaomu"
const API_BASE_URL = '__API_BASE_URL__'; // e.g. "https://aiapi.space" 或留空
const ENABLE_I18N  = __ENABLE_I18N__;   // true = 欢迎页中文化
const BRAND_RGB    = [__BRAND_R__, __BRAND_G__, __BRAND_B__]; // 边框色/图标色，官方默认 [215,119,87]
const LOGO_STYLE   = '__LOGO_STYLE__';  // default | look-left | look-right | arms-up | custom
const CUSTOM_LOGO  = __CUSTOM_LOGO__;   // 自定义 logo，格式: {r1L,r1E,r1R,r2L,r2R,feet} 或 null

const fs   = require('fs');
const path = require('path');

const CLI_PATH = process.argv[2] || path.join(__dirname, 'cli.js');
const PKG_PATH = CLI_PATH.replace(/cli\.js$/, 'package.json');

if (!fs.existsSync(CLI_PATH)) {
  console.error(`ERROR: cli.js not found at ${CLI_PATH}`);
  process.exit(1);
}

console.log(`\n  [Patcher] ${BRAND_NAME} — ${CLI_PATH}\n`);
let code = fs.readFileSync(CLI_PATH, 'utf-8');
const originalSize = code.length;

// ────────────────────────────────────────────────────────────
// STEP 1: PROTECT — 占位符保护所有 API 通信相关字符串
// 原理：防止后续的宽泛品牌替换破坏协议层（UA/包名/环境变量/SDK类名）
// ────────────────────────────────────────────────────────────
const PROTECTED = [
  ['claude-cli/',                               '__P_UA__'],      // HTTP User-Agent（第三方API会校验）
  ['@anthropic-ai/claude-code',                 '__P_PKG__'],     // npm 包名（影响内部 require）
  ['claudeAiOauth',                             '__P_OAUTH__'],
  ['"x-app":"cli"',                             '__P_XAPP__'],
  ['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',  '__P_E01__'],
  ['CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR',   '__P_E02__'],
  ['CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR',       '__P_E03__'],
  ['CLAUDE_CODE_DISABLE_STREAMING',             '__P_E04__'],
  ['CLAUDE_CODE_MAX_OUTPUT_TOKENS',             '__P_E05__'],
  ['CLAUDE_CODE_SKIP_TELEMETRY',                '__P_E06__'],
  ['CLAUDE_CODE_OAUTH_TOKEN',                   '__P_E07__'],
  ['CLAUDE_CODE_BUDGET_TOKENS',                 '__P_E08__'],
  ['CLAUDE_CODE_APPROVED_TOOLS',                '__P_E09__'],
  ['CLAUDE_CODE_MAX_TURNS',                     '__P_E10__'],
  ['CLAUDE_CODE_ENTRYPOINT',                    '__P_E11__'],
  ['CLAUDE_CODE_USE_BEDROCK',                   '__P_E12__'],
  ['CLAUDE_CODE_USE_VERTEX',                    '__P_E13__'],
  ['CLAUDE_CODE_USE_FOUNDRY',                   '__P_E14__'],
  ['CLAUDE_CODE_SIMPLE',                        '__P_E15__'],
  ['CLAUDE_CODE_REMOTE',                        '__P_E16__'],
  ['CLAUDE_CODE_API_KEY',                       '__P_E17__'],
  ['CLAUDE_AGENT_SDK',                          '__P_E18__'],
  ['CLAUDE_CONFIG_DIR',                         '__P_E19__'],
  ['AnthropicBedrock',                          '__P_SDK1__'],    // SDK 类名（改了会崩溃）
  ['AnthropicFoundry',                          '__P_SDK2__'],
  ['AnthropicVertex',                           '__P_SDK3__'],
  ['BaseAnthropic',                             '__P_SDK4__'],
  ['new Anthropic(',                            '__P_SDK5__'],
  ['import Anthropic',                          '__P_SDK6__'],
  ['Anthropic.MessageParam',                    '__P_SDK7__'],
  ['Anthropic.ToolResultBlockParam',            '__P_SDK8__'],
  ['Anthropic.ToolUseBlock',                    '__P_SDK9__'],
  ['Anthropic.APIError',                        '__P_SDK10__'],
  ['Anthropic.Models',                          '__P_SDK11__'],
  ['client = anthropic.Anthropic()',            '__P_SDK12__'],
  ['using Anthropic',                           '__P_SDK13__'],
  ['ANTHROPIC_API_KEY',                         '__P_AK__'],      // 认证环境变量名（只改值，不改名）
  ['ANTHROPIC_AUTH_TOKEN',                      '__P_AT__'],
  ['ANTHROPIC_BASE_URL',                        '__P_BU__'],
  ['ANTHROPIC_MODEL',                           '__P_AM__'],
  ['ANTHROPIC_SMALL_FAST_MODEL',                '__P_SM__'],
  ['ANTHROPIC_FOUNDRY_API_KEY',                 '__P_FK__'],
  ['api.anthropic.com',                         '__P_API__'],     // 功能性 API 域名
  ['console.anthropic.com',                     '__P_CON__'],
];

let protectedCount = 0;
for (const [orig, ph] of PROTECTED) {
  if (code.includes(orig)) { code = code.split(orig).join(ph); protectedCount++; }
}
console.log(`  [1/4] Protected ${protectedCount} API-facing strings`);

// ────────────────────────────────────────────────────────────
// STEP 2a: BRAND REPLACE — UI/品牌层替换
// ────────────────────────────────────────────────────────────
const b = BRAND_NAME;
const BRAND = [
  ["Claude Code, Anthropic's official CLI for Claude",    `${b}, your AI coding assistant`],
  ["Claude Code, Anthropic\\'s official CLI for Claude",  `${b}, your AI coding assistant`],
  ["(c) Anthropic PBC. All rights reserved.",             `(c) ${b}. All rights reserved.`],
  ["Want to see the unminified source? We're hiring!",    `${b} - AI-Powered Development`],
  ["https://job-boards.greenhouse.io/anthropic/jobs/4816199008", ""],
  ["Anthropic's agentic coding tool",                     b],
  ["Sorry, Claude encountered an error",                  "抱歉，出现了错误"],
  ["Sorry, Claude Code encountered an error",             "抱歉，出现了错误"],
  ['API Usage Billing (Anthropic Console)',                'API 用量计费'],
  ['Anthropic Console account',                           'API 账户'],
  ["reserved for official Anthropic marketplaces",        `reserved for official ${b} marketplaces`],
  ["winget upgrade Anthropic.ClaudeCode",                 `winget upgrade ${b}`],
  ["Claude is managed by winget",                         `${b} is managed by winget`],
  ["brew upgrade claude-code",                            `brew upgrade ${b.toLowerCase()}`],
  ["https://github.com/anthropics/claude-code/issues",   `https://github.com/${b.toLowerCase()}/issues`],
  ["https://github.com/anthropics/claude-code",          `https://github.com/${b.toLowerCase()}`],
  ["Claude Code",                                         b],   // 宽泛替换放最后
];

// ────────────────────────────────────────────────────────────
// STEP 2b: I18N — 可选中文本地化
// ────────────────────────────────────────────────────────────
const I18N = [
  ['return"Welcome back!";return`Welcome back ${', 'return"欢迎回来！";return`欢迎回来, ${'],
  ['"Tips for getting started"',  '"快速入门"'],
  ['"Recent activity"',           '"最近活动"'],
  ['"No recent activity"',        '"暂无活动记录"'],
  ['Run /init to create a CLAUDE.md file with instructions for Claude',
                                  '输入 /init 创建项目配置文件'],
  ['Best for everyday tasks',     '日常任务首选'],
  ['Best for complex tasks',      '复杂任务首选'],
  ['Fastest for quick answers',   '极速响应'],
  ['title:"Allow"',               'title:"允许"'],
  ['title:"Deny"',                'title:"拒绝"'],
  ['title:"Ask"',                 'title:"询问"'],
  ['title:"Enter plan mode?"',    'title:"进入规划模式？"'],
  ['title:"Exit plan mode?"',     'title:"退出规划模式？"'],
  ['"Update available! Run: "',   '"新版本可用！请运行: "'],
  ['"Starting new conversation"', '"开始新对话"'],
];

// ────────────────────────────────────────────────────────────
// STEP 2c: 遥测禁用
// ────────────────────────────────────────────────────────────
const TELEMETRY = [
  ["https://http-intake.logs.us5.datadoghq.com/api/v2/logs", "http://127.0.0.1:0/noop"],
  ["pubbbf48e6d78dae54bceaa4acf463299bf",  "disabled_dd"],
  ["sdk-zAZezfDKGoZuXXKe",                 "disabled_gb1"],
  ["sdk-xRVcrliHIlrg4og4",                 "disabled_gb2"],
  ["sdk-yZQvlplybuXjYh6L",                 "disabled_gb3"],
];

// ────────────────────────────────────────────────────────────
// STEP 2d: VISUALS — 欢迎框颜色 + 小图标
// ────────────────────────────────────────────────────────────
const rgb = `rgb(${BRAND_RGB[0]},${BRAND_RGB[1]},${BRAND_RGB[2]})`;
const VISUALS = [
  ['rgb(215,119,87)', rgb],        // claude 主色 / 欢迎框边框色
  ['rgb(245,149,117)', rgb],       // claudeShimmer（统一替换，减少遗漏）
  ['rgb(235,159,127)', rgb],
  ['#da7756', `#${BRAND_RGB.map(x => x.toString(16).padStart(2, '0')).join('')}`],
];

const LOGO_PRESETS = {
  default: {
    r1L: ' ▐', r1E: '▛███▜', r1R: '▌',
    r2L: '▝▜', r2R: '▛▘', feet: ' ▗   ▖ '
  },
  'look-left': {
    r1L: ' ▐', r1E: '▟███▟', r1R: '▌',
    r2L: '▝▜', r2R: '▛▘', feet: ' ▘   ▘ '
  },
  'look-right': {
    r1L: ' ▐', r1E: '▙███▙', r1R: '▌',
    r2L: '▝▜', r2R: '▛▘', feet: ' ▝   ▝ '
  },
  'arms-up': {
    r1L: '▗▟', r1E: '▛███▜', r1R: '▙▖',
    r2L: ' ▜', r2R: '▛ ', feet: ' ▗   ▖ '
  },
  'bot-mini': {
    r1L: '  ', r1E: '▗▛▜▖', r1R: '  ',
    r2L: ' ▐', r2R: '▌ ', feet: ' ▝▘▝▘ '
  },
  'pixel-cat': {
    r1L: '▗▘', r1E: '▛██▜', r1R: '▝▖',
    r2L: '▐ ', r2R: ' ▌', feet: '▝▚▞▘ '
  },
  'star': {
    r1L: '  ', r1E: ' ▟▙ ', r1R: '  ',
    r2L: '  ', r2R: '  ', feet: ' ▝▘▝▘ '
  }
};

const chosenLogo = LOGO_STYLE === 'custom' ? CUSTOM_LOGO : LOGO_PRESETS[LOGO_STYLE] || LOGO_PRESETS.default;
const LOGO = chosenLogo ? [
  ['r1L:" ▐",r1E:"▛███▜",r1R:"▌",r2L:"▝▜",r2R:"▛▘"', `r1L:"${chosenLogo.r1L}",r1E:"${chosenLogo.r1E}",r1R:"${chosenLogo.r1R}",r2L:"${chosenLogo.r2L}",r2R:"${chosenLogo.r2R}"`],
  ['default:" ▗   ▖ "', `default:"${chosenLogo.feet}"`],
] : [];

const allReplacements = [
  ...BRAND,
  ...(ENABLE_I18N ? I18N : []),
  ...TELEMETRY,
  ...VISUALS,
  ...LOGO,
];

let totalCount = 0;
for (const [from, to] of allReplacements) {
  let count = 0, idx = -1;
  while ((idx = code.indexOf(from, idx + 1)) !== -1) count++;
  if (count > 0) {
    code = code.split(from).join(to);
    totalCount += count;
    console.log(`    [${count}x] "${from.slice(0, 60)}${from.length > 60 ? '…' : ''}"`);
  }
}
console.log(`  [2/4] ${totalCount} replacements`);

// ────────────────────────────────────────────────────────────
// STEP 3: RESTORE — 还原占位符
// ────────────────────────────────────────────────────────────
// API 域名：按需替换为新端点
const newApiHost = API_BASE_URL
  ? API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
  : 'api.anthropic.com';
code = code.split('__P_API__').join(newApiHost);
code = code.split('__P_CON__').join('console.anthropic.com');

for (const [orig, ph] of PROTECTED) {
  if (ph !== '__P_API__' && ph !== '__P_CON__') {
    code = code.split(ph).join(orig);
  }
}
console.log(`  [3/4] Restored protected strings`);

// ────────────────────────────────────────────────────────────
// STEP 4: WRITE + VERIFY
// ────────────────────────────────────────────────────────────
fs.writeFileSync(CLI_PATH, code, 'utf-8');
console.log(`  [4/4] Written: ${originalSize} → ${code.length} bytes`);

// 完整性检查（失败则报 FATAL 并退出 1）
const MUST_EXIST = [
  ['claude-cli/',               'User-Agent'],
  ['@anthropic-ai/claude-code', 'Package name'],
  ['CLAUDE_CODE_ENTRYPOINT',    'Env var'],
  ['ANTHROPIC_API_KEY',         'API key env'],
  ['new Anthropic(',            'SDK constructor'],
];
let ok = true;
console.log('\n  完整性检查:');
for (const [s, label] of MUST_EXIST) {
  const found = code.includes(s);
  console.log(`    ${found ? '✓' : '✗'} ${label}`);
  if (!found) ok = false;
}
if (!ok) { console.error('\n  FATAL: 关键字符串丢失！请从备份恢复。'); process.exit(1); }

// 残留品牌扫描
const residual = (code.match(/(?<![\/\w\-\.@"'])Claude Code(?![\w])/g) || []).length;
console.log(`\n  残留 "Claude Code": ${residual === 0 ? '0 ✓' : residual + ' 处（请检查）'}`);

// 更新 package.json
if (fs.existsSync(PKG_PATH)) {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  pkg.name = `@${b.toLowerCase()}/cli`;
  pkg.description = `${b} - AI-Powered Development`;
  pkg.author = b;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
  console.log('  package.json updated');
}

console.log(`\n  完成！验证: node ${CLI_PATH} --version\n`);
