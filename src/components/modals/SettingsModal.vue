<template>
  <dialog class="modal" :class="{ 'modal-open': store.settingsModal.show }">
    <div class="modal-box glass-panel max-w-xl max-h-[90vh] overflow-y-auto">
      <h3 class="font-bold text-xl text-adaptive-white mb-6 flex items-center gap-2">
        <i class="fa-solid fa-gear text-primary"></i> 系统设置
      </h3>

      <!-- 数据管理 -->
      <div class="mb-6">
        <h4 class="font-bold text-sm text-adaptive-white mb-3">数据管理</h4>
        <div class="flex flex-wrap gap-2">
          <button @click="exportBackup" class="btn btn-sm btn-outline btn-primary gap-1">
            <i class="fa-solid fa-download"></i> 导出备份
          </button>
          <button @click="triggerImport" class="btn btn-sm btn-outline btn-secondary gap-1">
            <i class="fa-solid fa-upload"></i> 导入备份
          </button>
          <input ref="importFileRef" type="file" class="hidden" accept=".json" @change="importBackup" />
        </div>
      </div>

      <!-- 远程订阅代理 -->
      <div class="mb-6">
        <h4 class="font-bold text-sm text-adaptive-white mb-2">远程订阅代理</h4>
        <p class="text-xs text-adaptive-muted mb-3">只用于拉取和刷新远程订阅。公开订阅、登录和其他接口不走这里。落地节点须是公网 SOCKS5，不支持 UDP。导出备份不含代理密码。</p>
        <label class="flex items-center gap-2 mb-3 cursor-pointer">
          <input v-model="proxy.enabled" type="checkbox" class="toggle toggle-primary toggle-sm" />
          <span class="text-sm text-adaptive-white">启用 SOCKS5</span>
        </label>
        <div class="flex gap-2 mb-2">
          <input v-model="proxy.uri" type="text" class="input input-bordered bg-adaptive-input input-sm flex-1" placeholder="socks5://用户名:密码@主机:端口" autocomplete="off" />
          <button type="button" class="btn btn-sm btn-outline" @click="applyProxyUri">识别</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <input v-model="proxy.host" type="text" class="input input-bordered bg-adaptive-input input-sm sm:col-span-2" placeholder="主机" autocomplete="off" />
          <input v-model="proxy.port" type="number" min="1" max="65535" class="input input-bordered bg-adaptive-input input-sm" placeholder="端口" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <input v-model="proxy.username" type="text" class="input input-bordered bg-adaptive-input input-sm" placeholder="用户名，可空" autocomplete="off" />
          <input v-model="proxy.password" type="password" class="input input-bordered bg-adaptive-input input-sm" :placeholder="proxy.hasPassword && !proxy.clearPassword ? '已保存，留空则不修改' : '密码，可空'" autocomplete="new-password" />
        </div>
        <p v-if="proxy.hasPassword && !proxy.clearPassword" class="text-xs text-adaptive-muted mb-2">已保存密码。只改主机或端口时不用重填。</p>
        <p v-if="proxy.clearPassword" class="text-xs text-adaptive-muted mb-2">保存后会清除已存的用户名和密码。</p>
        <p v-if="proxy.error" class="text-sm text-error mb-2">{{ proxy.error }}</p>
        <p v-if="proxy.ok" class="text-sm text-success mb-2">{{ proxy.ok }}</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm btn-primary" :disabled="proxy.saving" @click="saveProxy">保存代理</button>
          <button type="button" class="btn btn-sm btn-outline" :disabled="proxy.testing" @click="testProxy">测试连接</button>
          <button type="button" class="btn btn-sm btn-ghost" @click="clearProxyCredentials">清除账号密码</button>
        </div>
      </div>

      <!-- 关于 -->
      <div class="mb-6">
        <h4 class="font-bold text-sm text-adaptive-white mb-2">关于</h4>
        <p class="text-sm text-adaptive-muted">BiaoSUB v3.0 - Cloudflare Pages + D1</p>
        <p class="text-xs text-adaptive-muted mt-1">自建节点聚合订阅管理面板</p>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="store.settingsModal.show = false">关闭</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="store.settingsModal.show = false"></form>
  </dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { useMainStore } from '../../stores/main.js'
import { authFetch, loadResources, loadGroups, loadTemplates } from '../../api/index.js'
import { showToast } from '../../utils/helpers.js'
import { API } from '../../api/config.js'
import { parseSocks5Uri } from '../../../functions/_lib/proxy-settings.js'

