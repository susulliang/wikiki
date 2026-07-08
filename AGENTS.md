# Wikiki - 需求拆解文档

## 产品概述

- **产品类型**: 个人 Wiki / 产品知识库应用
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 需要整理和管理产品知识、个人笔记、文档的用户
- **核心价值**: 一个轻量级、本地化的个人 Wiki 工具，支持富文本编辑、多页面管理、标签分类和全文搜索
- **界面语言**: 中文
- **主题偏好**: user_specified（用户明确要求暗色/亮色主题切换）
- **导航模式**: 路径导航
- **导航布局**: Sidebar（中后台/工具类应用，左侧边栏导航）

---

## 页面结构总览

> **说明**：本应用为单页应用（SPA），虽然用户提到"single-page React application"，但实际包含多个视图状态。所有视图在同一个页面内通过状态切换实现，无需路由。

**页面文件**: `App.tsx`（单页应用主文件）

| 视图/区域 | 说明 | 视图类型 |
|-----------|------|---------|
| 侧边栏 (Sidebar) | 应用导航、搜索、标签筛选、产品列表 | 固定区域 |
| 主内容区 - 空状态 | 未选择产品时的引导状态 | 条件视图 |
| 主内容区 - 搜索结果 | 全局搜索时的结果展示 | 条件视图 |
| 主内容区 - 产品详情 | 选中产品后的编辑/浏览视图 | 条件视图 |

> **说明**：由于是单页应用，所有"视图"通过状态变量（如 `selectedProductId`、`searchQuery`）控制显示，不使用路由。

---

## 页面布局建议

- **布局模式**: 左右分栏（主从布局）—— 左侧固定侧边栏（可折叠），右侧为主内容区。侧边栏承载导航/筛选/列表，主内容区承载编辑/阅读/搜索结果。
- **视觉重心**: 内容（富文本编辑器）—— 这是知识库应用的核心，用户大部分时间在编辑和阅读内容。
- **结果承载区**: 
  - **搜索结果**: 在主内容区以卡片列表形式展示，每条结果含标题、标签高亮、上下文片段
  - **产品详情**: 产品名称/标签头部 + 页面标签栏 + 富文本编辑器主体
  - **空状态**: 居中引导文案 + 创建第一个产品的按钮
- **源材料承载区**: 不适用（本应用无上传文件解析需求，图片插入为编辑器内功能）

---

## 插件规划

> 本应用为纯前端本地存储应用，不涉及 AI/飞书插件能力，无需插件规划。

---

## 导航配置

> **说明**：本应用为单页应用，无传统路由导航。侧边栏内的产品列表和标签筛选为应用内状态切换，非页面路由跳转。

- **导航布局**: Sidebar（可折叠左侧边栏）
- **侧边栏内容**（非路由导航，为应用内功能入口）:
  | 元素 | 功能 |
  |------|------|
  | Logo + "Wikiki" | 品牌标识 |
  | 主题切换按钮 | 暗色/亮色模式切换 |
  | 导入/导出按钮 | JSON 文件导入导出 |
  | 添加产品按钮 | 创建新产品 |
  | 搜索栏 | 实时筛选产品列表 |
  | 标签区域 | 展示所有标签，点击筛选 |
  | 产品列表 | 所有产品列表，点击选中 |

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 产品数据（创建/编辑/删除） | local-persist | localStorage key=`__wikiki_products`，JSON 序列化存储，自动保存 | 初始空数组 `[]`，首次使用显示空状态引导 |
| 页面内容（富文本编辑） | local-persist | 嵌套在产品数据内，随产品数据一起存储 | 无（新页面默认为空内容） |
| 标签数据 | local-persist | 嵌套在产品数据内，从产品标签聚合展示 | 无 |
| 主题偏好 | local-persist | localStorage key=`__wikiki_theme`，值为 `'dark'` 或 `'light'` | 默认 `'light'` |
| 侧边栏折叠状态 | local-persist | localStorage key=`__wikiki_sidebar_collapsed`，值为 `boolean` | 默认 `false`（展开） |
| 数据导出 | import-export | `Blob` + `URL.createObjectURL` + `<a>` 点击下载 JSON 文件 | 无 |
| 数据导入 | import-export | `<input type="file">` + `FileReader` 读取 JSON，合并策略（同名产品更新，新名称新增） | 无 |
| 图片上传（编辑器内） | real-file | `<input type="file" accept="image/*">` + `FileReader` 转 base64 存储，限制 2MB/1200px | 无 |
| 剪贴板图片粘贴 | real-file | `paste` 事件监听，提取剪贴板图片 Blob，转 base64 存储 | 无 |
| 搜索功能 | demo-mock | 前端内存搜索（遍历产品名、页面内容、标签），关键词高亮用 `<mark>` 标签 | 初始无数据时搜索返回空 |

