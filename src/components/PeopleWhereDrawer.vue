<template>
  <!-- 1. 獨立懸浮觸發按鈕 (桌機版顯示) -->
  <button
    type="button"
    class="od-float-trigger-btn"
    :class="{ 'is-active': isOpen }"
    @click="toggleDrawer"
    title="人流去向分析 (OD)"
  >
    <span class="trigger-icon">🧭</span>
    <span class="trigger-text">人流去向分析</span>
  </button>

  <!-- 2. 手機/桌機共用背景遮罩 -->
  <div
    v-if="isOpen"
    class="od-drawer-backdrop"
    @click="close"
  ></div>

  <!-- 3. 抽屜主面板 -->
  <aside class="od-drawer-panel" :class="{ 'is-open': isOpen }">
    <!-- 手機版頂部拖曳把手 -->
    <div class="mobile-drag-handle" @click="close"></div>

    <!-- 抽屜標題列 -->
    <div class="od-header">
      <div class="od-title-block">
        <span class="od-icon">🧭</span>
        <div>
          <h3 class="od-title">人流起訖OD查詢</h3>
        </div>
      </div>
      <button type="button" class="od-close-btn" @click="close">✕</button>
    </div>

    <div class="od-body custom-scroll">
      <!-- 篩選控制區 (日曆 + 時段下拉選單) -->
      <section class="od-filter-card">
        <!-- 起始時間 -->
        <div class="filter-field">
          <label class="field-label">📅 起始日期與時間</label>
          <div class="field-inputs">
            <input
              type="date"
              v-model="startDate"
              class="od-date-picker"
              title="點擊選擇起始日期"
            />
            <select v-model="startHour" class="od-time-select">
              <option v-for="h in timeSlotOptions" :key="'st-' + h" :value="h">{{ h }}</option>
            </select>
          </div>
        </div>

        <!-- 截止時間 -->
        <div class="filter-field">
          <label class="field-label">📅 截止日期與時間</label>
          <div class="field-inputs">
            <input
              type="date"
              v-model="endDate"
              class="od-date-picker"
              title="點擊選擇截止日期"
            />
            <select v-model="endHour" class="od-time-select">
              <option v-for="h in timeSlotOptions" :key="'et-' + h" :value="h">{{ h }}</option>
            </select>
          </div>
        </div>

        <!-- 觀察車站 -->
        <div class="filter-field">
          <label class="field-label">🚉 查詢車站</label>
          <select v-model="selectedStationKey" class="od-station-select">
            <option value="all">全線所有車站</option>
            <option v-for="st in stationOptions" :key="st.key" :value="st.key">
              {{ st.id }} {{ st.name }}
            </option>
          </select>
        </div>

        <button
          type="button"
          class="od-submit-btn"
          :disabled="isLoading"
          @click="executeSearch"
        >
          <span v-if="isLoading" class="spinner">⏳</span>
          {{ isLoading ? '資料運算中...' : '🔍 開始分析人流' }}
        </button>
      </section>

      <!-- 區間總量 Summary -->
      <div v-if="querySummary" class="od-summary-grid">
        <div class="summary-box">
          <span class="sum-label">全線總進站</span>
          <span class="sum-val in-val">{{ (querySummary.totalInflow || 0).toLocaleString() }}</span>
        </div>
        <div class="summary-box">
          <span class="sum-label">全線總出站</span>
          <span class="sum-val out-val">{{ (querySummary.totalOutflow || 0).toLocaleString() }}</span>
        </div>
      </div>

      <!-- 錯誤提示 -->
      <div v-if="errorMessage" class="od-error-banner">
        ⚠️ {{ errorMessage }}
      </div>

      <!-- 分析結果列表 -->
      <div v-if="!isLoading && stationList.length > 0" class="od-result-container">
        <div
          v-for="st in stationList"
          :key="st.numKey"
          class="station-od-card"
        >
          <!-- 車站總覽標題 -->
          <div class="station-card-top" @click="handleStationClick(st.codeId)">
            <div class="st-left">
              <span class="st-badge">{{ st.codeId }}</span>
              <span class="st-name">{{ st.fullName }}</span>
            </div>
            <div class="st-flow-tags">
              <span class="tag in">進站 {{ st.inflow.toLocaleString() }}</span>
              <span class="tag out">出站 {{ st.outflow.toLocaleString() }}</span>
            </div>
          </div>

          <!-- 雙向切換分頁 -->
          <div class="od-tab-row">
            <button
              type="button"
              class="tab-btn"
              :class="{ active: (activeOdTab[st.numKey] || 'from') === 'from' }"
              @click="activeOdTab[st.numKey] = 'from'"
            >
              📥 各站 → {{ st.shortName }}
            </button>
            <button
              type="button"
              class="tab-btn"
              :class="{ active: activeOdTab[st.numKey] === 'to' }"
              @click="activeOdTab[st.numKey] = 'to'"
            >
              📤 {{ st.shortName }} → 各站
            </button>
          </div>

          <!-- 1. 來源分析 (whereTheyCameFrom) -->
          <div v-if="(activeOdTab[st.numKey] || 'from') === 'from'" class="od-flow-detail-block">
            <div class="od-block-sub">
              <span>旅次出發起點站 (共 {{ st.whereTheyCameFrom.length }} 站)</span>
              <span>抵達人次 / 對總出站佔比</span>
            </div>
            <div v-if="st.whereTheyCameFrom && st.whereTheyCameFrom.length > 0" class="od-flow-list custom-scroll">
              <div
                v-for="(item, idx) in st.whereTheyCameFrom"
                :key="item.station"
                class="od-flow-item"
                @click="handleStationClick(getCodeIdByNum(item.station))"
              >
                <div class="od-item-info">
                  <span class="od-rank" :class="{ 'top-rank': idx < 3 }">{{ idx + 1 }}</span>
                  <span class="od-st-badge">{{ getCodeIdByNum(item.station) }}</span>
                  <span class="od-st-name">{{ getFullNameByNum(item.station) }}</span>
                  <div class="od-numbers">
                    <strong class="od-val in-val">{{ (item.volume || 0).toLocaleString() }}</strong>
                    <small class="od-pct" v-if="st.outflow > 0">
                      ({{ (((item.volume || 0) / st.outflow) * 100).toFixed(1) }}%)
                    </small>
                  </div>
                </div>
                <div class="od-bar-track">
                  <div
                    class="od-bar-fill fill-in"
                    :style="{ width: `${st.outflow > 0 ? Math.min(100, ((item.volume || 0) / st.outflow) * 100) : 0}%` }"
                  ></div>
                </div>
              </div>
            </div>
            <div v-else class="empty-tip">無來源旅次細項資料</div>
          </div>

          <!-- 2. 去向分析 (whereTheyWentTo) -->
          <div v-else class="od-flow-detail-block">
            <div class="od-block-sub">
              <span>旅次抵達目的地站 (共 {{ st.whereTheyWentTo.length }} 站)</span>
              <span>前往人次 / 對總進站佔比</span>
            </div>
            <div v-if="st.whereTheyWentTo && st.whereTheyWentTo.length > 0" class="od-flow-list custom-scroll">
              <div
                v-for="(item, idx) in st.whereTheyWentTo"
                :key="item.station"
                class="od-flow-item"
                @click="handleStationClick(getCodeIdByNum(item.station))"
              >
                <div class="od-item-info">
                  <span class="od-rank" :class="{ 'top-rank': idx < 3 }">{{ idx + 1 }}</span>
                  <span class="od-st-badge badge-to">{{ getCodeIdByNum(item.station) }}</span>
                  <span class="od-st-name">{{ getFullNameByNum(item.station) }}</span>
                  <div class="od-numbers">
                    <strong class="od-val out-val">{{ (item.volume || 0).toLocaleString() }}</strong>
                    <small class="od-pct" v-if="st.outflow > 0">
                      ({{ (((item.volume || 0) / st.outflow) * 100).toFixed(1) }}%)
                    </small>
                  </div>
                </div>
                <div class="od-bar-track">
                  <div
                    class="od-bar-fill fill-out"
                    :style="{ width: `${st.outflow > 0 ? Math.min(100, ((item.volume || 0) / st.outflow) * 100) : 0}%` }"
                  ></div>
                </div>
              </div>
            </div>
            <div v-else class="empty-tip">無去向旅次細項資料</div>
          </div>
        </div>
      </div>

      <div v-else-if="!isLoading && hasSearched && stationList.length === 0" class="empty-state">
        此區間無匹配之人流起訖資料
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { fetchPeopleWhereData } from '../services/odService.js';

