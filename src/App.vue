<template>
  <div class="metro-container">
    <!-- 1. 底圖與 SVG 雙向軌道/綠線/列車圖層 -->
    <div id="map"></div>
    <svg id="svg-track-layer">
      <!-- ================= 機捷雙向軌道 (去程/回程) ================= -->
      <path id="svg-commuter-glow" class="track-glow-blue" fill="none" />
      <path id="svg-commuter-core" class="track-core-blue" fill="none" />
      <path id="svg-express-glow" class="track-glow-purple" fill="none" />
      <path id="svg-express-core" class="track-core-purple" fill="none" />

      <!-- ================= 綠線 第 1 階段 (G11 - G15b) ================= -->
      <path id="svg-green-p1-r-glow" class="track-glow-green" fill="none" />
      <path id="svg-green-p1-r-core" class="track-core-green green-dashed" fill="none" />
      <path id="svg-green-p1-l-glow" class="track-glow-green" fill="none" />
      <path id="svg-green-p1-l-core" class="track-core-green green-dashed" fill="none" />

      <!-- ================= 綠線 第 2 階段 (G11 - G08) ================= -->
      <path id="svg-green-p2-r-glow" class="track-glow-green" fill="none" />
      <path id="svg-green-p2-r-core" class="track-core-green green-dashed" fill="none" />
      <path id="svg-green-p2-l-glow" class="track-glow-green" fill="none" />
      <path id="svg-green-p2-l-core" class="track-core-green green-dashed" fill="none" />

      <!-- ================= 綠線 第 3 階段 (G01 - G08) ================= -->
      <path id="svg-green-p3-r-glow" class="track-glow-green" fill="none" />
      <path id="svg-green-p3-r-core" class="track-core-green green-dashed" fill="none" />
      <path id="svg-green-p3-l-glow" class="track-glow-green" fill="none" />
      <path id="svg-green-p3-l-core" class="track-core-green green-dashed" fill="none" />

      <g id="svg-trains-group"></g>
    </svg>

    <!-- 2. 右上角呼吸燈狀態 HUD (僅在授權通過後顯示，避免遮擋驗證遮罩)[cite: 6] -->
    <CountdownHud 
      v-if="isSystemAuthorized"
      :sync-status="syncStatus"
      :flow-summary="flowSummary"
      @refresh="refreshFlowData"
    />

    <!-- 3. 左側戰情室 HUD 面板 (抽屜模式)[cite: 6] -->
    <HudPanel 
      ref="hudPanelRef"
      v-model:is-collapsed="isPanelCollapsed"
      :flow-summary="flowSummary"
      :selected-station-id="selectedStationId"
      :selected-station-name="selectedStationName"
      :current-station-detail="currentStationDetail"
      :formatted-sim-time="formattedSimTime"
      :time-multiplier="timeMultiplier"
      :sync-status="syncStatus"
      @set-speed="setTimeSpeed"
      @sync-real-time="syncToRealTime"
      @reset-overview="resetToOverview"
      @select-station="selectStation"
      @trigger-refresh="triggerImmediateRefresh"
    />

    <!-- 4. 獨立 OD 人流去向分析抽屜[cite: 6] -->
    <PeopleWhereDrawer 
      ref="peopleWhereDrawerRef"
      @locate-station="selectStation" 
    />

    <!-- 5. 獨立分時運量趨勢按鈕 (桌面版：座落於人流去向上方)[cite: 6] -->
    <HourlyFlowTriggerBtn 
      v-if="isSystemAuthorized"
      :active="isHourlyModalOpen"
      @click="isHourlyModalOpen = true"
    />

    <!-- 6. 分時運量彈窗[cite: 6] -->
    <HourlyFlowModal 
      v-model="isHourlyModalOpen"
      :default-station-id="'ALL'"
      @close="isHourlyModalOpen = false"
      @change-station="id => {
        if (id !== 'ALL' && mapInstance) {
          const st = stations.find(s => s.id === id);
          if (st) mapInstance.easeTo({ center: st.coord, zoom: 14.0, duration: 800 });
        }
      }"
    />

    <!-- 7. 手機版底部導覽列 (授權通過後才渲染，避免手機端鍵盤彈出時遮擋登入按鈕)[cite: 6] -->
    <MobileBottomNav 
      v-if="isSystemAuthorized"
      :is-panel-open="!isPanelCollapsed"
      :active-tab="currentMobileTab"
      :time-multiplier="timeMultiplier"
      :is-hourly-modal-open="isHourlyModalOpen"
      @update:is-panel-open="val => isPanelCollapsed = !val"
      @select-tab="handleMobileTabSelect"
      @close-panel="isPanelCollapsed = true"
      @set-speed="setTimeSpeed"
      @sync-real-time="syncToRealTime"
      @reset-overview="resetToOverview"
      @open-people-where="openPeopleWhereDrawer"
      @close-people-where="closePeopleWhereDrawer"
      @toggle-hourly-modal="isHourlyModalOpen = !isHourlyModalOpen"
      @close-hourly-modal="isHourlyModalOpen = false"
    />

    <!-- 8. ⭐ 系統存取授權鎖定與註冊審核面板 (覆蓋全域) -->
    <AccessLockModal 
      @authorized="handleUserAuthorized" 
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const maplibregl = window.maplibregl;

