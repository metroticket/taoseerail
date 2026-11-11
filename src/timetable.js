// src/timetable.js
// 桃園捷運官方營運全日時刻表

function secToTime(s) {
  const normSec = ((s % 86400) + 86400) % 86400;
  const h = String(Math.floor(normSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((normSec % 3600) / 60)).padStart(2, '0');
  const sec = String(normSec % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function timeToSec(str) {
  const [h, m, s] = str.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

// --------------------------------------------------------------------------
// 1. 各車種運行時分基準設定 (秒)
// --------------------------------------------------------------------------
const comSouthProfile = [
  { stationId: "A1",   runTime: 0,   dwellTime: 0 },
  { stationId: "A2",   runTime: 300, dwellTime: 40 },
  { stationId: "A3",   runTime: 180, dwellTime: 60 },
  { stationId: "A4",   runTime: 60,  dwellTime: 30 },
  { stationId: "A5",   runTime: 60,  dwellTime: 30 },
  { stationId: "A6",   runTime: 120, dwellTime: 40 },
  { stationId: "A7",   runTime: 300, dwellTime: 20 },
  { stationId: "A8",   runTime: 220, dwellTime: 180 },
  { stationId: "A9",   runTime: 180, dwellTime: 20 },
  { stationId: "A10",  runTime: 520, dwellTime: 20 },
  { stationId: "A11",  runTime: 100, dwellTime: 40 },
  { stationId: "A12",  runTime: 180, dwellTime: 60 },
  { stationId: "A13",  runTime: 120, dwellTime: 60 },
  { stationId: "A14a", runTime: 180, dwellTime: 20 },
  { stationId: "A15",  runTime: 160, dwellTime: 20 },
  { stationId: "A16",  runTime: 160, dwellTime: 20 },
  { stationId: "A17",  runTime: 160, dwellTime: 20 },
  { stationId: "A18",  runTime: 220, dwellTime: 60 },
  { stationId: "A19",  runTime: 120, dwellTime: 40 },
  { stationId: "A20",  runTime: 240, dwellTime: 40 },
  { stationId: "A21",  runTime: 240, dwellTime: 20 },
  { stationId: "A22",  runTime: 100, dwellTime: 0 }
];

const comNorthProfile = [
  { stationId: "A22",  runTime: 0,   dwellTime: 0 },
  { stationId: "A21",  runTime: 100, dwellTime: 20 },
  { stationId: "A20",  runTime: 240, dwellTime: 40 },
  { stationId: "A19",  runTime: 240, dwellTime: 40 },
  { stationId: "A18",  runTime: 120, dwellTime: 60 },
  { stationId: "A17",  runTime: 220, dwellTime: 20 },
  { stationId: "A16",  runTime: 160, dwellTime: 20 },
  { stationId: "A15",  runTime: 160, dwellTime: 20 },
  { stationId: "A14a", runTime: 160, dwellTime: 20 },
  { stationId: "A13",  runTime: 180, dwellTime: 60 },
  { stationId: "A12",  runTime: 120, dwellTime: 60 },
  { stationId: "A11",  runTime: 180, dwellTime: 40 },
  { stationId: "A10",  runTime: 100, dwellTime: 20 },
  { stationId: "A9",   runTime: 520, dwellTime: 20 },
  { stationId: "A8",   runTime: 180, dwellTime: 180 },
  { stationId: "A7",   runTime: 220, dwellTime: 20 },
  { stationId: "A6",   runTime: 300, dwellTime: 40 },
  { stationId: "A5",   runTime: 120, dwellTime: 30 },
  { stationId: "A4",   runTime: 60,  dwellTime: 30 },
  { stationId: "A3",   runTime: 60,  dwellTime: 60 },
  { stationId: "A2",   runTime: 180, dwellTime: 40 },
  { stationId: "A1",   runTime: 300, dwellTime: 0 }
];

const expSouthFullStops = [
  { stationId: "A1",   arr: 0,    dep: 0 },
  { stationId: "A3",   arr: 480,  dep: 600 },
  { stationId: "A8",   arr: 1260, dep: 1320 },
  { stationId: "A12",  arr: 2160, dep: 2220 },
  { stationId: "A13",  arr: 2340, dep: 2460 },
  { stationId: "A18",  arr: 3180, dep: 3240 },
  { stationId: "A21",  arr: 3840, dep: 3840 }
];

const expNorthFullStops = [
  { stationId: "A21",  arr: 0,    dep: 0 },
  { stationId: "A18",  arr: 540,  dep: 660 },
  { stationId: "A13",  arr: 1380, dep: 1500 },
  { stationId: "A12",  arr: 1620, dep: 1680 },
  { stationId: "A8",   arr: 2400, dep: 2460 },
  { stationId: "A3",   arr: 3240, dep: 3360 },
  { stationId: "A1",   arr: 3840, dep: 3840 }
];

const expToA21DepTimes = [
  "06:15:00", "07:00:00", "08:00:00", "16:00:00",
  "17:00:00", "18:00:00", "18:45:00", "19:00:00"
];

const expSouthServices = [
  { origin: "A1", dep: "05:30:00", terminal: "A13", serviceDays: "all" },
  ...Array.from({ length: 69 }, (_, i) => {
    const totalMin = 360 + i * 15;
    if (totalMin > 1380) return null;
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const m = String(totalMin % 60).padStart(2, '0');
    const depTime = `${h}:${m}:00`;
    return {
      origin: "A1",
      dep: depTime,
      terminal: expToA21DepTimes.includes(depTime) ? "A21" : "A13",
      serviceDays: "all"
    };
  }).filter(Boolean),
  { origin: "A1", dep: "18:45:00", terminal: "A21", serviceDays: "weekday" }
];

const expNorthServices = [
  { origin: "A21", dep: "07:15:00", terminal: "A1", serviceDays: "weekday" },
  { origin: "A21", dep: "07:30:00", terminal: "A1", serviceDays: "weekday" },
  { origin: "A21", dep: "08:15:00", terminal: "A1", serviceDays: "weekday" },
  { origin: "A21", dep: "09:15:00", terminal: "A1", serviceDays: "weekday" },
  ...Array.from({ length: 69 }, (_, i) => {
    const totalMin = 355 + i * 15;
    if (totalMin > 1375) return null;
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const m = String(totalMin % 60).padStart(2, '0');
    return {
      origin: "A13",
      dep: `${h}:${m}:00`,
      terminal: "A1",
      serviceDays: "all"
    };
  }).filter(Boolean)
];

const comSouthServices = [
  { origin: "A3",  dep: "06:03:00", terminal: "A22", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A7",  dep: "06:00:00", terminal: "A22", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A10", dep: "06:05:00", terminal: "A22", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A12", dep: "05:57:00", terminal: "A22", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A18", dep: "06:02:00", terminal: "A22", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A1",  dep: "06:08:00", terminal: "A22", hasWaitAtA8: false, serviceDays: "all" },
  ...Array.from({ length: 68 }, (_, i) => {
    const totalMin = 383 + i * 15;
    if (totalMin > 1388) return null;
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const m = String(totalMin % 60).padStart(2, '0');
    return {
      origin: "A1",
      dep: `${h}:${m}:00`,
      terminal: "A22",
      hasWaitAtA8: true,
      serviceDays: "all"
    };
  }).filter(Boolean),
  { origin: "A1", dep: "23:23:00", terminal: "A13", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A1", dep: "23:37:00", terminal: "A13", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A1", dep: "23:50:00", terminal: "A13", hasWaitAtA8: false, serviceDays: "all" }
];

const comNorthServices = [
  { origin: "A10",  dep: "05:58:00", terminal: "A1", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A14a", dep: "06:00:00", terminal: "A1", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A18",  dep: "06:02:00", terminal: "A1", hasWaitAtA8: true,  serviceDays: "all" },
  ...Array.from({ length: 68 }, (_, i) => {
    const totalMin = 378 + i * 15;
    if (totalMin > 1368) return null;
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const m = String(totalMin % 60).padStart(2, '0');
    return {
      origin: "A22",
      dep: `${h}:${m}:00`,
      terminal: "A1",
      hasWaitAtA8: true,
      serviceDays: "all"
    };
  }).filter(Boolean),
  { origin: "A13", dep: "06:04:00", terminal: "A1", hasWaitAtA8: true, serviceDays: "all" },
  { origin: "A13", dep: "06:19:00", terminal: "A1", hasWaitAtA8: true, serviceDays: "all" },
  { origin: "A13", dep: "06:34:00", terminal: "A1", hasWaitAtA8: true, serviceDays: "all" },
  { origin: "A13", dep: "07:19:00", terminal: "A1", hasWaitAtA8: false, serviceDays: "weekday" },
  { origin: "A13", dep: "07:25:00", terminal: "A1", hasWaitAtA8: false, serviceDays: "weekday" },
  { origin: "A13", dep: "17:43:00", terminal: "A1", hasWaitAtA8: false, serviceDays: "weekday" },
  { origin: "A13", dep: "23:05:00", terminal: "A1", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A13", dep: "23:20:00", terminal: "A1", hasWaitAtA8: false, serviceDays: "all" },
  { origin: "A13", dep: "23:35:00", terminal: "A1", hasWaitAtA8: false, serviceDays: "all" }
];

function buildCommuterSchedule(service, profile, direction) {
  const originIdx = profile.findIndex(st => st.stationId === service.origin);
  const termIdx = profile.findIndex(st => st.stationId === service.terminal);
  if (originIdx === -1 || termIdx === -1 || originIdx >= termIdx) return null;

  const stops = [];
  let currentSec = timeToSec(service.dep);

  for (let i = originIdx; i <= termIdx; i++) {
    const item = profile[i];
    const isFirst = i === originIdx;
    const isLast = i === termIdx;

    if (!isFirst) currentSec += item.runTime;
    const arrSec = currentSec;

    let actualDwell = item.dwellTime;
    if (item.stationId === "A8") {
      actualDwell = (service.hasWaitAtA8 !== false) ? 180 : 60;
    }

    if (!isLast) currentSec += actualDwell;
    const depSec = currentSec;

    stops.push({
      stationId: item.stationId,
      arr: isFirst ? secToTime(depSec) : secToTime(arrSec),
      dep: isLast ? secToTime(arrSec) : secToTime(depSec)
    });
  }

  return {
    type: "commuter",
    direction,
    originStation: service.origin,
    terminalStation: service.terminal,
    departureTime: service.dep,
    serviceDays: service.serviceDays || "all",
    hasWaitAtA8: service.hasWaitAtA8 !== false,
    stops
  };
}

function buildExpressSchedule(service, fullTemplate, direction) {
  const originIdx = fullTemplate.findIndex(st => st.stationId === service.origin);
  const termIdx = fullTemplate.findIndex(st => st.stationId === service.terminal);
  if (originIdx === -1 || termIdx === -1 || originIdx >= termIdx) return null;

  const originBaseDep = fullTemplate[originIdx].dep;
  const actualDepSec = timeToSec(service.dep);
  const virtualBaseDepSec = actualDepSec - originBaseDep;
  const activeStops = fullTemplate.slice(originIdx, termIdx + 1);

  return {
    type: "express",
    direction,
    originStation: service.origin,
    terminalStation: service.terminal,
    departureTime: service.dep,
    serviceDays: service.serviceDays || "all",
    stops: activeStops.map((st, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === activeStops.length - 1;
      const arrSec = virtualBaseDepSec + st.arr;
      const depSec = virtualBaseDepSec + st.dep;
      return {
        stationId: st.stationId,
        arr: isFirst ? secToTime(depSec) : secToTime(arrSec),
        dep: isLast ? secToTime(arrSec) : secToTime(depSec)
      };
    })
  };
}

export function assembleSchedule({ isHoliday = false } = {}) {
  const full = [];

  expSouthServices.forEach(s => {
    if (isHoliday && s.serviceDays === "weekday") return;
    const res = buildExpressSchedule(s, expSouthFullStops, "south");
    if (res) full.push(res);
  });

  expNorthServices.forEach(s => {
    if (isHoliday && s.serviceDays === "weekday") return;
    const res = buildExpressSchedule(s, expNorthFullStops, "north");
    if (res) full.push(res);
  });

  comSouthServices.forEach(s => {
    if (isHoliday && s.serviceDays === "weekday") return;
    const res = buildCommuterSchedule(s, comSouthProfile, "south");
    if (res) full.push(res);
  });

  comNorthServices.forEach(s => {
    if (isHoliday && s.serviceDays === "weekday") return;
    const res = buildCommuterSchedule(s, comNorthProfile, "north");
    if (res) full.push(res);
  });

  return full;
}

// ⭐ 快取平日與假日兩種組裝結果，避免多次重複計算
const weekdayTimetable = assembleSchedule({ isHoliday: false });
const holidayTimetable = assembleSchedule({ isHoliday: true });

export const fullDayTimetable = weekdayTimetable;

export function isWeekendOrHoliday(date = new Date()) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getFirstTrain(stationId, direction, options = {}) {
  const { type = null, date = new Date(), isHoliday = isWeekendOrHoliday(date) } = options;
  const timetable = isHoliday ? holidayTimetable : weekdayTimetable;

  const candidates = [];
  timetable.forEach(train => {
    if (train.direction !== direction) return;
    if (type && train.type !== type) return;

    const stop = train.stops.find(s => s.stationId === stationId);
    if (stop && stop.dep) {
      candidates.push({
        type: train.type,
        origin: train.originStation,
        terminal: train.terminalStation,
        depTime: stop.dep,
        depSec: timeToSec(stop.dep),
        serviceDays: train.serviceDays
      });
    }
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.depSec - b.depSec);
  return candidates[0];
}