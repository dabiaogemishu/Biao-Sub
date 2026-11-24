# BiaoSUB

BiaoSUB 是自建的订阅聚合面板。把自建节点链接和机场订阅地址放进资源池，勾选、筛选、组合成一个聚合组，再拿到一条订阅地址。面板只跑在 Cloudflare Pages + D1 上，不用别的主机。

前端是 Vue 3、Vite、Pinia。后端是 Pages Functions 里的 Hono，接口都在 `/api`。登录只有一个管理密码，来自 Pages 的 `ADMIN_PASSWORD` 密钥，不写进仓库。

## 能做什么

- 导入自建节点，或拉取机场的远程订阅。远程刷新成功后才会替换节点，刷新前的内容留在 `snapshot`。解析失败或拉取失败时，原来的节点和聚合组引用不动。只有删除资源时，才会把它从聚合组里拿掉。
- 一个聚合组可以挑选多个资源、按名称或序号筛选、拖拽排序。
- 三种模板：
  - **默认模板**：带预设的 Clash 头部、名为 `Proxy` 的选择策略组（使用全部已选节点）和一套规则。
  - **空白模板**：没有那套长头部。保存后仍是一份能用的配置：已选节点、名为 `Proxy` 的选择组，以及 `MATCH,Proxy`。
  - **托管 YAML**：保留上传文件里的头部、`proxy-groups` 和 `rules`，并把当前已选节点写进 `proxies`。同名代理用已选节点替换，上传文件里其余代理保留，新节点追加在后面。空的策略组，或带 `include-all` / `use-all-proxies` 的策略组，会填上这些已选节点名。已经写明成员的策略组保持原样。
- 系统设置里可以导出、导入备份。恢复默认是覆盖；请求体里带 `"mode": "append"` 才追加。覆盖时保留原来的数字 id，聚合组里的资源引用还在。
- **链式代理**写在聚合组已选资源上，输出到 Clash 的 `dialer-proxy`。目标可以是策略组，也可以是另一个已选节点。保存时会拒绝空目标、不存在的名字和自己指向自己。Base64 分享链接仍然是普通 URI，**不含链式**。组里启用了链式时，面板会提示这一点。

## 协议和导入、输出

支持这些分享链接，并转成 Clash Meta 代理：

| 协议 | 说明 |
| --- | --- |
| Shadowsocks | SIP002、旧版整段 Base64。加密方法按链接原样保留，包括 `2022-blake3-aes-128-gcm` 这类 2022 套件。插件支持 `obfs` / `obfs-local` 和 `v2ray-plugin`。 |
| ShadowsocksR | `ssr://` |
| VMess | JSON 的 Base64，以及带查询参数的 URL |
| VLESS | TLS、Reality。传输包括 TCP、WebSocket、gRPC、HTTPUpgrade、XHTTP |
| Trojan | TLS，可带传输 |
| Hysteria2 | `hysteria2://`、`hy2://`、`hy://` |
| Hysteria v1 | `hysteria://` |
| TUIC | UUID + 密码，或 token |
| AnyTLS | `anytls://` |

认不出的协议或残缺字段会返回明确错误，不会变成一个空节点。一份订阅里只有几条坏链接时，好的留下，坏的出现在错误列表里。不支持 WireGuard，也不执行订阅里的脚本。

导入可以是 Clash Meta YAML、标准 Base64 节点列表，或一行一个的原始 URI。

公开订阅用聚合组的 **16 位 token**，不是数字 id。`/api/g/64` 这种数字路径会 404，正文是「订阅不存在」。

```
https://<项目名>.pages.dev/api/g/<group-token>                 Clash Meta YAML（默认）
https://<项目名>.pages.dev/api/g/<group-token>?format=base64   v2rayN 用的标准 Base64（A-Za-z0-9+/，保留 = 填充）
```

`format=clash` 或 `format=yaml` 与默认相同。两种输出使用同一套筛选和重名处理。重名会变成 `香港`、`香港 1`。

管理接口要先登录。服务端用 `ADMIN_PASSWORD` 签发 12 小时的会话令牌，浏览器只放在 `sessionStorage`，关掉标签页就没了。`/api/g/<group-token>` 不需要管理登录。

