<template>
  <dialog class="modal" :class="{ 'modal-open': store.groupModal.show }">
    <div class="modal-box biaosub-modal glass-panel max-w-4xl w-11/12 p-0 overflow-hidden flex flex-col h-[90vh] max-h-[90vh]">
      <!-- 头部 -->
      <div class="p-4 sm:p-6 pb-0 flex items-center justify-between">
        <h3 class="font-bold text-xl text-adaptive-white flex items-center gap-2">
          <i class="fa-solid fa-layer-group text-accent"></i>
          {{ store.groupModal.isEdit ? '编辑聚合组' : '新建聚合组' }}
        </h3>
        <button class="btn btn-circle btn-ghost btn-sm" @click="store.groupModal.show = false">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Tab 切换 -->
      <div class="tabs tabs-boxed mx-4 sm:mx-6 mt-4 p-1 flex-wrap">
        <a class="tab flex-1" :class="{'tab-active': store.groupModal.tab==='base'}" @click="store.groupModal.tab='base'">
          <i class="fa-solid fa-cubes mr-2"></i> 节点配置
        </a>
        <a class="tab flex-1" :class="{'tab-active': store.groupModal.tab==='process'}" @click="store.groupModal.tab='process'">
          <i class="fa-solid fa-sliders mr-2"></i> 节点处理
        </a>
        <a v-if="store.groupForm.clash_config.mode !== 'raw'" class="tab flex-1" :class="{'tab-active': store.groupModal.tab==='clash'}" @click="store.groupModal.tab='clash'">
          <i class="fa-solid fa-gears mr-2"></i> Clash配置
        </a>
        <a v-if="store.groupForm.clash_config.mode === 'raw'" class="tab flex-1" :class="{'tab-active': store.groupModal.tab==='raw'}" @click="store.groupModal.tab='raw'">
          <i class="fa-solid fa-cloud-arrow-up mr-2"></i> 托管YAML
        </a>
      </div>

      <!-- 内容区 -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-8 custom-scrollbar">
        <!-- 组名 -->
        <div class="form-control mb-4">
          <label class="label"><span class="label-text text-adaptive-muted">聚合组名称</span></label>
          <input v-model="store.groupForm.name" type="text" placeholder="输入聚合组名称"
            class="input input-bordered bg-adaptive-input w-full"
            :class="{'input-error': store.groupNameError}" />
          <label v-if="store.groupNameError" class="label">
            <span class="label-text-alt text-error">请输入名称</span>
          </label>
        </div>

        <!-- Tab: 节点配置 -->
        <div v-show="store.groupModal.tab === 'base'">
          <!-- 选择资源 -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-bold text-sm text-adaptive-white">选择资源</h4>
              <div class="flex items-center gap-2">
                <button class="btn btn-xs btn-ghost" @click="selectAllResources">
                  {{ store.groupForm.config.length === store.resources.length ? '取消全选' : '全选' }}
                </button>
                <span class="badge badge-sm badge-ghost">{{ store.groupForm.config.length }}个已选</span>
              </div>
            </div>
            <div class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              <div v-for="r in store.resources" :key="r.id"
                class="flex items-center gap-3 p-2 rounded-lg bg-adaptive-input hover:bg-primary/10 transition-all cursor-pointer"
                @click="toggleResource(r)">
                <input type="checkbox" class="checkbox checkbox-primary checkbox-sm"
                  :checked="isResourceSelected(r.id)" @click.stop="toggleResource(r)" />
                <span class="flex-1 text-sm text-adaptive-white truncate">{{ r.name }}</span>
                <span class="badge badge-xs" :class="r.type === 'node' ? 'badge-primary' : r.type === 'group' ? 'badge-warning' : r.type === 'remote' ? 'badge-success' : 'badge-secondary'">
                  {{ r.type === 'node' ? '节点' : r.type === 'group' ? '节点组' : r.type === 'remote' ? '远程' : '订阅' }}
                </span>
                <span v-if="r.info && r.info.nodeCount" class="text-xs text-adaptive-muted">{{ r.info.nodeCount }}节点</span>
                <!-- 筛选按钮 -->
                <button v-if="isResourceSelected(r.id) && r.info && r.info.nodeCount > 1"
                  @click.stop="openNodeSelector(r)" class="btn btn-xs btn-ghost text-accent">
                  <i class="fa-solid fa-filter"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- 已选资源排序 -->
          <div v-if="store.groupForm.config.length > 0" class="mb-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-bold text-sm text-adaptive-white">已选资源排序</h4>
              <span class="text-xs text-adaptive-muted">拖拽排序 · 可设置链式代理</span>
            </div>
            <div ref="selectedResourceListRef" class="space-y-2">
              <div v-for="(c, i) in store.groupForm.config" :key="c.subId"
                class="rounded-lg bg-adaptive-input border border-panel-border overflow-hidden" :data-sub-id="c.subId">
                <!-- 主行 -->
                <div class="flex items-center gap-2 p-2">
                  <div class="config-drag-handle cursor-grab active:cursor-grabbing flex-shrink-0">
                    <i class="fa-solid fa-grip-vertical text-adaptive-muted"></i>
                  </div>
                  <span class="text-xs text-adaptive-muted w-5 text-center">{{ i + 1 }}</span>
                  <span class="flex-1 text-sm text-adaptive-white truncate">{{ getResourceName(c.subId) }}</span>
                  <span v-if="c.filter" class="badge badge-outline badge-xs">筛选</span>
                  <span v-if="c.dialerProxy && c.dialerProxy.enabled" class="badge badge-warning badge-xs gap-1">
                    <i class="fa-solid fa-link text-[10px]"></i> 链式
                  </span>
                  <!-- 链式代理开关 -->
                  <button @click="toggleDialerProxy(c)" class="btn btn-xs btn-ghost flex-shrink-0"
                    :class="c.dialerProxy && c.dialerProxy.enabled ? 'text-warning' : 'text-adaptive-muted'"
                    :data-tip="c.dialerProxy && c.dialerProxy.enabled ? '关闭链式代理' : '开启链式代理'">
                    <i class="fa-solid fa-link"></i>
                  </button>
                  <button @click="store.groupForm.config.splice(i, 1)" class="btn btn-xs btn-ghost text-error flex-shrink-0">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <!-- 链式代理选择 -->
                <div v-if="c.dialerProxy && c.dialerProxy.enabled" class="px-3 pb-2 flex items-center gap-2 border-t border-panel-border pt-2 ml-7">
                  <i class="fa-solid fa-arrow-right-arrow-left text-warning text-xs"></i>
                  <span class="text-xs text-adaptive-muted whitespace-nowrap">链式目标:</span>
                  <select v-model="c.dialerProxy.group" class="select select-bordered select-xs bg-adaptive-input flex-1 min-w-0">
                    <option value="">请选择策略组或节点</option>
                    <optgroup v-if="chainGroups().length" label="策略组">
                      <option v-for="name in chainGroups()" :key="'group-' + name" :value="name">{{ name }}</option>
                    </optgroup>
                    <optgroup v-if="chainNodes(c).length" label="节点">
                      <option v-for="name in chainNodes(c)" :key="'node-' + c.subId + '-' + name" :value="name">{{ name }}</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>
            <p v-if="chainActive" class="text-xs text-warning mt-2">
              链式代理只写入 Clash 订阅。Base64 分享链接仍是普通节点，不包含链式。
            </p>
          </div>

          <!-- 已选资源的筛选信息 -->
          <div v-if="store.groupForm.config.some(c => c.filter)" class="mb-4">
            <h4 class="font-bold text-sm text-adaptive-white mb-2">筛选规则</h4>
            <div v-for="(c, i) in store.groupForm.config" :key="i">
              <div v-if="c.filter" class="badge badge-outline badge-sm mb-1">
                {{ getResourceName(c.subId) }}: {{ c.filter }}
              </div>
            </div>
          </div>
        </div>


        <!-- Tab: 节点处理 -->
        <div v-show="store.groupModal.tab === 'process'">
          <p class="text-xs text-adaptive-muted mb-4">这里的处理发生在已选资源和节点筛选之后，对 Clash、Base64、sing-box 和节点列表四种输出一并生效。现有聚合组不开启任何选项时，结果与以前相同。</p>
          <div class="grid sm:grid-cols-2 gap-4 mb-4">
            <div class="form-control">
              <label class="label"><span class="label-text text-adaptive-muted">保留（节点名正则）</span></label>
              <input v-model="store.groupForm.clash_config.process.include" type="text" placeholder="例如 (?i)(港|HK|日本)"
                class="input input-bordered input-sm bg-adaptive-input w-full" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text text-adaptive-muted">排除（节点名正则）</span></label>
              <input v-model="store.groupForm.clash_config.process.exclude" type="text" placeholder="例如 (?i)(过期|剩余|官网)"
                class="input input-bordered input-sm bg-adaptive-input w-full" />
            </div>
          </div>
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-bold text-sm text-adaptive-white">只保留这些协议</h4>
              <button class="btn btn-xs btn-ghost" @click="store.groupForm.clash_config.process.protocols = []">全部协议</button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button v-for="item in protocolOptions" :key="item.value" type="button"
                class="btn btn-xs" :class="hasProtocol(item.value) ? 'btn-primary' : 'btn-outline'"
                @click="toggleProtocol(item.value)">{{ item.label }}</button>
            </div>
          </div>
          <div class="grid sm:grid-cols-2 gap-3 mb-4">
            <label class="flex items-center gap-2 p-3 rounded-xl bg-adaptive-input border border-panel-border cursor-pointer">
              <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" v-model="store.groupForm.clash_config.process.dropUseless" />
              <span class="text-sm">去掉流量、到期、官网等说明节点</span>
            </label>
            <label class="flex items-center gap-2 p-3 rounded-xl bg-adaptive-input border border-panel-border cursor-pointer">
              <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" v-model="store.groupForm.clash_config.process.dedup" />
              <span class="text-sm">按服务器去重，保留先出现的节点</span>
            </label>
          </div>
          <div class="form-control mb-4 max-w-xs">
            <label class="label"><span class="label-text text-adaptive-muted">排序</span></label>
            <select v-model="store.groupForm.clash_config.process.sort" class="select select-bordered select-sm bg-adaptive-input">
              <option value="none">保持原顺序</option>
              <option value="name">按名称</option>
              <option value="name-desc">按名称倒序</option>
            </select>
          </div>
          <h4 class="font-bold text-sm text-adaptive-white mb-3">重命名</h4>
          <div class="grid sm:grid-cols-2 gap-4 mb-3">
            <div class="form-control">
              <label class="label"><span class="label-text text-adaptive-muted">前缀</span></label>
              <input v-model="store.groupForm.clash_config.process.rename.prefix" type="text" placeholder="例如 家宽-"
                class="input input-bordered input-sm bg-adaptive-input w-full" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text text-adaptive-muted">后缀</span></label>
              <input v-model="store.groupForm.clash_config.process.rename.suffix" type="text"
                class="input input-bordered input-sm bg-adaptive-input w-full" />
            </div>
          </div>
          <div class="grid sm:grid-cols-2 gap-3 mb-4">
            <label class="flex items-center gap-2 p-3 rounded-xl bg-adaptive-input border border-panel-border cursor-pointer">
              <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" v-model="store.groupForm.clash_config.process.rename.appendType" />
              <span class="text-sm">名称前加上 [VLESS] 这类协议标记</span>
            </label>
            <label class="flex items-center gap-2 p-3 rounded-xl bg-adaptive-input border border-panel-border cursor-pointer">
              <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" v-model="store.groupForm.clash_config.process.rename.emoji" />
              <span class="text-sm">按节点名加上地区旗帜</span>
            </label>
          </div>
          <div class="mb-2 flex items-center justify-between">
            <h4 class="font-bold text-sm text-adaptive-white">正则替换</h4>
            <button class="btn btn-xs btn-ghost text-accent" @click="addRenameRule"><i class="fa-solid fa-plus mr-1"></i>添加一条</button>
          </div>
          <div v-if="!store.groupForm.clash_config.process.rename.rules.length" class="text-xs text-adaptive-muted mb-2">例如把「专线」替换成空，或把「香港」统一成「HK」。</div>
          <div class="space-y-2">
            <div v-for="(rule, i) in store.groupForm.clash_config.process.rename.rules" :key="i" class="flex gap-2 items-center">
              <input v-model="rule.pattern" type="text" placeholder="正则" class="input input-bordered input-sm bg-adaptive-input flex-1" />
              <input v-model="rule.replacement" type="text" placeholder="替换为" class="input input-bordered input-sm bg-adaptive-input flex-1" />
              <button class="btn btn-xs btn-ghost text-error" @click="store.groupForm.clash_config.process.rename.rules.splice(i, 1)">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Tab: Clash配置 -->
        <div v-show="store.groupModal.tab === 'clash' && store.groupForm.clash_config.mode !== 'raw'">
          <!-- 头部配置 -->
          <div class="collapse collapse-arrow bg-adaptive-input border border-panel-border mb-3">
            <input type="checkbox" />
            <div class="collapse-title text-sm font-bold text-adaptive-white">头部配置 (Header)</div>
            <div class="collapse-content">
              <textarea v-model="store.groupForm.clash_config.header"
                class="code-editor w-full h-48 textarea textarea-bordered bg-adaptive-input text-xs"
                placeholder="YAML Header..."></textarea>
            </div>
          </div>

          <!-- 策略组管理 -->
          <div class="collapse collapse-arrow bg-adaptive-input border border-panel-border mb-3">
            <input type="checkbox" checked />
            <div class="collapse-title text-sm font-bold text-adaptive-white">
              策略组 (Proxy Groups) <span class="badge badge-xs badge-primary ml-2">{{ store.groupForm.clash_config.groups.length }}</span>
            </div>
            <div class="collapse-content">
              <button @click="addProxyGroup" class="btn btn-xs btn-primary mb-3">
                <i class="fa-solid fa-plus mr-1"></i> 添加策略组
              </button>
              <div ref="proxyGroupListRef">
                <div v-for="(pg, i) in store.groupForm.clash_config.groups" :key="pg"
                  class="card bg-adaptive-input border border-panel-border mb-2 p-3">
                  <div class="grid grid-cols-2 gap-2 mb-2">
                    <div class="col-span-2 flex items-center gap-2">
                      <div class="proxy-drag-handle cursor-grab active:cursor-grabbing text-adaptive-muted hover:text-adaptive-white">
                        <i class="fa-solid fa-grip-vertical"></i>
                      </div>
                      <input v-model="pg.name" class="input input-bordered input-sm bg-adaptive-input flex-1" placeholder="名称" />
                      <select v-model="pg.type" class="select select-bordered select-sm bg-adaptive-input w-32">
                        <option value="select">手动选择</option>
                        <option value="url-test">自动测速</option>
                        <option value="fallback">故障转移</option>
                        <option value="load-balance">负载均衡</option>
                      </select>
                    </div>
                  </div>
                  <div v-if="pg.type === 'url-test' || pg.type === 'fallback'" class="grid grid-cols-3 gap-2 mb-2 ml-6">
                    <input v-model="pg.url" class="input input-bordered input-xs bg-adaptive-input" placeholder="测速URL" />
                    <input v-model.number="pg.interval" type="number" class="input input-bordered input-xs bg-adaptive-input" placeholder="间隔(秒)" />
                    <input v-model.number="pg.tolerance" type="number" class="input input-bordered input-xs bg-adaptive-input" placeholder="容差(ms)" />
                  </div>
                  <div class="flex items-center gap-2 ml-6">
                    <label class="flex items-center gap-1 text-xs">
                      <input type="checkbox" v-model="pg.useAllProxies" class="checkbox checkbox-xs" /> 使用全部节点
                    </label>
                    <button v-if="!pg.useAllProxies" @click="openClashNodeSelector(i)"
                      class="btn btn-xs btn-ghost text-accent">
                      <i class="fa-solid fa-list-check"></i> 选择节点 ({{ (pg.proxies || []).length }})
                    </button>
                    <div class="flex-1"></div>
                    <button @click="store.groupForm.clash_config.groups.splice(i, 1)"
                      class="btn btn-xs btn-ghost text-error">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 规则配置 -->
          <div class="collapse collapse-arrow bg-adaptive-input border border-panel-border mb-3">
            <input type="checkbox" />
            <div class="collapse-title text-sm font-bold text-adaptive-white">规则 (Rules)</div>
            <div class="collapse-content">
              <textarea v-model="store.groupForm.clash_config.rules"
                class="code-editor w-full h-48 textarea textarea-bordered bg-adaptive-input text-xs"
                placeholder="rules:&#10;  - MATCH,Proxy"></textarea>
            </div>
          </div>

        </div>

        <!-- Tab: 托管YAML -->
        <div v-show="store.groupModal.tab === 'raw'">
          <!-- 文件上传区 -->
          <div class="mb-4">
            <label class="label"><span class="label-text text-adaptive-muted">上传 YAML 配置文件</span></label>
            <div class="border-2 border-dashed border-panel-border rounded-lg p-6 text-center hover:border-warning/50 transition-colors cursor-pointer"
              @click="$refs.yamlFileInput.click()" @dragover.prevent @drop.prevent="handleFileDrop">
              <i class="fa-solid fa-cloud-arrow-up text-3xl text-warning mb-2"></i>
              <p class="text-sm text-adaptive-muted">点击选择或拖拽 YAML 文件到此处</p>
              <p class="text-xs text-adaptive-muted mt-1">支持 .yaml / .yml 格式</p>
            </div>
            <input ref="yamlFileInput" type="file" accept=".yaml,.yml" class="hidden" @change="handleFileSelect" />
          </div>

          <!-- 文件信息 -->
          <div v-if="uploadedFileName" class="alert alert-info py-2 mb-4">
            <i class="fa-solid fa-file-code"></i>
            <span class="text-sm">已加载: {{ uploadedFileName }}</span>
            <button class="btn btn-xs btn-ghost" @click="clearUploadedFile">清除</button>
          </div>

          <!-- YAML 预览/编辑 -->
          <div class="form-control">
            <label class="label"><span class="label-text text-adaptive-muted">YAML 内容（可直接编辑）。已选节点会写入 proxies；头部、策略组和规则保留。同名代理用已选节点替换，其余上传代理保留，新节点追加在后面。</span></label>
            <textarea v-model="store.groupForm.clash_config.raw_yaml"
              class="code-editor w-full h-96 textarea textarea-bordered bg-adaptive-input text-xs font-mono"
              placeholder="上传 YAML 文件或直接粘贴完整的 Clash 配置..."></textarea>
          </div>
        </div>
      </div>

      <div v-if="refreshedLinks" class="shrink-0 mx-4 sm:mx-6 mb-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
        <p class="text-sm font-bold text-warning mb-2">新的订阅链接（旧链接已失效）</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-xs btn-outline btn-primary" @click="copyText(refreshedLinks.clash)">复制 Clash</button>
          <button type="button" class="btn btn-xs btn-outline btn-secondary" @click="copyText(refreshedLinks.base64)">复制 Base64</button>
        </div>
        <p class="text-xs break-all mt-2 text-adaptive-white">{{ refreshedLinks.clash }}</p>
      </div>

      <!-- 底部按钮 -->
      <div class="shrink-0 z-20 border-t border-panel-border px-4 sm:px-6 py-4 flex justify-between items-center" style="background: var(--panel-bg)">
        <div class="flex gap-2">
          <button v-if="store.groupForm.clash_config.mode !== 'raw'" @click="saveAsTemplate" class="btn btn-xs btn-ghost text-accent">
            <i class="fa-solid fa-bookmark mr-1"></i> 保存为模板
          </button>
          <button v-if="store.groupModal.isEdit" @click="refreshToken" class="btn btn-xs btn-ghost text-warning">
            <i class="fa-solid fa-rotate mr-1"></i> 刷新Token
          </button>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost" @click="store.groupModal.show = false">取消</button>
          <button class="btn btn-accent" @click="saveGroup" :disabled="store.submitting">
            <span v-if="store.submitting" class="loading loading-spinner loading-sm"></span>
            {{ store.groupModal.isEdit ? '保存修改' : '创建' }}
          </button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="store.groupModal.show = false"></form>
  </dialog>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { parse as parseYaml } from 'yaml'