> **说明**：搜索功能的数据来源为 `local-persist` 的产品数据，搜索逻辑本身为前端内存操作，标注为 `demo-mock` 表示搜索算法为纯前端实现，不依赖外部服务。

---

## 功能列表

### 侧边栏 (Sidebar)

- **页面目标**: 提供应用导航、产品管理入口、搜索和筛选功能
- **功能点**:
  - **侧边栏折叠/展开**: 点击折叠按钮切换侧边栏显示状态，折叠时仅显示图标，状态持久化到 localStorage
  - **主题切换**: 点击主题切换按钮在暗色/亮色模式间切换，使用 CSS 变量 + Tailwind dark mode 实现平滑过渡，偏好持久化
  - **数据导入**: 点击导入按钮触发文件选择器，读取 JSON 文件，按名称匹配合并（同名更新、新名称新增），导入后刷新产品列表
  - **数据导出**: 点击导出按钮将所有产品数据序列化为 JSON 文件并触发浏览器下载
  - **创建产品**: 点击"添加产品"按钮弹出 Dialog，输入产品名称和标签（标签支持多选输入），提交后创建新产品并选中
  - **实时搜索**: 在搜索栏输入关键词，实时过滤侧边栏产品列表（按产品名和标签匹配），匹配关键词高亮显示
  - **标签筛选**: 点击标签区域中的标签，筛选出包含该标签的产品列表；再次点击取消筛选；支持多标签组合筛选
  - **产品列表**: 展示所有产品（或筛选后的产品），每项显示产品名称和标签色块；点击选中产品，高亮当前选中项

### 主内容区 - 空状态

- **页面目标**: 引导用户创建第一个产品或选择已有产品
- **功能点**:
  - **空状态展示**: 当无产品选中时，居中显示引导图标、文案"选择一个产品开始编辑"和"创建第一个产品"按钮
  - **快捷创建**: 点击空状态中的创建按钮，弹出创建产品 Dialog（同侧边栏创建功能）

### 主内容区 - 搜索结果

- **页面目标**: 展示全局搜索结果，帮助用户快速定位内容
- **功能点**:
  - **搜索结果列表**: 以卡片列表展示搜索结果，每条结果包含产品名称、匹配页面名称、匹配内容片段（含关键词高亮）
  - **关键词高亮**: 搜索结果中的匹配关键词使用 `<mark>` 标签高亮显示
  - **结果跳转**: 点击搜索结果卡片，跳转到对应产品的对应页面，定位到匹配内容位置
  - **搜索范围**: 全文搜索覆盖产品名称、所有页面内容、标签

### 主内容区 - 产品详情

- **页面目标**: 查看和编辑产品的 Wiki 页面内容
- **功能点**:
  - **产品信息头部**: 顶部显示产品名称（大标题）和标签色块列表；提供"编辑产品信息"按钮和"删除产品"按钮
  - **编辑产品信息**: 点击"编辑产品信息"按钮弹出 Dialog，可修改产品名称和标签，提交后更新
  - **删除产品**: 点击"删除产品"按钮弹出确认 Dialog，确认后删除产品及其所有页面数据，清除选中状态
  - **页面标签栏**: 横向标签栏展示产品的所有 Wiki 子页面，支持点击切换页面；标签栏包含"添加页面"按钮和每个页面的"删除页面"按钮（至少保留一个页面）
  - **添加页面**: 点击"添加页面"按钮弹出 Dialog，输入页面名称，创建新页面并自动切换
  - **删除页面**: 点击页面标签上的删除按钮，弹出确认 Dialog，确认后删除该页面（若为最后一个页面则禁止删除）
  - **页面重排序**: 支持拖拽页面标签调整页面顺序（拖拽排序）
  - **富文本编辑器**: 当前选中页面的富文本编辑器，支持以下格式化功能：
    - **文本格式**: 加粗 (Ctrl+B)、斜体 (Ctrl+I)、下划线 (Ctrl+U)、删除线
    - **标题**: H1、H2、H3 下拉选择
    - **列表**: 无序列表、有序列表
    - **代码**: 行内代码、代码块
    - **链接**: 插入超链接（弹出输入框输入 URL 和文本）
    - **图片**: 插入图片（支持 URL 输入或本地上传，自动限制 2MB/1200px）
    - **引用块**: 块引用
    - **分隔线**: 水平分隔线
    - **剪贴板粘贴**: 支持从剪贴板粘贴图片
  - **自动保存**: 编辑器内容变更时自动保存到 localStorage（防抖处理，如 500ms 延迟）

---

## 数据共享配置

