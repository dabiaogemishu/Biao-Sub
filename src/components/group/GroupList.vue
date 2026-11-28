<template>
  <div>
    <!-- 操作栏 -->
    <div class="flex flex-wrap gap-2 mb-4 sm:mb-6">
      <button class="btn btn-accent btn-sm sm:btn-md gap-2 shadow-lg" @click="openAddGroup">
        <i class="fa-solid fa-plus"></i> 新建聚合组
      </button>
    </div>
    <p class="text-xs text-adaptive-muted mb-4">把资源池里已添加的节点组合成一条订阅。按客户端复制 Clash、Base64 或 sing-box 链接，粘贴进去即可。</p>

    <!-- 聚合组列表 -->
    <div ref="groupListRef" class="grid gap-3 sm:gap-4">
      <div v-for="g in store.groups" :key="g.id"
        class="card glass-panel hover:shadow-xl transition-all duration-300 group border border-transparent hover:border-accent/30"
        :data-id="g.id">
        <div class="card-body p-3 sm:p-5">
          <div class="flex items-start gap-2 sm:gap-3">
            <!-- 拖拽手柄 -->
            <div class="drag-handle pt-1 opacity-30 group-hover:opacity-100 transition-opacity">
              <i class="fa-solid fa-grip-vertical text-adaptive-muted"></i>
            </div>
            <!-- 图标 -->
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center flex-shrink-0">
              <i class="fa-solid fa-layer-group text-sm sm:text-base"></i>
            </div>
            <!-- 信息 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-adaptive-white text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">{{ g.name }}</h3>
                <span class="badge badge-accent badge-sm">
                  {{ isRawMode(g) ? '托管 YAML' : `${(g.config || []).length}个资源` }}
                </span>
                <span v-for="label in processBadges(g)" :key="label" class="badge badge-outline badge-sm">{{ label }}</span>
                <span v-if="g.access_count" class="badge badge-ghost badge-sm">
                  <i class="fa-solid fa-chart-simple mr-1"></i> {{ g.access_count }}次
                </span>
              </div>
              <!-- 订阅链接 -->
              <div class="mt-2 flex flex-wrap gap-1 sm:gap-2">
                <button @click="copyLink(g.token, 'clash')" class="btn btn-xs btn-outline btn-primary gap-1 tooltip" data-tip="完整 Clash 订阅，含策略组、规则和链式代理">
                  <i class="fa-solid fa-copy"></i> Clash
                </button>
                <button @click="copyLink(g.token, 'base64')" class="btn btn-xs btn-outline btn-secondary gap-1 tooltip" data-tip="给 v2rayN 等用的节点列表，不含链式">
                  <i class="fa-solid fa-copy"></i> Base64
                </button>
                <button @click="copyLink(g.token, 'singbox')" class="btn btn-xs btn-outline btn-accent gap-1 tooltip" data-tip="sing-box 出站配置，不含链式">
                  <i class="fa-solid fa-copy"></i> sing-box
                </button>
                <button @click="copyLink(g.token, 'list')" class="btn btn-xs btn-outline gap-1 tooltip" data-tip="只有节点的 Clash 列表，可给 proxy-provider 用，不含链式">
                  <i class="fa-solid fa-copy"></i> 节点列表
                </button>
              </div>
              <p v-if="hasChain(g)" class="text-xs text-warning mt-2 leading-relaxed">这个聚合组启用了链式代理。请复制「Clash」订阅使用；Base64、sing-box 和节点列表仍是普通节点，不含链式。</p>
            </div>
            <!-- 操作按钮 -->
            <div class="flex gap-1 flex-shrink-0">
              <button @click="openEditGroup(g)" class="btn btn-circle btn-ghost btn-xs sm:btn-sm tooltip" data-tip="编辑这个聚合组">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button @click="deleteGroup(g.id)" class="btn btn-circle btn-ghost btn-xs sm:btn-sm text-error tooltip" data-tip="删除这个聚合组">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="store.groups.length === 0" class="text-center py-16">
      <i class="fa-solid fa-object-ungroup text-6xl text-adaptive-muted opacity-30 mb-4"></i>
      <p class="text-adaptive-muted text-lg">还没有聚合组。把资源池里的节点组合起来，就能得到一条订阅链接。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useMainStore } from '../../stores/main.js'
