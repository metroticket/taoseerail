<template>
  <!-- 1. 手機版抽屜開啟時的黑色遮罩 -->
  <div 
    class="mobile-panel-backdrop" 
    v-if="!isCollapsed" 
    @click="$emit('update:isCollapsed', true)"
  ></div>

  <!-- 2. HUD 面板主體 -->
  <div class="hud-panel" :class="{ 'is-collapsed': isCollapsed }">
    <!-- 標題列 -->
    <div class="hud-header">
      <div class="header-left">
        <div class="status-indicator" :class="{ 'event-indicator': currentTab === 'event' }"></div>
        <span class="hud-title">
          {{ currentTab === 'event' ? '🎪 活動疏運專案監控' : 'TAOYUAN METRO 即時數據中心' }}
        </span>
      </div>

      <div class="header-actions">
        <button 
          type="button" 
          class="hud-tab-toggle-btn"
          @click="currentTab = (currentTab === 'overview' ? 'event' : 'overview')"
        >
          {{ currentTab === 'overview' ? '🎪 活動觀察' : '← 返回戰情' }}
        </button>

        <button 
          class="hud-close-collapse-btn" 
          @click="$emit('update:isCollapsed', true)" 
          type="button"
        >
          ✕ 縮回
        </button>
      </div>
    </div>

    <!-- ==================== 視圖 A：戰情儀表板 ==================== -->
    <div v-if="currentTab === 'overview'" class="hud-body-content custom-scroll">
      <!-- 頂部同步狀態條 -->
      <div class="mobile-sync-bar">
        <div class="msb-left">
          <div class="status-pulse-dot" :class="`dot-${syncFreshnessStatus}`"></div>
          <div class="msb-text-group">
            <span class="msb-timer" :class="`text-${syncFreshnessStatus}`">
              <template v-if="syncStatus === 'syncing'">正在同步運量...</template>
              <template v-else>{{ statusText }}</template>
            </span>
            <span 
              v-if="syncFreshnessStatus === 'red' && flowSummary?.dataEndTime" 
              class="msb-time-tag text-red-sub"
            >
              (停留在 {{ flowSummary.dataEndTime }})
            </span>
          </div>
        </div>
        <button 
          class="msb-refresh-btn" 
          :disabled="syncStatus === 'syncing'"
          @click="$emit('triggerRefresh')"
        >
          <span class="refresh-icon" :class="{ 'is-spinning': syncStatus === 'syncing' }">🔄</span>
          {{ syncStatus === 'syncing' ? '更新中' : '立即更新' }}
        </button>
      </div>

      <div class="hud-sub">桃園捷運即時運量監控</div>
      <div class="divider"></div>

      <!-- 全線即時運量 -->
      <div class="flow-info-card">
        <div class="flow-card-header">
          <span class="flow-card-title">👥 全線即時運量</span>
          <span class="flow-badge">每5分鐘自動同步</span>
        </div>
        <div class="flow-stats-grid">
          <div class="flow-stat-box">
            <span class="flow-stat-label">今日累計進站</span>
            <span class="flow-stat-val val-in">
              {{ flowSummary?.totals?.sumTodayIn ? Number(flowSummary.totals.sumTodayIn).toLocaleString() : '--' }}
            </span>
            <span class="flow-stat-rate" v-if="flowSummary?.totals?.rateIn">
              較前期 {{ Number(flowSummary.totals.rateIn) >= 0 ? '+' : '' }}{{ flowSummary.totals.rateIn }}%
            </span>
          </div>
          <div class="flow-stat-box">
            <span class="flow-stat-label">今日累計出站</span>
            <span class="flow-stat-val val-out">
              {{ flowSummary?.totals?.sumTodayOut ? Number(flowSummary.totals.sumTodayOut).toLocaleString() : '--' }}
            </span>
            <span class="flow-stat-rate" v-if="flowSummary?.totals?.rateOut">
              較前期 {{ Number(flowSummary.totals.rateOut) >= 0 ? '+' : '' }}{{ flowSummary.totals.rateOut }}%
            </span>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- 時間控制面板 -->
      <div class="time-control-box">
        <div class="sim-time-display">
          <span class="clock-label">當前監控時刻</span>
          <span class="clock-value">{{ formattedSimTime }}</span>
        </div>
        <div class="time-btn-row">
          <button class="time-btn" :class="{ active: timeMultiplier === 1 }" @click="$emit('setSpeed', 1)">1x 即時</button>
          <button class="time-btn" :class="{ active: timeMultiplier === 10 }" @click="$emit('setSpeed', 10)">10x 快進</button>
          <button class="time-btn" :class="{ active: timeMultiplier === 60 }" @click="$emit('setSpeed', 60)">60x 預演</button>
          <button class="time-btn sync-btn" @click="$emit('syncRealTime')">現在時間</button>
        </div>
      </div>

      <div class="divider"></div>

      <!-- 排行榜與單站明細 -->
      <div class="station-drawer-box">
        <div class="drawer-header">
          <span class="drawer-title">
            <span v-if="!selectedStationId">🏆 全日累計運量 Top 5</span>
            <span v-else>🔍 站點運量明細：{{ selectedStationName }}</span>
          </span>

          <button v-if="selectedStationId" class="drawer-reset-btn" @click="$emit('resetOverview')">
            返回全線
          </button>
        </div>

        <div v-if="!selectedStationId" class="top-ranking-list">
          <div
            v-for="(st, idx) in displayedTop5Stations"
            :key="st.stationId"
            class="top-ranking-item"
            @click="$emit('selectStation', st.stationId);$emit('update:isCollapsed', true)"
          >
            <span class="rank-badge" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
            <span class="rank-name">{{ st.name }}</span>
            <div class="rank-counts">
              <span class="rank-sub-in">進 {{ formatCompactNumber(st.todayIn) }}</span>
              <span class="rank-sub-out">出 {{ formatCompactNumber(st.todayOut) }}</span>
            </div>
          </div>
          <div v-if="displayedTop5Stations.length === 0" class="empty-list-tip">
            資料同步中，請稍候...
          </div>
        </div>

        <div v-else class="station-detail-card">
          <div class="date-comparison-tag">
            <span>營運日: {{ flowSummary?.currentOperDateStr || '今日' }}</span>
            <span>比較日: {{ flowSummary?.historyDateStr || '歷史比較日' }}</span>
          </div>
          <div class="detail-grid">
            <div class="detail-cell">
              <div class="cell-label">進站運量</div>
              <div class="cell-main val-in">{{ currentStationDetail?.todayIn?.toLocaleString() || '--' }}</div>
              <div class="cell-sub">
                比較日: {{ currentStationDetail?.historyIn?.toLocaleString() || '--' }}
                <span :class="(currentStationDetail?.diffIn || 0) >= 0 ? 'text-red' : 'text-green'">
                  ({{ (currentStationDetail?.diffIn || 0) >= 0 ? '+' : '' }}{{ currentStationDetail?.rateIn || '0' }}%)
                </span>
              </div>
            </div>
            <div class="detail-cell">
              <div class="cell-label">出站運量</div>
              <div class="cell-main val-out">{{ currentStationDetail?.todayOut?.toLocaleString() || '--' }}</div>
              <div class="cell-sub">
                比較日: {{ currentStationDetail?.historyOut?.toLocaleString() || '--' }}
                <span :class="(currentStationDetail?.diffOut || 0) >= 0 ? 'text-red' : 'text-green'">
                  ({{ (currentStationDetail?.diffOut || 0) >= 0 ? '+' : '' }}{{ currentStationDetail?.rateOut || '0' }}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 視圖 B：活動專案觀察視圖 ==================== -->
    <div v-else class="hud-body-content custom-scroll event-monitor-view">
      <div class="hud-sub">自選活動站點數據與全線佔比監控</div>
      <div class="divider"></div>

      <!-- 快捷情境按鈕列 -->
      <div class="preset-scenario-row">
        <span class="preset-label">快捷載入:</span>
        <div class="preset-tags-container hide-scrollbar">
          <button 
            v-for="(preset, idx) in customPresets" 
            :key="idx" 
            type="button" 
            class="preset-tag" 
            :title="`包含站點: ${preset.stations.join(', ')}`"
            @click="applyPreset(preset.stations)"
          >
            {{ preset.name }}
          </button>

          <button 
            type="button" 
            class="preset-tag add-preset-btn" 
            @click="promptAddPreset"
          >
            ＋ 新增
          </button>
          <button 
            type="button" 
            class="preset-tag reset" 
            @click="selectedEventStations = []"
          >
            清空
          </button>
        </div>
      </div>

      <!-- 旗艦整合卡 -->
      <div class="event-flagship-card">
        <div class="flagship-cols-grid">
          <!-- 1. 進站欄 -->
          <div class="flagship-col">
            <div class="col-head">
              <span class="head-tag tag-in">進站</span>
              <span class="share-badge badge-gold">佔{{ eventAggregate.inShare }}%</span>
            </div>
            <div class="col-main val-in">
              {{ eventAggregate.totalIn.toLocaleString() }}<span class="col-unit">人次</span>
            </div>
            <div class="col-history">
              <span class="hist-label">{{ eventContribution.historyDateShort }}</span>
              <span class="hist-val">{{ eventContribution.historyTotalIn.toLocaleString() }}</span>
            </div>
          </div>

          <!-- 2. 出站欄 -->
          <div class="flagship-col">
            <div class="col-head">
              <span class="head-tag tag-out">出站</span>
              <span class="share-badge badge-purple">佔{{ eventAggregate.outShare }}%</span>
            </div>
            <div class="col-main val-out">
              {{ eventAggregate.totalOut.toLocaleString() }}<span class="col-unit">人次</span>
            </div>
            <div class="col-history">
              <span class="hist-label">{{ eventContribution.historyDateShort }}</span>
              <span class="hist-val">{{ eventContribution.historyTotalOut.toLocaleString() }}</span>
            </div>
          </div>

          <!-- 3. 差額欄 -->
          <div class="flagship-col">
            <div class="col-head">
              <span class="head-tag tag-stay">出-進差</span>
            </div>
            <div class="col-main" :class="eventContribution.todayNet >= 0 ? 'val-stay-pos' : 'val-stay-neg'">
              {{ eventContribution.todayNet >= 0 ? '+' : '' }}{{ eventContribution.todayNet.toLocaleString() }}<span class="col-unit">人</span>
            </div>
            <div class="col-history">
              <span class="hist-label">{{ eventContribution.historyDateShort }}</span>
              <span class="hist-val" :class="eventContribution.historyNet >= 0 ? 'text-sky' : 'text-slate'">
                {{ eventContribution.historyNet >= 0 ? '+' : '' }}{{ eventContribution.historyNet.toLocaleString() }}
              </span>
            </div>
          </div>
        </div>

        <!-- 底部結算橫列 -->
        <div class="flagship-contrib-bar">
          <div class="contrib-title-block">
            <span class="contrib-icon">🎯</span>
            <span class="contrib-title">活動純增貢獻度</span>
          </div>
          <div class="contrib-number-block">
            <strong :class="eventContribution.contributionVal >= 0 ? 'contrib-pos' : 'contrib-neg'">
              {{ eventContribution.contributionVal >= 0 ? '+' : '' }}{{ eventContribution.contributionVal.toLocaleString() }}
            </strong>
            <span class="contrib-unit">人</span>
          </div>
        </div>
      </div>

      <!-- 全線大盤參考條 -->
      <div class="all-line-footer-bar">
        <span class="all-line-tag">全線車站</span>
        <div class="all-line-metrics">
          <div class="alm-item">累計進 <strong class="val-in">{{ allLineAggregate.totalIn.toLocaleString() }}</strong></div>
          <div class="alm-item">累計出 <strong class="val-out">{{ allLineAggregate.totalOut.toLocaleString() }}</strong></div>
          <div class="alm-item">差額 <strong :class="allLineAggregate.netStay >= 0 ? 'diff-positive' : 'diff-negative'">{{ allLineAggregate.netStay >= 0 ? '+' : '' }}{{ allLineAggregate.netStay.toLocaleString() }}</strong></div>
        </div>
      </div>
      
      <div class="divider"></div>

      <!-- 車站選擇膠囊列 -->
      <div class="station-selector-section">
        <div class="section-title">選擇監控車站 (點擊切換)</div>
        <div class="station-chip-scroller hide-scrollbar">
          <button
            v-for="(name, id) in stationNamesMap"
            :key="id"
            type="button"
            class="station-chip"
            :class="{ active: selectedEventStations.includes(id) }"
            @click="toggleStation(id)"
          >
            {{ id }}
          </button>
        </div>
      </div>

      <div class="divider"></div>

      <!-- 已選車站數據明細列表 -->
      <div class="event-station-list-box">
        <div class="section-title">已選車站數據明細 ({{ selectedEventStations.length }} 站)</div>
        
        <div v-if="eventStationDetails.length > 0" class="event-station-list custom-scroll">
          <div 
            v-for="st in eventStationDetails" 
            :key="st.id" 
            class="event-station-row"
            @click="$emit('selectStation', st.id);$emit('update:isCollapsed', true)"
          >
            <div class="es-left">
              <span class="es-name">{{ st.name }}</span>
            </div>
            <div class="es-right">
              <div class="es-counts">
                <span class="val-in">進 {{ formatCompactNumber(st.todayIn) }}</span>
                <span class="val-out">出 {{ formatCompactNumber(st.todayOut) }}</span>
              </div>
              <button class="es-remove-btn" @click.stop="toggleStation(st.id)">✕</button>
            </div>
          </div>
        </div>
        <div v-else class="empty-list-tip">
          請於上方點選車站標籤加入觀察
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
  isCollapsed: { type: Boolean, required: true },
  flowSummary: { type: Object, required: true },
  selectedStationId: { type: String, default: null },
  selectedStationName: { type: String, default: '' },
  currentStationDetail: { type: Object, default: () => null },
  formattedSimTime: { type: String, default: '' },
  timeMultiplier: { type: Number, default: 1 },
  syncStatus: { type: String, default: 'success' }
});

