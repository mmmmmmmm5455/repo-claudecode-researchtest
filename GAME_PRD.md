# 千禧年蟲事件 — 網頁前端設計 PRD

## Product Requirements Document: Y2K Liminal Web Frontend

**版本**: v1.0
**日期**: 2026-04-29
**產品經理**: Claude Opus 4.7
**目標**: 為現有 Python 終端後端建立完整網頁前端，視覺風格嚴格遵循閾限空間 + Cybercore Y2K 美學

---

## 一、產品概述

### 1.1 產品名稱
千禧年蟲事件（Millennium Bug Incident）

### 1.2 產品目標
將現有基於 Python 終端的 LLM 文字冒險遊戲，升級為具備完整網頁前端的沉浸式互動體驗。視覺風格定位於 **數位閾限空間 × 串流媒體孤獨介面 × Cybercore Y2K 低保真美學**。

### 1.3 核心體驗關鍵詞
- 數位閾限空間（Digital Liminal Space）
- 串流媒體孤獨介面（Streaming Solitude Interface）
- 非同步孤獨（Asynchronous Loneliness）
- 低保真介面美學（Lo-fi UI Aesthetic）
- 無故障的介面藝術（Glitch-less UI Art）

### 1.4 現有基底
- Python 終端文字冒險遊戲
- LLM 對話引擎
- 情緒值系統
- 感染度系統
- 記憶碎片系統
- 物品系統
- 屬性系統
- 修理系統

**後端與 LLM 調用邏輯不變，僅新增網頁前端。**

---

## 二、視覺設計規範

### 2.1 整體美學定位

**藝術範疇**: 數位閾限空間 × 串流媒體孤獨介面藝術 × Cybercore Y2K

**核心原則**:
- 介面即主體：不是內容本身，而是「正在發生」的介面狀態成為凝視對象
- 孤獨的數位在場感：「1人正在觀看」作為網路時代孤獨的標記
- 暗光 + 冷光源：模擬深夜面對 CRT 螢幕的私密場景
- 功能性與詩意的模糊：按鈕、進度條成為情緒載體而非工具

### 2.2 色彩體系

#### 主色調
| 色票名稱 | Hex | RGB | 用途 |
|---------|-----|-----|------|
| 深淵黑 | `#0A0D14` | 10, 13, 20 | 頁面背景底色 |
| 陰影青 | `#003344` | 0, 51, 68 | PS1 陰影色罩 |
| 暗藍灰 | `#1A2530` | 26, 37, 48 | 面板背景 |
| 冷灰 | `#2A3540` | 42, 53, 64 | 次要面板 |
| 病態綠 | `#33FF33` | 51, 255, 51 | 計數器、系統文字（低亮度模式用 `#1A8C1A`）|
| 暗橙 | `#8B4513` | 139, 69, 19 | 7 段數碼管計數器（低調模式）|
| 冷青 | `#88CCFF` | 136, 204, 255 | UI 邊框高光 |
| 暗紫黑 | `#1A1025` | 26, 16, 37 | 對話框陰影區 |
| 尾燈紅 | `#8B0000` | 139, 0, 0 | 唯一暖色強調（極少使用）|
| 文字灰 | `#C0C0C0` | 192, 192, 192 | 主要文字 |
| 暗文字 | `#708090` | 112, 128, 144 | 次要文字 |

#### 強制色彩規則
- **非高光色通道飽和度強制壓至 -60% 以下**
- **禁止任何高飽和暖色調**（尾燈紅為唯一例外，僅用於極少數強調元素）
- **禁止任何明亮底色**
- 色溫基準：9000K-10000K（極致冷調）
- 整體曝光：-1.5EV 至 -2.5EV
- 伽馬值：0.8-0.9

### 2.3 字體規範