const emit = defineEmits(['locateStation']);

const STATION_META = {
  "1": { id: "A1", name: "台北車站" },
  "2": { id: "A2", name: "三重站" },
  "3": { id: "A3", name: "新北產業園區" },
  "4": { id: "A4", name: "新莊副都心" },
  "5": { id: "A5", name: "泰山站" },
  "6": { id: "A6", name: "泰山貴和" },
  "7": { id: "A7", name: "體育大學" },
  "8": { id: "A8", name: "長庚醫院" },
  "9": { id: "A9", name: "林口站" },
  "10": { id: "A10", name: "山鼻站" },
  "11": { id: "A11", name: "坑口站" },
  "12": { id: "A12", name: "機場第一航廈" },
  "13": { id: "A13", name: "機場第二航廈" },
  "201": { id: "A14a", name: "機場旅館" },
  "14": { id: "A14", name: "機場第三航廈" },
  "15": { id: "A15", name: "大園站" },
  "16": { id: "A16", name: "橫山站" },
  "17": { id: "A17", name: "領航站" },
  "18": { id: "A18", name: "高鐵桃園站" },
  "19": { id: "A19", name: "桃園體育園區" },
  "20": { id: "A20", name: "興南站" },
  "21": { id: "A21", name: "環北站" },
  "22": { id: "A22", name: "老街溪站" }
};

