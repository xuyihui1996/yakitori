# Ordered - 多人点单应用 ([ordered-five.vercel.app](https://ordered-five.vercel.app))

一个面向顾客的、支持多人实时点单、多轮下单、按人汇总的 Web/PWA 应用。

## 🎯 核心功能

### A. 菜品级录入
- ✅ 建组（Owner 角色）
- ✅ 成员录入 item（名称+价格+数量+备注）
- ✅ 共享菜单 + 冲突处理（同名不同价提醒）
- ✅ 菜单停用功能
- ✅ 记录创建人

### B. 人员级分配 & 多轮点单
- ✅ 点单轮次（open/closed 状态）
- ✅ 成员点单（每人看自己的订单）
- ✅ 结束本轮（Owner 权限）
- ✅ 多轮管理
- ✅ 结账功能（锁定所有轮次）
- ✅ 管理员视图（按轮汇总、按人汇总、导出文本）
- ✅ 修改/撤销订单

### D. 使用环境
- ✅ 移动端优先布局
- ✅ 支持日文输入
- ✅ PWA 支持
- ✅ 数据保留 7 天

## 🏗️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **状态管理**: Zustand
- **样式**: TailwindCSS
- **路由**: React Router v6
- **图标**: Lucide React
- **PWA**: vite-plugin-pwa

## 📁 项目结构

```
Ordered/
├── src/
│   ├── api/                    # API层
│   │   ├── mockData.ts        # Mock数据
│   │   └── mockService.ts     # Mock服务（可替换为真实API）
│   ├── components/             # 核心组件
│   │   ├── ItemInput.tsx      # 菜品录入组件
│   │   ├── MenuPicker.tsx     # 菜单选择器
│   │   ├── RoundTabs.tsx      # 轮次标签页
│   │   └── OwnerSummary.tsx   # Owner汇总视图
│   ├── pages/                  # 页面
│   │   ├── JoinGroup.tsx      # 加入/创建组
│   │   ├── GroupHome.tsx      # 组主页（点单界面）
│   │   └── MyBill.tsx         # 我的账单
│   ├── store/                  # 状态管理
│   │   └── groupStore.ts      # 组状态Store
│   ├── types/                  # 类型定义
│   │   └── index.ts           # 数据模型
│   ├── utils/                  # 工具函数
│   │   ├── menu.ts            # 菜单去重逻辑
│   │   ├── money.ts           # 金额格式化
│   │   ├── export.ts          # 导出文本
│   │   └── format.ts          # 格式化工具
│   ├── App.tsx                # 应用主组件
│   ├── main.tsx               # 入口文件
│   └── index.css              # 全局样式
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173`

### 3. 构建生产版本

```bash
npm run build
```

### 4. 预览生产版本

```bash
npm run preview
```

## 📱 使用流程

### 创建新桌
1. 打开应用，选择"创建新桌"
2. 输入您的昵称
3. 系统自动生成桌号（例：G123456）
4. 自动开启第一轮

### 加入已有桌
1. 选择"加入桌"
2. 输入桌号和您的昵称
3. 加入成功后可以开始点单

### 点单
1. **从菜单选择**：点击已有菜品，选择数量后确认
2. **新建菜品**：点击"新建菜品"，填写名称、价格、数量、备注

### 管理员操作（Owner）
1. 点击右上角设置图标，进入管理员视图
2. 可以查看：
   - 整桌总览
   - 成员消费明细
   - 轮次明细
   - 全部菜品汇总
3. 管理轮次：
   - 关闭当前轮次
   - 开启新轮次
   - 确认结账

### 查看账单
- 点击右上角"账单"图标
- 查看自己所有轮次的订单和总金额
- 可以导出文本分享

## 🔑 核心逻辑说明

### 1. 菜单去重机制
- 使用 `(nameDisplay, price)` 作为唯一键
- 同名同价：直接使用现有菜品
- 同名不同价：弹窗提示用户确认，可选择：
  - 使用现有价格
  - 更新为新价格

实现位置：`src/utils/menu.ts` 中的 `upsertMenuItem` 函数

### 2. 多轮机制
- 每个组可以有多个轮次（R1, R2, R3...）
- 同时只能有一个 `open` 状态的轮次
- 只有 Owner 可以关闭当前轮和开启新轮
- 轮次关闭后会生成该轮的合并清单

实现位置：`src/store/groupStore.ts` 中的轮次相关方法

### 3. 角色权限
- **Owner（桌主）**：
  - 创建组的人
  - 可以开启/关闭轮次
  - 可以结账
  - 可以删除任何人的订单
  - 有管理员视图

- **普通成员**：
  - 可以加入组
  - 可以点单
  - 只能删除自己当前轮的订单
  - 可以查看自己的账单

### 4. 导出文本格式

```
━━━━━━━━━━━━━━━━
📋 点单汇总 - 桌号: G123456
━━━━━━━━━━━━━━━━

【第1轮】
かしわ (鸡肉串) ¥198 × 3
かわ (鸡皮串) ¥165 × 2
小计: ¥954

【第2轮】
手羽先 (鸡翅) ¥198 × 1
小计: ¥198

━━━━━━━━━━━━━━━━
【全部】
かしわ (鸡肉串) ¥198 × 3
かわ (鸡皮串) ¥165 × 2
手羽先 (鸡翅) ¥198 × 1

合计: ¥1,152
━━━━━━━━━━━━━━━━
```

实现位置：`src/utils/export.ts`

## 🔧 可替换的后端

当前使用内存存储的 Mock 服务，可以轻松替换为：

### Supabase
1. 创建表结构（按 `src/types/index.ts` 中的模型）
2. 替换 `src/api/mockService.ts` 中的函数
3. 使用 Supabase 客户端进行 CRUD 操作

### Firebase
1. 创建 Firestore 集合
2. 替换 API 层为 Firebase SDK 调用
3. 可以添加实时监听功能

### REST API
1. 实现后端 API（参考接口草稿）
2. 替换 `mockService.ts` 为 `fetch` 或 `axios` 调用

## 📦 部署

### GitHub Pages

```bash
# 1. 修改 vite.config.ts，添加 base
export default defineConfig({
  base: '/Ordered/',  // 你的仓库名
  // ...
})

# 2. 构建
npm run build

# 3. 部署到 gh-pages 分支
npm install -D gh-pages
npx gh-pages -d dist
```

### Vercel

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 部署
vercel
```

或直接在 Vercel 网站上导入 GitHub 仓库。

### PWA 注意事项
- PWA 需要 HTTPS 环境
- GitHub Pages 和 Vercel 都默认提供 HTTPS
- Service Worker 会在生产构建时自动生成

## 🛠️ 后续优化方向

### v1.1
- [ ] 历史菜单（跨桌复用）
- [ ] 拍照识别菜单（OCR）
- [ ] 某一轮某人请客功能
- [ ] 分享桌号二维码

### v1.2
- [ ] 用户头像
- [ ] 深色模式
- [ ] 多语言支持（英文/日文）
- [ ] 数据导出（CSV/Excel）

### v2.0
- [ ] 迁移到 Flutter/React Native
- [ ] 推送通知（轮次变更）
- [ ] 离线支持
- [ ] 云端备份

## 📄 许可证

MIT

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系

如有问题，请在 GitHub 上提交 Issue。

