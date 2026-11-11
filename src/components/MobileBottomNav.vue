<template>
  <!-- 📱 手機版專屬底部常駐導航列 (5 欄均分布局) -->
  <nav class="mobile-bottom-navbar">
    <!-- 1. 即時戰情 -->
    <button 
      type="button" 
      class="nav-tab-btn" 
      :class="{ 'is-active': isPanelOpen && activeTab === 'overview' }"
      @click="handleTabClick('overview')"
    >
      <span class="nav-icon">📊</span>
      <span class="nav-text">即時戰情</span>
    </button>

    <!-- 2. 人流去向 (已與倍速按鈕調換位置) -->
    <button 
      type="button" 
      class="nav-tab-btn" 
      :class="{ 'is-active': isPeopleWhereActive }"
      @click="handleTabClick('od')"
    >
      <span class="nav-icon">🧭</span>
      <span class="nav-text">人流去向</span>
    </button>

    <!-- 3. 中央速度膠囊 (位在正中央第 3 欄) -->
    <div class="speed-control-wrapper">
      <button 
        type="button" 
        class="nav-center-pill" 
        :class="{ 'is-active': isSpeedMenuOpen }"
        @click="handleSpeedClick"
        title="點擊調整播放速度"
      >
        <span class="pill-speed">{{ timeMultiplier }}×</span>
        <span class="pill-dot"></span>
      </button>
    </div>

    <!-- 4. 分時運量 -->
    <button 
      type="button" 
      class="nav-tab-btn" 
      :class="{ 'is-active': isHourlyModalOpen }"
      @click="handleHourlyClick"
    >
      <span class="nav-icon">📈</span>
      <span class="nav-text">分時運量</span>
    </button>

    <!-- 5. 功能擴建中... -->
    <button 
      type="button" 
      class="nav-tab-btn dev-btn" 
      @click="handleDevelopingClick"
    >
      <span class="nav-icon">🚧</span>
      <span class="nav-text">功能擴建中...</span>
    </button>
  </nav>

  <!-- 彈出式倍速面板 (移出 nav，以整個畫面為基準水平置中，解決被裁切問題) -->
  <Transition name="speed-pop">
    <div v-if="isSpeedMenuOpen" class="speed-popover-centered">
      <div class="popover-header">
        <span class="popover-title">⏱️ 播放速度控制</span>
        <span class="current-speed-tag">{{ timeMultiplier }}×</span>
      </div>

      <div class="speed-presets-row">
        <button 
          v-for="s in [1, 10, 60, 120]" 
          :key="s" 
          type="button" 
          class="speed-tag-btn" 
          :class="{ active: timeMultiplier === s }"
          @click="selectSpeed(s)"
        >
          {{ s }}x
        </button>
      </div>

      <div class="slider-box">
        <input 
          type="range" 
          min="1" 
          max="120" 
          step="1" 
          :value="timeMultiplier" 
          @input="onSliderInput"
          class="speed-slider"
        />
        <div class="slider-marks">
          <span>1x</span>
          <span>60x</span>
          <span>120x</span>
        </div>
      </div>

      <button type="button" class="btn-sync-now" @click="handleSyncNow">
        🕒 目前時間
      </button>
    </div>
  </Transition>

  <!-- 點擊背景空白處關閉倍速視窗 -->
  <div 
    v-if="isSpeedMenuOpen" 
    class="speed-backdrop" 
    @click="isSpeedMenuOpen = false"
  ></div>

  <!-- 點擊「功能擴建中...」時的輕量提示條 -->
  <Transition name="fade">
    <div v-if="showDevToast" class="dev-toast">
      🚧 該功能正在擴建開發中，敬請期待！
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  isPanelOpen: { type: Boolean, default: false },
  activeTab: { type: String, default: 'overview' },
  timeMultiplier: { type: Number, default: 1 },
  isHourlyModalOpen: { type: Boolean, default: false }
});

const emit = defineEmits([
  'update:isPanelOpen',
  'selectTab',
  'closePanel',
  'openPeopleWhere',
  'closePeopleWhere',
  'open-hourly-modal',
  'close-hourly-modal',
  'toggle-hourly-modal',
  'setSpeed',
  'syncRealTime',
  'resetOverview'
]);

const isSpeedMenuOpen = ref(false);
const isPeopleWhereActive = ref(false);
const showDevToast = ref(false);
let toastTimer = null;

watch(() => props.isPanelOpen, (val) => {
  if (val) {
    isSpeedMenuOpen.value = false;
    isPeopleWhereActive.value = false;
  }
});

const handleSpeedClick = () => {
  const target = !isSpeedMenuOpen.value;
  isSpeedMenuOpen.value = target;

  if (target) {
    emit('closePanel');
    emit('update:isPanelOpen', false);
    emit('closePeopleWhere');
    emit('close-hourly-modal');
    isPeopleWhereActive.value = false;
  }
};

