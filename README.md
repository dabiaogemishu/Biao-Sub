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
https://<PROJECT_NAME>.pages.dev/api/g/<group-token>                 Clash Meta YAML（默认）
https://<PROJECT_NAME>.pages.dev/api/g/<group-token>?format=base64   v2rayN 用的标准 Base64（A-Za-z0-9+/，保留 = 填充）
```

`format=clash` 或 `format=yaml` 与默认相同。两种输出使用同一套筛选和重名处理。重名会变成 `香港`、`香港 1`。

管理接口要先登录。服务端用 `ADMIN_PASSWORD` 签发 12 小时的会话令牌，浏览器只放在 `sessionStorage`，关掉标签页就没了。`/api/g/<group-token>` 不需要管理登录。

## 用网页部署到 Cloudflare

推荐全程用浏览器完成。你需要一个 Cloudflare 账号，以及 GitHub 上属于你的一份代码（自己的仓库，或从原仓库 Fork 出来），默认分支是 `main`。不用安装 Node.js，不用打开终端。

控制台语言跟着账号设置走。下面用 Cloudflare 文档里的英文按钮名；账号是中文时，括号里是常见译名，按位置点同一个按钮即可。

这个程序只认 Cloudflare Pages + D1。接口入口是 `functions/api/[[route]].js`，数据库绑定名必须是 `DB`（代码读 `env.DB`）。仓库根目录的 `wrangler.toml` 里已经有 `pages_build_output_dir = "dist"` 和 `[[d1_databases]]`。因为有 `pages_build_output_dir`，Pages 把这个文件当作项目配置。只在控制台里绑一次 D1 不够：文件里的 `database_id` 必须是**你自己这只库**的 UUID。还是别人的 id，或是 `00000000-0000-0000-0000-000000000000`，发布阶段会报 **Error 8000022: Invalid database UUID**。密码不要写进这个文件。

先想好两个名字，后面两处要填成同一套：

- `<PROJECT_NAME>`：Pages 项目名。只用小写字母、数字和短横线。它会变成 `https://<PROJECT_NAME>.pages.dev`。文件里现在的 `name` 是原站点用的，新建时请换成你自己的，并和后面的 Project name 完全一致。
- `<DATABASE_NAME>`：D1 的名字。字母、数字和短横线，短于 32 个字符，例如 `biaosub-db`。

### 1. 在 GitHub 网页上拿到自己的仓库

1. 浏览器打开 <https://github.com/dabiaogemishu/Biao-Sub>。
2. 这是原仓库。你没有写权限时，右上角点 **Fork**。
3. Owner 选你自己的 GitHub 账号。仓库名可以保持 `Biao-Sub`。点 **Create fork**。
4. 完成后地址是 `https://github.com/<你的用户名>/Biao-Sub`。左上角分支下拉框应显示 `main`。没有 `main` 就不要继续，Pages 的生产分支必须先存在于 GitHub 上。

已经有自己的仓库、并且 `main` 上是这份代码时，跳过 Fork，直接打开那个仓库。

### 2. 在控制台创建 D1，并复制 Database ID

1. 打开 <https://dash.cloudflare.com/> 并登录。
2. 若账号下有多个账户，先在左上角选中要用来部署的那一个。后面的 D1 和 Pages 必须在同一个账户里。
3. 打开 <https://dash.cloudflare.com/?to=/:account/workers-and-pages>。左侧 **Storage**（存储）里点 **D1 SQL database**（D1）。有的账号从 Workers & Pages 页面的侧栏就能看到 D1。
4. 点 **Create Database**（创建数据库）。
5. 名字填 `<DATABASE_NAME>`。Location hint（位置提示）可以不填。点 **Create**（创建）。
6. 创建完成后会进入这只库的概览页。找到 **Database ID**，它是一串 `8-4-4-4-12` 形式的 UUID。复制下来，这就是 `<D1_DATABASE_ID>`。不要用全 0 的占位符。

表不用在网页里手工建。站点第一次收到 `/api` 请求时，`functions/api/[[route]].js` 会自己 `CREATE TABLE`。`schema.sql` 只是同一套语句的存档，网页部署不用执行它。

### 3. 在 GitHub 网页上改 `wrangler.toml`

还是在你自己的仓库里，分支保持 `main`。

1. 在文件列表里点开根目录的 `wrangler.toml`（不要点进子目录）。
2. 右上角点铅笔图标 **Edit this file**（编辑此文件）。看不到铅笔、页面只让你 Fork，说明当前仓库你不能直接改，回到第 1 步用自己的 Fork。
3. 只改三处，其余行不要动：
   - `name = "..."` 改成 `name = "<PROJECT_NAME>"`
   - `database_name = "..."` 改成 `database_name = "<DATABASE_NAME>"`，和第 2 步创建时填的名字一致
   - `database_id = "..."` 改成 `database_id = "<D1_DATABASE_ID>"`，粘贴刚才复制的 Database ID