import { useMainStore } from '../../stores/main.js'
import { authFetch, loadGroups, loadTemplates } from '../../api/index.js'
import { showToast, copyText } from '../../utils/helpers.js'
import { subscriptionLinks, PROTOCOL_OPTIONS, withProcess } from '../../utils/panel.js'
import { API } from '../../api/config.js'

const store = useMainStore()
const uploadedFileName = ref('')
const refreshedLinks = ref(null)

const protocolOptions = PROTOCOL_OPTIONS

watch(() => [store.groupModal.show, store.groupForm.id], () => {
  if (!store.groupModal.show) refreshedLinks.value = null
  else ensureProcess()
})

function ensureProcess() {
  store.groupForm.clash_config = withProcess(store.groupForm.clash_config || {})
}

function hasProtocol(value) {
  return (store.groupForm.clash_config.process?.protocols || []).includes(value)
}

function toggleProtocol(value) {
  ensureProcess()
  const list = store.groupForm.clash_config.process.protocols
  const index = list.indexOf(value)
  if (index === -1) list.push(value)
  else list.splice(index, 1)
}

function addRenameRule() {
  ensureProcess()
  store.groupForm.clash_config.process.rename.rules.push({ pattern: '', replacement: '' })
}
const selectedResourceListRef = ref(null)
const proxyGroupListRef = ref(null)
const nodeNamesBySubId = ref({})
let chainLoad = 0

