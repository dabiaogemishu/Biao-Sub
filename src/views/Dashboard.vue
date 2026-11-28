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
import { authFetch, loadResources, openResourcePreview } from '../api/index.js'
import { revealResources, showToast } from '../utils/helpers.js'
import { API } from '../api/config.js'
import StatsCards from '../components/resource/StatsCards.vue'
import ResourceList from '../components/resource/ResourceList.vue'
import GroupList from '../components/group/GroupList.vue'
import TabBar from '../components/layout/TabBar.vue'

const store = useMainStore()

async function handlePreview(resource) {
  await openResourcePreview(resource)
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
      revealResources([resource])
    } else {
      showToast(res.error || '重新拉取失败', 'error')
    }
  } catch (e) {
    showToast('重新拉取失败', 'error')
  }
}
</script>