defineEmits([
  'update:isCollapsed', 
  'setSpeed', 
  'syncRealTime', 
  'resetOverview', 
  'selectStation', 
  'triggerRefresh'
]);

const stationNamesMap = {
  A1: 'A1 台北車站', A2: 'A2 三重站', A3: 'A3 新北產業園區', A4: 'A4 新莊副都心',
  A5: 'A5 泰山站', A6: 'A6 泰山貴和', A7: 'A7 體育大學', A8: 'A8 長庚醫院',
  A9: 'A9 林口站', A10: 'A10 山鼻站', A11: 'A11 坑口站', A12: 'A12 機場第一航廈',
  A13: 'A13 機場第二航廈', A14a: 'A14a 機場旅館', A15: 'A15 大園站', A16: 'A16 橫山站',
  A17: 'A17 領航站', A18: 'A18 高鐵桃園站', A19: 'A19 桃園體育園區', A20: 'A20 興南站',
  A21: 'A21 環北站', A22: 'A22 老街溪站'
};

const currentTab = ref('overview');

const INITIAL_PRESETS = [
  { name: 'A19棒球演唱會', stations: ['A19', 'A18'] },
  { name: '設計展活動', stations: ['A17', 'A18', 'A19', 'A20', 'A21'] }
];

const PRESETS_STORAGE_KEY = '_tym_custom_event_presets';
const customPresets = ref([...INITIAL_PRESETS]);