4. `binding = "DB"` 保持这两个字，不要改成别的名字。`pages_build_output_dir = "dist"` 也保持不动。
5. 不要在这个文件里写 `ADMIN_PASSWORD`，也不要把密码写进提交说明。
6. 右上角点 **Commit changes...**（提交更改）。对话框里：
   - 提交说明可以写成 `set D1 database id`
   - 选中 **Commit directly to the `main` branch**（直接提交到 `main` 分支）。不要选创建新分支。
   - 再点 **Commit changes**。
7. 提交后页面回到文件内容。核对三行已经是你的项目名、库名和 UUID，并且 `binding = "DB"` 还在。

改完之前不要去连接 Pages。文件里的 id 还是别人的或是全 0 时，第一次发布就会在日志里失败。

### 4. 把仓库连接到 Pages

1. 回到 Cloudflare，打开 <https://dash.cloudflare.com/?to=/:account/workers-and-pages>。确认左上角仍是第 2 步那个账户。
2. 点 **Create application**（创建应用程序）。
3. 选择 **Pages** 这一页，再点 **Connect to Git**（连接到 Git）。不要选 Direct Upload（直接上传）。用 Git 创建之后，不能再改成 Direct Upload。
4. 选 **GitHub**。第一次会跳到 GitHub：
   - 安装 **Cloudflare Workers & Pages** 这个 GitHub App。账户选你的用户（或拥有该仓库的组织）。
   - Repository access 选 **All repositories**（所有仓库），或 **Only select repositories**（仅选定的仓库）并勾上你的 `Biao-Sub`。
   - 点 **Install & Authorize**（安装并授权）。这是安装和授权两步，GitHub 会分开展示。授权只代表「你是谁」，安装才决定「能看见哪些仓库」。
5. 回到 Cloudflare 后，账户列表里应有你的 GitHub 账号。点进账号，仓库列表里选你的 `Biao-Sub`。列表只显示当前 GitHub 用户有权访问、并且 App 已被授权的仓库。
6. 选中仓库后点 **Begin setup**（开始设置）。

列表里没有这个仓库时：

- 点 **Add GitHub account**（添加 GitHub 账户，按钮上可能是 `+`）。对拥有仓库的那个 GitHub 账号或组织再安装一次 App，并在 Only select repositories 里勾上它。
- 组织仓库还要求你是 Owner，或有 GitHub App manager 角色，否则安装按钮不可用。
- 你的 GitHub 账号根本不在列表里：打开 <https://github.com/settings/apps/authorizations>，找到 Cloudflare Workers & Pages，点 **Revoke**（撤销），再从第 4 步重新连接。换 GitHub 登录用户时也是这一步。
- App 已安装但仍看不到仓库：打开 <https://github.com/settings/installations>，点 Cloudflare Workers & Pages 的 **Configure**（配置）。Repository access 改成包含这个仓库，保存后再回到 Cloudflare 刷新列表。组织账号先在 GitHub 右上角 **Switch settings context**（切换设置上下文）到该组织，或打开 `https://github.com/organizations/<组织名>/settings/installations`。

### 5. 填写构建设置并做第一次部署

进入 **Set up builds and deployments**（设置构建和部署）后，按下面填。框架预设选 **Vue** 时，构建命令和输出目录会自动变成这套，和本仓库一致；预设列表里没有 Vue 就手填。

| 字段 | 填什么 |
| --- | --- |
| Project name（项目名称） | `<PROJECT_NAME>`，与 `wrangler.toml` 的 `name` 完全相同 |
| Production branch（生产分支） | `main`。下拉里没有 `main`，说明 GitHub 上还没有这个分支，回到第 1 步 |
| Framework preset（框架预设） | Vue |
| Build command（构建命令） | `npm run build` |
| Build output directory（构建输出目录） | `dist` |
| Root directory (advanced) → Path（根目录） | 留空。代码在仓库根目录 |

`npm run build` 就是 `vite build`，产物目录是 `dist`，和 `pages_build_output_dir` 一致。这一页先不要填 `ADMIN_PASSWORD`。

点 **Save and Deploy**（保存并部署）。

接下来是构建日志页：Pages 会安装依赖、执行 `npm run build`，再发布。成功时给出 `https://<PROJECT_NAME>.pages.dev`。点 **Continue to project**（继续前往项目）进入项目首页。这里能看到生产环境网址、对应的提交，以及部署列表。