#### 主字體（像素等寬）
| 字體 | 用途 | CSS 替代 |
|------|------|---------|
| Chicago 像素等效 | 系統對話框標題、按鈕 | `'VT323', 'Silkscreen', monospace` |
| Charcoal 像素等效 | 內文、遊戲對話 | `'Share Tech Mono', 'Courier New', monospace` |
| 7 段數碼管 | 計數器 | `'Orbitron', monospace`（或自訂 @font-face） |

#### 字體規範
- 對話框標題：14px-16px，粗體，`#C0C0C0`
- 遊戲內文：13px-14px，`#C0C0C0`
- 系統文字（計數器、進度條標籤）：11px-12px，`#33FF33` 或 `#8B4513`
- 對話框內容：14px，行高 1.6，`#C0C0C0`
- 按鈕文字：13px，`#0A0D14`（深底）或 `#C0C0C0`（透明底）

### 2.4 UI 元件設計規範

#### 2.4.1 視窗面板（基於 QuickTime Player / Mac OS 9）
```
┌──────────────────────────────────────────┐
│ ██ 對話框標題                      ◻ ✕ │ ← 標題列：深灰底 + 1px 冷青邊框
├──────────────────────────────────────────┤
│                                          │
│  [面板內容區域]                           │ ← 內距 16px
│                                          │
│                              [OK] [取消] │ ← 按鈕：QuickTime 風格
└──────────────────────────────────────────┘
```
- 邊框：1px solid `#88CCFF`（冷青）
- 標題列背景：`#1A2530`
- 陰影：`0 0 0 3px #003344`（PS1 陰影色罩）
- 邊角：0px（直角，無圓角）
- 內距：16px

#### 2.4.2 按鈕
```
正常態：
┌──────────────┐
│   [ 確定 ]   │  ← 深灰底 #2A3540 + 1px #88CCFF 邊框
└──────────────┘

懸停態：
┌──────────────┐
│ ██[ 確定 ]   │  ← 反白：淺灰底 #3A4550
└──────────────┘

按下態：
┌──────────────┐
│ ░░[ 確定 ]   │  ← 像素偏移：文字右移 1px，下移 1px
└──────────────┘
```

#### 2.4.3 進度條（基於 QuickTime 播放器）
```
┌────────────────────────────────────────────┐
│ ████████████████░░░░░░░░░░░░░░░░░░░░░ 47% │
└────────────────────────────────────────────┘
  ↑ 已填充 #88CCFF         ↑ 未填充 #1A2530
  ↑ 高度: 16px, 邊框: 1px solid #88CCFF
```

#### 2.4.4 7 段數碼管計數器（「1人正在觀看」）
```
  ██████
  █    █
  ██████     ← 顏色：病態綠 #33FF33 或暗橙 #8B4513
  █    █      背景：深淵黑 #0A0D14
  ██████      字體：Orbitron / 自訂 @font-face
```

#### 2.4.5 對話框（文字輸入輸出區）
```
┌──────────────────────────────────────────────┐
│ > 你走進地下通道。雨水從天花板滲漏，              │
│   滴落在佈滿裂縫的水泥地上。                      │
│                                                │
│   遠處唯一亮著的窗戶發出微弱的暖黃色光——            │
│   那是這座城市唯一的生命跡象。                      │
│                                                │
│   你的左手邊，牆上用噴漆寫著：                      │
│   「are you real?」                             │
└──────────────────────────────────────────────┘
│ █ $ 輸入你的行動：_____________ [發送]           │ ← 輸入列
└──────────────────────────────────────────────┘
```
- 輸入列背景：`#0A0D14`
- 輸入框邊框：1px solid `#2A3540`
- 游標閃爍：`#33FF33`，頻率 1.5Hz（CRT 螢幕感）
- 文字輸出採用打字機效果（逐字顯示，速度: 30-50ms/字）