const EVENT_STORAGE_KEY = '_tym_event_selected_stations';
const selectedEventStations = ref(['A19', 'A18']);

onMounted(() => {
  const savedStations = localStorage.getItem(EVENT_STORAGE_KEY);
  if (savedStations) {
    try { selectedEventStations.value = JSON.parse(savedStations); } catch (e) {}
  }

  const savedPresets = localStorage.getItem(PRESETS_STORAGE_KEY);
  if (savedPresets) {
    try {
      const parsed = JSON.parse(savedPresets);
      if (Array.isArray(parsed) && parsed.length > 0) {
        customPresets.value = parsed;
      }
    } catch (e) {}
  }
});

watch(selectedEventStations, (val) => {
  localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(val));
}, { deep: true });

const savePresetsToStorage = () => {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customPresets.value));
};

const toggleStation = (id) => {
  const idx = selectedEventStations.value.indexOf(id);
  if (idx >= 0) {
    selectedEventStations.value.splice(idx, 1);
  } else {
    selectedEventStations.value.push(id);
  }
};

const applyPreset = (list) => {
  selectedEventStations.value = [...list];
};

const promptAddPreset = () => {
  if (selectedEventStations.value.length === 0) {
    alert('請先在下方勾選至少 1 個監控車站！');
    return;
  }

  const name = window.prompt(`請輸入新標籤名稱：\n(目前包含: ${selectedEventStations.value.join(', ')})`);
  if (!name || !name.trim()) return;

  const trimmed = name.trim();
  const existingIdx = customPresets.value.findIndex(p => p.name === trimmed);

  if (existingIdx >= 0) {
    customPresets.value[existingIdx].stations = [...selectedEventStations.value];
  } else {
    customPresets.value.push({
      name: trimmed,
      stations: [...selectedEventStations.value]
    });
  }

  savePresetsToStorage();
};

