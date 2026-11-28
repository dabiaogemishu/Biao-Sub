<template>
  <dialog class="modal" :class="{ 'modal-open': store.resourceModal.show }">
    <div class="modal-box glass-panel w-11/12 max-w-5xl max-h-[92vh] overflow-y-auto">
      <h3 class="font-bold text-xl text-adaptive-white mb-6 flex items-center gap-2">
        <i class="fa-solid fa-database text-primary"></i>
        {{ modalTitle }}
      </h3>

      <!-- 类型切换（仅新增时显示） -->
      <div v-if="!store.resourceModal.isEdit" class="flex gap-2 mb-4">
        <button class="btn flex-1 gap-2"
          :class="store.resourceForm.type === 'node' ? 'btn-primary' : 'btn-ghost border border-panel-border'"
          @click="switchCreateType('node')">
          <i class="fa-solid fa-server"></i> 自建节点
        </button>
        <button class="btn flex-1 gap-2"
          :class="store.resourceForm.type === 'group' ? 'btn-warning' : 'btn-ghost border border-panel-border'"
          @click="switchCreateType('group')">
          <i class="fa-solid fa-folder-tree"></i> 节点组
        </button>
      </div>

      <!-- 名称：新建追加到已有组时不需要再填 -->
      <div v-if="showNameField" class="form-control mb-4">
        <label class="label">
          <span class="label-text text-adaptive-muted">
            名称 <span v-if="nameRequired" class="text-error">*</span>
          </span>
        </label>
        <input v-model="store.resourceForm.name" type="text"
          :placeholder="namePlaceholder"
          class="input input-bordered bg-adaptive-input w-full"
          :class="{'input-error': nameError}" />
        <label v-if="nameError" class="label">
          <span class="label-text-alt text-error">节点组名称不能为空</span>
        </label>
      </div>

      <!-- 新建提示 -->
      <div v-if="!store.resourceModal.isEdit" class="mb-3">
        <div class="alert alert-info py-2 text-xs">
          <i class="fa-solid fa-circle-info"></i>
          <span v-if="store.resourceForm.type === 'node'">粘贴一条或多条节点分享链接。多条会拆成多个独立资源，方便以后单独勾选。</span>
          <span v-else-if="groupTarget === 'existing'">把节点链接加到下面选中的已有节点组里，组内原来的节点会保留。</span>
          <span v-else>把多条节点或整份订阅放进同一个资源里，之后在聚合组里一次勾选即可。</span>
        </div>
      </div>

      <!-- 新建节点组：可选择追加到已有组 -->
      <div v-if="!store.resourceModal.isEdit && store.resourceForm.type === 'group' && existingGroups.length" class="mb-4">
        <p class="text-xs text-adaptive-muted mb-2">这些节点要放哪？</p>
        <div class="flex flex-wrap gap-2 mb-3">
          <button type="button" class="btn btn-sm gap-1"
            :class="groupTarget === 'new' ? 'btn-warning' : 'btn-ghost border border-panel-border'"
            @click="groupTarget = 'new'">
            新建节点组
          </button>
          <button type="button" class="btn btn-sm gap-1"
            :class="groupTarget === 'existing' ? 'btn-warning' : 'btn-ghost border border-panel-border'"
            @click="groupTarget = 'existing'">
            追加到已有节点组
          </button>
        </div>
        <div v-if="groupTarget === 'existing'" class="form-control">
          <select v-model="appendGroupId" class="select select-bordered bg-adaptive-input w-full">
            <option value="">请选择要加入的节点组</option>
            <option v-for="group in existingGroups" :key="group.id" :value="String(group.id)">
              {{ group.name }}（已有 {{ resourceNodeCount(group) }} 个节点）
            </option>
          </select>
        </div>
      </div>

      <!-- 编辑远程订阅：只改名称，避免把节点列表当成订阅地址改掉 -->
      <div v-if="isRemoteEdit" class="mb-6 space-y-3">
        <div class="alert py-2 text-xs">
          <i class="fa-solid fa-circle-info"></i>
          <span>这里只改名称。要看里面的节点，请点资源上的「查看」；要更新节点，请点「刷新」重新拉取。</span>
        </div>
        <p v-if="store.resourceForm.source_url" class="text-xs text-adaptive-muted break-all">
          订阅地址：{{ store.resourceForm.source_url }}
        </p>
      </div>

      <!-- 编辑节点组：追加链接，不覆盖原有节点 -->
      <div v-else-if="isGroupEdit" class="form-control mb-6">
        <div class="alert py-2 text-xs mb-3">
          <i class="fa-solid fa-circle-info"></i>
          <span>当前组内有 {{ editingNodeCount }} 个节点。下面只用来追加新链接，原有节点会保留。要查看、改名或删除已有节点，请点「查看组内节点」。</span>
        </div>
        <div class="mb-3">
          <button type="button" class="btn btn-xs btn-ghost" @click="viewEditingGroup">
            查看组内节点
          </button>
        </div>
        <label class="label"><span class="label-text text-adaptive-muted">追加节点链接</span></label>
        <textarea :value="appendUrl" rows="5"
          @input="onAppendInput"
          placeholder="粘贴要追加的节点分享链接或订阅内容。保存后会加到这个组里，原来的节点还在。"
          class="textarea textarea-bordered bg-adaptive-input w-full font-mono text-xs"></textarea>
        <p v-if="previewing" class="text-xs text-adaptive-muted mt-2">正在识别…</p>
        <p v-if="importError" class="text-xs text-error mt-2">{{ importError }}</p>
        <div v-if="importCount" class="mt-3 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-xs text-adaptive-muted">识别到 {{ importCount }} 个节点。</p>
            <span v-for="(count, type) in importTypes" :key="type" class="badge badge-sm badge-outline">{{ type }} {{ count }}</span>
          </div>
          <div v-if="importCatalog.length" class="rounded-xl border border-panel-border p-3 max-h-40 overflow-y-auto custom-scrollbar">
            <div v-for="(node, i) in importCatalog" :key="'cat-'+i" class="flex items-center gap-2 py-0.5 text-xs">
              <span class="badge badge-ghost badge-xs uppercase">{{ node.type || node.protocol || 'node' }}</span>
              <span class="text-adaptive-white truncate">{{ node.name || '未命名' }}</span>
            </div>
          </div>
          <p class="text-xs text-adaptive-muted">保存后会追加到组里。要核对某条节点的 YAML / JSON，保存后在资源池里点开查看即可。</p>
        </div>
      </div>

      <!-- 内容：新建，或编辑单条自建节点 -->
      <div v-else class="form-control mb-6">
        <label class="label">
          <span class="label-text text-adaptive-muted">{{ contentLabel }}</span>
        </label>
        <textarea :value="store.resourceForm.url" rows="5"
          @input="onContentInput"
          :placeholder="contentPlaceholder"
          class="textarea textarea-bordered bg-adaptive-input w-full font-mono text-xs"></textarea>
        <p v-if="previewing" class="text-xs text-adaptive-muted mt-2">正在识别…</p>
        <p v-if="importError" class="text-xs text-error mt-2">{{ importError }}</p>
        <div v-if="importCount" class="mt-3 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-xs text-adaptive-muted">识别到 {{ importCount }} 个节点。</p>
            <span v-for="(count, type) in importTypes" :key="type" class="badge badge-sm badge-outline">{{ type }} {{ count }}</span>
          </div>
          <div v-if="importCatalog.length" class="rounded-xl border border-panel-border p-3 max-h-40 overflow-y-auto custom-scrollbar">
            <div v-for="(node, i) in importCatalog" :key="'cat-g-'+i" class="flex items-center gap-2 py-0.5 text-xs">
              <span class="badge badge-ghost badge-xs uppercase">{{ node.type || node.protocol || 'node' }}</span>
              <span class="text-adaptive-white truncate">{{ node.name || '未命名' }}</span>
            </div>
          </div>
          <p class="text-xs text-adaptive-muted">这里只显示识别结果。要看某条节点的 YAML / JSON 配置，保存后在资源池里点开即可。</p>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="store.resourceModal.show = false">取消</button>
        <button class="btn" :class="store.resourceForm.type === 'node' ? 'btn-primary' : 'btn-warning'"
          @click="saveResource" :disabled="store.submitting">
          <span v-if="store.submitting" class="loading loading-spinner loading-sm"></span>
          {{ saveLabel }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="store.resourceModal.show = false"></form>
  </dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useMainStore } from '../../stores/main.js'
