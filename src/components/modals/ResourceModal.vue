<template>
  <dialog class="modal" :class="{ 'modal-open': store.resourceModal.show }">
    <div class="modal-box glass-panel w-11/12 max-w-5xl max-h-[92vh] overflow-y-auto">
      <h3 class="font-bold text-xl text-adaptive-white mb-6 flex items-center gap-2">
        <i class="fa-solid fa-database text-primary"></i>
        {{ store.resourceModal.isEdit ? '编辑资源' : '添加资源' }}
      </h3>

      <!-- 类型切换（仅新增时显示） -->
      <div v-if="!store.resourceModal.isEdit" class="flex gap-2 mb-4">
        <button class="btn flex-1 gap-2"
          :class="store.resourceForm.type === 'node' ? 'btn-primary' : 'btn-ghost border border-panel-border'"
          @click="store.resourceForm.type = 'node'">
          <i class="fa-solid fa-server"></i> 自建节点
        </button>
        <button class="btn flex-1 gap-2"
          :class="store.resourceForm.type === 'group' ? 'btn-warning' : 'btn-ghost border border-panel-border'"
          @click="store.resourceForm.type = 'group'">
          <i class="fa-solid fa-folder-tree"></i> 节点组
        </button>
      </div>

      <!-- 名称 -->
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text text-adaptive-muted">
            名称 <span v-if="store.resourceForm.type === 'group'" class="text-error">*</span>
          </span>
        </label>
        <input v-model="store.resourceForm.name" type="text"
          :placeholder="store.resourceForm.type === 'node' ? '留空自动跟随节点链接名称' : '请输入节点组名称（必填）'"
          class="input input-bordered bg-adaptive-input w-full"
          :class="{'input-error': nameError}" />
        <label v-if="nameError" class="label">
          <span class="label-text-alt text-error">节点组名称不能为空</span>
        </label>
      </div>

      <!-- 提示 -->
      <div v-if="!store.resourceModal.isEdit" class="mb-3">
        <div class="alert alert-info py-2 text-xs">
          <i class="fa-solid fa-circle-info"></i>
          <span v-if="store.resourceForm.type === 'node'">粘贴一条或多条节点分享链接。多条会拆成多个独立资源，方便以后单独勾选。</span>
          <span v-else>把多条节点或整份订阅放进同一个资源里，之后在聚合组里一次勾选即可。</span>
        </div>
      </div>

      <!-- 内容 -->
      <div class="form-control mb-6">
        <label class="label"><span class="label-text text-adaptive-muted">{{ store.resourceForm.type === 'node' ? '节点分享链接' : '节点或订阅内容' }}</span></label>
        <textarea :value="store.resourceForm.url" rows="5"
          @input="onContentInput"
          :placeholder="store.resourceForm.type === 'node'
            ? '粘贴节点分享链接，每行一个。多条会拆成多个资源。\n支持 ss、vmess、vless、trojan、hysteria2、tuic、wireguard、socks、http、snell 等'
            : '粘贴多条分享链接，或整段 Clash YAML / Base64 订阅，作为一个节点组'"
          class="textarea textarea-bordered bg-adaptive-input w-full font-mono text-xs"></textarea>
        <p v-if="previewing" class="text-xs text-adaptive-muted mt-2">正在识别…</p>
        <p v-if="importError" class="text-xs text-error mt-2">{{ importError }}</p>
        <div v-if="importCount" class="mt-3 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-xs text-adaptive-muted">识别到 {{ importCount }} 个节点。保存时会导入全部。</p>
            <span v-for="(count, type) in importTypes" :key="type" class="badge badge-sm badge-outline">{{ type }} {{ count }}</span>
          </div>
          <div v-if="importCatalog.length" class="rounded-xl border border-panel-border p-3 max-h-40 overflow-y-auto custom-scrollbar">
            <div v-for="(node, i) in importCatalog" :key="'cat-'+i" class="flex items-center gap-2 py-0.5 text-xs">
              <span class="badge badge-ghost badge-xs uppercase">{{ node.type || node.protocol || 'node' }}</span>
              <span class="text-adaptive-white truncate">{{ node.name || '未命名' }}</span>
            </div>
          </div>
          <p class="text-xs text-adaptive-muted">下面同时给出 Clash YAML 和客户端 JSON，方便核对。<span v-if="hiddenCount && !expandedPreview">默认展开前 {{ previewLimit }} 个，其余 {{ hiddenCount }} 个可点开，保存时仍会全部导入。</span></p>
          <button v-if="hiddenCount" class="btn btn-xs btn-ghost" @click="expandedPreview = !expandedPreview">
            {{ expandedPreview ? '收起详情' : '展开全部 YAML / JSON' }}
          </button>
          <div v-for="(node, i) in visibleImportNodes" :key="i" class="rounded-xl border border-panel-border p-3">
            <p class="text-sm text-adaptive-white mb-2">{{ node.name || '未命名' }} · {{ node.protocol || node.type }}</p>
            <p v-if="node.note" class="text-xs text-warning mb-2">{{ node.note }}</p>
            <div class="grid lg:grid-cols-2 gap-3">
              <div class="min-w-0">
                <p class="text-xs text-adaptive-muted mb-1">{{ node.yamlLabel || 'YAML' }}</p>
                <pre class="text-xs whitespace-pre-wrap break-all bg-base-100 rounded-lg p-3">{{ node.yaml }}</pre>
              </div>
              <div class="min-w-0">
                <p class="text-xs text-adaptive-muted mb-1">{{ node.jsonLabel || 'JSON' }}</p>
                <pre class="text-xs whitespace-pre-wrap break-all bg-base-100 rounded-lg p-3">{{ node.json }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="store.resourceModal.show = false">取消</button>
        <button class="btn" :class="store.resourceForm.type === 'node' ? 'btn-primary' : 'btn-warning'"
          @click="saveResource" :disabled="store.submitting">
          <span v-if="store.submitting" class="loading loading-spinner loading-sm"></span>
          {{ store.resourceModal.isEdit ? '保存修改' : '添加' }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="store.resourceModal.show = false"></form>
  </dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useMainStore } from '../../stores/main.js'
import { authFetch, loadResources } from '../../api/index.js'
import { showToast } from '../../utils/helpers.js'
import { importPreviewState, mergeSavedResources, typeLabel } from '../../utils/panel.js'
import { API } from '../../api/config.js'

const store = useMainStore()
const nameError = ref(false)
const importNodes = ref([])
const importCatalog = ref([])
const importTypes = ref({})
const importCount = ref(0)
const hiddenCount = ref(0)
const previewLimit = 3
const expandedPreview = ref(false)
const importError = ref('')
const previewing = ref(false)
let previewTimer = null
let previewSeq = 0

const visibleImportNodes = computed(() => expandedPreview.value ? importNodes.value : importNodes.value.slice(0, previewLimit))

function clearPreview() {
  importNodes.value = []
  importCatalog.value = []
  importTypes.value = {}
  importCount.value = 0
  hiddenCount.value = 0
  expandedPreview.value = false
  importError.value = ''
  previewing.value = false
}

function onContentInput(event) {
  const value = event.target.value
  store.resourceForm.url = value
  schedulePreview(value)
}

function schedulePreview(value) {
  clearTimeout(previewTimer)
  const seq = ++previewSeq
  if (!store.resourceModal.show || store.resourceForm.type === 'remote') {
    clearPreview()
    return
  }
  const text = String(value || '').trim()
  if (!text) {
    clearPreview()
    return
  }
  importNodes.value = []
  importCatalog.value = []
  importTypes.value = {}
  importCount.value = 0
  hiddenCount.value = 0
  importError.value = ''
  previewing.value = true
  previewTimer = setTimeout(() => refreshImportPreview(text, seq), 250)
}

async function refreshImportPreview(text, seq) {
  try {
    const res = await authFetch(`${API}/check`, { method: 'POST', body: { url: text } })
    if (seq !== previewSeq) return
    const preview = importPreviewState(res.data?.nodes || [], res.error || '没有识别出节点', previewLimit)
    importCount.value = preview.count
    importNodes.value = preview.all
    importCatalog.value = preview.all
    importTypes.value = Object.fromEntries(Object.entries(preview.types || {}).map(([key, count]) => [typeLabel(key) || key, count]))
    hiddenCount.value = preview.hidden
    importError.value = preview.error
  } catch (error) {
    if (seq !== previewSeq) return
    importNodes.value = []
    importCatalog.value = []
    importTypes.value = {}
    importCount.value = 0
    hiddenCount.value = 0
    importError.value = error.message || '没有识别出可用节点，请检查粘贴的内容'
  } finally {
    if (seq === previewSeq) previewing.value = false
  }
}

watch(() => store.resourceModal.show, (open) => {
  if (open) schedulePreview(store.resourceForm.url)
  else clearPreview()
})

watch(() => store.resourceForm.type, () => {
  if (store.resourceModal.show) schedulePreview(store.resourceForm.url)
})

async function saveResource() {
  if (!store.resourceForm.url) { showToast('请粘贴节点链接或订阅内容', 'error'); return }

  // 节点组必须填名称
  if (store.resourceForm.type === 'group' && !store.resourceForm.name) {
    nameError.value = true
    return
  }
  nameError.value = false

  store.submitting = true
  try {
    const res = store.resourceModal.isEdit
      ? await authFetch(`${API}/subs/${store.resourceForm.id}`, { method: 'PUT', body: { ...store.resourceForm } })
      : await authFetch(`${API}/subs`, { method: 'POST', body: store.resourceForm })
    if (!res.success) {
      showToast(res.error || '导入失败', 'error')
      return
    }
    if (res.warnings?.length) showToast(`已保存，有链接未识别：${res.warnings[0].message}`, 'error')
    else showToast(store.resourceModal.isEdit ? '修改成功' : '添加成功')
    store.resourceModal.show = false
    if (Array.isArray(res.resources) && res.resources.length) {
      store.resources = mergeSavedResources(store.resources, res.resources)
    }
    await loadResources()
    if (Array.isArray(res.resources) && res.resources.length) {
      store.resources = mergeSavedResources(store.resources, res.resources)
    }
  } catch (e) { showToast(e.message || '操作失败', 'error') }
  finally { store.submitting = false }
}
</script>