const getStationIndexById = (stId) => {
  const map = {
    A1: 0, A2: 1, A3: 2, A4: 3, A5: 4, A6: 5, A7: 6, A8: 7,
    A9: 8, A10: 9, A11: 10, A12: 11, A13: 12, A14a: 13, A15: 14,
    A16: 15, A17: 16, A18: 17, A19: 18, A20: 19, A21: 20, A22: 21
  };
  return map[stId] ?? -1;
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    return `${Number(parts[1])}/${Number(parts[2])}`;
  }
  return dateStr;
};

const eventStationDetails = computed(() => {
  const summary = props.flowSummary;
  if (!summary) return [];

  const statsMap = summary.stationStats || {};

  return selectedEventStations.value.map(stId => {
    const stats = statsMap[stId] || {};
    const todayIn = Number(stats.todayIn) || 0;
    const todayOut = Number(stats.todayOut) || 0;

    return {
      id: stId,
      name: stationNamesMap[stId] || stId,
      todayIn,
      todayOut,
      totalVolume: todayIn + todayOut
    };
  });
});

const eventAggregate = computed(() => {
  const details = eventStationDetails.value;
  const totals = props.flowSummary?.totals || {};

  const totalIn = details.reduce((sum, item) => sum + item.todayIn, 0);
  const totalOut = details.reduce((sum, item) => sum + item.todayOut, 0);
  const netStay = totalOut - totalIn;

  const allIn = Number(totals.sumTodayIn) || 0;
  const allOut = Number(totals.sumTodayOut) || 0;

  const inShare = allIn > 0 ? ((totalIn / allIn) * 100).toFixed(1) : '0.0';
  const outShare = allOut > 0 ? ((totalOut / allOut) * 100).toFixed(1) : '0.0';

  return { totalIn, totalOut, netStay, inShare, outShare };
});

