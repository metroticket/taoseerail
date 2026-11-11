<template>
  <Teleport to="body">
    <!-- 遮罩層 (點擊背景關閉) -->
    <div v-if="modelValue" class="hourly-modal-backdrop" @click="handleClose">
      <!-- 彈窗主體 (阻止冒泡) -->
      <div class="hourly-modal-card" @click.stop>
        <!-- 手機版頂部小拉桿 -->
        <div class="mobile-sheet-handle" @click.stop="handleClose"></div>

        <!-- 1. 標題與控制列 -->
        <header class="modal-header">
          <div class="header-left">
            <span class="header-icon">📈</span>
            <div class="header-text-block">
              <h2 class="modal-title">車站分時運量</h2>
            </div>
          </div>

          <div class="header-actions">
            <!-- 動態狀態標籤 -->
            <div class="sync-status-pill" :class="statusClass">
              <span class="status-dot"></span>
              <span class="status-text">{{ statusDisplay.text }}</span>
            </div>

            <!-- 手動立即更新按鈕 -->
            <button
              type="button"
              class="btn-manual-refresh"
              :disabled="isLoading"
              @click.stop="loadData(true)"
              title="立即更新分時數據"
            >
              <span class="refresh-icon" :class="{ 'is-spinning': isLoading }">🔄</span>
              <span class="refresh-text">{{ isLoading ? '更新中' : '立即更新' }}</span>
            </button>

            <!-- 車站選擇下拉選單 -->
            <div class="station-select-wrapper">
              <label class="select-label">選擇車站：</label>
              <select v-model="selectedStation" class="station-select" @change="onStationChange">
                <option value="ALL">🌐 全線車站 (全日彙總)</option>
                <option v-for="st in stationsList" :key="st.id" :value="st.id">
                  {{ st.id }} {{ st.name }}
                </option>
              </select>
            </div>

            <!-- 關閉按鈕 -->
            <button 
              type="button" 
              class="btn-close" 
              @click.stop="handleClose" 
              title="關閉"
            >✕</button>
          </div>
        </header>

        <!-- 2. 圖例與動態即時 KPI 列 (手機版超清晰，手指觸控直接連動) -->
        <div class="modal-summary-bar" :class="{ 'is-inspecting': activeIndex !== null }">
          <div class="legend-group">
            <!-- 靜態圖例 -->
            <template v-if="activeIndex === null">
              <span class="legend-item legend-in">
                <span class="legend-dot in-dot"></span> 進站
              </span>
              <span class="legend-item legend-out">
                <span class="legend-dot out-dot"></span> 出站
              </span>
            </template>
            <!-- 觸碰/Hover 時顯示時段徽章 -->
            <template v-else>
              <span class="inspect-time-badge">
                🕒 {{ hoursList[activeIndex] }}:00 時段
              </span>
            </template>
          </div>

          <!-- 數值呈現區：無選取時顯示全日累計，選取時顯示該時段實際進出 -->
          <div class="kpi-group">
            <template v-if="activeIndex === null">
              <span class="kpi-item">
                全日進: <strong class="text-in">{{ currentTotalIn.toLocaleString() }}</strong>
              </span>
              <span class="kpi-divider">|</span>
              <span class="kpi-item">
                全日出: <strong class="text-out">{{ currentTotalOut.toLocaleString() }}</strong>
              </span>
            </template>
            <template v-else>
              <span class="kpi-item">
                時段進: <strong class="text-in">{{ (activeDataIn[activeIndex] || 0).toLocaleString() }}</strong>
              </span>
              <span class="kpi-divider">|</span>
              <span class="kpi-item">
                時段出: <strong class="text-out">{{ (activeDataOut[activeIndex] || 0).toLocaleString() }}</strong>
              </span>
              <span class="kpi-divider">|</span>
              <span class="kpi-item diff-item">
                差額: <strong :class="(activeDataIn[activeIndex] - activeDataOut[activeIndex]) >= 0 ? 'text-in' : 'text-out'">
                  {{ ((activeDataIn[activeIndex] || 0) - (activeDataOut[activeIndex] || 0) > 0 ? '+' : '') + ((activeDataIn[activeIndex] || 0) - (activeDataOut[activeIndex] || 0)).toLocaleString() }}
                </strong>
              </span>
            </template>
          </div>
        </div>

        <!-- 3. 圖表渲染核心區 -->
        <div class="chart-viewport-wrapper">
          <div class="chart-viewport custom-scroll" @mouseleave="activeIndex = null">
            <svg 
              class="flow-svg-chart" 
              viewBox="0 0 960 360" 
              preserveAspectRatio="xMidYMid meet"
            >
              <!-- 網格背景水平線 (Y軸刻度) -->
              <g class="grid-lines">
                <line v-for="i in 5" :key="'grid-' + i" x1="60" :y1="40 + (i - 1) * 60" x2="940" :y2="40 + (i - 1) * 60" class="grid-line" />
              </g>

              <!-- Y 軸標籤 -->
              <g class="y-axis-labels">
                <text v-for="(val, idx) in currentYLabels" :key="'y-' + idx" x="50" :y="45 + idx * 60" class="axis-label y-label">
                  {{ val }}
                </text>
              </g>

              <!-- 選中時的高亮光柱背景 (手機手指點擊或滑動即亮起) -->
              <rect
                v-if="activeIndex !== null"
                :x="68 + activeIndex * 44"
                y="35"
                width="42"
                height="245"
                class="hover-pillar"
                rx="6"
              />

              <!-- 長條圖系列 -->
              <g class="chart-series">
                <g v-for="(hour, idx) in hoursList" :key="'bar-' + hour">
                  <!-- 進站長條 (金黃) -->
                  <rect 
                    :x="75 + idx * 44" 
                    :y="getY(activeDataIn[idx])" 
                    width="14" 
                    :height="Math.max(0, 280 - getY(activeDataIn[idx]))" 
                    class="bar-rect in-bar"
                    :class="{ 'dimmed': activeIndex !== null && activeIndex !== idx }"
                    rx="3"
                  />
                  <!-- 出站長條 (紫色) -->
                  <rect 
                    :x="91 + idx * 44" 
                    :y="getY(activeDataOut[idx])" 
                    width="14" 
                    :height="Math.max(0, 280 - getY(activeDataOut[idx]))" 
                    class="bar-rect out-bar"
                    :class="{ 'dimmed': activeIndex !== null && activeIndex !== idx }"
                    rx="3"
                  />

                  <!-- ⭐ 觸控/滑鼠全覆蓋感應感測片 (寬達 44px，手機手指隨便按都能感應) -->
                  <rect
                    :x="68 + idx * 44"
                    y="20"
                    width="44"
                    height="260"
                    class="touch-detector"
                    @mouseenter="activeIndex = idx"
                    @touchstart.passive="activeIndex = idx"
                  />
                </g>
              </g>

              <!-- X 軸水平基線 -->
              <line x1="60" y1="280" x2="940" y2="280" class="axis-base-line" />

              <!-- X 軸標籤 (05:00 ～ 24:00) -->
              <g class="x-axis-labels">
                <text 
                  v-for="(hour, idx) in hoursList" 
                  :key="'x-' + hour" 
                  :x="88 + idx * 44" 
                  y="305" 
                  class="axis-label x-label"
                  :class="{ 'active-x': activeIndex === idx }"
                >
                  {{ hour }}
                </text>
                <text x="945" y="305" class="axis-unit">時</text>
              </g>
            </svg>
          </div>
        </div>

        <!-- 4. 底部備註列 -->
        <footer class="modal-footer">
          <span class="footer-note">
            ℹ {{ selectedStation === 'ALL' ? '目前顯示：全線 22 站分時總運量彙總' : `目前顯示：${currentStationObj.stationName || selectedStation} 單站分時趨勢` }}
            <template v-if="operDate"> (營運日: {{ operDate }})</template>
            <span class="mobile-hint-text">（滑動圖表點擊柱子可看各時段人數）</span>
          </span>
          <button 
            type="button" 
            class="btn-action-clean" 
            @click.stop="handleClose"
          >關閉</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { fetchHourlyFlowData } from '../services/hourlyService.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  defaultStationId: { type: String, default: 'ALL' }
});