const stationOptions = Object.keys(STATION_META).map(key => ({
  key,
  id: STATION_META[key].id,
  name: STATION_META[key].name
}));

const timeSlotOptions = (() => {
  const slots = [];
  for (let i = 0; i <= 24; i++) {
    const hh = String(i).padStart(2, '0');
    slots.push(`${hh}:00`);
    if (i < 24) slots.push(`${hh}:30`);
  }
  return slots;
})();

const isOpen = ref(false);
const isLoading = ref(false);
const hasSearched = ref(false);
const errorMessage = ref('');

const startDate = ref('');
const startHour = ref('04:00');
const endDate = ref('');
const endHour = ref('12:00');
const selectedStationKey = ref('1');

const resetToCurrentOperTime = () => {
  const now = new Date();
  const operDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const year = operDate.getFullYear();
  const month = String(operDate.getMonth() + 1).padStart(2, '0');
  const day = String(operDate.getDate()).padStart(2, '0');
  const operDateStr = `${year}-${month}-${day}`;

  const h = now.getHours();
  const m = now.getMinutes();
  const closestSlot = `${String(h).padStart(2, '0')}:${m >= 30 ? '30' : '00'}`;

  startDate.value = operDateStr;
  startHour.value = '04:00';
  endDate.value = operDateStr;
  endHour.value = closestSlot;
};

resetToCurrentOperTime();

watch(isOpen, (newVal) => {
  if (newVal) resetToCurrentOperTime();
});

const querySummary = ref(null);
const rawByStation = ref({});
const activeOdTab = reactive({});

const toggleDrawer = () => {
  if (!isOpen.value) resetToCurrentOperTime();
  isOpen.value = !isOpen.value;
};

const open = () => {
  resetToCurrentOperTime();
  isOpen.value = true;
};

const close = () => {
  isOpen.value = false;
};

const handleStationClick = (codeId) => {
  emit('locateStation', codeId);
  if (window.innerWidth <= 768) {
    isOpen.value = false;
  }
};

const getCodeIdByNum = (numStr) => {
  const k = String(numStr).trim();
  return STATION_META[k]?.id || `A${k}`;
};

const getFullNameByNum = (numStr) => {
  const k = String(numStr).trim();
  const meta = STATION_META[k];
  return meta ? `${meta.id} ${meta.name}` : `車站 ${k}`;
};

const executeSearch = async () => {
  errorMessage.value = '';
  isLoading.value = true;
  hasSearched.value = true;

  try {
    const res = await fetchPeopleWhereData({
      startTime: `${startDate.value} ${startHour.value}`,
      endTime: `${endDate.value} ${endHour.value}`,
      station: selectedStationKey.value
    });

    if (res && res.status === 'success') {
      querySummary.value = res.summary || null;
      rawByStation.value = res.byStation || {};
    } else {
      errorMessage.value = res?.message || '查詢失敗';
    }
  } catch (err) {
    errorMessage.value = '無法連線至人流去向分析伺服器';
  } finally {
    isLoading.value = false;
  }
};

