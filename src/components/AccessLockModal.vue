<!-- 登入面板組件 -->

<template>
  <Teleport to="body">
    <div v-if="!isAuthorized" class="auth-lock-backdrop">
      <div class="auth-lock-card">
        
        <!-- 頂部標題列 -->
        <div class="lock-header">
          <div class="lock-shield-icon">🔐</div>
          <h2 class="lock-title">TYM 即時數據</h2>
          <p class="lock-subtitle">
            {{ isRegisterMode ? '同仁首次存取權限申請' : 'TYM 即時數據即時運量· 請驗證存取身分' }}
          </p>
        </div>

        <!-- 視圖 A：登入表單 -->
        <form v-if="!isRegisterMode" class="lock-form" @submit.prevent="submitLogin">
          <div class="input-wrapper">
            <span class="input-icon">👤</span>
            <input
              v-model="loginForm.employeeId"
              type="text"
              placeholder="請輸入工號"
              class="auth-input"
              required
            />
          </div>

          <div class="input-wrapper">
            <span class="input-icon">🔑</span>
            <input
              v-model="loginForm.password"
              type="password"
              placeholder="請輸入密碼"
              class="auth-input"
              required
            />
          </div>

          <!-- 錯誤或提示文字 -->
          <div v-if="messageText" class="feedback-banner" :class="isSuccess ? 'banner-success' : 'banner-error'">
            {{ messageText }}
          </div>

          <button type="submit" class="primary-btn" :disabled="isLoading">
            <span v-if="isLoading" class="btn-spinner">⏳</span>
            {{ isLoading ? '登入驗證中...' : '登入系統' }}
          </button>

          <button type="button" class="secondary-btn" @click="switchToRegister">
            首次申請權限
          </button>
        </form>

        <!-- 視圖 B：首次申請表單 -->
        <form v-else class="lock-form" @submit.prevent="submitRegister">
          <div class="input-wrapper">
            <span class="input-icon">🆔</span>
            <input
              v-model="regForm.employeeId"
              type="text"
              placeholder="工號 (例如: TY0123)"
              class="auth-input"
              required
            />
          </div>

          <div class="input-wrapper">
            <span class="input-icon">🏢</span>
            <input
              v-model="regForm.department"
              type="text"
              placeholder="所屬單位 (例如: 運務處行控中心)"
              class="auth-input"
              required
            />
          </div>

          <div class="input-wrapper">
            <span class="input-icon">👤</span>
            <input
              v-model="regForm.name"
              type="text"
              placeholder="姓名"
              class="auth-input"
              required
            />
          </div>

          <div class="input-wrapper">
            <span class="input-icon">🔑</span>
            <input
              v-model="regForm.password"
              type="password"
              placeholder="設定密碼"
              class="auth-input"
              required
            />
          </div>

          <!-- 錯誤或提示文字 -->
          <div v-if="messageText" class="feedback-banner" :class="isSuccess ? 'banner-success' : 'banner-error'">
            {{ messageText }}
          </div>

          <button type="submit" class="primary-btn" :disabled="isLoading">
            <span v-if="isLoading" class="btn-spinner">⏳</span>
            {{ isLoading ? '資料送出中...' : '送出開通申請' }}
          </button>

          <button type="button" class="secondary-btn" @click="switchToLogin">
            ← 返回登入
          </button>
        </form>

        <div class="lock-footer-hint">
          ⏱ 登入成功後將保留授權 4 小時，逾時將自動登出
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';

const emit = defineEmits(['authorized']);

// ⭐ 請換成您的 GAS Web App 發布網址
const GAS_AUTH_API_URL = "https://script.google.com/macros/s/AKfycbzyvo8pE59kneyvd6DzO79QhFBhNAn6n9rD6ybQ90zJqAucESClHDfwzgYc8uShqnc/exec";
const AUTH_STORAGE_KEY = "_TYM_METRO_USER_AUTH";
const EXPIRE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 小時有效