const emit = defineEmits([
  'update:modelValue',
  'update:model-value',
  'close',
  'changeStation'
]);

const stationsList = [
  { id: 'A1', name: '台北車站' }, { id: 'A2', name: '三重' }, { id: 'A3', name: '新北產業園區' },
  { id: 'A4', name: '新莊副都心' }, { id: 'A5', name: '泰山' }, { id: 'A6', name: '泰山貴和' },
  { id: 'A7', name: '體育大學' }, { id: 'A8', name: '長庚醫院' }, { id: 'A9', name: '林口' },
  { id: 'A10', name: '山鼻' }, { id: 'A11', name: '坑口' }, { id: 'A12', name: '機場第一航廈' },
  { id: 'A13', name: '機場第二航廈' }, { id: 'A14a', name: '機場旅館' }, { id: 'A15', name: '大園' },
  { id: 'A16', name: '橫山' }, { id: 'A17', name: '領航' }, { id: 'A18', name: '高鐵桃園站' },
  { id: 'A19', name: '桃園體育園區' }, { id: 'A20', name: '興南' }, { id: 'A21', name: '環北' },
  { id: 'A22', name: '老街溪' }
];

const selectedStation = ref('ALL');
const isLoading = ref(false);
const stationsDataMap = ref({});
const operDate = ref('');
const updateTime = ref('');
const hoursList = ref(Array.from({ length: 20 }, (_, i) => String(i + 5).padStart(2, '0')));