const allLineAggregate = computed(() => {
  const totals = props.flowSummary?.totals || {};
  const totalIn = Number(totals.sumTodayIn) || 0;
  const totalOut = Number(totals.sumTodayOut) || 0;
  const netStay = totalIn - totalOut;

  return { totalIn, totalOut, netStay };
});

const eventContribution = computed(() => {
  const summary = props.flowSummary;
  const historyInArr = summary?.historyIn || [];
  const historyOutArr = summary?.historyOut || [];

  let historyTotalIn = 0;
  let historyTotalOut = 0;

  selectedEventStations.value.forEach(stId => {
    const idx = getStationIndexById(stId);
    if (idx >= 0) {
      historyTotalIn += Number(historyInArr[idx]) || 0;
      historyTotalOut += Number(historyOutArr[idx]) || 0;
    }
  });

  const todayNet = (eventAggregate.value.totalOut || 0) - (eventAggregate.value.totalIn || 0);
  const historyNet = historyTotalOut - historyTotalIn;
  const contributionVal = todayNet - historyNet;

  return {
    historyDateShort: formatShortDate(summary?.historyDateStr || ''),
    historyTotalIn,
    historyTotalOut,
    todayNet,
    historyNet,
    contributionVal
  };
});

const displayedTop5Stations = computed(() => {
  const summary = props.flowSummary;
  if (!summary) return [];

  const statsMap = summary.stationStats || {};
  const list = Object.keys(statsMap).map(stId => {
    const stats = statsMap[stId] || {};
    const todayIn = Number(stats.todayIn) || 0;
    const todayOut = Number(stats.todayOut) || 0;
    const totalFlow = (stats.todayTotal !== undefined) ? Number(stats.todayTotal) : (todayIn + todayOut);

    return {
      stationId: stId,
      name: stationNamesMap[stId] || stId,
      todayIn,
      todayOut,
      totalFlow
    };
  });

  list.sort((a, b) => b.totalFlow - a.totalFlow);
  return list.slice(0, 5);
});