这次成功只说明静态页面上传了。绑定和密钥还没进「正在对外服务的那一次部署」。先做完第 6、7 步，再按第 8 步重新部署，然后才去打开网站登录。

项目名已被占用时，这一页不会让你保存。另选一个 `<PROJECT_NAME>`，回到 GitHub 把 `wrangler.toml` 的 `name` 改成同一个字符串，直接提交到 `main`，再用新名字创建。

### 6. 把 D1 绑成 `DB`（生产和预览各一次）

1. 在该 Pages 项目里打开 **Settings**（设置）→ **Bindings**（绑定）。
2. 先选 **Production**（生产环境）。点 **Add**（添加）→ **D1 database bindings**（D1 数据库绑定）。
3. **Variable name**（变量名称）填 `DB`，三个字母都大写。**D1 database** 选第 2 步创建的那只库，不要选账户里其他库。保存。
4. 切到 **Preview**（预览环境），用同样的变量名 `DB` 和同一只库再添加一次。

其他分支的部署是预览环境，不会替换 `https://<PROJECT_NAME>.pages.dev`。绑定只加在一边时，另一边的接口没有 `env.DB`。

控制台绑定不能代替 `wrangler.toml`。文件里的 `database_id` 仍然必须是这只库的 UUID，`binding` 仍然必须是 `DB`。

### 7. 设置加密的 `ADMIN_PASSWORD`（生产和预览各一次）

1. 仍在 **Settings**，打开 **Variables and Secrets**（变量和机密）→ **Add**（添加）。
2. 环境选 **Production**。变量名填 `ADMIN_PASSWORD`。值填你自己定的管理密码。
3. 点 **Encrypt**（加密），再 **Save**（保存）。加密后不能再查看原文。不要只存成普通变量。
4. 再添加一次，环境选 **Preview**，变量名、密码相同，同样 Encrypt 后 Save。

密钥必须在「使用它的那次部署」之前就存在。只保存、不重新部署时，线上仍是旧版本，登录会返回「服务端未配置 ADMIN_PASSWORD」。

### 8. 重新部署，让绑定和密钥生效

1. 打开项目的 **Deployments**（部署）。
2. 点开最新的一次生产部署（分支是 `main`）。失败或成功都可以。
3. 点 **Retry deployment**（重试部署）。
4. 等状态变成成功。构建日志里不应再出现 Error 8000022。

Retry 使用同一次提交再构建。绑定和密钥是在这次重试之前保存的，所以这次部署会带上它们。若你是改完 `wrangler.toml` 才失败的，先确认 GitHub 上 `main` 已有新提交；推到 `main` 会自动开一次新的生产部署，不必再靠 Retry。

构建日志里如果 Node.js 低于 18：回到 **Settings → Variables and Secrets**，为 Production 和 Preview 各加一个**不加密**的变量，名称 `NODE_VERSION`，值 `22`。本仓库没有 `.nvmrc`。Pages 当前的 v3 构建镜像默认就是 Node.js 22，一般不用加。加完后再 Retry deployment。

### 9. 第一次登录，并做出订阅

1. 浏览器打开 `https://<PROJECT_NAME>.pages.dev`。刚部署完若打不开，等一分钟再试，或换一个网络。这是 `*.pages.dev` 的域名还没在你这边解析开，不是构建失败。
2. 页面中央是登录卡，提示「请输入管理密码」。输入第 7 步的密码，点 **登录**。
   - 什么都没输入就点登录：按钮下方显示「请输入密码」，不会发请求。
   - 密码不对：提示「密码错误」。
   - 提示「服务端未配置 ADMIN_PASSWORD」：生产环境没加密保存这个变量，或保存之后没有重新部署。回到第 7、8 步。
3. 登录后默认在 **资源池**。添加一条自建节点链接，或一个机场订阅地址。
4. 打开 **聚合订阅组** → **新建聚合组**。先选模板（默认、空白或托管 YAML），填写组名，勾选资源。需要链式时打开它，并选择策略组或其他已选节点，再 **创建**。
5. 卡片上 **Clash（默认）** 复制的是 `https://<PROJECT_NAME>.pages.dev/api/g/<16位token>`。**Base64** 复制的是同一地址加上 `?format=base64`。把 Clash 地址填进 Clash Meta / Mihomo。启用了链式时，卡片上会写明 Base64 不含链式。

### 以后怎么更新