## 部署到 Cloudflare

下面按第一次部署的人来写。仓库只使用 Pages 和 D1。`functions/api/[[route]].js` 是接口入口，绑定名必须是 `DB`，代码读的是 `env.DB`。

本仓库的 `wrangler.toml` 已经有这些字段：

- `name`：Pages 项目名
- `pages_build_output_dir = "dist"`
- `compatibility_date`
- `[[d1_databases]]`，其中 `binding = "DB"`

`database_name` 和 `database_id` 必须改成**你自己账号里**那只 D1 的名字和 UUID。文件里如果还是别人的 id，或是 `00000000-0000-0000-0000-000000000000`，发布会失败。不要把 `ADMIN_PASSWORD` 写进这个文件或任何提交。

因为文件里有 `pages_build_output_dir`，Pages 会把这份 Wrangler 配置当作项目配置。`database_id` 写错时，构建日志里的发布阶段会报 **Error 8000022: Invalid database UUID**。

### 准备

1. 一个 Cloudflare 账号。用浏览器打开 [Cloudflare 控制台](https://dash.cloudflare.com/) 并登录。
2. 一台装了 Git 和 Node.js 的电脑。本仓库没有 `.nvmrc`，也没有 `engines`。Pages 当前 v3 构建镜像默认是 Node.js 22，足够跑 Vite 5。本机建议也用 Node.js 18 或更高。检查：

   ```bash
   node -v
   npm -v
   git --version
   ```

3. 拿到这份代码。连接到 GitHub 自动部署时，用你自己的仓库（fork 或导入均可），默认分支是 `main`。本机手动部署时：

   ```bash
   git clone https://github.com/<你的账号>/Biao-Sub.git
   cd Biao-Sub
   npm install
   ```

   `npm install` 按 `package-lock.json` 安装依赖。仓库没有把 Wrangler 写进 `package.json`，后面的 Wrangler 命令用 `npx wrangler@latest`，第一次运行会下载它。

4. 确认能在本机构建（这一步不连 Cloudflare）：

   ```bash
   npm test
   npm run build
   ```

   `npm run build` 就是 `vite build`，产物在 `dist/`。`vite.config.js` 里的 `outDir` 和 `wrangler.toml` 的 `pages_build_output_dir` 都是 `dist`。

### 创建 D1，并写入 `database_id`

两种方式都可以。绑定名不要改，必须是 `DB`。

**用 Wrangler：**

1. 在仓库目录登录，浏览器会打开授权页。完成后看当前账号：

   ```bash
   npx wrangler@latest login
   npx wrangler@latest whoami
   ```

   `whoami` 会打印账号名称。如果不是你要部署的那个账号，换账号重新 `login`。

2. 创建数据库。`<DATABASE_NAME>` 换成你起的名字，只用字母、数字和短横线，短于 32 个字符，例如 `biaosub-db`：

   ```bash
   npx wrangler@latest d1 create <DATABASE_NAME>
   ```

   成功时输出里有一段 `d1_databases`，其中 `database_id` 是一串 UUID。这就是后面要填的 `<D1_DATABASE_ID>`。控制台 [D1](https://dash.cloudflare.com/) 里点开这只库，概览页也能看到同一个 Database ID。

   如果提示 `Would you like Wrangler to add it on your behalf?`，选 **No**。自动写入的 `binding` 往往不是 `DB`。这个项目的代码只认 `DB`。

**用控制台：**

1. 打开 [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)，左侧进入 **D1 SQL database**（Storage → D1）。
2. **Create Database**，填写名字，可选位置提示，再 **Create**。
3. 点进新建的库，复制 Database ID。

然后编辑仓库根目录的 `wrangler.toml`，只改名字和 id，`binding` 保持 `DB`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "<DATABASE_NAME>"
database_id = "<D1_DATABASE_ID>"
```

把 `name = "..."` 改成你即将创建的 Pages 项目名。项目名会变成 `https://<项目名>.pages.dev`。

表不用先手工建。第一次有请求打到 `/api` 时，`functions/api/[[route]].js` 会执行 `CREATE TABLE IF NOT EXISTS`，并忽略「列已存在」的 `ALTER`。仓库里的 `schema.sql` 是同一套语句。想提前在远程库执行时：

```bash
npx wrangler@latest d1 execute <DATABASE_NAME> --remote --file=./schema.sql
```

新建库上，文件后半段的 `ALTER TABLE ... ADD COLUMN` 会报 `duplicate column name`，因为 `CREATE TABLE` 已经包含这些列。看到这个错误可以停在这里，表已经在。线上函数遇到同样的错误会忽略并继续。

### A. 把 GitHub 仓库接到 Pages，`main` 自动部署

先把改好的 `wrangler.toml` 提交并推到你的 `main`。不要提交密码。

1. 控制台打开 [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)。
2. **Create application** → **Pages** → **Connect to Git**。
3. 选 GitHub。按提示安装并授权 Cloudflare Pages。仓库列表里只会出现你的 GitHub 用户有权访问的仓库。选中这份 Biao-Sub 仓库。
4. **Install & Authorize**，然后 **Begin setup**。
5. 在 **Set up builds and deployments** 里填写：
   - **Project name**：与 `wrangler.toml` 的 `name` 相同。
   - **Production branch**：`main`。下拉框里要先有这个分支，所以 `main` 必须已经推到 GitHub。
   - **Framework preset**：选 **Vue**。它的默认值就是本仓库要的设置。若没有这个预设，就手填下面两项。
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
   - **Root directory**：留空。代码在仓库根目录，不是 monorepo 子目录。
6. 这个仓库没有 `.nvmrc` 或 `.node-version`。使用 Pages v3 构建镜像时不必再设 Node 版本。如果构建日志里的 Node 低于 18，到 **Settings → Variables and Secrets** 加一个普通变量（不要 Encrypt）：名称 `NODE_VERSION`，值 `22`，生产环境和预览环境都加，然后重新部署。
7. **Save and Deploy**。等构建日志走完 `npm install` 和 `npm run build`，部署成功后会给出 `https://<项目名>.pages.dev`。

构建成功只说明静态文件上传了。还要把 D1 和密码接到**同一次会对外服务的部署**上。`pages_build_output_dir` 已经在 `wrangler.toml` 里，D1 以文件中的 `database_id` 为准。控制台再绑一次，避免只改了其中一处：

8. 进入该 Pages 项目 → **Settings** → **Bindings** → **Add** → **D1 database bindings**。
9. **Variable name** 填 `DB`（大小写一致）。**D1 database** 选刚才创建的那只库。生产环境（Production）和预览环境（Preview）都做一遍。文档要求绑定之后重新部署才会生效。
10. **Settings** → **Variables and Secrets** → **Add**。名称填 `ADMIN_PASSWORD`，值填你自己定的管理密码。点 **Encrypt**，再 **Save**。生产和预览都要设。设完之后再部署一次，当前线上版本才会带上这个密钥。
11. **Deployments** 里打开最新的一次失败或成功的部署，**Retry deployment**，或往 `main` 再推一次提交。等到状态成功，再打开网站。

以后每次把提交推到 `main`，Pages 都会自动再构建并发布生产环境。其他分支是预览部署。

用 Git 集成创建的项目，不能再改成纯 Direct Upload。若不想每次推送都构建，可以在项目设置里关掉全部分支的自动部署，之后改用下面的 Wrangler 命令发布。

### B. 不接 Git，在本机用 Wrangler 发布

做完上面的「准备」和「创建 D1」，并且 `npm run build` 已经生成 `dist/`。

1. 创建 Pages 项目。`<PROJECT_NAME>` 与 `wrangler.toml` 的 `name` 相同，生产分支用 `main`：

   ```bash
   npx wrangler@latest pages project create <PROJECT_NAME> --production-branch main
   ```

2. 写入管理密码。命令会提示你输入，密码不会出现在命令行参数里。不要把密码写进 shell 历史可以保留的位置，更不要提交：

   ```bash
   npx wrangler@latest pages secret put ADMIN_PASSWORD --project-name <PROJECT_NAME>
   ```

   密钥要在使用它的那次部署之前写好。如果先部署再写密钥，写完后再执行一次下面的 deploy。

3. 发布。`dist` 是构建输出目录；`--branch main` 对应上一步的生产分支：

   ```bash
   npx wrangler@latest pages deploy dist --project-name <PROJECT_NAME> --branch main
   ```

   成功时终端会打印 `https://<PROJECT_NAME>.pages.dev`。

`wrangler.toml` 里的 `[[d1_databases]]` 会在这次发布里带上 `DB` 绑定。`binding` 必须是 `DB`，`database_id` 必须是第 2 步复制的 UUID。

### 第一次登录并做出订阅

1. 浏览器打开 `https://<PROJECT_NAME>.pages.dev`。
2. 页面中央是登录卡，提示「请输入管理密码」。输入 `ADMIN_PASSWORD` 的值，点 **登录**。空密码会在按钮下写出「请输入密码」，不会发请求。密码不对时提示「密码错误」。
3. 登录后默认在 **资源池**。添加一条自建节点链接，或一个机场订阅地址。
4. 打开 **聚合订阅组** → **新建聚合组**。先选模板（默认、空白或托管 YAML），填写组名，勾选资源，需要的话打开链式并选择策略组或其他节点，再 **创建**。
5. 卡片上 **Clash（默认）** 复制的是 `https://<PROJECT_NAME>.pages.dev/api/g/<16位token>`。**Base64** 复制的是同一地址加上 `?format=base64`。把 Clash 地址填进 Clash Meta / Mihomo。启用了链式时，卡片上会写明 Base64 不含链式。

### 以后怎么更新

- **已连接 GitHub：** 把改动合并进 `main` 并推送。Pages 的生产部署会跟着这次提交重建。进度在项目的 **Deployments**。
- **本机手动：** 拉下最新代码后重新构建并发布：

  ```bash
  git pull
  npm install
  npm run build
  npx wrangler@latest pages deploy dist --project-name <PROJECT_NAME> --branch main
  ```

改了 `ADMIN_PASSWORD` 或 D1 绑定之后，也要再部署一次，正在服务的那一版才会用上新配置。

### 常见失败

**发布报 Error 8000022: Invalid database UUID。**  
`wrangler.toml` 的 `database_id` 不是你账号里真实的 D1 UUID。全 0 的 `00000000-0000-0000-0000-000000000000` 一定会这样。把 `npx wrangler d1 create` 输出的 `database_id`，或 D1 控制台里的 Database ID，写进 `database_id`，`binding` 仍是 `DB`，提交或保存后再部署。

**`d1 create`、`pages project create` 或 `pages deploy` 报 403，或提示当前令牌不能编辑 Pages / D1。**  
`npx wrangler whoami` 看是不是正确的账号。OAuth 登录的账号需要能创建 D1 和 Pages。若改用 API 令牌，在控制台 **My Profile → API Tokens** 创建令牌，至少包含 Cloudflare Pages 的编辑权限和 D1 的编辑权限（读写），再在当前终端设置 `CLOUDFLARE_API_TOKEN` 后重试。令牌值不要写进仓库。`CLOUDFLARE_API_TOKEN` 会优先于 `wrangler login` 保存的登录态。

**打开网站后登录失败，接口返回「服务端未配置 ADMIN_PASSWORD」。**  
生产环境的密钥没设，或只设在预览环境，或密钥是在当前这次部署之后才加的。按上面的控制台步骤对 Production 加密保存 `ADMIN_PASSWORD`，或再跑一次 `npx wrangler pages secret put ADMIN_PASSWORD --project-name <PROJECT_NAME>`，然后重新部署。密码本身错误时，页面提示的是「密码错误」，不是这一句。

**能登录，但添加资源或聚合组失败，日志里没有 `DB`。**  
绑定名不是 `DB`，或绑定只加在预览环境。改成 `DB` 并选中你的 D1，生产和预览都保存，再重新部署。

## 本地检查

不需要 Cloudflare 账号：

```bash
npm install
npm test
npm run build
```