import { authFetch, loadGroups } from '../../api/index.js'
import { showToast, copyText } from '../../utils/helpers.js'
import { moveItem, processLabels, subscriptionLinks, withProcess, defaultProcess } from '../../utils/panel.js'
import { API } from '../../api/config.js'
import { defaultHeader, defaultRules } from '../../api/config.js'

const store = useMainStore()
const groupListRef = ref(null)

function hasChain(group) {
  return (group.config || []).some(item => item?.dialerProxy?.enabled)
}

function isRawMode(g) {
  try {
    const cc = typeof g.clash_config === 'string' ? JSON.parse(g.clash_config) : g.clash_config
    return cc && cc.mode === 'raw'
  } catch (e) { return false }
}

function openAddGroup() {
  store.groupForm = {
    id: null, name: '',
    config: [],
    clash_config: { mode: 'generate', header: '', groups: [], rules: '', resources: [], raw_yaml: '' }
  }
  store.groupModal.isEdit = false
  store.groupModal.tab = 'base'
  store.templateModal.show = true
}

function openEditGroup(g) {
  store.groupForm = {
    id: g.id, name: g.name,
    config: JSON.parse(JSON.stringify(g.config || [])),
    clash_config: withProcess(JSON.parse(JSON.stringify(g.clash_config || { mode: 'generate', header: '', groups: [], rules: '', resources: [], raw_yaml: '' })))
  }
  store.groupModal.isEdit = true
  store.groupModal.tab = store.groupForm.clash_config.mode === 'raw' ? 'raw' : 'base'
  store.groupModal.show = true
}

function clashConfigOf(group) {
  try {
    return typeof group.clash_config === 'string' ? JSON.parse(group.clash_config) : (group.clash_config || {})
  } catch { return {} }
}

function processBadges(group) {
  return processLabels(clashConfigOf(group).process)
}

function copyLink(token, format) {
  const links = subscriptionLinks(window.location.origin, token)
  const url = format === 'base64' ? links.base64 : format === 'singbox' ? links.singbox : format === 'list' ? links.list : links.clash
  copyText(url)
}

async function deleteGroup(id) {
  if (!confirm('确定删除这个聚合组？删除后，这条订阅链接也会失效。')) return
  try {
    const res = await authFetch(`${API}/groups/${id}`, { method: 'DELETE' })
    if (!res.success) { showToast(res.error || '删除失败', 'error'); return }
    store.groups = store.groups.filter(item => String(item.id) !== String(id))
    showToast('已删除')
    await loadGroups()
  } catch (e) { showToast('删除失败', 'error') }
}

// Sortable
let sortableInstance = null
async function initSortable() {
  if (!groupListRef.value) return
  try {
    const { default: Sortable } = await import('sortablejs')
    if (sortableInstance) sortableInstance.destroy()
    sortableInstance = new Sortable(groupListRef.value, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      onEnd: async (evt) => {
        if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
        const previous = store.groups.slice()
        const next = moveItem(store.groups, evt.oldIndex, evt.newIndex)
        store.groups = next
        try {
          const res = await authFetch(`${API}/groups/reorder`, {
            method: 'POST',
            body: { order: next.map(item => item.id) }
          })
          if (!res.success) {
            store.groups = previous
            showToast(res.error || '排序保存失败', 'error')
          }
        } catch (e) {
          store.groups = previous
          showToast('排序保存失败', 'error')
        }
        await nextTick()
        initSortable()
      }
    })
  } catch (e) { console.error('Sortable init failed:', e) }
}

onMounted(() => { nextTick(initSortable) })
watch(() => store.groups.length, () => { nextTick(initSortable) })
</script>