import CountdownHud from './components/CountdownHud.vue';
import HudPanel from './components/HudPanel.vue';
import PeopleWhereDrawer from './components/PeopleWhereDrawer.vue';
import MobileBottomNav from './components/MobileBottomNav.vue';
import HourlyFlowTriggerBtn from './components/HourlyFlowTriggerBtn.vue';
import HourlyFlowModal from './components/HourlyFlowModal.vue';
import AccessLockModal from './components/AccessLockModal.vue'; // ⭐ 引入授權驗證模組
import { useTrainSimulator } from './composables/useTrainSimulator.js';

import { stations, stationOffsets } from './trackData.js';
import { fetchPassengerFlow } from './services.js';
import { greenStations, greenPhaseTracks, greenOffsets } from './greenLineData.js';

const {
  simSeconds,
  timeMultiplier,
  southCoords,
  northCoords,
  getNowSeconds,
  initTrainAnimation
} = useTrainSimulator();

let mapInstance = null;
let timerInterval = null;
const stationElementsMap = new Map();

// 實例與彈窗控制參照[cite: 6]
const hudPanelRef = ref(null);
const peopleWhereDrawerRef = ref(null);
const isHourlyModalOpen = ref(false);

const currentMobileTab = ref('overview');
const isPanelCollapsed = ref(window.innerWidth <= 1024);
const syncStatus = ref('syncing');

// ⭐ 授權控制狀態與登入者資訊
const isSystemAuthorized = ref(false);
const currentUser = ref(null);

const flowSummary = ref({
  totals: { sumTodayIn: 0, sumTodayOut: 0, rateIn: '', rateOut: '' },
  stationRange: [],
  stationStats: {},
  currentOperDateStr: '',
  historyDateStr: '',
  dataEndTime: ''
});

const selectedStationId = ref(null);
const selectedStationName = computed(() => {
  if (!selectedStationId.value) return '';
  const s = stations.find(item => item.id === selectedStationId.value);
  return s ? s.name : selectedStationId.value;
});

const currentStationDetail = computed(() => {
  const stId = selectedStationId.value;
  if (!stId) return null;
  const stats = flowSummary.value.stationStats?.[stId] || {};
  const todayIn = Number(stats.todayIn) || 0;
  const historyIn = Number(stats.historyIn) || 0;
  const todayOut = Number(stats.todayOut) || 0;
  const historyOut = Number(stats.historyOut) || 0;
  const diffIn = todayIn - historyIn;
  const diffOut = todayOut - historyOut;

  return {
    todayIn,
    historyIn,
    diffIn,
    rateIn: historyIn > 0 ? ((diffIn / historyIn) * 100).toFixed(1) : '0.0',
    todayOut,
    historyOut,
    diffOut,
    rateOut: historyOut > 0 ? ((diffOut / historyOut) * 100).toFixed(1) : '0.0',
  };
});

const formattedSimTime = computed(() => {
  const total = Math.floor(simSeconds.value);
  const h = String(Math.floor(total / 3600) % 24).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
});

const setTimeSpeed = (speed) => { 
  timeMultiplier.value = speed; 
};

const syncToRealTime = () => {
  simSeconds.value = getNowSeconds();
  timeMultiplier.value = 1;
};

