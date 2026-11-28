<template>
  <div class="biaosub-tabs glass-panel mb-4 sm:mb-8 shadow-xl border border-panel-border">
    <button type="button" class="biaosub-tab tooltip tooltip-bottom"
      :class="{ 'biaosub-tab-resources': store.currentTab === 'resources' }"
      :aria-pressed="store.currentTab === 'resources'"
      data-tip="存放自建节点、节点组和机场订阅"
      @click="store.currentTab = 'resources'">
      <i class="fa-solid fa-database"></i> <span>资源池</span>
    </button>
    <button type="button" class="biaosub-tab tooltip tooltip-bottom"
      :class="{ 'biaosub-tab-groups': store.currentTab === 'groups' }"
      :aria-pressed="store.currentTab === 'groups'"
      data-tip="把资源组合成一条订阅，复制给客户端"
      @click="store.currentTab = 'groups'">
      <i class="fa-solid fa-layer-group"></i> <span>聚合组</span>
    </button>
  </div>
</template>

<script setup>
import { useMainStore } from '../../stores/main.js'
const store = useMainStore()
</script>