import { authFetch, loadResources, openResourcePreview } from '../../api/index.js'
import { revealResources, showToast } from '../../utils/helpers.js'
import { importPreviewState, mergeSavedResources, typeLabel, resourceNodeCount } from '../../utils/panel.js'
import { API } from '../../api/config.js'

const store = useMainStore()
const nameError = ref(false)
const importCatalog = ref([])
const importTypes = ref({})
const importCount = ref(0)
const importError = ref('')
const previewing = ref(false)
const groupTarget = ref('new')
const appendGroupId = ref('')
const appendUrl = ref('')
let previewTimer = null
let previewSeq = 0

const isGroupEdit = computed(() => store.resourceModal.isEdit && store.resourceForm.type === 'group')
const isRemoteEdit = computed(() => store.resourceModal.isEdit && store.resourceForm.type === 'remote')
const isAppendCreate = computed(() => !store.resourceModal.isEdit && store.resourceForm.type === 'group' && groupTarget.value === 'existing')
const showNameField = computed(() => !isAppendCreate.value)
const nameRequired = computed(() => store.resourceForm.type === 'group' && !isAppendCreate.value)
const existingGroups = computed(() => store.resources.filter(item => item.type === 'group'))
const editingNodeCount = computed(() => resourceNodeCount(store.resources.find(item => String(item.id) === String(store.resourceForm.id)) || { info: { nodeCount: importCount.value } }))