- 改代码或 `wrangler.toml`：在 GitHub 网页上改文件，**Commit directly to the `main` branch**。Pages 会自动开始一次新的生产部署。进度看项目的 **Deployments**，对应提交应是你刚提交的那条。用自己电脑的 Git 把提交推进 `main` 也一样。
- 只改了绑定或 `ADMIN_PASSWORD`、代码没变：到 **Deployments**，打开最新的生产部署，点 **Retry deployment**。不重试的话，正在服务的仍是上一版。
- 提交到 `main` 以外的分支，得到的是预览部署，地址不是生产用的 `pages.dev` 根域名，也不会换掉生产站点。
- 提交说明以 `[CF-Pages-Skip]`、`[Skip CI]` 或 `[CI Skip]` 开头时，Pages 会跳过这一次部署。

用 Git 连接创建的项目，以后不能改成 Direct Upload。若不想每次推送都构建，可以在 **Settings → Builds** 里关掉生产分支的自动部署；那之后要更新线上，就得改用文末的 Wrangler。

### 常见失败

**构建日志出现 Error 8000022: Invalid database UUID。**  
`wrangler.toml` 的 `database_id` 不是你这个 Cloudflare 账户里那只 D1 的 UUID。全 0 的 `00000000-0000-0000-0000-000000000000` 一定会这样。打开 D1 概览页，复制 Database ID。到 GitHub 编辑 `wrangler.toml`，只替换 `database_id`（名字不对就一起改 `database_name`），`binding` 仍是 `DB`，直接提交到 `main`。等自动部署完成，或到 **Deployments** 看这次新提交的结果。

**连接 Git 时看不到仓库，或列表里没有你的 GitHub 账号。**  
Cloudflare Workers & Pages 这个 GitHub App 没装到拥有仓库的账号上，或安装时没勾这个仓库。按第 4 步的 **Add GitHub account**、**Install & Authorize**，或到 <https://github.com/settings/installations> 里 **Configure**，把仓库加进 Repository access。组织仓库要有 Owner 或 GitHub App manager 权限。改完后回到 Cloudflare 刷新仓库列表，不用改代码。

**登录提示「服务端未配置 ADMIN_PASSWORD」。**  
生产环境的密钥没设，只设在 Preview，或设完后没有重新部署。到 **Settings → Variables and Secrets**，确认 Production 里有加密的 `ADMIN_PASSWORD`，Preview 也同样有。然后 **Deployments** → 打开最新生产部署 → **Retry deployment**。密码填错时页面写的是「密码错误」，空着提交时写的是「请输入密码」，都不是这一句。

**能打开页面，但添加资源或聚合组失败。**  
绑定变量名不是 `DB`，或只绑在 Preview 上。到 **Settings → Bindings**，Production 和 Preview 都是变量名 `DB`、选中你的那只 D1。同时确认 GitHub 上 `binding = "DB"`。保存后再 **Retry deployment**。

**构建失败，日志里的 Node.js 低于 18。**  
**Settings → Variables and Secrets** 为 Production 和 Preview 添加普通变量（不要点 Encrypt）：`NODE_VERSION` = `22`。再 **Retry deployment**。

## 可选：用 Wrangler 命令行部署

只有本机已经装了 Node.js、并且你更想用终端时才看这一节。网页步骤不需要这些命令。

```bash
git clone https://github.com/<你的用户名>/Biao-Sub.git
cd Biao-Sub
npm install
npx wrangler@latest login
npx wrangler@latest whoami
npx wrangler@latest d1 create <DATABASE_NAME>
```

`d1 create` 成功时会打印 `database_id`，那就是 `<D1_DATABASE_ID>`。若问 `Would you like Wrangler to add it on your behalf?`，选 **No**，以免它写成不是 `DB` 的绑定名。然后手工改 `wrangler.toml`：`name` 为 `<PROJECT_NAME>`，`database_name` 为 `<DATABASE_NAME>`，`database_id` 为刚打印的 UUID，`binding` 保持 `DB`。

```bash
npm run build
npx wrangler@latest pages project create <PROJECT_NAME> --production-branch main
npx wrangler@latest pages secret put ADMIN_PASSWORD --project-name <PROJECT_NAME>
npx wrangler@latest pages deploy dist --project-name <PROJECT_NAME> --branch main
```

`pages secret put` 会提示你输入密码，不要把密码写进命令参数。密钥要在 `pages deploy` 之前写好；如果顺序反了，写完再部署一次。`npm test` 只在本机检查解析和输出，不需要 Cloudflare 账号。

命令报 403、或提示令牌不能编辑 Pages / D1 时，`whoami` 先确认账户。改用 API 令牌的话，在控制台 **My Profile → API Tokens** 新建令牌，至少包含 Cloudflare Pages 和 D1 的编辑权限，再在终端设置 `CLOUDFLARE_API_TOKEN`。令牌不要写进仓库。这个变量会盖过 `wrangler login` 的登录态。