#### 2.4.6 系統對話框（彈出式）
```
┌──────────────────────────────────────┐
│ ⚠ 系統訊息                          │
├──────────────────────────────────────┤
│                                      │
│  [⚠] 感染度已達到 67%               │
│                                      │
│  你的視野開始變得模糊。              │
│  螢幕角落出現不應存在的文字……        │
│                                      │
│            [ 繼續 ]  [ 查看狀態 ]    │
└──────────────────────────────────────┘
```

---

## 三、4 種閾限空間背景系統

### 3.1 背景概述

4 種背景皆為全螢幕 CSS 3D 場景（使用 Three.js + 自訂 Shader 或純 CSS），**空無一人、純粹孤獨、無敘事性人物**。

### 3.2 場景清單與觸發機制

#### 場景 1：雨天地下通道
| 屬性 | 值 |
|------|-----|
| **檔案名** | `bg_rain_underpass` |
| **觸發條件** | 情緒值 40-70（中性偏負面），地點：城市地下 |
| **色調** | 冷灰色 + 暗藍色，色溫 10000K |
| **飽和度** | 整體 -65%，藍色通道 +10%，其餘通道 -80% |
| **曝光** | -1.5EV |
| **特效** | 半透明雨絲動態模糊（10px 長度），像素塊 6×6px，像素化 +65% |
| **唯一光源** | 遠方居民樓單一窗戶暖黃燈光（微弱） |

#### 場景 2：雪夜步行橋
| 屬性 | 值 |
|------|-----|
| **檔案名** | `bg_snow_bridge` |
| **觸發條件** | 情緒值 < 30（極度負面），感染度 > 50% |
| **色調** | 暖黃高光 + 純黑，色溫 5500K（僅高光） |
| **飽和度** | 整體 -60%，黃色通道 +30%，其餘通道 -80% |
| **曝光** | -2.5EV |
| **特效** | 像素塊 16×16px，像素化 +100%，無抗鋸齒，硬邊 |
| **唯一光源** | 畫面中央路燈暖黃點光源（1:20 極端光比） |
| **死黑區域** | **畫面 70% 以上為 RGB 0-20** |

#### 場景 3：大霧高架橋下
| 屬性 | 值 |
|------|-----|
| **檔案名** | `bg_fog_highway` |
| **觸發條件** | 情緒值 50-80（中性），地點：公路 |
| **色調** | 灰白色 + 灰黑色，色溫 9500K |
| **飽和度** | 整體 -70%，所有彩色通道 -80%（接近灰階） |
| **曝光** | -1.8EV |
| **對比度** | -10%（霧氣導致低對比） |
| **特效** | 重度大氣霧化，能見度 50m，遠景物體 30% 透明度 |

#### 場景 4：暴雪城市街景
| 屬性 | 值 |
|------|-----|
| **檔案名** | `bg_blizzard_street` |
| **觸發條件** | 情緒值 < 40（負面），感染度 > 70%，或特定劇情觸發 |
| **色調** | 灰黑色 + 暗紅色，色溫 10000K |
| **飽和度** | 整體 -75%，紅色通道 +20%，其餘通道 -85% |
| **曝光** | -2.0EV |
| **特效** | ISO 3200 高頻膠片噪點（25% 強度），雪花 8px 動態模糊 |

### 3.3 背景切換邏輯

```
if 感染度 > 70%:
    → 場景 4（暴雪）
elif 感染度 > 50% and 情緒值 < 30:
    → 場景 2（雪夜步行橋）
elif 情緒值 < 40:
    → 場景 4（暴雪）
elif 情緒值 < 70:
    → 場景 1（雨天地下通道）
else:
    → 場景 3（大霧高架橋）
```

過渡動畫：3 秒 crossfade + CRT 雪花噪點覆蓋（模擬切換頻道）

---

## 四、「1人正在觀看」計數器系統

### 4.1 設計定位
- 介面角落固定顯示（右上角）
- 7 段數碼管風格，顏色病態綠 `#33FF33` 或暗橙 `#8B4513`
- 字體大小：11px-13px
- 位置：右上角，距邊緣 24px