const modalTitle = computed(() => {
  if (!store.resourceModal.isEdit) return '添加资源'
  if (store.resourceForm.type === 'group') return '编辑节点组'
  if (store.resourceForm.type === 'remote') return '编辑远程订阅'
  return '编辑资源'
})

const namePlaceholder = computed(() => {
  if (store.resourceForm.type === 'node') return '留空自动跟随节点链接名称'
  if (store.resourceForm.type === 'remote') return '请输入名称'
  return '请输入节点组名称（必填）'
})

const contentLabel = computed(() => {
  if (store.resourceForm.type === 'node') return '节点分享链接'
  if (isAppendCreate.value) return '要追加的节点或订阅内容'
  return '节点或订阅内容'
})

const contentPlaceholder = computed(() => {
  if (store.resourceForm.type === 'node') {
    return '粘贴节点分享链接，每行一个。多条会拆成多个资源。\n支持 ss、vmess、vless、trojan、hysteria2、tuic、wireguard、socks、http、snell 等'
  }
  if (isAppendCreate.value) return '粘贴要追加的分享链接，或整段 Clash YAML / Base64 订阅。保存后会加到所选节点组里，原有节点保留。'
  return '粘贴多条分享链接，或整段 Clash YAML / Base64 订阅，作为一个节点组'
})

const saveLabel = computed(() => {
  if (isAppendCreate.value || (isGroupEdit.value && appendUrl.value.trim())) return '追加并保存'
  return store.resourceModal.isEdit ? '保存修改' : '添加'
})

function switchCreateType(type) {
  store.resourceForm.type = type
  if (type !== 'group') groupTarget.value = 'new'
}

function clearPreview() {
  importCatalog.value = []
  importTypes.value = {}
  importCount.value = 0
  importError.value = ''
  previewing.value = false
}

function onContentInput(event) {
  const value = event.target.value
  store.resourceForm.url = value
  schedulePreview(value)
}

function onAppendInput(event) {
  const value = event.target.value
  appendUrl.value = value
  schedulePreview(value)
}

function schedulePreview(value) {
  clearTimeout(previewTimer)
  const seq = ++previewSeq
  if (!store.resourceModal.show || store.resourceForm.type === 'remote' || isRemoteEdit.value) {
    clearPreview()
    return
  }
  const text = String(value || '').trim()
  if (!text) {
    clearPreview()
    return
  }
  importCatalog.value = []
  importTypes.value = {}
  importCount.value = 0
  importError.value = ''
  previewing.value = true
  previewTimer = setTimeout(() => refreshImportPreview(text, seq), 250)
}

async function refreshImportPreview(text, seq) {
  try {
    const res = await authFetch(`${API}/check`, { method: 'POST', body: { url: text } })
    if (seq !== previewSeq) return
    const preview = importPreviewState(res.data?.nodes || [], res.error || '没有识别出节点')
    importCount.value = preview.count
    importCatalog.value = preview.all
    importTypes.value = Object.fromEntries(Object.entries(preview.types || {}).map(([key, count]) => [typeLabel(key) || key, count]))
    importError.value = preview.error
  } catch (error) {
    if (seq !== previewSeq) return
    importCatalog.value = []
    importTypes.value = {}
    importCount.value = 0
    importError.value = error.message || '没有识别出可用节点，请检查粘贴的内容'
  } finally {
    if (seq === previewSeq) previewing.value = false
  }
}