const chainActive = computed(() => (store.groupForm.config || []).some(item => item?.dialerProxy?.enabled))

function pickedNames(item, nodes) {
  const names = (nodes || []).map(node => node?.name).filter(Boolean)
  if (Array.isArray(item.include) && item.include.length) {
    const allow = new Set(item.include)
    return names.filter(name => allow.has(name))
  }
  if (Array.isArray(item.selectedNodes) && item.selectedNodes.length) {
    const allow = new Set(item.selectedNodes.map(Number))
    return names.filter((_, index) => allow.has(index))
  }
  return names
}

async function loadChainNodes() {
  const ticket = ++chainLoad
  const next = {}
  await Promise.all((store.groupForm.config || []).map(async (item) => {
    const resource = store.resources.find(entry => entry.id === item.subId)
    if (!resource?.url) return
    try {
      const res = await authFetch(`${API}/check`, { method: 'POST', body: { url: resource.url } })
      if (res.success) next[item.subId] = pickedNames(item, res.data?.nodes || [])
    } catch { /* 保存时仍由服务端校验 */ }
  }))
  if (ticket === chainLoad) nodeNamesBySubId.value = next
}

function chainGroups() {
  const names = (store.groupForm.clash_config.groups || []).map(group => group?.name).filter(Boolean)
  if (store.groupForm.clash_config.mode === 'raw') {
    try {
      const doc = parseYaml(store.groupForm.clash_config.raw_yaml || '')
      for (const group of doc?.['proxy-groups'] || []) {
        if (group?.name) names.push(String(group.name))
      }
    } catch { /* 策略组名留到 YAML 能解析时再出现 */ }
  }
  return [...new Set(names)]
}

