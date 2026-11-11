<template>
  <div class="top-right-countdown-hud desktop-only">
    <!-- 呼吸指示燈本體 -->
    <div class="status-pulse-dot" :class="`dot-${syncFreshnessStatus}`"></div>

    <!-- 狀態文字與異常時間提示 -->
    <div class="status-text-group">
      <span class="status-title" :class="`text-${syncFreshnessStatus}`">
        <template v-if="syncStatus === 'syncing'">正在同步運量...</template>
        <template v-else>{{ statusText }}</template>
      </span>
      <!-- 僅異常時呈現最後截至時間 -->
      <span 
        v-if="syncFreshnessStatus === 'red' && flowSummary?.dataEndTime" 
        class="status-time-tag text-red-sub"
      >
        (停留在 {{ flowSummary.dataEndTime }})
      </span>
    </div>

    <!-- 立即更新按鈕 -->
    <button 
      type="button"
      class="btn-refresh-clean" 
      :disabled="syncStatus === 'syncing'" 
      @click="onRefreshClick"
    >
      {{ syncStatus === 'syncing' ? '同步中...' : '立即更新' }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  syncStatus: { type: String, default: 'success' },
  flowSummary: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['refresh']);

const onRefreshClick = () => {
  if (props.syncStatus !== 'syncing') {
    emit('refresh');
  }
};

const syncFreshnessStatus = computed(() => {
  if (props.syncStatus === 'error') return 'red';
  const endTimeStr = props.flowSummary?.dataEndTime?.trim();
  if (!endTimeStr) return 'green';

  let targetDate;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(endTimeStr)) {
    const todayStr = new Date().toISOString().split('T')[0];
    targetDate = new Date(`${todayStr} ${endTimeStr}`);
  } else {
    targetDate = new Date(endTimeStr.replace(/-/g, '/'));
  }

  const diffMinutes = Math.floor((Date.now() - targetDate.getTime()) / 60000);

  if (isNaN(diffMinutes) || diffMinutes > 60) return 'red';
  if (diffMinutes > 18) return 'yellow';
  return 'green';
});

const statusText = computed(() => {
  switch (syncFreshnessStatus.value) {
    case 'green': return '同步資料最新';
    case 'yellow': return '資料延遲中';
    case 'red': return '資料異常中';
    default: return '同步資料最新';
  }
});
</script>

<style scoped>
.top-right-countdown-hud {
  position: absolute;
  top: 18px;
  right: 18px;
  width: fit-content;
  max-width: max-content;
  z-index: 1000;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none;
  white-space: nowrap;
}

.status-pulse-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-green {
  background-color: #10b981;
  box-shadow: 0 0 0 rgba(16, 185, 129, 0.6);
  animation: pulse-green 2s infinite ease-in-out;
}
.dot-yellow {
  background-color: #f59e0b;
  box-shadow: 0 0 0 rgba(245, 158, 11, 0.6);
  animation: pulse-yellow 2s infinite ease-in-out;
}
.dot-red {
  background-color: #ef4444;
  box-shadow: 0 0 0 rgba(239, 68, 68, 0.6);
  animation: pulse-red 2s infinite ease-in-out;
}

.text-green { color: #34d399 !important; }
.text-yellow { color: #fbbf24 !important; }
.text-red { color: #f87171 !important; }

.status-text-group {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.status-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.status-time-tag {
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.text-red-sub {
  color: #fca5a5 !important;
  opacity: 0.9;
}

@keyframes pulse-green {
  0%, 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  50% { transform: scale(1.15); box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
}
@keyframes pulse-yellow {
  0%, 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
  50% { transform: scale(1.15); box-shadow: 0 0 0 7px rgba(245, 158, 11, 0); }
}
@keyframes pulse-red {
  0%, 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  50% { transform: scale(1.15); box-shadow: 0 0 0 7px rgba(239, 68, 68, 0); }
}

.btn-refresh-clean {
  background: transparent;
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  padding: 2px 0 2px 10px;
  color: #38bdf8;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-refresh-clean:hover:not(:disabled) {
  color: #7dd3fc;
  text-decoration: underline;
}

.btn-refresh-clean:disabled {
  color: #64748b;
  cursor: not-allowed;
}

/* ⭐ 與全專案統一為 1024px，避免桌機/手機過渡空白 */
@media (max-width: 1024px) {
  .desktop-only {
    display: none !important;
  }
}
</style>