const formatCompactNumber = (num) => {
  const n = Number(num) || 0;
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

const syncFreshnessStatus = computed(() => {
  if (props.syncStatus === 'error') return 'red';
  const endTimeStr = props.flowSummary?.dataEndTime;
  if (!endTimeStr) return 'green';

  let targetDate;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(endTimeStr.trim())) {
    const todayStr = new Date().toISOString().split('T')[0];
    targetDate = new Date(`${todayStr} ${endTimeStr.trim()}`);
  } else {
    targetDate = new Date(endTimeStr.replace(/-/g, '/'));
  }

  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60));

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

const setTab = (tab) => {
  currentTab.value = tab;
};

defineExpose({
  setTab,
  currentTab
});
</script>

<style scoped>
/* ==================== 1. 無干擾滾動條輔助 ==================== */
.hide-scrollbar {
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.custom-scroll {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.custom-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
}

/* ==================== 2. 標題與按鈕文字保護 ==================== */
.hud-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud-tab-toggle-btn,
.hud-close-collapse-btn {
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}

/* ==================== 3. 戰情室面板基礎 (桌面 / iPad 橫向) ==================== */
.hud-panel {
  position: fixed;
  left: 20px;
  /* ⭐ 核心修正：使用 max() 與 safe-area-inset-top，平板網址列下壓時自動留出安全空間 */
  top: max(24px, calc(env(safe-area-inset-top, 0px) + 16px));
  width: 380px;
  max-width: 90vw;
  /* 扣除頂部留白與底部空間，支援內部滾動 */
  max-height: calc(100vh - max(48px, calc(env(safe-area-inset-top, 0px) + 32px)) - env(safe-area-inset-bottom, 0px));
  background: rgba(11, 17, 32, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  z-index: 1020;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

.hud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.85);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  flex-shrink: 0;
}

.event-indicator {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
}

.hud-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: 0.5px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hud-tab-toggle-btn {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.hud-tab-toggle-btn:hover {
  background: rgba(56, 189, 248, 0.25);
}

.hud-close-collapse-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #94a3b8;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  display: none; /* 桌面預設不顯示縮回按鈕，依賴折疊切換 */
}

.hud-body-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hud-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: -4px;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 2px 0;
}

/* ==================== 4. 戰情室各卡片樣式 ==================== */
.flow-info-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 10px 12px;
}