function chainNodes(current) {
  const groups = new Set(chainGroups())
  const names = []
  for (const item of store.groupForm.config || []) {
    if (item.subId === current.subId) continue
    for (const name of nodeNamesBySubId.value[item.subId] || []) {
      if (!groups.has(name) && !names.includes(name)) names.push(name)
    }
  }
  return names
}

const emit = defineEmits(['openNodeSelector', 'openClashNodeSelector'])

// === 全选/取消全选 ===
function selectAllResources() {
  if (store.groupForm.config.length === store.resources.length) {
    store.groupForm.config = []
  } else {
    store.groupForm.config = store.resources.map(r => ({ subId: r.id, name: r.name }))
  }
}

// === 链式代理 ===
function toggleDialerProxy(configItem) {
  if (!configItem.dialerProxy) {
    configItem.dialerProxy = { enabled: true, group: '' }
  } else {
    configItem.dialerProxy.enabled = !configItem.dialerProxy.enabled
  }
}

// === 已选资源拖拽排序 ===
let configSortableInstance = null
async function initConfigSortable() {
  if (!selectedResourceListRef.value) return
  try {
    const { default: Sortable } = await import('sortablejs')
    if (configSortableInstance) configSortableInstance.destroy()
    configSortableInstance = new Sortable(selectedResourceListRef.value, {
      handle: '.config-drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: () => {
        const els = Array.from(selectedResourceListRef.value.children)
        const newOrder = els.map(el => parseInt(el.dataset.subId))
        const oldConfig = [...store.groupForm.config]
        store.groupForm.config = newOrder.map(subId => oldConfig.find(c => c.subId === subId)).filter(Boolean)
      }
    })
  } catch (e) { console.error('Config sortable init failed:', e) }
}

