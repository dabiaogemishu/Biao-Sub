# BiaoSUB

把自建节点和机场订阅收进一个资源池，自己挑选后生成一条聚合订阅。聚合链接默认是 Clash Meta YAML，加上 `?format=base64` 就是 v2rayN 能导入的标准 Base64。

部署只使用 Cloudflare Pages 和 D1。面板语言是中文。解析器是本仓库自己写的，按协议拆开，许可证保持 MIT，不是 Sub-Store，也不是 AGPL。

## 支持的协议和传输

| 协议 | 分享链接 | Clash Meta |
| --- | --- | --- |
| Shadowsocks | SIP002、旧版整段 Base64、`obfs` / `v2ray-plugin` | `ss` + `plugin` |
| ShadowsocksR | `ssr://` | `ssr` |
| VMess | JSON Base64，以及带查询参数的 URL | `vmess` |
| VLESS | Reality、TLS、TCP | `vless` |
| Trojan | TLS，可带传输 | `trojan` |
| Hysteria2 | `hysteria2://`、`hy2://`、`hy://` | `hysteria2` |
| Hysteria | `hysteria://` | `hysteria` |
| TUIC | UUID + 密码，或 token | `tuic` |
| AnyTLS | `anytls://` | `anytls` |

传输覆盖 TCP、WebSocket、gRPC、HTTP、HTTP/2、HTTPUpgrade、xhttp。Clash Meta 里的 HTTPUpgrade 写成 `network: ws` 加 `ws-opts.v2ray-http-upgrade: true`，分享链接仍是 `type=httpupgrade`。

认不出的协议或残缺字段会返回明确错误，不会静默丢成一个空节点。一份订阅里如果只是其中几条坏了，好的会留下，坏的会出现在错误列表里。

## 订阅链接

```
https://<你的域名>/api/g/<token>                  Clash Meta YAML
https://<你的域名>/api/g/<token>?format=clash     同上
https://<你的域名>/api/g/<token>?format=base64    标准 Base64（A-Za-z0-9+/，保留 = 填充）
```

两种输出使用同一套 `include` 筛选和重名处理。重名会变成 `香港`、`香港 1`。筛选为空表示该资源里的节点全要。

## 和旧数据的关系

表还是 `subscriptions`、`groups`、`templates`。原来的节点链接、`config.include`、`selectedNodes`、`clash_config`（含托管 YAML）、模板和远程订阅的 `source_url` / `params.ua` 会继续用。

第一次请求时会自动补这些列，已有列不会被重写：

- `subscriptions.source_url`
- `subscriptions.params`
- `subscriptions.snapshot`（远程刷新前的上一份节点列表）
- `groups.cached_yaml`
- `groups.access_count`
- `groups.last_accessed`

完整语句在 `schema.sql`。备份恢复默认先清空再写入，并保留原来的数字 id，所以聚合组里的资源引用还在。请求体里带 `"mode": "append"` 才会追加。

远程刷新只在新内容解析出节点之后才替换 `url`，替换前把旧内容写入 `snapshot`。解析失败或拉取失败时，原来的节点和组内引用都不动。只有删除资源时才会把该资源从聚合组里拿掉。

## 部署

线上的 Pages 项目 `biaosub`（`biaosub.pages.dev`）和 D1 `biaosub-db` 已经绑定为 `DB`，生产分支是 `main`，`ADMIN_PASSWORD` 也已经在 Pages 的变量里。这个仓库里的 `wrangler.toml` 只给本地预览用，`database_id` 是占位符。不要把密码写进仓库，也不要拿这个文件去改线上绑定。合并到 `main` 之后，Pages 会按原来的项目设置构建：

- 构建命令：`npm run build`
- 输出目录：`dist`
- D1 绑定名：`DB`

新环境才需要自己建 D1、在控制台执行 `schema.sql`，再在 Pages 里绑定 `DB` 并设置 `ADMIN_PASSWORD`。

本地测试不需要账号：

```bash
npm install
npm test
npm run build
```

## 鉴权

管理接口要登录。服务端用 `ADMIN_PASSWORD` 签发一个 12 小时的会话令牌，浏览器只把它放在 `sessionStorage`，关掉标签页就没了。明文密码不会再写入 `localStorage`。订阅地址 `/api/g/<token>` 不走管理登录。接口默认不返回 CORS 头。

## 限制

- 只能跑在 Cloudflare Pages Functions 上。机场如果屏蔽 Cloudflare 出口，远程刷新会失败，可以把订阅内容手动粘进节点组。
- 不支持 WireGuard，以及其他没有列在上面的协议；这类条目会报错。
- 不执行订阅里的脚本，也不做 Sub-Store 那种流程转换。
- 托管 YAML 模式原样返回 Clash 配置。Base64 会尽量从里面的 `proxies` 导出分享链接。
- `dialer-proxy` 只出现在 Clash 输出里，Base64 里没有对应字段，但节点集合和名称一致。
- xhttp 的冷门调优字段会放进 `xhttp-opts` 往返；分享链接里额外参数放在 `extra`。
