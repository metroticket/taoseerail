import { ref } from 'vue';
import * as turf from '@turf/turf';
import { stations, calibratedCoords } from '../trackData.js';
import { fullDayTimetable } from '../timetable.js';

export function useTrainSimulator() {
  function timeStrToSeconds(str) {
    if (!str) return 0;
    const [h, m, s] = str.split(':').map(Number);
    return h * 3600 + m * 60 + (s || 0);
  }

  const getNowSeconds = () => {
    const now = new Date();
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  };

  const simSeconds = ref(getNowSeconds());
  const timeMultiplier = ref(1);
  const activeExpressCount = ref(0);
  const activeCommuterCount = ref(0);

  let southLine = null;
  let northLine = null;
  let southCoords = [];
  let northCoords = [];
  let southTotalKm = 0;
  let northTotalKm = 0;
  const stationDistanceMap = { south: {}, north: {} };

  // 1. 初始化雙向複線幾何
  const buildSmoothDualTracks = () => {
    const line = turf.lineString(calibratedCoords);
    const simplified = turf.simplify(line, { tolerance: 0.00008, highQuality: true });
    const len = turf.length(simplified, { units: 'kilometers' });
    const stepKm = 0.06;
    const steps = Math.ceil(len / stepKm);
    const samplePts = [];
    for (let i = 0; i <= steps; i++) {
      samplePts.push(turf.along(simplified, (i / steps) * len, { units: 'kilometers' }).geometry.coordinates);
    }

    const sampledLine = turf.lineString(samplePts);
    const offsetSouth = turf.lineOffset(sampledLine, 0.015, { units: 'kilometers' });
    const offsetNorth = turf.lineOffset(sampledLine, -0.015, { units: 'kilometers' });

    southCoords = offsetSouth.geometry.coordinates;
    northCoords = offsetNorth.geometry.coordinates;

    southLine = turf.lineString(southCoords);
    northLine = turf.lineString(northCoords);

    southTotalKm = turf.length(southLine, { units: 'kilometers' });
    northTotalKm = turf.length(northLine, { units: 'kilometers' });

    stations.forEach(s => {
      const pt = turf.point(s.coord);
      stationDistanceMap.south[s.id] = turf.nearestPointOnLine(southLine, pt).properties.location;
      stationDistanceMap.north[s.id] = turf.nearestPointOnLine(northLine, pt).properties.location;
    });
  };

  buildSmoothDualTracks();

  // ⭐ 效能優化：預先快取班表時間秒數，避免每幀重複執行字串 split 與 map
  const cachedTimetable = fullDayTimetable.map(train => {
    const stops = train.stops;
    const firstStop = stops[0];
    const lastStop = stops[stops.length - 1];
    const startDepSec = timeStrToSeconds(firstStop.dep);
    const readySec = startDepSec - 60;
    const endArrSec = timeStrToSeconds(lastStop.arr);
    const trainId = `${train.type}-${train.direction}-${firstStop.dep}-${train.terminalStation}`;

    const parsedStops = stops.map(st => ({
      ...st,
      arrSec: timeStrToSeconds(st.arr),
      depSec: timeStrToSeconds(st.dep)
    }));

    return {
      ...train,
      trainId,
      startDepSec,
      readySec,
      endArrSec,
      parsedStops
    };
  });

  // 2. 啟動 SVG 動畫渲染
  const initTrainAnimation = (map, svgTrainsGroup) => {
    const svgTrainElements = new Map();

    const getOrCreateSvgTrain = (trainId, train) => {
      if (svgTrainElements.has(trainId)) return svgTrainElements.get(trainId);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `svg-train ${train.type === 'express' ? 'train-exp' : 'train-com'}`);

      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      halo.setAttribute('r', '10');
      halo.setAttribute('class', 'train-halo');
      g.appendChild(halo);

      const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      core.setAttribute('r', '5');
      core.setAttribute('class', 'train-core');
      g.appendChild(core);

      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      arrow.setAttribute('points', '0,-12 -3,-6 3,-6');
      arrow.setAttribute('class', 'train-arrow');
      g.appendChild(arrow);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('y', '16');
      text.setAttribute('class', 'train-text');
      text.textContent = train.type === 'express' ? `直達 ${train.terminalStation}` : `普通 ${train.terminalStation}`;
      g.appendChild(text);

      if (svgTrainsGroup) svgTrainsGroup.appendChild(g);
      const item = { g, currentCoord: null, prevCoord: null };
      svgTrainElements.set(trainId, item);
      return item;
    };

    const updateTrainsRendering = () => {
      svgTrainElements.forEach(item => {
        if (item.currentCoord && item.prevCoord) {
          const p = map.project(item.currentCoord);
          const pPrev = map.project(item.prevCoord);
          const angle = Math.atan2(p.y - pPrev.y, p.x - pPrev.x) * (180 / Math.PI) + 90;
          item.g.setAttribute('transform', `translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) rotate(${angle.toFixed(1)})`);
        }
      });
    };

    let lastTimestamp = performance.now();

    function frame() {
      const nowTimestamp = performance.now();
      const dt = (nowTimestamp - lastTimestamp) / 1000;
      lastTimestamp = nowTimestamp;

      simSeconds.value = (simSeconds.value + dt * timeMultiplier.value) % 86400;
      const currentSec = simSeconds.value;

      let activeExp = 0;
      let activeCom = 0;

      for (let t = 0; t < cachedTimetable.length; t++) {
        const train = cachedTimetable[t];

        if (currentSec < train.readySec || currentSec > train.endArrSec) {
          if (svgTrainElements.has(train.trainId)) {
            svgTrainElements.get(train.trainId).g.remove();
            svgTrainElements.delete(train.trainId);
          }
          continue;
        }

        if (train.type === 'express') activeExp++;
        else activeCom++;

        const trainItem = getOrCreateSvgTrain(train.trainId, train);
        const isSouth = train.direction === 'south';
        const targetLine = isSouth ? southLine : northLine;
        const lineMaxKm = isSouth ? southTotalKm : northTotalKm;
        const distMap = isSouth ? stationDistanceMap.south : stationDistanceMap.north;

        const firstDist = Math.max(0, Math.min(lineMaxKm, distMap[train.parsedStops[0].stationId] ?? 0));
        const initialPt = turf.along(targetLine, firstDist, { units: 'kilometers' });
        const offsetStep = isSouth ? 0.05 : -0.05;
        const prevPt = turf.along(targetLine, Math.max(0, Math.min(lineMaxKm, firstDist - offsetStep)), { units: 'kilometers' });

        if (currentSec >= train.readySec && currentSec < train.startDepSec) {
          trainItem.currentCoord = initialPt.geometry.coordinates;
          trainItem.prevCoord = prevPt ? prevPt.geometry.coordinates : initialPt.geometry.coordinates;
          trainItem.g.classList.add('waiting');
          continue;
        }

        trainItem.g.classList.remove('waiting');

        const stops = train.parsedStops;
        for (let i = 0; i < stops.length; i++) {
          const curStop = stops[i];

          // 停站狀態
          if (currentSec >= curStop.arrSec && currentSec <= curStop.depSec) {
            const stopDist = Math.max(0, Math.min(lineMaxKm, distMap[curStop.stationId] ?? 0));
            const pt = turf.along(targetLine, stopDist, { units: 'kilometers' });
            const pPrev = turf.along(targetLine, Math.max(0, Math.min(lineMaxKm, stopDist - offsetStep)), { units: 'kilometers' });
            if (pt?.geometry?.coordinates) {
              trainItem.currentCoord = pt.geometry.coordinates;
              trainItem.prevCoord = pPrev ? pPrev.geometry.coordinates : pt.geometry.coordinates;
            }
            break;
          }

          // 區間行駛狀態
          if (i < stops.length - 1) {
            const nextStop = stops[i + 1];
            if (currentSec > curStop.depSec && currentSec < nextStop.arrSec) {
              const progress = (currentSec - curStop.depSec) / (nextStop.arrSec - curStop.depSec);
              const dStart = distMap[curStop.stationId] ?? 0;
              const dEnd = distMap[nextStop.stationId] ?? 0;
              const curD = Math.max(0, Math.min(lineMaxKm, dStart + (dEnd - dStart) * progress));

              const pt = turf.along(targetLine, curD, { units: 'kilometers' });
              const pPrev = turf.along(targetLine, Math.max(0, Math.min(lineMaxKm, curD - offsetStep)), { units: 'kilometers' });

              if (pt?.geometry?.coordinates) {
                trainItem.currentCoord = pt.geometry.coordinates;
                trainItem.prevCoord = pPrev ? pPrev.geometry.coordinates : pt.geometry.coordinates;
              }
              break;
            }
          }
        }
      }

      activeExpressCount.value = activeExp;
      activeCommuterCount.value = activeCom;
      updateTrainsRendering();
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
    return { updateTrainsRendering };
  };

  return {
    simSeconds,
    timeMultiplier,
    southCoords,
    northCoords,
    activeExpressCount,
    activeCommuterCount,
    getNowSeconds,
    initTrainAnimation
  };
}