// ⭐ 正在檢視的時段索引 (null 代表未選取，顯示全日彙總)
const activeIndex = ref(null);
let pollTimer = null;

// ==================== 營運時間跨日換算與時效判定 ====================
const statusDisplay = computed(() => {
  if (isLoading.value) {
    return { status: 'loading', text: '同步中...' };
  }

  if (!operDate.value || !updateTime.value) {
    return { status: 'loading', text: '同步中...' };
  }

  const timeParts = updateTime.value.trim().split(':');
  const updateH = parseInt(timeParts[0] || '0', 10);
  const updateM = parseInt(timeParts[1] || '0', 10);
  const updateS = parseInt(timeParts[2] || '0', 10);

  const targetDate = new Date(`${operDate.value}T00:00:00`);
  if (updateH < 4) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  targetDate.setHours(updateH, updateM, updateS, 0);

  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60));

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const hh = String(targetDate.getHours()).padStart(2, '0');
  const min = String(targetDate.getMinutes()).padStart(2, '0');
  const formattedFull = `${yyyy}-${mm}-${dd} ${hh}:${min}:00`;

  if (diffMinutes < 30) {
    return { status: 'green', text: '資料最新中' };
  } else if (diffMinutes < 60) {
    return { status: 'yellow', text: '資料延遲中' };
  } else {
    return { 
      status: 'red', 
      text: `資料異常(最新資料:${formattedFull})` 
    };
  }
});

const statusClass = computed(() => {
  switch (statusDisplay.value.status) {
    case 'green': return 'status-green';
    case 'yellow': return 'status-yellow';
    case 'red': return 'status-red';
    default: return 'status-loading';
  }
});

// ==================== 資料載入與快取 ====================
const loadData = async (isForce = false) => {
  isLoading.value = true;
  try {
    const data = await fetchHourlyFlowData((cachedData) => {
      if (!isForce) applyData(cachedData);
    }, isForce);
    applyData(data);
  } catch (err) {
    console.error("載入分時運量失敗:", err);
  } finally {
    isLoading.value = false;
  }
};

const applyData = (data) => {
  if (!data) return;
  if (Array.isArray(data.hours) && data.hours.length > 0) {
    hoursList.value = data.hours;
  }
  operDate.value = data.operDate || '';
  updateTime.value = data.updateTime || '';
  stationsDataMap.value = data.stations || {};
};

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    selectedStation.value = props.defaultStationId || 'ALL';
    activeIndex.value = null; // 重置檢視時段
    loadData(true);

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      loadData(true);
    }, 5 * 60 * 1000);
  } else {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
});

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});

const currentStationObj = computed(() => {
  const map = stationsDataMap.value;
  return map[selectedStation.value] || map['ALL'] || {};
});

const activeDataIn = computed(() => {
  const arr = currentStationObj.value.dataIn;
  return Array.isArray(arr) ? arr : Array(hoursList.value.length).fill(0);
});

const activeDataOut = computed(() => {
  const arr = currentStationObj.value.dataOut;
  return Array.isArray(arr) ? arr : Array(hoursList.value.length).fill(0);
});

const currentTotalIn = computed(() => {
  if (currentStationObj.value.totalIn !== undefined) {
    return Number(currentStationObj.value.totalIn) || 0;
  }
  return activeDataIn.value.reduce((a, b) => a + (Number(b) || 0), 0);
});

const currentTotalOut = computed(() => {
  if (currentStationObj.value.totalOut !== undefined) {
    return Number(currentStationObj.value.totalOut) || 0;
  }
  return activeDataOut.value.reduce((a, b) => a + (Number(b) || 0), 0);
});

const currentMaxY = computed(() => {
  if (currentStationObj.value.maxY) {
    return Number(currentStationObj.value.maxY);
  }
  return selectedStation.value === 'ALL' ? 20000 : 2000;
});

