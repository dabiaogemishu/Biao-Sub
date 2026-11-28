<template>
  <div>
    <!-- 统计卡片 -->
    <StatsCards />

    <!-- Tab -->
    <TabBar />

    <!-- 资源池 -->
    <div v-show="store.currentTab === 'resources'">
      <ResourceList @preview="handlePreview" @openRemote="openRemote" @refreshRemote="handleRefreshRemote" />
    </div>

    <!-- 聚合组 -->
    <div v-show="store.currentTab === 'groups'">
      <GroupList />
    </div>
  </div>
</template>

<script setup>
import { useMainStore } from '../stores/main.js'
import { authFetch, loadResources } from '../api/index.js'
import { showToast } from '../utils/helpers.js'
import { API } from '../api/config.js'
import StatsCards from '../components/resource/StatsCards.vue'
import ResourceList from '../components/resource/ResourceList.vue'
import GroupList from '../components/group/GroupList.vue'
import TabBar from '../components/layout/TabBar.vue'

const store = useMainStore()

async function handlePreview(resource) {
  store.previewModal.resourceId = resource.id
  store.previewModal.resourceItem = resource
  store.previewModal.sortMode = false
  store.previewModal.editMode = false

  try {
    const res = await authFetch(`${API}/check`, {
      method: 'POST',
      body: { url: resource.url }
    })
    if (res.success) {
      store.previewModal.nodes = res.data.nodes || []
      store.previewModal.originalNodes = JSON.parse(JSON.stringify(res.data.nodes || []))
      if (res.data.errors?.length) showToast(res.data.errors[0].message, 'error')
    } else {
      store.previewModal.nodes = []
      showToast(res.error || '没有识别到节点，请检查这份资源的内容', 'error')
    }
  } catch (e) {
    store.previewModal.nodes = []
  }

  store.previewModal.show = true
}

function openRemote() {
  store.remoteModal.show = true
  store.remoteModal.url = ''
  store.remoteModal.name = ''
  store.remoteModal.content = ''
  store.remoteModal.error = ''
}

async function handleRefreshRemote(resource) {
  if (!confirm(`重新拉取「${resource.name}」的最新节点？拉取成功后会替换当前节点。`)) return
  try {
    const res = await authFetch(`${API}/remote/refresh/${resource.id}`, { method: 'POST' })
    if (res.success) {
      showToast(`已更新，共 ${res.data.nodeCount} 个节点`)
      await loadResources()
    } else {
      showToast(res.error || '重新拉取失败', 'error')
    }
  } catch (e) {
    showToast('重新拉取失败', 'error')
  }
}
</script>