const stationList = computed(() => {
  const raw = rawByStation.value;
  if (!raw || Object.keys(raw).length === 0) return [];

  const filterKey = selectedStationKey.value !== 'all' ? String(selectedStationKey.value) : null;
  const list = [];

  for (const [key, data] of Object.entries(raw)) {
    if (filterKey && String(key) !== filterKey) continue;
    if (!data) continue;

    const meta = STATION_META[key];
    list.push({
      numKey: key,
      codeId: meta ? meta.id : `A${key}`,
      fullName: meta ? `${meta.id} ${meta.name}` : `車站 ${key}`,
      shortName: meta ? meta.name : `車站 ${key}`,
      inflow: Number(data.inflow) || 0,
      outflow: Number(data.outflow) || 0,
      total: Number(data.total) || 0,
      whereTheyCameFrom: Array.isArray(data.whereTheyCameFrom) ? data.whereTheyCameFrom : [],
      whereTheyWentTo: Array.isArray(data.whereTheyWentTo) ? data.whereTheyWentTo : []
    });
  }

  return list.sort((a, b) => b.total - a.total);
});

defineExpose({
  isOpen,
  open,
  close,
  toggleDrawer
});
</script>

<style scoped>
/* ==================== 1. 自訂深色天藍膠囊捲軸 (列表與面板) ==================== */
.custom-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(56, 189, 248, 0.35) transparent;
}

.custom-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 9999px;
}

.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(56, 189, 248, 0.28);
  border-radius: 9999px;
  transition: background 0.2s ease;
}

.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(56, 189, 248, 0.6);
}

.custom-scroll::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

/* ==================== 2. 桌機版右下角浮動按鈕 ==================== */
.od-float-trigger-btn {
  position: fixed;
  right: 20px;
  bottom: 24px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 9999px;
  color: #f8fafc;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s, border-color 0.2s;
  user-select: none;
}

.od-float-trigger-btn:hover {
  transform: translateY(-2px);
  border-color: #38bdf8;
}

.trigger-icon { font-size: 16px; }
.trigger-text { font-size: 13.5px; font-weight: 600; letter-spacing: 0.5px; }

/* ==================== 3. 抽屜主體佈局 ==================== */
.od-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1010;
}

.od-drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 450px;
  max-width: 92vw;
  height: 100vh;
  background: #0b1120;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  z-index: 1040;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.od-drawer-panel.is-open { transform: translateX(0); }
.mobile-drag-handle { display: none; }

.od-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.od-title-block { display: flex; align-items: center; gap: 10px; }
.od-icon { font-size: 20px; }
.od-title { margin: 0; font-size: 15px; font-weight: 700; color: #f8fafc; }

.od-close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}

.od-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-overflow-scrolling: touch;
}

/* ==================== 4. 篩選控制項與下拉選單深色化美化 ==================== */
.od-filter-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12px; color: #94a3b8; font-weight: 500; }
.field-inputs { display: flex; gap: 8px; }

.od-date-picker {
  flex: 1.4;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 8px 10px;
  color: #f8fafc;
  font-size: 13px;
  outline: none;
  cursor: pointer;
  color-scheme: dark;
}

/* ⭐ 下拉選單：套用 color-scheme: dark 與自訂捲軸，杜絕原生白底捲軸 */
.od-time-select,
.od-station-select {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #f8fafc;
  font-size: 13px;
  outline: none;
  cursor: pointer;
  color-scheme: dark;
  scrollbar-width: thin;
  scrollbar-color: rgba(56, 189, 248, 0.35) transparent;
}

.od-time-select {
  flex: 1;
  padding: 8px;
}

.od-station-select {
  width: 100%;
  padding: 8px 10px;
}

/* 下拉選單選項內部樣式保護 */
.od-time-select option,
.od-station-select option {
  background-color: #0b1120;
  color: #f8fafc;
  padding: 6px 10px;
}