// === 策略组排序 ===
let proxyGroupSortableInstance = null
async function initProxyGroupSortable() {
  if (!proxyGroupListRef.value) return
  try {
    const { default: Sortable } = await import('sortablejs')
    if (proxyGroupSortableInstance) proxyGroupSortableInstance.destroy()
    proxyGroupSortableInstance = new Sortable(proxyGroupListRef.value, {
      handle: '.proxy-drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex === newIndex) return
        const item = store.groupForm.clash_config.groups.splice(oldIndex, 1)[0]
        store.groupForm.clash_config.groups.splice(newIndex, 0, item)
      }
    })
  } catch (e) { console.error('Proxy Group sortable init failed:', e) }
}

watch(() => store.groupModal.show, (show) => { if (show) loadChainNodes() })
watch(() => (store.groupForm.config || []).map(item => `${item.subId}:${(item.include || []).join(',')}:${(item.selectedNodes || []).join(',')}`).join('|'), () => {
  if (store.groupModal.show) loadChainNodes()
})
watch(() => store.groupForm.config.length, () => { nextTick(initConfigSortable) })
watch(() => store.groupForm.clash_config.groups.length, () => { nextTick(initProxyGroupSortable) })
watch(() => store.groupModal.tab, (tab) => { 
  if (tab === 'base') nextTick(initConfigSortable)
  if (tab === 'clash') nextTick(initProxyGroupSortable)
})



