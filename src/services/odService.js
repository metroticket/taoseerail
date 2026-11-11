// src/services/odService.js 這是查詢人流的api

const PEOPLE_WHERE_API = "https://script.google.com/macros/s/AKfycbzyvo8pE59kneyvd6DzO79QhFBhNAn6n9rD6ybQ90zJqAucESClHDfwzgYc8uShqnc/exec";

/**
 * 查詢特定時間區間與車站的客流 OD 分佈
 * @param {Object} options
 * @param {string} options.startTime - 格式: "2026-09-23 14:00"
 * @param {string} options.endTime   - 格式: "2026-09-23 15:00"
 * @param {string} [options.station] - 特定車站 ID (如 "A18")，若為 "all" 或不傳則查全線
 * @returns {Promise<Object>}
 */
export async function fetchPeopleWhereData({ startTime, endTime, station = 'all' }) {
  if (!startTime || !endTime) {
    throw new Error("必須提供 startTime 與 endTime");
  }

  const url = new URL(PEOPLE_WHERE_API);
  url.searchParams.append("action", "PEOPLEWHERE");
  url.searchParams.append("startTime", startTime.trim());
  url.searchParams.append("endTime", endTime.trim());
  
  if (station && station !== 'all') {
    url.searchParams.append("station", station.trim());
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`OD 查詢失敗，HTTP 狀態碼: ${res.status}`);
    }
    const result = await res.json();
    return result;
  } catch (error) {
    console.error("fetchPeopleWhereData 連線異常:", error);
    throw error;
  }
}