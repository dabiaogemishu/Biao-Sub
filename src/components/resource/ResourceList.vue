<template>
  <div>
    <!-- 操作栏 -->
    <div class="flex flex-wrap gap-2 mb-4 sm:mb-6 items-center">
      <label class="input input-bordered input-sm sm:input-md bg-adaptive-input flex items-center gap-2 flex-1 min-w-[12rem] max-w-md">
        <i class="fa-solid fa-magnifying-glass text-adaptive-muted text-xs"></i>
        <input v-model="store.resourceQuery" type="search" class="grow bg-transparent outline-none" placeholder="搜索节点、节点组或订阅名称" />
      </label>
      <button class="btn btn-primary btn-sm sm:btn-md gap-2 shadow-lg tooltip tooltip-bottom" data-tip="粘贴节点分享链接，或把多条节点收成一个节点组" @click="openAddResource">
        <i class="fa-solid fa-plus"></i> 添加资源
      </button>
      <button class="btn btn-secondary btn-sm sm:btn-md gap-2 shadow-lg tooltip tooltip-bottom" data-tip="填写机场订阅地址，在线拉取节点" @click="$emit('openRemote')">
        <i class="fa-solid fa-globe"></i> 远程订阅
      </button>
      <button class="btn btn-sm sm:btn-md gap-2" :class="store.batchMode ? 'btn-warning' : 'btn-ghost'" @click="toggleBatch">
        <i class="fa-solid fa-check-double"></i> {{ store.batchMode ? '退出批量' : '批量操作' }}
      </button>
      <button v-if="store.batchMode && store.selectedResources.length > 0"
        class="btn btn-error btn-sm sm:btn-md gap-2" @click="batchDelete">
        <i class="fa-solid fa-trash"></i> 删除 ({{ store.selectedResources.length }})
      </button>
      <div v-if="store.batchMode" class="flex gap-2">
        <button class="btn btn-xs btn-ghost" @click="selectAll">全选</button>
        <button class="btn btn-xs btn-ghost" @click="store.selectedResources = []">取消</button>
      </div>
    </div>
    <p class="text-xs text-adaptive-muted mb-3">「添加资源」用来粘贴节点链接；「远程订阅」用来填写机场订阅地址。要给客户端用时，再到「聚合组」里组合并复制链接。</p>
    <!-- 筛选按钮 -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button class="btn btn-xs gap-1" :class="store.resourceFilter === 'all' ? 'btn-primary' : 'btn-ghost border border-panel-border'" @click="store.resourceFilter = 'all'">
        全部 <span class="badge badge-xs">{{ store.resources.length }}</span>
      </button>
      <button class="btn btn-xs gap-1" :class="store.resourceFilter === 'node' ? 'btn-primary' : 'btn-ghost border border-panel-border'" @click="store.resourceFilter = 'node'">
        <i class="fa-solid fa-server"></i> 自建节点 <span class="badge badge-xs">{{ store.stats.nodeCount }}</span>
      </button>
      <button class="btn btn-xs gap-1" :class="store.resourceFilter === 'group' ? 'btn-warning' : 'btn-ghost border border-panel-border'" @click="store.resourceFilter = 'group'">
        <i class="fa-solid fa-folder-tree"></i> 节点组 <span class="badge badge-xs">{{ store.stats.groupCount }}</span>
      </button>
      <button class="btn btn-xs gap-1" :class="store.resourceFilter === 'remote' ? 'btn-success' : 'btn-ghost border border-panel-border'" @click="store.resourceFilter = 'remote'">
        <i class="fa-solid fa-cloud-arrow-down"></i> 远程订阅 <span class="badge badge-xs">{{ store.stats.remoteCount }}</span>
      </button>
    </div>

    <!-- 资源列表 -->
    <div ref="resourceListRef" class="grid gap-3 sm:gap-4">
      <div v-for="r in filteredResources" :key="r.id"
        class="card glass-panel hover:shadow-xl transition-all duration-300 group border border-transparent hover:border-primary/30"
        :class="{ 'just-saved': isHighlighted(r.id) }"
        :data-id="r.id">
        <div class="card-body p-3 sm:p-4">
          <div class="flex items-start gap-2 sm:gap-3">
            <!-- 批量选择 -->
            <div v-if="store.batchMode" class="pt-1">
              <input type="checkbox" class="checkbox checkbox-primary checkbox-sm"
                :checked="store.selectedResources.includes(r.id)"
                @change="toggleSelect(r.id)" />
            </div>
            <!-- 拖拽手柄 -->
            <div v-if="!store.batchMode" class="drag-handle pt-1 opacity-30 group-hover:opacity-100 transition-opacity">
              <i class="fa-solid fa-grip-vertical text-adaptive-muted"></i>
            </div>
            <!-- 图标 -->
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              :class="r.type === 'node' ? 'bg-primary/20 text-primary' : r.type === 'remote' ? 'bg-success/20 text-success' : r.type === 'group' ? 'bg-warning/20 text-warning' : 'bg-secondary/20 text-secondary'">
              <i :class="r.type === 'node' ? 'fa-solid fa-server' : r.type === 'remote' ? 'fa-solid fa-cloud-arrow-down' : r.type === 'group' ? 'fa-solid fa-folder-tree' : 'fa-solid fa-plane'" class="text-sm sm:text-base"></i>
            </div>
            <!-- 信息：点击名称即可查看节点 -->
            <div class="flex-1 min-w-0 cursor-pointer" @click="openPreview(r)">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-adaptive-white text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">{{ r.name }}</h3>
                <span class="badge badge-sm"
                  :class="r.type === 'node' ? 'badge-primary' : r.type === 'remote' ? 'badge-success' : r.type === 'group' ? 'badge-warning' : 'badge-secondary'">
                  {{ r.type === 'node' ? '自建' : r.type === 'remote' ? '远程订阅' : r.type === 'group' ? '节点组' : '订阅' }}
                </span>
                <span v-if="r.info && r.info.nodeCount" class="badge badge-ghost badge-sm">
                  <i class="fa-solid fa-diagram-project mr-1"></i> {{ r.info.nodeCount }}个节点
                </span>
                <span v-if="getUADisplay(r)" class="badge badge-xs sm:badge-sm" :class="getUADisplay(r).class">
                  {{ getUADisplay(r).text }}
                </span>
                <span v-if="isHighlighted(r.id)" class="badge badge-primary badge-sm">刚保存</span>
              </div>

            </div>
            <!-- 操作按钮 -->
            <div class="flex gap-1 sm:gap-1 flex-shrink-0">
              <button v-if="r.type === 'remote'" @click="$emit('refreshRemote', r)" class="btn btn-circle btn-ghost btn-xs sm:btn-sm tooltip" data-tip="重新拉取这份机场订阅的最新节点">
                <i class="fa-solid fa-rotate"></i>
              </button>
              <button v-if="r.type === 'group'" @click="openAppendGroup(r)" class="btn btn-circle btn-ghost btn-xs sm:btn-sm tooltip" data-tip="向这个节点组追加节点链接">
                <i class="fa-solid fa-plus"></i>
              </button>
              <button @click="openPreview(r)" class="btn btn-circle btn-ghost btn-xs sm:btn-sm tooltip" data-tip="查看、改名、排序、删除里面的节点，节点组还可以追加链接">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button @click="openEditResource(r)" class="btn btn-circle btn-ghost btn-xs sm:btn-sm tooltip" :data-tip="r.type === 'group' ? '改名称，或追加节点链接' : r.type === 'remote' ? '改这份远程订阅的名称' : '编辑这份资源'">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button @click="deleteResource(r.id)" class="btn btn-circle btn-ghost btn-xs sm:btn-sm text-error tooltip" data-tip="删除这份资源">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!store.resourcesReady" class="text-center py-16">
      <span class="loading loading-spinner loading-md text-primary"></span>
      <p class="text-adaptive-muted mt-3">正在加载资源...</p>
    </div>
    <div v-else-if="store.resourcesFailed" class="text-center py-16">
      <p class="text-error text-lg mb-4">资源加载失败，请再试一次</p>
      <button class="btn btn-primary btn-sm" @click="retryLoad">重新加载</button>
    </div>
    <div v-else-if="store.resources.length === 0" class="text-center py-16">
      <i class="fa-solid fa-box-open text-6xl text-adaptive-muted opacity-30 mb-4"></i>
      <p class="text-adaptive-muted text-lg mb-4">还没有资源。先点「添加资源」粘贴节点，或点「远程订阅」导入机场链接。</p>
      <div class="flex flex-wrap gap-2 justify-center">
        <button class="btn btn-primary btn-sm gap-1" @click="openAddResource"><i class="fa-solid fa-plus"></i> 添加资源</button>
        <button class="btn btn-secondary btn-sm gap-1" @click="$emit('openRemote')"><i class="fa-solid fa-globe"></i> 远程订阅</button>
      </div>
    </div>
    <div v-else-if="filteredResources.length === 0" class="text-center py-12">
      <p class="text-adaptive-muted mb-3">没有符合筛选或搜索条件的资源</p>
      <button class="btn btn-sm btn-ghost" @click="clearViewFilters">清除筛选和搜索</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useMainStore } from '../../stores/main.js'