// === 文件上传 ===
function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file) readYamlFile(file)
}

function handleFileDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file && (file.name.endsWith('.yaml') || file.name.endsWith('.yml'))) {
    readYamlFile(file)
  } else {
    showToast('请上传 .yaml 或 .yml 文件', 'error')
  }
}

function readYamlFile(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    store.groupForm.clash_config.raw_yaml = e.target.result
    uploadedFileName.value = file.name
    // 自动用文件名（去扩展名）设置组名
    if (!store.groupForm.name) {
      store.groupForm.name = file.name.replace(/\.(yaml|yml)$/i, '')
    }
    showToast(`已加载: ${file.name}`)
  }
  reader.readAsText(file)
}

function clearUploadedFile() {
  store.groupForm.clash_config.raw_yaml = ''
  uploadedFileName.value = ''
}

function isResourceSelected(id) {
  return store.groupForm.config.some(c => c.subId === id)
}

function toggleResource(r) {
  const idx = store.groupForm.config.findIndex(c => c.subId === r.id)
  if (idx === -1) {
    store.groupForm.config.push({ subId: r.id, name: r.name })
  } else {
    store.groupForm.config.splice(idx, 1)
  }
}



function getResourceName(subId) {
  const r = store.resources.find(r => r.id === subId)
  return r ? r.name : '未知'
}

