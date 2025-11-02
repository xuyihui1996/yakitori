# 快速上手指南

## 🚀 5 分钟快速体验

### 1. 安装依赖（已完成）

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

看到类似输出：
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### 3. 打开浏览器

访问 `http://localhost:5173`

### 4. 开始体验

#### 场景 1: 创建新桌（Owner）

1. 选择"创建新桌"
2. 输入昵称，例如："小明"
3. 点击"创建并开始点单"
4. 🎉 成功！你现在是桌主，可以开始点单了

**你会看到**：
- 顶部显示桌号（例：G123456）和当前轮次（R1）
- "我的订单"区域（目前为空）
- "点单区"可以添加菜品

#### 场景 2: 添加第一道菜

**方式一：新建菜品**

1. 点击"新建菜品"按钮
2. 填写：
   - 菜名：`かしわ`
   - 价格：`198`
   - 数量：`2`
   - 备注：`鸡肉串`
3. 点击"添加菜品"
4. ✅ 菜品已添加到"我的订单"和"共享菜单"

**方式二：从菜单选择**

1. 在"共享菜单"区域搜索或浏览
2. 点击想要的菜品
3. 调整数量
4. 点击"确认"
5. ✅ 菜品已添加到订单

#### 场景 3: 体验多用户（模拟）

**打开新的隐私窗口**：

1. 复制桌号（例：G123456）
2. 打开浏览器的隐私模式/无痕模式
3. 访问 `http://localhost:5173`
4. 选择"加入桌"
5. 输入桌号和昵称（例："小红"）
6. 点击"加入并开始点单"
7. 🎉 你现在是第二个成员了

**现在你可以**：
- 看到"小明"添加的菜品在共享菜单中
- 点击快速添加到自己的订单
- 查看自己的账单

#### 场景 4: Owner 管理功能

**返回第一个窗口（小明的）**：

1. 点击右上角的 "⚙️" 图标
2. 进入管理员视图

**你会看到**：
- 📊 整桌总览
- 👥 成员消费排行
- 📋 轮次明细
- 🍜 全部菜品汇总
- 📤 导出按钮

**尝试**：
1. 点击"导出全部文本" → 已复制到剪贴板
2. 粘贴到笔记本查看格式
3. 点击"关闭当前轮次" → R1 已关闭
4. 点击"开启新轮次" → R2 已开启
5. 点击"确认结账" → 整桌结账完成

#### 场景 5: 查看个人账单

1. 点击右上角的 "🧾" 图标
2. 查看"我的账单"页面

**显示内容**：
- 💰 总消费金额（大字显示）
- 按轮次分组的详细订单
- 每道菜的数量和金额
- 可以导出个人账单

## 📱 移动端测试

### 方法 1: 手机访问局域网

1. 确保手机和电脑在同一 WiFi
2. 查看电脑 IP 地址：
   ```bash
   # Mac/Linux
   ifconfig | grep inet
   
   # Windows
   ipconfig
   ```
3. 在手机浏览器访问：`http://你的IP:5173`
4. 例如：`http://192.168.1.100:5173`

### 方法 2: 使用 Vite 的 host 选项

```bash
npm run dev -- --host
```

会显示：
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
```

直接用手机扫描或访问 Network 地址。

### 方法 3: 使用浏览器开发者工具

Chrome DevTools 的设备模拟：
1. 按 F12 打开开发者工具
2. 点击 "Toggle device toolbar" 图标（或按 Ctrl+Shift+M）
3. 选择设备：iPhone 12 Pro / Pixel 5 等
4. 刷新页面体验移动端

## 🎮 功能演示流程

### 完整流程（推荐用于演示）

**准备 3 个浏览器窗口**：
- 窗口 1: 小明（Owner）
- 窗口 2: 小红（成员）
- 窗口 3: 小李（成员）

#### 第一步：建组（窗口 1）
```
小明 → 创建新桌 → 桌号: G123456
```

#### 第二步：加入（窗口 2 & 3）
```
小红 → 加入 G123456
小李 → 加入 G123456
```

#### 第三步：第一轮点单
```
小明点：かしわ ×2, かわ ×1
小红点：かわ ×2
小李点：とり肉 ×2
```

#### 第四步：关闭第一轮（窗口 1）
```
小明 → 管理员视图 → 关闭当前轮次
→ 查看本轮汇总：
  かしわ ¥198 × 2
  かわ ¥165 × 3
  とり肉 ¥180 × 2
```

#### 第五步：第二轮点单（窗口 1）
```
小明 → 开启新轮次 → 继续点单
小明点：手羽先 ×1
小红点：かしわ ×1
```

#### 第六步：结账（窗口 1）
```
小明 → 确认结账
→ 所有窗口显示"已完成结账"
```

#### 第七步：查看账单
```
每个人点击 🧾 查看自己的账单
小明在管理员视图可以看到所有人的账单
```

## 🐛 常见问题

### Q1: 端口被占用

**错误**：`Port 5173 is already in use`

**解决**：
```bash
# 方法 1: 使用其他端口
npm run dev -- --port 3000

# 方法 2: 找到并关闭占用端口的进程
# Mac/Linux
lsof -ti:5173 | xargs kill -9

# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Q2: 依赖安装失败

**解决**：
```bash
# 清除缓存
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 如果还是失败，尝试使用 cnpm 或 yarn
npm install -g cnpm
cnpm install
```

### Q3: TypeScript 报错

**解决**：
```bash
# 重启 VSCode
# 或清除 TypeScript 缓存
rm -rf node_modules/.cache
```

### Q4: 页面空白

**检查**：
1. 浏览器控制台是否有错误
2. 是否正确访问了根路径 `/`
3. 是否有浏览器扩展干扰（尝试隐私模式）

## 🔧 开发技巧

### 1. 查看状态变化

打开 Redux DevTools 或在组件中添加：
```typescript
useEffect(() => {
  console.log('State changed:', useGroupStore.getState());
}, []);
```

### 2. Mock 不同用户

修改 `src/api/mockData.ts`：
```typescript
export function setMockUser(userId: string) {
  localStorage.setItem('ordered_user_id', userId);
  window.location.reload();
}
```

在控制台调用：
```javascript
window.setMockUser('U002'); // 切换到小红
```

### 3. 清除所有数据

```javascript
// 在浏览器控制台执行
localStorage.clear();
window.location.reload();
```

### 4. 查看所有 Mock 数据

```javascript
// 在浏览器控制台
import { mockGroup, mockMenu, mockRounds, mockRoundItems } from '@/api/mockData';
console.log({ mockGroup, mockMenu, mockRounds, mockRoundItems });
```

## 📚 下一步

1. 阅读 [README.md](./README.md) 了解完整功能
2. 阅读 [FEATURES.md](./FEATURES.md) 了解核心特性
3. 阅读 [DEPLOYMENT.md](./DEPLOYMENT.md) 学习如何部署
4. 查看代码注释了解实现细节
5. 开始定制你自己的需求！

## 🎉 享受开发！

有问题？查看项目的 Issues 或创建新 Issue。

Happy Coding! 🚀

