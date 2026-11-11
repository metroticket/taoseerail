<template>
  <!-- 桌面版專屬懸浮按鈕 (位在人流去向分析上方) -->
  <button
    type="button"
    class="hourly-float-trigger-btn desktop-only"
    :class="{ 'is-active': active }"
    @click="$emit('click')"
    title="車站分時運量趨勢"
  >
    <span class="trigger-icon">📈</span>
    <span class="trigger-text">分時運量趨勢</span>
  </button>
</template>

<script setup>
defineProps({
  active: { type: Boolean, default: false }
});

defineEmits(['click']);
</script>

<style scoped>
/* 預設桌機版呈現：精確定位在人流去向分析 (bottom: 24px) 正上方 */
.hourly-float-trigger-btn {
  position: fixed;
  right: 20px;
  bottom: 78px; /* 關鍵：高於 人流去向分析 (bottom: 24px) */
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 9999px;
  color: #f8fafc;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  user-select: none;
}

.hourly-float-trigger-btn:hover {
  transform: translateY(-2px);
  border-color: #38bdf8;
  box-shadow: 0 6px 24px rgba(56, 189, 248, 0.25);
}

.hourly-float-trigger-btn.is-active {
  background: rgba(2, 132, 199, 0.35);
  border-color: #38bdf8;
  color: #38bdf8;
}

.trigger-icon {
  font-size: 16px;
}

.trigger-text {
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* 行動版隱藏 (<= 1024px 自動隱藏，不干擾手機介面) */
@media (max-width: 1024px) {
  .desktop-only {
    display: none !important;
  }
}
</style>