import { authFetch, loadResources, openResourcePreview } from '../../api/index.js'
import { showToast } from '../../utils/helpers.js'
import { API } from '../../api/config.js'

const store = useMainStore()
const resourceListRef = ref(null)

const emit = defineEmits(['openRemote', 'refreshRemote'])

const filteredResources = computed(() => {
  const query = String(store.resourceQuery || '').trim().toLowerCase()
  return store.resources.filter(r => {
    if (store.resourceFilter !== 'all' && r.type !== store.resourceFilter) return false
    if (!query) return true
    return String(r.name || '').toLowerCase().includes(query)
  })
})

function isHighlighted(id) {
  return store.highlightedResourceIds.includes(String(id))
}

function clearViewFilters() {
  store.resourceFilter = 'all'
  store.resourceQuery = ''
}

async function retryLoad() {
  store.resourcesReady = false
  await loadResources()
}

function getUADisplay(r) {
  if (r.type !== 'remote') return null
  try {
    const p = typeof r.params === 'string' ? JSON.parse(r.params) : (r.params || {})
    const ua = p.ua || 'clash-verge/v1.7.7' // 默认视为 Clash
    
    if (ua.includes('v2rayNG')) return { text: 'v2rayNG', class: 'badge-info badge-outline' }
    if (ua.includes('ClashMeta')) return { text: 'Clash Meta', class: 'badge-warning badge-outline' }
    if (ua.includes('clash-verge')) return { text: 'Clash', class: 'badge-primary badge-outline' }
    
    return { text: '其他客户端', class: 'badge-ghost' }
  } catch (e) { return null }
}