const handleMobileTabSelect = (tab) => {
  currentMobileTab.value = tab;
  if (hudPanelRef.value?.setTab) {
    hudPanelRef.value.setTab(tab);
  }
  isPanelCollapsed.value = false;
  peopleWhereDrawerRef.value?.close();
};

const openPeopleWhereDrawer = () => {
  isPanelCollapsed.value = true;
  peopleWhereDrawerRef.value?.open();
};

const closePeopleWhereDrawer = () => {
  peopleWhereDrawerRef.value?.close();
};

const selectStation = (stationId) => {
  selectedStationId.value = stationId;
  const isMobile = window.innerWidth <= 1024;

  document.querySelectorAll('.station-flow-capsule').forEach(el => el.classList.remove('is-pinned'));

  if (!isMobile) {
    const elObj = stationElementsMap.get(stationId);
    if (elObj && elObj.bubbleEl) {
      elObj.bubbleEl.classList.remove('is-dismissed');
      elObj.bubbleEl.classList.add('is-pinned');
    }
  }

  const targetStation = stations.find(s => s.id === stationId);
  if (targetStation && mapInstance) {
    mapInstance.easeTo({ center: targetStation.coord, zoom: 14.0, duration: 800 });
  }
};

const resetToOverview = () => {
  selectedStationId.value = null;
  document.querySelectorAll('.station-flow-capsule.is-pinned').forEach(el => el.classList.remove('is-pinned'));
  
  isPanelCollapsed.value = true;
  peopleWhereDrawerRef.value?.close();
  isHourlyModalOpen.value = false;

  if (mapInstance) {
    mapInstance.easeTo({ center: [121.295, 25.020], zoom: 13, duration: 800 });
  }
};

const updateStationMarkersData = () => {
  if (!flowSummary.value) return;

  stations.forEach(s => {
    const elObj = stationElementsMap.get(s.id);
    if (!elObj) return;

    const stats = flowSummary.value.stationStats?.[s.id] || {};
    const todayIn = Number(stats.todayIn) || 0;
    const historyIn = Number(stats.historyIn) || 0;
    const todayOut = Number(stats.todayOut) || 0;
    const historyOut = Number(stats.historyOut) || 0;

    const rateInNum = historyIn > 0 ? ((todayIn - historyIn) / historyIn) * 100 : 0;
    const rateOutNum = historyOut > 0 ? ((todayOut - historyOut) / historyOut) * 100 : 0;

    const rateInStr = (rateInNum >= 0 ? '▲ ' : '▼ ') + Math.abs(rateInNum).toFixed(1) + '%';
    const rateOutStr = (rateOutNum >= 0 ? '▲ ' : '▼ ') + Math.abs(rateOutNum).toFixed(1) + '%';

    const inTrendClass = rateInNum >= 0 ? 'trend-up' : 'trend-down';
    const outTrendClass = rateOutNum >= 0 ? 'trend-up' : 'trend-down';

    elObj.countEl.innerHTML = `
      <div class="flow-pill-group">
        <div class="flow-item">
          <span class="flow-label">進</span>
          <span class="flow-val">${todayIn.toLocaleString()}</span>
          <span class="flow-rate ${inTrendClass}">${rateInStr}</span>
        </div>
        <span class="flow-dot">·</span>
        <div class="flow-item">
          <span class="flow-label">出</span>
          <span class="flow-val">${todayOut.toLocaleString()}</span>
          <span class="flow-rate ${outTrendClass}">${rateOutStr}</span>
        </div>
      </div>
    `;
  });
};

const refreshFlowData = async () => {
  // 未獲取權限前不發送運量請求
  if (!isSystemAuthorized.value) return;

  syncStatus.value = 'syncing';

  try {
    const data = await fetchPassengerFlow((fastCache) => {
      flowSummary.value = fastCache;
      updateStationMarkersData();
    });

    if (data && (data.totals || data.stationStats)) {
      flowSummary.value = data;
      updateStationMarkersData();
      syncStatus.value = 'success';
    } else {
      syncStatus.value = 'error';
    }
  } catch (err) {
    console.error("同步客流失敗:", err);
    syncStatus.value = 'error';
  }
};

const triggerImmediateRefresh = async () => {
  await refreshFlowData();
};