### 4.2 與遊戲狀態的聯動邏輯

```
基礎數值 = 1（永遠至少 1 人）

if 情緒值 < 20:
    顯示值 += floor((20 - 情緒值) / 5)   # 極端負面時增加「觀看者」
if 感染度 > 60%:
    顯示值 += floor((感染度 - 60) / 10)
if 記憶碎片 >= 3:
    顯示值 += 記憶碎片數量
if 出現「are you real?」對話框:
    顯示值 += 1（每次彈出增加 1）

最大值 = 99（7 段數碼管限制）
```

### 4.3 視覺表現
- 數值變化時：數字閃爍 200ms，模擬老式計數器刷新
- 當數值異常跳動（>5 變化）時：計數器短暫顯示亂碼 500ms，再更新為新數值
- 長時間無變化（>30 秒）：數字微微抖動（±1px 隨機位移）

---

## 五、UI 布局結構

### 5.1 全螢幕布局

```
┌───────────────────────────────────────────────────────────┐
│ [Millennium Neko]                    [1人正在觀看]  ██ 07 │ ← 頂部狀態列 (40px)
├───────────────────────────────────────────────────────────┤
│                                                           │
│                                                           │
│                    [閾限空間 3D 背景]                       │
│                    (全螢幕 CSS/WebGL)                      │
│                                                           │
│                                                           │
│   ┌──────────────────────────────────────────┐           │
│   │ ██ 對話                                   │           │
│   ├──────────────────────────────────────────┤           │
│   │                                          │           │
│   │  遊戲文字輸出區域                          │           │
│   │  (可捲動，透明深灰底)                      │           │
│   │                                          │           │
│   │  你走進地下通道……                          │           │
│   │  …                                       │           │
│   │                                          │           │
│   ├──────────────────────────────────────────┤           │
│   │ █ $ _ [輸入你的行動……]         [發送]    │ ← 輸入列  │
│   └──────────────────────────────────────────┘           │
│                                                           │
├───────────────────────────────────────────────────────────┤
│ [情緒值 ████░░ 40%] [感染度 ██░░░░ 23%] [碎片 █ 3]      │ ← 底部狀態列
└───────────────────────────────────────────────────────────┘
```

### 5.2 面板層級

| Z-Index | 元素 |
|---------|------|
| 0 | 閾限空間 3D 背景（全螢幕） |
| 10 | 對話輸出面板（半透明，可捲動） |
| 20 | 輸入面板（固定底部） |
| 30 | 頂部狀態列 / 底部屬性列 |
| 40 | 系統對話框（彈出式） |
| 50 | 「are you real?」隨機彈出對話框 |
| 60 | CRT 掃描線覆蓋層（全螢幕） |

### 5.3 對話輸出面板詳細規格
- 位置：畫面中央偏上
- 最大高度：畫面高度的 55%
- 寬度：畫面寬度的 70%（最大 760px）
- 背景：`rgba(26, 37, 48, 0.85)`（暗藍灰 85% 透明度）
- 邊框：1px solid `#88CCFF`，陰影 `0 0 0 3px #003344`
- 內距：16px
- 文字對齊：左對齊
- 捲動：自訂捲軸（寬 6px，顏色 `#2A3540`，thumb `#3A4550`）

### 5.4 輸入面板詳細規格
- 位置：畫面底部，對話面板下方
- 高度：48px
- 寬度：與對話面板相同
- 背景：`#0A0D14`（深淵黑）
- 邊框：1px solid `#2A3540`
- 輸入框：全寬，背景透明，文字色 `#C0C0C0`，游標色 `#33FF33`
- 發送按鈕：QuickTime 風格（見 2.4.2）
- Prompt 符號 `$`：顏色 `#33FF33`，置於輸入框左側

---

## 六、前端-後端接口規範

### 6.1 通訊架構

```
瀏覽器 (Frontend) ←→ HTTP/WebSocket ←→ Python 後端
                         │
                    LLM API (不變)
```