.flow-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.flow-card-title {
  font-size: 12px;
  font-weight: 700;
  color: #f1f5f9;
}

.flow-badge {
  font-size: 9.5px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  padding: 2px 5px;
  border-radius: 4px;
}

.flow-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.flow-stat-box {
  display: flex;
  flex-direction: column;
}

.flow-stat-label {
  font-size: 10.5px;
  color: #94a3b8;
}

.flow-stat-val {
  font-size: 18px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  margin: 2px 0;
}

.val-in { color: #38bdf8; }
.val-out { color: #c084fc; }

.flow-stat-rate {
  font-size: 10px;
  color: #94a3b8;
}

/* 時間控制面板 */
.time-control-box {
  background: rgba(30, 41, 59, 0.4);
  border-radius: 10px;
  padding: 8px 10px;
}

.sim-time-display {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}

.clock-label {
  font-size: 10.5px;
  color: #94a3b8;
}

.clock-value {
  font-size: 15px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #38bdf8;
}

.time-btn-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

.time-btn {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 4px 0;
  border-radius: 5px;
  font-size: 10.5px;
  cursor: pointer;
  transition: all 0.15s;
}

.time-btn.active {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 700;
}

.sync-btn {
  color: #cbd5e1;
}

/* 排行榜與站點明細 */
.station-drawer-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer-title {
  font-size: 12px;
  font-weight: 700;
  color: #f1f5f9;
}

.drawer-reset-btn {
  background: transparent;
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
}

.top-ranking-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.top-ranking-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.top-ranking-item:hover {
  background: rgba(30, 41, 59, 0.8);
}

.rank-badge {
  font-size: 9.5px;
  font-weight: 800;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}

.rank-1 { background: #eab308; color: #000; }
.rank-2 { background: #94a3b8; color: #000; }
.rank-3 { background: #b45309; color: #fff; }

.rank-name {
  flex: 1;
  font-size: 11.5px;
  color: #e2e8f0;
  font-weight: 500;
}

.rank-counts {
  display: flex;
  gap: 6px;
  font-size: 10.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.rank-sub-in { color: #38bdf8; }
.rank-sub-out { color: #c084fc; }

.empty-list-tip {
  text-align: center;
  color: #64748b;
  font-size: 11px;
  padding: 12px 0;
}

/* 單站詳細卡 */
.station-detail-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(15, 23, 42, 0.7);
  padding: 8px 10px;
  border-radius: 8px;
}

.date-comparison-tag {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: #64748b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 4px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.detail-cell {
  display: flex;
  flex-direction: column;
}

.cell-label { font-size: 10px; color: #94a3b8; }
.cell-main {
  font-size: 15px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.cell-sub { font-size: 9.5px; color: #64748b; margin-top: 2px; }
.text-red { color: #f87171; }
.text-green { color: #34d399; }

/* ==================== 5. 活動視圖卡片 ==================== */
.preset-scenario-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.preset-label {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}

.preset-tags-container {
  display: flex;
  gap: 5px;
  overflow-x: auto;
}

.preset-tag {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #cbd5e1;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.add-preset-btn { border-color: rgba(56, 189, 248, 0.4); color: #38bdf8; }
.preset-tag.reset { color: #94a3b8; }

.event-flagship-card {
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.9);
  border: 1.5px solid rgba(56, 189, 248, 0.35);
  border-radius: 10px;
  padding: 10px;
  margin-top: 4px;
  margin-bottom: 6px;
}

.flagship-cols-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.flagship-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.col-head {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.head-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
}
.tag-in { background: rgba(234, 179, 8, 0.2); color: #fbbf24; }
.tag-out { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
.tag-stay { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }

.share-badge {
  font-size: 9.5px;
  font-weight: 600;
  padding: 1px 3px;
  border-radius: 3px;
}
.badge-gold { color: #fbbf24; background: rgba(234, 179, 8, 0.12); }
.badge-purple { color: #c084fc; background: rgba(168, 85, 247, 0.12); }

.col-main {
  font-size: 14px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  margin-top: 2px;
  white-space: nowrap;
}
.col-unit { font-size: 9.5px; font-weight: normal; color: #94a3b8; margin-left: 2px; }

.col-history {
  display: flex;
  align-items: baseline;
  gap: 3px;
  font-size: 9.5px;
  white-space: nowrap;
}
.hist-label {
  font-size: 8.5px;
  padding: 0 2px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}
.hist-val {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #cbd5e1;
}

.text-sky { color: #38bdf8; }
.text-slate { color: #94a3b8; }
.val-stay-pos { color: #38bdf8; }
.val-stay-neg { color: #f87171; }

.flagship-contrib-bar {
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.contrib-title-block { display: flex; align-items: baseline; gap: 4px; }
.contrib-icon { font-size: 11px; }
.contrib-title { font-size: 11px; font-weight: 800; color: #ffffff; }

.contrib-number-block strong {
  font-size: 15px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.contrib-pos { color: #38bdf8; text-shadow: 0 0 8px rgba(56, 189, 248, 0.4); }
.contrib-neg { color: #f87171; }
.contrib-unit { font-size: 10px; color: #94a3b8; }

.all-line-footer-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 5px 8px;
  margin-bottom: 6px;
}
.all-line-tag {
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
}
.all-line-metrics {
  display: flex;
  justify-content: space-around;
  flex: 1;
  font-size: 9.5px;
  gap: 4px;
}
.all-line-metrics strong { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.station-selector-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.section-title { font-size: 11px; font-weight: 700; color: #cbd5e1; }
.station-chip-scroller { display: flex; gap: 4px; overflow-x: auto; }
.station-chip {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #94a3b8;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
}
.station-chip.active {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 700;
}

.event-station-list-box { display: flex; flex-direction: column; gap: 5px; }
.event-station-list { display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto; }
.event-station-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(15, 23, 42, 0.6);
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
}
.es-name { font-size: 11px; color: #e2e8f0; }
.es-right { display: flex; align-items: center; gap: 6px; }
.es-counts { font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; display: flex; gap: 4px; }
.es-remove-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 10px;
}

/* 頂部同步條狀態 */
.mobile-sync-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 23, 42, 0.7);
  padding: 5px 8px;
  border-radius: 6px;
  margin-bottom: 6px;
}
.msb-left { display: flex; align-items: center; gap: 6px; }
.msb-text-group { display: flex; align-items: baseline; gap: 4px; }
.msb-timer { font-size: 10.5px; font-weight: 600; }
.msb-time-tag { font-size: 9.5px; }
.text-red-sub { color: #fca5a5 !important; }
.status-pulse-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot-green { background-color: #10b981; }
.dot-yellow { background-color: #f59e0b; }
.dot-red { background-color: #ef4444; }

.msb-refresh-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #cbd5e1;
  font-size: 9.5px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
}
.refresh-icon.is-spinning { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

/* ==================== 6. 📱 手機/直向平板 (<= 1024px) 專屬樣式 ==================== */
@media (max-width: 1024px) {
  .mobile-panel-backdrop {
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, 0.6) !important;
    z-index: 1010 !important;
  }

  .hud-panel {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important;
    width: 100vw !important;
    max-width: 100vw !important;
    max-height: calc(85vh - 60px) !important;
    border-radius: 18px 18px 0 0 !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-bottom: none !important;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.7) !important;
    z-index: 1040 !important;
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
    transform: translateY(0);
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }

  .hud-panel.is-collapsed {
    transform: translateY(calc(100% + 120px)) !important;
    pointer-events: none !important;
  }

  .hud-close-collapse-btn {
    display: block !important;
  }

  .hud-header {
    padding: 10px 12px !important;
    gap: 6px !important;
  }

  .hud-title {
    font-size: 11.5px !important;
  }

  .hud-body-content {
    padding: 10px 12px calc(48px + env(safe-area-inset-bottom, 0px)) 12px !important;
  }
}
</style>