| 存储键名 | 数据说明 | 使用位置 |
|---------|---------|---------|
| `__wikiki_products` | 所有产品数据，类型为 `IProduct[]` | 侧边栏、产品详情、搜索、导入导出 |
| `__wikiki_theme` | 主题偏好，类型为 `'light' \| 'dark'` | 侧边栏主题切换、全局主题应用 |
| `__wikiki_sidebar_collapsed` | 侧边栏折叠状态，类型为 `boolean` | 侧边栏折叠控制 |
| `__wikiki_selected_product_id` | 当前选中产品 ID，类型为 `string \| null` | 主内容区视图切换 |
| `__wikiki_selected_page_index` | 当前选中页面索引，类型为 `number` | 产品详情页面标签切换 |

```ts
interface IProduct {
  /** 产品唯一标识 */
  id: string;
  /** 产品名称 */
  name: string;
  /** 产品标签 */
  tags: string[];
  /** Wiki 子页面列表 */
  pages: IPage[];
  /** 创建时间 */
  createdAt: string;
  /** 最后修改时间 */
  updatedAt: string;
}

interface IPage {
  /** 页面唯一标识 */
  id: string;
  /** 页面名称 */
  name: string;
  /** 富文本内容（HTML 格式） */
  content: string;
  /** 页面排序序号 */
  order: number;
  /** 创建时间 */
  createdAt: string;
  /** 最后修改时间 */
  updatedAt: string;
}
```

---

## 数据迁移策略

- **版本标识**: 在 `localStorage` 中存储 `__wikiki_data_version`，当前版本为 `1`
- **迁移逻辑**: 应用启动时检查版本号，若为旧格式则执行迁移函数转换为新格式
- **存储配额处理**: 当 `localStorage` 写入失败（QuotaExceededError）时，遍历所有产品页面内容，将 base64 图片替换为占位符 `[图片已移除]`，然后重试保存

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Free Direction —— 无参考材料，按产品语义与内容场景自主建立视觉系统
- **核心情绪 / 应用类型**: 个人知识库 / 产品 Wiki —— 安静、专注、文档般的阅读与编辑体验
- **独特记忆点**: 纸质笔记本的温暖克制感——米白纸张底色、墨色文字、极细灰线分隔，让知识沉淀有仪式感

## 2. Art Direction

- **方向名**: Warm Editorial Minimal
- **Design Style**: Swiss Minimalist + Warm Natural —— 瑞士极简的网格秩序与克制留白，叠加自然暖调的纸张温度，适合知识沉淀与长文编辑场景
- **DNA 参数**: 圆角 subtle（`rounded-md`）/ 阴影 subtle（`shadow-sm` 仅用于卡片浮层）/ 间距 spacious（`gap-6 p-6`）/ 字体方向 serif display + sans-serif body / 装饰手法 极细边框分隔 + 低饱和 accent 色块
- **应用类型**: Content —— 侧边栏导航 + 主内容区阅读/编辑，信息密度中等，优先可读性

## 3. Color System

**色彩关系**: 暖灰基底 + 鼠尾草绿主色 + 暖白纸张卡片面，整体低饱和、低对比、柔和安静
**配色设计理由**: primary 选择低饱和鼠尾草绿（sage green），克制不刺眼，承担主按钮、激活态和品牌锚点；bg 用暖白模拟纸张感；card 略亮于 bg 形成微弱层次；text 用深墨灰保证长文可读；accent 用极浅暖灰承接 hover 和选中态
**主色推导**: 知识库场景需要安静、可信、不抢夺注意力的主色；鼠尾草绿天然带有自然、成长、沉淀的语义，低饱和处理避免工具感过强
**使用比例**: 60% 中性（暖白 bg + 浅灰 card + 深墨 text）/ 30% 辅助（极浅暖灰 accent + 细灰 border）/ 10% primary（主按钮、激活 tab、选中高亮、链接）

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(40 20% 97%) | 暖白纸张底色，模拟笔记本内页 |
| card | `--card` | `bg-card` | hsl(40 15% 99%) | 略亮于 bg 的卡片面，微弱层次 |
| text | `--foreground` | `text-foreground` | hsl(30 8% 15%) | 深墨灰，长文阅读舒适 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(30 5% 45%) | 辅助说明、占位符、时间戳 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(85 12% 48%) | 鼠尾草绿，主按钮、激活态、链接 |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(40 20% 97%) | primary 上的白色文字 |
| accent | `--accent` | `bg-accent` | hsl(35 12% 93%) | 极浅暖灰，hover/focus 底、选中浅底 |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(30 8% 25%) | accent 上的深灰文字 |
| border | `--border` | `border-border` | hsl(35 8% 85%) | 极细暖灰线，卡片和输入框边界 |

**语义色提示**:
- 成功: bg `hsl(85 12% 93%)` / border `hsl(85 12% 70%)` / text `hsl(85 15% 30%)`，与 primary 同色温、低饱和
- 警告: bg `hsl(40 30% 93%)` / border `hsl(40 30% 70%)` / text `hsl(40 25% 30%)`，暖黄调，饱和度与 primary 对齐
- 错误/删除: bg `hsl(5 20% 94%)` / border `hsl(5 20% 75%)` / text `hsl(5 25% 35%)`，微暖红，低饱和不刺眼
- 标签色: hash-based 自动生成，限制在 hsl(H 15% 70%) 饱和度区间，与整体低饱和一致