function resetLocalState() {
  groupTarget.value = 'new'
  appendGroupId.value = ''
  appendUrl.value = ''
  nameError.value = false
  clearPreview()
}

watch(() => store.resourceModal.show, (open) => {
  if (open) {
    const text = isGroupEdit.value ? appendUrl.value : store.resourceForm.url
    schedulePreview(text)
  } else {
    resetLocalState()
  }
})

watch(() => store.resourceForm.type, () => {
  if (store.resourceModal.show && !isGroupEdit.value && !isRemoteEdit.value) {
    schedulePreview(store.resourceForm.url)
  }
})

async function viewEditingGroup() {
  const resource = store.resources.find(item => String(item.id) === String(store.resourceForm.id))
  if (!resource) {
    showToast('没有找到这个节点组', 'error')
    return
  }
  store.resourceModal.show = false
  await openResourcePreview(resource)
}

async function saveResource() {
  if (isRemoteEdit.value) {
    if (!String(store.resourceForm.name || '').trim()) {
      showToast('请填写名称', 'error')
      return
    }
    return submitUpdate({ name: store.resourceForm.name })
  }

  if (isGroupEdit.value) {
    if (!store.resourceForm.name) {
      nameError.value = true
      return
    }
    nameError.value = false
    const body = { name: store.resourceForm.name }
    if (appendUrl.value.trim()) {
      body.url = appendUrl.value
      body.append = true
    }
    return submitUpdate(body, appendUrl.value.trim() ? '已追加到节点组' : '修改成功')
  }

  if (isAppendCreate.value) {
    if (!appendGroupId.value) {
      showToast('请选择要加入的节点组', 'error')
      return
    }
    if (!store.resourceForm.url) {
      showToast('请粘贴要追加的节点链接或订阅内容', 'error')
      return
    }
    return submitUpdate({ url: store.resourceForm.url, append: true }, '已追加到节点组', appendGroupId.value)
  }

  if (!store.resourceForm.url) { showToast('请粘贴节点链接或订阅内容', 'error'); return }

  if (store.resourceForm.type === 'group' && !store.resourceForm.name) {
    nameError.value = true
    return
  }
  nameError.value = false

  store.submitting = true
  try {
    const res = await authFetch(`${API}/subs`, { method: 'POST', body: store.resourceForm })
    if (!res.success) {
      showToast(res.error || '导入失败', 'error')
      return
    }
    if (res.warnings?.length) showToast(`已保存，有链接未识别：${res.warnings[0].message}`, 'error')
    else showToast('添加成功。已在资源池中标出，点开就能查看节点或继续追加链接。')
    store.resourceModal.show = false
    if (Array.isArray(res.resources) && res.resources.length) {
      store.resources = mergeSavedResources(store.resources, res.resources)
    }
    await loadResources()
    if (Array.isArray(res.resources) && res.resources.length) {
      store.resources = mergeSavedResources(store.resources, res.resources)
    }
    revealResources(res.resources)
  } catch (e) { showToast(e.message || '操作失败', 'error') }
  finally { store.submitting = false }
}

async function submitUpdate(body, successText = '修改成功', id = store.resourceForm.id) {
  store.submitting = true
  try {
    const res = await authFetch(`${API}/subs/${id}`, { method: 'PUT', body })
    if (!res.success) {
      showToast(res.error || '保存失败', 'error')
      return
    }
    if (res.warnings?.length) showToast(`已保存，有链接未识别：${res.warnings[0].message}`, 'error')
    else showToast(successText)
    store.resourceModal.show = false
    if (Array.isArray(res.resources) && res.resources.length) {
      store.resources = mergeSavedResources(store.resources, res.resources)
    }
    await loadResources()
    if (Array.isArray(res.resources) && res.resources.length) {
      store.resources = mergeSavedResources(store.resources, res.resources)
    }
    revealResources(res.resources)
  } catch (e) { showToast(e.message || '操作失败', 'error') }
  finally { store.submitting = false }
}
</script>