const store = useMainStore()
const importFileRef = ref(null)
const proxy = reactive({
  enabled: false,
  uri: '',
  host: '',
  port: 1080,
  username: '',
  password: '',
  hasPassword: false,
  clearPassword: false,
  error: '',
  ok: '',
  saving: false,
  testing: false
})

watch(() => store.settingsModal.show, (open) => {
  if (open) loadProxySettings()
  else proxy.password = ''
})

function proxyPayload() {
  const body = {
    enabled: proxy.enabled,
    host: proxy.host,
    port: Number(proxy.port),
    username: proxy.username,
    clearPassword: proxy.clearPassword
  }
  if (proxy.password) body.password = proxy.password
  return body
}

async function loadProxySettings() {
  proxy.error = ''
  proxy.ok = ''
  try {
    const res = await authFetch(`${API}/settings/proxy`)
    if (!res.success) {
      proxy.error = res.error || '读取代理设置失败'
      return
    }
    const data = res.data || {}
    proxy.enabled = !!data.enabled
    proxy.host = data.host || ''
    proxy.port = data.port || 1080
    proxy.username = data.username || ''
    proxy.password = ''
    proxy.hasPassword = !!data.hasPassword
    proxy.clearPassword = false
    proxy.uri = ''
  } catch (error) {
    proxy.error = error.message || '读取代理设置失败'
  }
}

function applyProxyUri() {
  proxy.error = ''
  proxy.ok = ''
  try {
    const parsed = parseSocks5Uri(proxy.uri)
    proxy.host = parsed.host
    proxy.port = parsed.port
    const hasUserinfo = proxy.uri.includes('@')
    if (hasUserinfo) {
      proxy.username = parsed.username
      proxy.password = parsed.password
      proxy.clearPassword = !parsed.password
      if (!parsed.password) proxy.hasPassword = false
    }
    proxy.ok = hasUserinfo ? '已填入链接里的主机和账号，保存后生效' : '已填入链接里的主机，保存后生效'
  } catch (error) {
    proxy.error = error.message
  }
}

function clearProxyCredentials() {
  proxy.username = ''
  proxy.password = ''
  proxy.hasPassword = false
  proxy.clearPassword = true
  proxy.error = ''
  proxy.ok = '已标记清除账号密码，保存后生效'
}

async function saveProxy() {
  proxy.saving = true
  proxy.error = ''
  proxy.ok = ''
  try {
    const res = await authFetch(`${API}/settings/proxy`, { method: 'PUT', body: proxyPayload() })
    if (!res.success) {
      proxy.error = res.error || '保存失败'
      showToast(proxy.error, 'error')
      return
    }
    proxy.password = ''
    proxy.hasPassword = !!res.data?.hasPassword
    proxy.clearPassword = false
    proxy.ok = '代理设置已保存'
    showToast('代理设置已保存')
  } catch (error) {
    proxy.error = error.message || '保存失败'
    showToast(proxy.error, 'error')
  } finally {
    proxy.saving = false
  }
}

async function testProxy() {
  proxy.testing = true
  proxy.error = ''
  proxy.ok = ''
  try {
    const res = await authFetch(`${API}/settings/proxy/test`, { method: 'POST', body: proxyPayload() })
    if (!res.success) {
      proxy.error = res.error || '代理连接失败'
      showToast(proxy.error, 'error')
      return
    }
    proxy.ok = res.data?.message || '代理连接成功'
    showToast(proxy.ok)
  } catch (error) {
    proxy.error = error.message || '代理连接失败'
    showToast(proxy.error, 'error')
  } finally {
    proxy.testing = false
  }
}

async function exportBackup() {
  try {
    const data = await authFetch(`${API}/backup`)
    if (data.success) {
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `biaosub-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('备份已导出')
    }
  } catch (e) { showToast('导出失败', 'error') }
}

function triggerImport() {
  importFileRef.value?.click()
}

async function importBackup(e) {
  const file = e.target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (!confirm(`确认用备份覆盖当前数据？现有资源、聚合组和模板会被替换为备份中的 ${(data.items || []).length} 个资源、${(data.groups || []).length} 个聚合组、${(data.templates || []).length} 个模板。`)) {
      return
    }

    const res = await authFetch(`${API}/restore`, { method: 'POST', body: data })
    if (res.success) {
      showToast('导入成功')
      loadResources()
      loadGroups()
      loadTemplates()
    } else {
      showToast('导入失败: ' + (res.error || ''), 'error')
    }
  } catch (e) {
    showToast('文件格式错误', 'error')
  }

  e.target.value = '' // 重置
}
</script>