function addProxyGroup() {
  store.groupForm.clash_config.groups.push({
    name: '',
    type: 'select',
    proxies: [],
    useAllProxies: false
  })
}

function openNodeSelector(r) {
  emit('openNodeSelector', r)
}

function openClashNodeSelector(groupIndex) {
  emit('openClashNodeSelector', groupIndex)
}

async function saveGroup() {
  if (!store.groupForm.name) {
    store.groupNameError = true
    return
  }
  if ((store.groupForm.config || []).some(item => item?.dialerProxy?.enabled && !String(item.dialerProxy.group || '').trim())) {
    showToast('请选择链式代理目标', 'error')
    return
  }
  store.groupNameError = false
  store.submitting = true

  try {
    const body = {
      name: store.groupForm.name,
      config: store.groupForm.config,
      clash_config: withProcess(store.groupForm.clash_config)
    }

    const res = store.groupModal.isEdit
      ? await authFetch(`${API}/groups/${store.groupForm.id}`, { method: 'PUT', body })
      : await authFetch(`${API}/groups`, { method: 'POST', body })
    if (!res.success) {
      showToast(res.error || '操作失败', 'error')
      store.submitting = false
      return
    }

    showToast(store.groupModal.isEdit ? '修改成功' : '创建成功')
    store.groupModal.show = false
    await loadGroups()
  } catch (e) { showToast('操作失败', 'error') }
  store.submitting = false
}