function openAddResource() {
  store.resourceForm = { name: '', url: '', type: 'node', source_url: '', appendUrl: '' }
  store.resourceModal.isEdit = false
  store.resourceModal.show = true
}

function openPreview(r) {
  store.previewModal.appendOpen = false
  openResourcePreview(r)
}

function openAppendGroup(r) {
  store.previewModal.appendOpen = true
  openResourcePreview(r, { append: true })
}

function openEditResource(r) {
  store.resourceForm = {
    id: r.id,
    name: r.name,
    url: r.url,
    type: r.type,
    source_url: r.source_url || '',
    appendUrl: ''
  }
  store.resourceModal.isEdit = true
  store.resourceModal.show = true
}

function toggleBatch() {
  store.batchMode = !store.batchMode
  if (!store.batchMode) store.selectedResources = []
}

function toggleSelect(id) {
  const idx = store.selectedResources.indexOf(id)
  if (idx === -1) store.selectedResources.push(id)
  else store.selectedResources.splice(idx, 1)
}

function selectAll() {
  store.selectedResources = filteredResources.value.map(r => r.id)
}

async function deleteResource(id) {
  if (!confirm('确定删除这个资源？引用它的聚合组也会同时去掉这份资源。')) return
  try {
    const res = await authFetch(`${API}/subs/${id}`, { method: 'DELETE' })
    if (!res.success) { showToast(res.error || '删除失败', 'error'); return }
    store.resources = store.resources.filter(item => String(item.id) !== String(id))
    showToast('已删除')
    await loadResources()
  } catch (e) { showToast('删除失败', 'error') }
}

async function batchDelete() {
  if (!confirm(`确定删除选中的 ${store.selectedResources.length} 个资源？引用它们的聚合组也会同时去掉这些资源。`)) return
  const ids = store.selectedResources.map(id => String(id))
  try {
    const res = await authFetch(`${API}/subs/delete`, { method: 'POST', body: { ids: store.selectedResources } })
    if (!res.success) { showToast(res.error || '删除失败', 'error'); return }
    store.resources = store.resources.filter(item => !ids.includes(String(item.id)))
    store.selectedResources = []
    store.batchMode = false
    showToast('已删除选中的资源')
    await loadResources()
  } catch (e) { showToast('删除失败', 'error') }
}

// Sortable
let sortableInstance = null
async function initSortable() {
  if (!resourceListRef.value) return
  try {
    const { default: Sortable } = await import('sortablejs')
    if (sortableInstance) sortableInstance.destroy()
    sortableInstance = new Sortable(resourceListRef.value, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      onEnd: async () => {
        const order = Array.from(resourceListRef.value.children).map(el => parseInt(el.dataset.id))
        try { await authFetch(`${API}/subs/reorder`, { method: 'POST', body: { order } }) }
        catch (e) { console.error(e) }
      }
    })
  } catch (e) { console.error('Sortable init failed:', e) }
}

async function scrollToHighlighted() {
  const id = store.highlightedResourceIds[0]
  if (!id || !resourceListRef.value) return
  await nextTick()
  const el = resourceListRef.value.querySelector(`[data-id="${id}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

onMounted(() => { nextTick(initSortable) })
watch(() => store.resources.length, () => { nextTick(initSortable) })
watch(() => store.highlightedResourceIds.slice(), () => { scrollToHighlighted() })
</script>