/* WebKit 瀏覽器下拉浮層捲軸細緻化 */
.od-time-select::-webkit-scrollbar,
.od-station-select::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.od-time-select::-webkit-scrollbar-track,
.od-station-select::-webkit-scrollbar-track {
  background: #0b1120;
}

.od-time-select::-webkit-scrollbar-thumb,
.od-station-select::-webkit-scrollbar-thumb {
  background: rgba(56, 189, 248, 0.35);
  border-radius: 9999px;
}

.od-time-select::-webkit-scrollbar-thumb:hover,
.od-station-select::-webkit-scrollbar-thumb:hover {
  background: rgba(56, 189, 248, 0.6);
}

.od-time-select::-webkit-scrollbar-button,
.od-station-select::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

.od-submit-btn {
  margin-top: 4px;
  background: linear-gradient(135deg, #0284c7, #0369a1);
  border: none;
  border-radius: 8px;
  padding: 10px;
  color: #ffffff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.od-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ==================== 5. 統計與卡片列表 ==================== */
.od-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.summary-box {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
}

.sum-label { font-size: 11px; color: #94a3b8; }
.sum-val { font-size: 16px; font-weight: 700; margin-top: 2px; }
.in-val { color: #34d399; }
.out-val { color: #fb7185; }

.station-od-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.station-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.st-left { display: flex; align-items: center; gap: 8px; }
.st-badge {
  background: #3b82f6;
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.st-name { font-size: 13.5px; font-weight: 600; color: #f1f5f9; }
.st-flow-tags { display: flex; gap: 6px; font-size: 11px; }
.tag.in { color: #34d399; font-weight: 600; }
.tag.out { color: #fb7185; font-weight: 600; }

.od-tab-row {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 6px;
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 11.5px;
  padding: 6px;
  cursor: pointer;
  border-radius: 6px;
  text-align: center;
}

.tab-btn.active {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  font-weight: 600;
}

.od-flow-detail-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.od-block-sub {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #64748b;
  padding: 0 2px;
}

.od-flow-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 6px;
}

.od-flow-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(15, 23, 42, 0.5);
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
}

.od-item-info {
  display: flex;
  align-items: center;
  font-size: 12px;
}

.od-rank { width: 18px; color: #64748b; font-weight: 700; }
.od-rank.top-rank { color: #f59e0b; }

.od-st-badge {
  background: rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  margin-right: 5px;
}

.od-st-badge.badge-to {
  background: rgba(251, 113, 133, 0.2);
  color: #fca5a5;
}

.od-st-name { flex: 1; color: #e2e8f0; }
.od-numbers { display: flex; align-items: baseline; gap: 4px; }
.od-pct { color: #94a3b8; font-size: 10.5px; }

.od-bar-track {
  width: 100%;
  height: 3.5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 9999px;
  overflow: hidden;
}

.od-bar-fill { height: 100%; border-radius: 9999px; }
.fill-in { background: #10b981; }
.fill-out { background: #f43f5e; }

.empty-tip, .empty-state {
  text-align: center;
  color: #64748b;
  font-size: 12px;
  padding: 16px 0;
}

.od-error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 6px;
}

/* ==================== 6. 📱 手機版專屬優化 (<= 1024px) ==================== */
@media (max-width: 1024px) {
  .od-float-trigger-btn {
    display: none !important;
  }

  .od-drawer-backdrop {
    z-index: 1010 !important;
  }

  .od-drawer-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: calc(64px + env(safe-area-inset-bottom, 0px)) !important;
    width: 100vw !important;
    max-width: 100vw !important;
    height: calc(85vh - 64px) !important;
    max-height: calc(85vh - 64px) !important;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px 20px 0 0;
    background: #0b1120 !important;
    transform: translateY(calc(100% + 100px));
    box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.65);
    z-index: 1040 !important;
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .od-drawer-panel.is-open {
    transform: translateY(0);
  }

  .mobile-drag-handle {
    display: block;
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 9999px;
    margin: 10px auto 2px;
    cursor: pointer;
  }

  .od-header {
    padding: 10px 16px 12px;
  }

  .od-body {
    padding: 12px 14px 20px;
  }

  .field-inputs {
    flex-direction: row;
  }

  .od-flow-list {
    max-height: 220px;
  }
}
</style>