async function refreshToken() {
  if (!confirm('刷新Token后，旧的订阅链接将失效！确定？')) return
  try {
    const res = await authFetch(`${API}/groups/${store.groupForm.id}`, {
      method: 'PUT',
      body: { refresh_token: true }
    })
    if (!res.success || !res.token) {
      showToast(res.error || '刷新失败', 'error')
      return
    }
    const group = store.groups.find(item => String(item.id) === String(store.groupForm.id))
    if (group) group.token = res.token
    store.groupForm.token = res.token
    const links = subscriptionLinks(window.location.origin, res.token)
    refreshedLinks.value = links
    let copied = false
    try {
      await navigator.clipboard.writeText(links.clash)
      copied = true
    } catch { copied = false }
    showToast(copied ? 'Token已刷新，新的 Clash 链接已复制' : 'Token已刷新，请复制下方新链接')
  } catch (e) { showToast(e.message || '刷新失败', 'error') }
}

async function saveAsTemplate() {
  const name = prompt('请输入模板名称')
  if (!name) return
  try {
    await authFetch(`${API}/templates`, {
      method: 'POST',
      body: {
        name,
        header: store.groupForm.clash_config.header,
        groups: store.groupForm.clash_config.groups,
        rules: store.groupForm.clash_config.rules
      }
    })
    showToast('模板已保存')
    loadTemplates()
  } catch (e) { showToast('保存失败', 'error') }
}
</script>