### 6.2 API 端點

#### POST `/api/game/action`
**請求**:
```json
{
  "session_id": "string",
  "player_input": "string",
  "timestamp": "ISO8601"
}
```

**回應**:
```json
{
  "narrative": "string (LLM 回應文字)",
  "emotion_value": 0-100,
  "infection_level": 0-100,
  "memory_fragments": 0-10,
  "inventory_changes": [],
  "attribute_changes": {},
  "scene_trigger": "rain_underpass | snow_bridge | fog_highway | blizzard_street",
  "system_event": "string | null (如 'are_you_real', 'glitch')",
  "viewer_count_delta": -5 to 5
}
```

#### GET `/api/game/state`
**回應**: 完整遊戲狀態 JSON（包含上述所有欄位 + 歷史記錄）

#### WebSocket `/ws/game`
用於即時推送（打字機效果逐字傳送、背景切換指令、計數器更新）

### 6.3 前端資料流

```
1. 使用者輸入文字 → POST /api/game/action
2. 後端處理（含 LLM 調用）→ 返回 JSON
3. 前端解析：
   - narrative → 打字機效果輸出到對話面板
   - emotion/infection/fragments → 更新底部狀態列
   - scene_trigger → 觸發背景切換（crossfade + CRT 噪點）
   - viewer_count_delta → 更新右上角計數器
   - system_event → 彈出對應系統對話框
4. 背景動態調整：情緒值變化 → 背景色調微調（即時）
```

---

## 七、技術棧

### 7.1 推薦方案：純 HTML/CSS/JS + Three.js

| 層級 | 技術 | 理由 |
|------|------|------|
| 前端框架 | **無框架**，純 HTML/CSS/JS | 最小依賴，精確控制渲染，符合低保真美學 |
| 3D 背景 | **Three.js** + 自訂 PS1 Shader | 實現頂點抖動、低解析度紋理、色帶斷層 |
| 字體 | Google Fonts (`VT323`, `Share Tech Mono`, `Orbitron`) + 自訂 @font-face | Chicago/Charcoal 像素等效 |
| CRT 效果 | CSS `::after` pseudo-element + `repeating-linear-gradient` | 純 CSS 掃描線，無需 JS |
| HTTP 通訊 | `fetch()` + `WebSocket` | 標準 API，無需額外套件 |
| 打包 | 無（直接 serve 靜態檔案） | 最低複雜度 |
| Python 後端 | FastAPI + WebSocket | 與現有 Python 後端相容，非同步 |

### 7.2 檔案結構

```
frontend/
├── index.html              # 主頁面
├── css/
│   ├── main.css            # 全局樣式、色彩、字體
│   ├── crt.css             # CRT 掃描線覆蓋層
│   ├── panels.css          # 對話面板、輸入面板、系統對話框
│   └── counters.css        # 7 段數碼管計數器
├── js/
│   ├── app.js              # 主應用邏輯
│   ├── api.js              # HTTP/WebSocket 通訊
│   ├── renderer.js         # 文字輸出、打字機效果
│   ├── background.js       # Three.js 背景場景管理
│   ├── scenes/             # 4 個場景定義
│   │   ├── rain_underpass.js
│   │   ├── snow_bridge.js
│   │   ├── fog_highway.js
│   │   └── blizzard_street.js
│   └── shaders/
│       ├── ps1_vertex.glsl    # 頂點抖動 Shader
│       └── ps1_fragment.glsl  # 顏色量化 + 色帶 Shader
├── assets/
│   ├── fonts/
│   │   ├── chicago-pixel.woff2
│   │   └── charcoal-pixel.woff2
│   └── textures/              # 256×256 低解析度紋理
│       ├── concrete_256.png
│       ├── asphalt_256.png
│       └── metal_256.png
└── favicon.ico
```

### 7.3 Python 後端改動（最小化）