const handleTabClick = (tab) => {
  isSpeedMenuOpen.value = false;
  emit('close-hourly-modal');

  if (tab === 'overview') {
    emit('closePeopleWhere');
    isPeopleWhereActive.value = false;
    if (props.isPanelOpen && props.activeTab === 'overview') {
      emit('closePanel');
      emit('update:isPanelOpen', false);
    } else {
      emit('selectTab', 'overview');
      emit('update:isPanelOpen', true);
    }
  } else if (tab === 'od') {
    emit('closePanel');
    emit('update:isPanelOpen', false);
    if (isPeopleWhereActive.value) {
      emit('closePeopleWhere');
      isPeopleWhereActive.value = false;
    } else {
      emit('openPeopleWhere');
      isPeopleWhereActive.value = true;
    }
  }
};

const handleHourlyClick = () => {
  isSpeedMenuOpen.value = false;
  emit('closePanel');
  emit('update:isPanelOpen', false);
  emit('closePeopleWhere');
  isPeopleWhereActive.value = false;

  emit('toggle-hourly-modal');
};

const handleDevelopingClick = () => {
  isSpeedMenuOpen.value = false;
  emit('closePanel');
  emit('update:isPanelOpen', false);
  emit('closePeopleWhere');
  emit('close-hourly-modal');

  if (toastTimer) clearTimeout(toastTimer);
  showDevToast.value = true;
  toastTimer = setTimeout(() => {
    showDevToast.value = false;
  }, 2000);
};

const selectSpeed = (val) => {
  emit('setSpeed', val);
};

const onSliderInput = (e) => {
  emit('setSpeed', Number(e.target.value));
};

const handleSyncNow = () => {
  emit('syncRealTime');
  emit('setSpeed', 1);
  isSpeedMenuOpen.value = false;
};
</script>

<style scoped>
.mobile-bottom-navbar {
  display: none;
}

.speed-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  z-index: 2150;
}

@media (max-width: 1024px) {
  .mobile-bottom-navbar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    position: fixed;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100vw !important;
    box-sizing: border-box !important;
    min-height: calc(60px + env(safe-area-inset-bottom, 0px)) !important;
    padding-bottom: env(safe-area-inset-bottom, 0px) !important;
    background: #0b1120 !important;
    border-top: 1px solid rgba(255, 255, 255, 0.15) !important;
    z-index: 2100 !important;
    box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.8) !important;
    user-select: none;
  }

  .nav-tab-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: transparent;
    border: none;
    padding: 6px 4px;
    color: #94a3b8;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s;
    flex: 1;
    min-width: 0;
  }

  .nav-tab-btn:active {
    transform: scale(0.92);
  }

  .nav-icon {
    font-size: 18px;
    line-height: 1;
  }

  .nav-text {
    font-size: 9.5px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .nav-tab-btn.is-active {
    color: #38bdf8 !important;
    font-weight: 700;
  }

  .dev-btn {
    opacity: 0.85;
  }
  .dev-btn:active {
    color: #f59e0b;
  }

  /* 中央速度膠囊容器 */
  .speed-control-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
  }

  .nav-center-pill {
    display: flex;
    align-items: center;
    gap: 3px;
    background: #1e293b;
    border: 1px solid rgba(245, 158, 11, 0.5);
    border-radius: 9999px;
    padding: 4px 10px;
    color: #fbbf24;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.2);
    -webkit-tap-highlight-color: transparent;
    transition: all 0.2s;
  }

  .nav-center-pill.is-active {
    border-color: #f59e0b;
    box-shadow: 0 0 14px rgba(245, 158, 11, 0.6);
  }

  .pill-speed {
    font-size: 11.5px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #fbbf24;
  }

  /* ⭐ 核心修改：倍速選單面板相對於全螢幕正中央置中，底部貼齊導航列上方 */
  .speed-popover-centered {
    position: fixed;
    bottom: calc(72px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    width: calc(100vw - 32px);
    max-width: 330px;
    box-sizing: border-box;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.85);
    z-index: 2200;
  }

  .speed-pop-enter-active,
  .speed-pop-leave-active {
    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .speed-pop-enter-from,
  .speed-pop-leave-to {
    opacity: 0;
    transform: translate(-50%, 12px) scale(0.96);
  }

  .popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .popover-title {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 600;
  }

  .current-speed-tag {
    font-size: 12px;
    font-weight: 800;
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .speed-presets-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .speed-tag-btn {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #cbd5e1;
    font-size: 11.5px;
    font-weight: 600;
    padding: 6px 0;
    cursor: pointer;
  }

  .speed-tag-btn.active {
    background: #f59e0b;
    border-color: #f59e0b;
    color: #0f172a;
    font-weight: 800;
  }

  .slider-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .speed-slider {
    width: 100%;
    accent-color: #f59e0b;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
  }

  .slider-marks {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #64748b;
  }

  .btn-sync-now {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.4);
    border-radius: 8px;
    color: #38bdf8;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 0;
    cursor: pointer;
  }

  .dev-toast {
    position: fixed;
    bottom: calc(75px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(245, 158, 11, 0.5);
    color: #fbbf24;
    font-size: 12px;
    padding: 8px 16px;
    border-radius: 20px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
    z-index: 2200;
    pointer-events: none;
    white-space: nowrap;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.25s, transform 0.25s;
  }
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
}
</style>