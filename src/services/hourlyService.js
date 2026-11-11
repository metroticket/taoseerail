// src/services/hourlyService.js

const HOURLY_API_URL = "https://script.google.com/macros/s/AKfycbzyvo8pE59kneyvd6DzO79QhFBhNAn6n9rD6ybQ90zJqAucESClHDfwzgYc8uShqnc/exec?action=handleHourlyFlow";
const HOURLY_CACHE_KEY = "TYM_HOURLY_FLOW_DATA";

// 記憶體快取
let memoryHourlyCache = null;

/**
 * 取得全線及各站分時運量數據
 * @param {Function} onCacheHit - 若有本地快取，立即透過回呼提供快照
 * @param {Boolean} forceRefresh - 是否強制重新抓取 API
 * @returns {Promise<Object>} 回傳包含 operDate, hours, stations 的完整資料物件
 */
export async function fetchHourlyFlowData(onCacheHit, forceRefresh = false) {
  // 1. 若記憶體有快取且未強制更新，直接回傳
  if (!forceRefresh && memoryHourlyCache) {
    if (typeof onCacheHit === 'function') onCacheHit(memoryHourlyCache);
    return memoryHourlyCache;
  }

  // 2. 嘗試讀取 LocalStorage 快取
  if (!forceRefresh) {
    try {
      const localStr = localStorage.getItem(HOURLY_CACHE_KEY);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        memoryHourlyCache = parsed;
        if (typeof onCacheHit === 'function') onCacheHit(parsed);
      }
    } catch (e) {
      console.warn("[HourlyService] 讀取本地快取略過:", e);
    }
  }

  // 3. 連線請求後端 GAS API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 秒連線逾時保護

  try {
    const res = await fetch(`${HOURLY_API_URL}&_t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP 錯誤: ${res.status}`);
    }

    const json = await res.json();
    if (json.status === 'success' && json.data) {
      memoryHourlyCache = json.data;
      try {
        localStorage.setItem(HOURLY_CACHE_KEY, JSON.stringify(json.data));
      } catch (e) {}
      return json.data;
    }

    throw new Error("回傳分時數據結構不符合預期");
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[HourlyService] 抓取分時運量異常:", error);
    // 若請求失敗但有舊記憶體快取，則回退給舊快取
    if (memoryHourlyCache) return memoryHourlyCache;
    throw error;
  }
}

/**
 * 清除分時運量快取
 */
export function clearHourlyCache() {
  memoryHourlyCache = null;
  try {
    localStorage.removeItem(HOURLY_CACHE_KEY);
  } catch (e) {}
}