const isAuthorized = ref(false);
const isRegisterMode = ref(false);
const isLoading = ref(false);
const messageText = ref('');
const isSuccess = ref(false);

const loginForm = reactive({
  employeeId: '',
  password: ''
});

const regForm = reactive({
  employeeId: '',
  department: '',
  name: '',
  password: ''
});

// 檢查本地 4 小時有效暫存
const checkExistingAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const authData = JSON.parse(raw);
      if (Date.now() < authData.expiry) {
        isAuthorized.value = true;
        emit('authorized', authData.user);
        return true;
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  } catch (e) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  isAuthorized.value = false;
  return false;
};

// 提交登入
const submitLogin = async () => {
  messageText.value = '';
  isSuccess.value = false;
  isLoading.value = true;

  try {
    const res = await fetch(GAS_AUTH_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "login",
        employeeId: loginForm.employeeId,
        password: loginForm.password
      })
    });

    const result = await res.json();

    if (result.status === 'success') {
      const authRecord = {
        expiry: Date.now() + EXPIRE_DURATION_MS,
        user: result.user
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authRecord));
      isAuthorized.value = true;
      emit('authorized', result.user);
    } else {
      messageText.value = result.message || '登入失敗';
    }
  } catch (err) {
    messageText.value = '無法連線至驗證伺服器，請檢查網路';
  } finally {
    isLoading.value = false;
  }
};

// 提交申請
const submitRegister = async () => {
  messageText.value = '';
  isSuccess.value = false;
  isLoading.value = true;

  try {
    const res = await fetch(GAS_AUTH_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "register",
        employeeId: regForm.employeeId,
        department: regForm.department,
        name: regForm.name,
        password: regForm.password
      })
    });

    const result = await res.json();

    if (result.status === 'success') {
      isSuccess.value = true;
      messageText.value = result.message;
      // 申請成功後自動切回登入頁
      setTimeout(() => {
        loginForm.employeeId = regForm.employeeId;
        loginForm.password = '';
        switchToLogin();
      }, 2500);
    } else {
      messageText.value = result.message || '申請失敗';
    }
  } catch (err) {
    messageText.value = '連線異常，請稍候再試';
  } finally {
    isLoading.value = false;
  }
};

const switchToRegister = () => {
  isRegisterMode.value = true;
  messageText.value = '';
};

const switchToLogin = () => {
  isRegisterMode.value = false;
  messageText.value = '';
};

onMounted(() => {
  checkExistingAuth();
});
</script>

<style scoped>
.auth-lock-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999 !important;
  background: rgba(5, 10, 20, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-lock-card {
  width: 100%;
  max-width: 420px;
  background: #0b1120;
  border: 1.5px solid rgba(56, 189, 248, 0.4);
  border-radius: 18px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(56, 189, 248, 0.2);
  padding: 30px 26px;
  display: flex;
  flex-direction: column;
  animation: cardFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

@keyframes cardFadeIn {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

.lock-header {
  text-align: center;
  margin-bottom: 20px;
}

.lock-shield-icon {
  font-size: 36px;
  margin-bottom: 6px;
}

.lock-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: 0.8px;
}

.lock-subtitle {
  margin: 6px 0 0;
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 0.3px;
}

.lock-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  pointer-events: none;
}

.auth-input {
  width: 100%;
  background: rgba(15, 23, 42, 0.95);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 9px;
  padding: 10px 12px 10px 38px;
  font-size: 13.5px;
  color: #f8fafc;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.auth-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
}

.feedback-banner {
  font-size: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  text-align: center;
  font-weight: 500;
}

.banner-error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.banner-success {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
}

.primary-btn {
  background: linear-gradient(135deg, #0284c7, #0369a1);
  border: none;
  border-radius: 9px;
  padding: 11px;
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.primary-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #94a3b8;
  border-radius: 9px;
  padding: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
}

.lock-footer-hint {
  text-align: center;
  font-size: 10px;
  color: #64748b;
  margin-top: 16px;
}
</style>