const currentYLabels = computed(() => {
  const max = currentMaxY.value;
  const step = max / 4;
  return [
    Math.round(max).toLocaleString(),
    Math.round(step * 3).toLocaleString(),
    Math.round(step * 2).toLocaleString(),
    Math.round(step * 1).toLocaleString(),
    '0'
  ];
});

const getY = (val) => {
  const num = Number(val) || 0;
  const max = currentMaxY.value;
  const ratio = Math.min(1, Math.max(0, num / max));
  return 280 - ratio * 240;
};

const handleClose = () => {
  emit('update:modelValue', false);
  emit('update:model-value', false);
  emit('close');
};

const onStationChange = () => {
  activeIndex.value = null; // 切換站點時重置選中狀態
  emit('changeStation', selectedStation.value);
};
</script>

<style scoped>
/* ==================== 1. 桌面端基礎樣式 ==================== */
.hourly-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 3000 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.hourly-modal-card {
  width: 980px;
  max-width: 95vw;
  background: #0b1120;
  border: 1.5px solid rgba(56, 189, 248, 0.35);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 24px rgba(56, 189, 248, 0.15);
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  z-index: 3001;
}

@keyframes modalScaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.mobile-sheet-handle {
  display: none;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: rgba(15, 23, 42, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 22px;
}

.header-text-block {
  display: flex;
  flex-direction: column;
}

.modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.modal-subtitle {
  margin: 2px 0 0;
  font-size: 9.5px;
  color: #94a3b8;
  letter-spacing: 0.8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 同步狀態膠囊標籤 */
.sync-status-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-green {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.status-green .status-dot { background: #10b981; box-shadow: 0 0 6px #10b981; }

.status-yellow {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}
.status-yellow .status-dot { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; }

.status-red {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.status-red .status-dot { background: #ef4444; box-shadow: 0 0 6px #ef4444; }

.status-loading {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
}
.status-loading .status-dot { background: #38bdf8; animation: pulseDot 1.2s infinite; }

@keyframes pulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.8); }
}

/* 手動更新按鈕 */
.btn-manual-refresh {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.btn-manual-refresh:hover:not(:disabled) {
  background: rgba(56, 189, 248, 0.18);
  border-color: rgba(56, 189, 248, 0.5);
  color: #38bdf8;
}

.btn-manual-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
.refresh-icon { font-size: 12px; display: inline-block; line-height: 1; }
.refresh-icon.is-spinning { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

.station-select-wrapper { display: flex; align-items: center; gap: 6px; }
.select-label { font-size: 12px; color: #cbd5e1; white-space: nowrap; }

.station-select {
  background: #1e293b;
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12.5px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  max-width: 180px;
}

.btn-close {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #94a3b8;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all 0.2s;
  pointer-events: auto !important;
}

.btn-close:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #fca5a5;
}

/* ⭐ 2. 動態即時 KPI 列 (Scrubbing HUD) */
.modal-summary-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: rgba(15, 23, 42, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11.5px;
  transition: background-color 0.2s ease;
}

.modal-summary-bar.is-inspecting {
  background: rgba(56, 189, 248, 0.08);
  border-bottom-color: rgba(56, 189, 248, 0.25);
}

.legend-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inspect-time-badge {
  color: #38bdf8;
  font-weight: 700;
  background: rgba(56, 189, 248, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
}

.legend-item { display: flex; align-items: center; gap: 5px; font-weight: 600; }
.legend-dot { width: 7px; height: 7px; border-radius: 2px; }
.in-dot { background: #fbbf24; }
.out-dot { background: #c084fc; }
.legend-in { color: #fbbf24; }
.legend-out { color: #c084fc; }

.kpi-group {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
}

.kpi-divider { color: rgba(255, 255, 255, 0.15); }
.text-in { color: #fbbf24; font-family: ui-monospace, monospace; }
.text-out { color: #c084fc; font-family: ui-monospace, monospace; }

/* 圖表區域 */
.chart-viewport-wrapper {
  background: rgba(11, 17, 32, 0.9);
  padding: 12px 16px 4px;
  overflow: hidden;
}

.chart-viewport {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.flow-svg-chart {
  width: 100%;
  min-width: 780px;
  height: 290px;
  display: block;
}

.grid-line {
  stroke: rgba(255, 255, 255, 0.07);
  stroke-dasharray: 4 4;
  stroke-width: 1;
}

.axis-base-line {
  stroke: rgba(255, 255, 255, 0.2);
  stroke-width: 1.5;
}

.axis-label {
  fill: #64748b;
  font-size: 11px;
  font-family: ui-monospace, monospace;
}

.y-label { text-anchor: end; }
.x-label { text-anchor: middle; transition: fill 0.15s ease; }
.x-label.active-x { fill: #38bdf8; font-weight: 800; font-size: 12.5px; }
.axis-unit { fill: #64748b; font-size: 11px; }

/* 光柱與感應層 */
.hover-pillar {
  fill: rgba(56, 189, 248, 0.09);
  stroke: rgba(56, 189, 248, 0.2);
  stroke-width: 1;
  transition: all 0.15s ease;
}

.touch-detector {
  fill: transparent;
  cursor: pointer;
}

.bar-rect {
  transition: height 0.3s ease, y 0.3s ease, opacity 0.2s ease;
  cursor: pointer;
}

.bar-rect.dimmed {
  opacity: 0.25 !important;
}

.in-bar { fill: #fbbf24; opacity: 0.85; }
.in-bar:hover { opacity: 1; fill: #facc15; }

.out-bar { fill: #c084fc; opacity: 0.85; }
.out-bar:hover { opacity: 1; fill: #d8b4fe; }

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: rgba(15, 23, 42, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.footer-note {
  font-size: 10.5px;
  color: #64748b;
}

.mobile-hint-text {
  display: none;
}

.btn-action-clean {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s;
  pointer-events: auto !important;
}

.btn-action-clean:hover {
  background: #0284c7;
  color: #ffffff;
}

/* 自訂膠囊捲軸 */
.custom-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(56, 189, 248, 0.35) transparent;
}
.custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(56, 189, 248, 0.28);
  border-radius: 9999px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(56, 189, 248, 0.6); }

/* ==================== 2. 📱 手機端響應式優化 (<= 768px) ==================== */
@media (max-width: 768px) {
  .hourly-modal-backdrop {
    padding: 0 !important;
    align-items: flex-end !important;
  }

  .hourly-modal-card {
    width: 100vw !important;
    max-width: 100vw !important;
    border-radius: 18px 18px 0 0 !important;
    border-left: none !important;
    border-right: none !important;
    border-bottom: none !important;
    bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important;
    margin-bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important;
    max-height: calc(85vh - 60px) !important;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.8) !important;
    animation: sheetSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }

  @keyframes sheetSlideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .mobile-sheet-handle {
    display: block;
    width: 36px;
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 9999px;
    margin: 8px auto 2px;
    cursor: pointer;
  }

  .modal-header {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
    padding: 8px 14px 10px !important;
  }

  .header-left {
    justify-content: flex-start;
  }

  .modal-title {
    font-size: 13.5px !important;
    white-space: nowrap !important;
  }

  .desktop-only-text {
    display: none !important;
  }

  .header-actions {
    justify-content: space-between !important;
    width: 100% !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
  }

  .sync-status-pill {
    font-size: 10px !important;
    padding: 2px 6px !important;
  }

  .btn-manual-refresh {
    font-size: 10px !important;
    padding: 2px 6px !important;
  }

  .station-select-wrapper {
    flex: 1 !important;
  }

  .select-label {
    font-size: 11px !important;
  }

  .station-select {
    flex: 1 !important;
    max-width: none !important;
    font-size: 11.5px !important;
    padding: 4px 8px !important;
  }

  .btn-close {
    width: 26px !important;
    height: 26px !important;
    font-size: 12px !important;
    flex-shrink: 0 !important;
  }

  /* 手機版頂部 KPI 提示列：即使螢幕窄也能一眼看懂 */
  .modal-summary-bar {
    padding: 6px 14px !important;
    font-size: 10.5px !important;
  }

  .kpi-group {
    gap: 5px !important;
    font-size: 10px !important;
  }

  .diff-item {
    display: none !important; /* 手機螢幕超窄時隱藏差額，保留進站與出站數值 */
  }

  .chart-viewport-wrapper {
    padding: 8px 10px 4px !important;
  }

  .chart-viewport {
    overflow-x: auto !important;
    scrollbar-width: thin;
  }

  .flow-svg-chart {
    min-width: 720px !important;
    height: 240px !important;
  }

  .modal-footer {
    padding: 8px 14px !important;
  }

  .footer-note {
    font-size: 9.5px !important;
  }

  .mobile-hint-text {
    display: inline !important;
    color: #38bdf8;
  }

  .btn-action-clean {
    padding: 4px 12px !important;
    font-size: 11px !important;
  }
}
</style>