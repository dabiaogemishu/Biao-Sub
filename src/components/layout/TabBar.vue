<template>
  <div class="biaosub-tabs glass-panel mb-4 sm:mb-8 shadow-xl border border-panel-border">
    <button type="button" class="biaosub-tab"
      :class="{ 'biaosub-tab-resources': store.currentTab === 'resources' }"
      :aria-pressed="store.currentTab === 'resources'"
      @click="store.currentTab = 'resources'">
      <i class="fa-solid fa-database"></i> <span>资源池</span>
    </button>
    <button type="button" class="biaosub-tab"
      :class="{ 'biaosub-tab-groups': store.currentTab === 'groups' }"
      :aria-pressed="store.currentTab === 'groups'"
      @click="store.currentTab = 'groups'">
      <i class="fa-solid fa-layer-group"></i> <span>聚合订阅组</span>
    </button>
  </div>
</template>

<script setup>
import { useMainStore } from '../../stores/main.js'
const store = useMainStore()
</script>