## 4. 字体与节奏

- **font-display**: Noto Serif SC —— 衬线体为标题和产品名带来文档感与仪式感
- **font-body**: Inter / Noto Sans SC —— 无衬线体保证正文、编辑器、侧边栏的可读性
- **字号**: H1 text-3xl（产品名）/ H2 text-xl（页面标题）/ H3 text-lg（编辑器内标题）/ body text-base / muted text-sm
- **圆角**: subtle（`rounded-md`）—— 卡片和按钮有微弱圆角，保持柔和但不幼稚

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导 —— 左侧可折叠边栏 + 右侧主内容区，经典文档工具布局
- **Page / Section Order**: 侧边栏固定（Logo → 主题切换 → 导入导出 → 新建产品 → 搜索 → 标签区 → 产品列表）→ 主内容区动态切换（空态 / 搜索结果 / 产品详情含页面标签栏 + 富文本编辑器）
- **Standard Content Zone**: 主内容区 `max-w-4xl mx-auto`，编辑器内文区域 `max-w-3xl`，保证阅读行长舒适
- **Shell / Frame Alignment**: 侧边栏独立滚动，主内容区独立滚动，两者同高但不共享滚动容器
- **Padding & Rhythm**: 侧边栏 `p-4`，主内容区 `px-6 md:px-10 lg:px-16 py-8`，保持 8px 倍数节奏
- **Full-bleed Zones**: 无全宽区域；编辑器工具栏可撑满内容区宽度，但文本编辑区收窄
- **Local Narrowing**: 搜索结果显示页、产品详情正文在 `max-w-4xl` 内进一步收窄至 `max-w-3xl`
- **Overflow Strategy**: 编辑器内宽表格或代码块使用 `overflow-x-auto`；标签列表横向溢出时使用 `flex-wrap`
- **Flexibility Boundary**: 允许移动端侧边栏变为抽屉式、卡片内边距缩小；全局 max-w、圆角系统、主色、阴影语言保持一致

## 6. 视觉与动效

- **装饰**: 极细分隔线 + 低饱和 accent 色块（标签、选中态）
- **阴影/边界**: 轻 —— 卡片 `shadow-sm`，侧边栏与主内容区间 `border-r` 细线分隔
- **动效**: 克制 —— hover 时 accent 色块 150ms 淡入，主题切换 300ms 背景色过渡，侧边栏折叠 200ms ease-out，编辑器工具栏按钮 hover 微亮

## 7. 组件原则

- 按钮、表单、菜单、卡片必须有 Default / Hover / Active / Focus / Disabled 状态
- Primary 承担新建产品、保存编辑、确认删除等主行动；Secondary/Outline 用于取消、导入导出等次要操作；Ghost 用于侧边栏产品项 hover 和工具栏图标按钮
- 标签使用 hash-based 背景色（低饱和）+ 深色文字，点击过滤时加 `ring-1 ring-primary`
- 搜索高亮使用 `<mark>` 标签，背景色为 primary 的 20% 透明度版本
- 加载与空状态：空态用 textMuted + 细线图标 + 引导文案，不回到默认 shadcn 蓝

## 8. Image Direction

- **Image Role**: 无强制图片需求，优先通过排版、色彩和局部图形建立视觉记忆点
- **Image Art Direction**: 用户可在编辑器内插入图片，图片风格由用户内容决定；系统不做全局图片装饰
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 避免在空态或侧边栏使用通用插画图、无意义抽象渐变图；空态用文字排版表达

## 9. Anti-patterns

- **Split personality**: 空态、搜索结果、产品详情三视图切换时保持同一 max-w、同一圆角、同一阴影语言
- **Phantom tokens**: 不编造 shadcn/ui 不存在的 CSS 变量；所有颜色使用已定义的 9 角色 token
- **Default SaaS drift**: 不回到默认蓝按钮、紫色渐变卡片；鼠尾草绿 + 暖白纸张感贯穿全站
- **Invisible interaction**: 侧边栏产品项、工具栏按钮、标签必须有 focus-visible 环（`ring-1 ring-primary`）
- **Mono-hue tyranny**: primary 只用于主按钮、激活 tab、链接、搜索高亮；hover 态用 accent，边框用 border，标签用 hash 色
- **Status color drift**: 成功/警告/错误色饱和度与 primary（12-15%）对齐，不出现高饱和红绿破坏安静氛围
- **Over-decorated empty states**: 空态不过度装饰，用 textMuted + 引导文案 + 一个 lucide 图标，保持安静