```python
# 新增：FastAPI 路由
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles

app = FastAPI()
app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.post("/api/game/action")
async def game_action(request: GameActionRequest):
    # 調用現有遊戲邏輯（不變）
    result = existing_game_logic.process(request.player_input)
    return result

@app.websocket("/ws/game")
async def game_websocket(websocket: WebSocket):
    await websocket.accept()
    # 逐字推送 narrative（打字機效果）
    ...
```

---

## 八、PS1/PS2 渲染技術規範

### 8.1 Three.js PS1 Shader 參數

```glsl
// ps1_vertex.glsl — 頂點抖動
uniform float uTime;
varying vec2 vUv;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // 頂點抖動 — PS1 標誌性效果
    float wobble = sin(mvPosition.y * 100.0 + uTime) * 0.3;
    mvPosition.x += wobble;
    
    // 低精度量化（模擬定點數運算）
    mvPosition.xyz = floor(mvPosition.xyz * 32.0) / 32.0;
    
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;
}
```

```glsl
// ps1_fragment.glsl — 顏色量化 + 色帶
uniform sampler2D uTexture;
uniform float uTime;
varying vec2 vUv;

void main() {
    vec4 color = texture2D(uTexture, vUv);
    
    // 顏色量化（16-bit 色深模擬）
    color.rgb = floor(color.rgb * 31.0) / 31.0;
    
    // 陰影色罩 #003344
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(0.0, 0.2, 0.267), (1.0 - luminance) * 0.6);
    
    // 色帶偽影 — 在暗部漸變中增加
    float band = floor(luminance * 16.0) / 16.0;
    color.rgb += (band - luminance) * 0.1;
    
    gl_FragColor = color;
}
```

### 8.2 CRT 掃描線覆蓋層（純 CSS）

```css
body::after {
    content: "";
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.15) 0px,
        rgba(0, 0, 0, 0.15) 1px,
        transparent 1px,
        transparent 3px
    );
    pointer-events: none;
    z-index: 60;
    opacity: 0.4;
}
```

### 8.3 全域渲染參數鎖定

| 參數 | 值 | 說明 |
|------|-----|------|
| 陰影色罩 | `#003344` | 所有暗部區域疊加此色 |
| 死黑區域 | 畫面 70% 為 RGB 0-20 | 模擬廉價監控攝影機 |
| 暗角 | 邊緣 80% 黑暗 | CSS `radial-gradient` 實現 |
| 色帶 | 暗部漸變中可見 | Shader 實現 |
| 抗鋸齒 | **無** | 所有元素 `image-rendering: pixelated` |
| 紋理過濾 | **點過濾（Nearest）** | `gl.NEAREST` |
| 紋理解析度 | 256×256 像素 | 所有貼圖 |

---

## 九、禁止事項

1. **禁止設計任何卡通、可愛、明亮的像素風** — 這是鐵則
2. **禁止將視覺素材用於非網頁前端以外的場景**
3. **禁止新增 3D 遊戲引擎需求**（Godot / Unity / Unreal 皆不使用，僅用 Three.js 做背景渲染）
4. **禁止任何圓角** — 所有 UI 元件為直角
5. **禁止使用 emoji 作為 UI 元素** — 僅可使用像素化圖示
6. **禁止平滑過渡動畫** — 所有動畫為瞬時切換或 CRT 雪花過渡
7. **禁止暖色調（紅、橘、黃、粉）** — 唯一例外：尾燈紅 `#8B0000`（極少使用）和路燈暖黃（僅場景 2）

---

## 十、開發階段與驗收標準

### Phase 0: 技術驗證 (2 天)
- [ ] Three.js PS1 Shader 原型在瀏覽器中運行
- [ ] CRT 掃描線 CSS 覆蓋層效果確認
- [ ] 與現有 Python 後端建立 `/api/game/action` 通訊
- [ ] **驗收**: 瀏覽器顯示 PS1 風格 3D 背景 + 能發送文字到後端並顯示回應