// ⭐ 驗證通過後的配套初始化程序（桌機/手機共用）
const handleUserAuthorized = (user) => {
  isSystemAuthorized.value = true;
  currentUser.value = user;

  const isMobile = window.innerWidth <= 1024;
  if (!isMobile) {
    isPanelCollapsed.value = false; // 桌機版展開左側戰情面板
  } else {
    isPanelCollapsed.value = true;  // 手機版維持收合在底部
  }

  // 1. 馬上執行首次數據載入
  refreshFlowData();

  // 2. 啟動 5 分鐘自動輪詢機制
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    refreshFlowData();
  }, 5 * 60 * 1000);
};

const handleWindowResize = () => {
  const isMobile = window.innerWidth <= 1024;
  if (!isMobile && isSystemAuthorized.value) {
    isPanelCollapsed.value = false;
  }
};

onMounted(async () => {
  window.addEventListener('resize', handleWindowResize);

  // ⚠️ 修正：原本在這裡直接叫用的 refreshFlowData() 與 setInterval 已經完全移入 handleUserAuthorized 中！
  // 只有在完成工號密碼驗證或 4 小時授權生效後才會開始拉取客流。

  let styleJson = 'https://tiles.openfreemap.org/styles/positron';
  try {
    const res = await fetch('https://tiles.openfreemap.org/styles/positron');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.layers)) {
        data.layers = data.layers.filter(layer => {
          if (layer.type === 'fill-extrusion') return false;
          if (typeof layer.id === 'string' && layer.id.includes('building')) return false;
          return true;
        });
        styleJson = data;
      }
    }
  } catch (e) {
    styleJson = 'https://tiles.openfreemap.org/styles/positron';
  }

  const map = new maplibregl.Map({
    container: 'map',
    style: styleJson,
    center: [121.295, 25.020],
    zoom: 12.2,
    minZoom: 10,
    maxZoom: 17.5,
    maxBounds: [[120.95, 24.80], [121.75, 25.25]],
    dragPan: true,
    scrollZoom: true,
    boxZoom: false,
    dragRotate: false,
    pitchWithRotate: false
  });

  map.on('error', (e) => {
    if (e?.error?.message?.includes('Expected value to be of type number')) {
      return;
    }
  });

  mapInstance = map;

  const updateZoomClass = () => {
    const currentZoom = map.getZoom();
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    if (currentZoom < 13.0) {
      mapEl.classList.add('zoom-far');
    } else {
      mapEl.classList.remove('zoom-far');
    }

    if (currentZoom >= 14.5) {
      mapEl.classList.add('zoom-close');
    } else {
      mapEl.classList.remove('zoom-close');
    }
  };

  map.on('zoom', updateZoomClass);

  map.on('style.load', () => {
    const style = map.getStyle();
    const layers = style.layers || [];

    layers.forEach(layer => {
      if (layer.type === 'symbol') {
        try {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        } catch (err) {}
      }
    });

    renderSvgTracks();
    updateZoomClass();
  });

  const svgTrainsGroup = document.getElementById('svg-trains-group');
  const { updateTrainsRendering } = initTrainAnimation(map, svgTrainsGroup);

  const elSouthGlow = document.getElementById('svg-commuter-glow');
  const elSouthCore = document.getElementById('svg-commuter-core');
  const elNorthGlow = document.getElementById('svg-express-glow');
  const elNorthCore = document.getElementById('svg-express-core');

  const p1RGlow = document.getElementById('svg-green-p1-r-glow');
  const p1RCore = document.getElementById('svg-green-p1-r-core');
  const p1LGlow = document.getElementById('svg-green-p1-l-glow');
  const p1LCore = document.getElementById('svg-green-p1-l-core');

  const p2RGlow = document.getElementById('svg-green-p2-r-glow');
  const p2RCore = document.getElementById('svg-green-p2-r-core');
  const p2LGlow = document.getElementById('svg-green-p2-l-glow');
  const p2LCore = document.getElementById('svg-green-p2-l-core');

  const p3RGlow = document.getElementById('svg-green-p3-r-glow');
  const p3RCore = document.getElementById('svg-green-p3-r-core');
  const p3LGlow = document.getElementById('svg-green-p3-l-glow');
  const p3LCore = document.getElementById('svg-green-p3-l-core');

  const coordsToSmoothSvgPath = (coords) => {
    if (!coords || coords.length < 2) return '';
    const len = coords.length;
    const pts = new Array(len);
    for (let i = 0; i < len; i++) {
      pts[i] = map.project(coords[i]);
    }

    const parts = [`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`];
    for (let i = 1; i < len - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const xc = ((p1.x + p2.x) * 0.5).toFixed(1);
      const yc = ((p1.y + p2.y) * 0.5).toFixed(1);
      parts.push(`Q ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}, ${xc} ${yc}`);
    }
    parts.push(`L ${pts[len - 1].x.toFixed(1)} ${pts[len - 1].y.toFixed(1)}`);
    return parts.join(' ');
  };

  const setPathPair = (glowEl, coreEl, coords) => {
    if (!coords || coords.length === 0) return;
    const pathStr = coordsToSmoothSvgPath(coords);
    glowEl?.setAttribute('d', pathStr);
    coreEl?.setAttribute('d', pathStr);
  };

  const renderSvgTracks = () => {
    setPathPair(elSouthGlow, elSouthCore, southCoords);
    setPathPair(elNorthGlow, elNorthCore, northCoords);

    if (greenPhaseTracks?.phase1) {
      setPathPair(p1RGlow, p1RCore, greenPhaseTracks.phase1.right);
      setPathPair(p1LGlow, p1LCore, greenPhaseTracks.phase1.left);
    }
    if (greenPhaseTracks?.phase2) {
      setPathPair(p2RGlow, p2RCore, greenPhaseTracks.phase2.right);
      setPathPair(p2LGlow, p2LCore, greenPhaseTracks.phase2.left);
    }
    if (greenPhaseTracks?.phase3) {
      setPathPair(p3RGlow, p3RCore, greenPhaseTracks.phase3.right);
      setPathPair(p3LGlow, p3LCore, greenPhaseTracks.phase3.left);
    }

    updateTrainsRendering();
  };

  let isMovePending = false;
  const onMoveThrottled = () => {
    if (!isMovePending) {
      isMovePending = true;
      requestAnimationFrame(() => {
        renderSvgTracks();
        isMovePending = false;
      });
    }
  };

  map.on('move', onMoveThrottled);
  map.on('load', renderSvgTracks);
  map.on('moveend', renderSvgTracks);

  renderSvgTracks();

  stations.forEach(s => {
    const pos = (stationOffsets && stationOffsets[s.id]) ? stationOffsets[s.id] : 'top';
    const markerEl = document.createElement('div');
    markerEl.className = 'station-marker-container pos-' + pos;

    const dot = document.createElement('div');
    dot.className = s.express ? 'station-dot dot-express' : 'station-dot dot-commuter';
    markerEl.appendChild(dot);

    const line = document.createElement('div');
    line.className = 'leader-line';
    markerEl.appendChild(line);

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'station-flow-capsule';

    const label = document.createElement('span');
    label.className = 'st-name';
    label.innerText = s.name;
    bubbleEl.appendChild(label);

    const countEl = document.createElement('span');
    countEl.className = 'st-live-count';
    countEl.innerHTML = `<span style="opacity: 0.6; font-size: 11px;">載入中...</span>`;
    bubbleEl.appendChild(countEl);

    bubbleEl.addEventListener('click', (e) => {
      e.stopPropagation();
      selectStation(s.id);
    });

    markerEl.appendChild(bubbleEl);

    stationElementsMap.set(s.id, {
      bubbleEl,
      countEl
    });

    new maplibregl.Marker({ element: markerEl, anchor: 'center' })
      .setLngLat(s.coord)
      .addTo(map);
  });

  greenStations.forEach(s => {
    const pos = (greenOffsets && greenOffsets[s.id]) ? greenOffsets[s.id] : 'right';
    const gMarkerEl = document.createElement('div');
    gMarkerEl.className = 'station-marker-container pos-' + pos + ' green-station';

    const dot = document.createElement('div');
    dot.className = 'station-dot dot-green';
    gMarkerEl.appendChild(dot);

    const line = document.createElement('div');
    line.className = 'green-leader-line';
    gMarkerEl.appendChild(line);

    const tag = document.createElement('div');
    tag.className = 'station-tag-green';
    tag.innerText = `${s.id} ${s.name}`;
    gMarkerEl.appendChild(tag);

    new maplibregl.Marker({ element: gMarkerEl, anchor: 'center' })
      .setLngLat(s.coord)
      .addTo(map);
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
  if (timerInterval) clearInterval(timerInterval);
  if (mapInstance) mapInstance.remove();
});
</script>