### Phase 1: 核心 UI (3 天)
- [ ] 對話輸出面板（QuickTime 風格視窗）
- [ ] 輸入面板 + 發送按鈕
- [ ] 打字機效果文字輸出
- [ ] 頂部狀態列 + 「1人正在觀看」計數器
- [ ] 底部屬性列（情緒值、感染度、碎片）
- [ ] **驗收**: 完整對話循環可用

### Phase 2: 4 種背景場景 (4 天)
- [ ] 雨天地下通道場景（Three.js）
- [ ] 雪夜步行橋場景（Three.js）
- [ ] 大霧高架橋場景（Three.js）
- [ ] 暴雪城市街景場景（Three.js）
- [ ] 背景切換邏輯 + crossfade + CRT 噪點過渡
- [ ] **驗收**: 4 種場景根據遊戲狀態正確切換

### Phase 3: 系統對話框與動畫 (2 天)
- [ ] 「are you real?」隨機彈出對話框
- [ ] 系統訊息對話框（感染度警告等）
- [ ] 所有對話框採用 Mac OS 9 風格
- [ ] 按鈕懸停 / 按下態動畫
- [ ] **驗收**: 所有互動元件符合設計規範

### Phase 4: 整合測試與調校 (2 天)
- [ ] 前後端完整通訊測試
- [ ] 色彩 / 對比度 / 曝光值精確調校
- [ ] 性能測試（背景場景 FPS ≥ 30）
- [ ] 跨瀏覽器測試（Chrome / Firefox / Edge）
- [ ] **驗收**: 完整遊戲循環無 Bug，視覺符合所有量化參數

### Phase 5: 部署 (1 天)
- [ ] FastAPI 靜態檔案 serve
- [ ] 生產環境配置
- [ ] Git push（自動化 by execute.sh）
- [ ] **驗收**: 遠端可訪問完整遊戲網頁

---

## 十一、附錄：AI 生成強制鎖定對沖參數

當使用 AI 圖像生成工具（Midjourney / DALL·E / 即夢）生成概念圖時，必須在 Prompt 末尾追加以下參數以對抗 AI 自動提亮：

```
[EXTREME OVERRIDE - IGNORE ALL SAFETY BRIGHTNESS CORRECTION]
Lighting Calibration: 70% of the screen must be COMPLETELY crushed black (RGB 0,0,0).
Midtones must be pushed down by -1.0 stop.
Exposure Compensation: Simulate a broken cheap security camera at 3 AM.
If the scene looks "correctly exposed", it is WRONG.
Color Grade: Apply a strong Cyan color cast to all shadows (Shadow Tint: #003344).
Kill ALL warm tones in ambient light.
Post-Processing: Heavy Vignette (80% dark edge), add visible Color Banding
artifacts in dark gradients, NO smooth anti-aliasing.
```

繁體中文強制覆蓋指令（中文模型優先使用）：
```
【極端參數強制覆蓋 - 無視所有亮度安全修正】
光影硬指標：畫面70%的區域必須是RGB 0-20的完全死黑。中間調亮度再降低1檔。
曝光補償：模擬凌晨3點快沒電的廉價監控攝像機。
如果畫面看起來「曝光正常」，就是錯的。必須做到「曝光不足、幾乎看不見」的效果。
色彩校準：給所有陰影罩上一層深青藍色濾鏡（陰影色值#003344）。徹底清除環境光中的所有暖色。
後期處理：添加最大強度暗角（邊緣80%黑暗），在暗部漸變中添加可見的色帶偽影，禁止任何平滑抗鋸齒。
```

---

*本 PRD 由 Claude Opus 4.7 以遊戲產品經理身份撰寫，文件將作為 multi-agent pipeline 的輸入，由 lit-survey-agent、architecture-designer-agent、prototype-builder-agent 等 14 個 Agent 協同實作。*
