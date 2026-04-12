# 立杰人力资源管理系统 v2.2

本地运行的鞋厂工资管理系统，基于 Python + FastAPI + pywebview + HTML/CSS/JS 开发。

![系统截图](docs/images/screenshot-overview.png)

## 快速运行

**方式一（双击运行）：**
```
双击 run.bat
```

**方式二（命令行）：**
```bash
pip install -r requirements.txt
python main.py
```

## 功能模块

### 1. 资源总览

系统首页，提供快速导航入口，支持快捷计算数据源切换。

![资源总览](docs/images/screenshot-overview.png)

**功能特点：**
- 快速跳转到各功能模块
- 右上角开关控制工资数据源（做货编辑/快捷计算）
- 实时显示系统状态

---

### 2. 成员管理

员工增删改查，批量添加，查看历史工资记录。

![成员管理](docs/images/screenshot-members.png)

**功能特点：**
- 紧凑卡片布局显示员工信息
- 支持批量添加成员
- 按月份筛选查看工资
- 点击详情查看历史记录

---

### 3. 成员详情

员工入职以来所有月份的做货记录和工资明细。

![成员详情](docs/images/screenshot-member-detail.png)

**功能特点：**
- 顶部汇总卡片显示累计数据
- 每月一个折叠块
- 显示订单/型号/对数/单价/工资明细
- 人工增扣行高亮显示

---

### 4. 部门管理

大部门/小部门增删改。

![部门管理](docs/images/screenshot-depts.png)

**功能特点：**
- 左右分栏布局
- 大部门列表（面部、底部）
- 小部门列表（衣车、折面、折边等）
- 级联删除提醒

---

### 5. 订单管理

订单CRUD，支持关联多个型号。

![订单管理](docs/images/screenshot-orders.png)

**功能特点：**
- 订单列表显示年份月份
- 支持备注信息
- 关联型号多选
- 显示订单总对数

---

### 6. 型号单价表

动态列表格，双击直接修改单价。

![型号单价表](docs/images/screenshot-prices.png)

**功能特点：**
- 矩阵式表格显示
- 行：型号（A2026、B2026等）
- 列：小部门（衣车、折面、折边、底部）
- 双击单元格直接编辑单价

---

### 7. 做货编辑

Excel风格可编辑表格，Tab键跳转，自动保存，撤销/重做。

![做货编辑](docs/images/screenshot-work-edit.png)

**功能特点：**
- Excel风格表格，支持Tab键在员工格子间跳转
- 自动保存（300ms防抖），无需手动点击保存
- 撤销/重做功能，支持行操作和单元格编辑
- 工资视角切换，实时查看每个格子的工资
- 清空对数按钮，一键清空当前所有对数
- 浅蓝色高亮非零值单元格

---

### 8. 快捷计算

实时工资计算，按大部门分组多表格，支持撤销/重做。

![快捷计算](docs/images/screenshot-quick-calc.png)

**功能特点：**
- 按大部门分组多表格，每个大部门独立显示
- 纯手工输入单价和对数，无需选择型号
- 实时计算工资，支持工资视角切换
- 撤销/重做功能
- 全厂合计汇总

---

### 9. 总工资表

按大部门分组，含部门小计和全厂合计，支持数据源切换。

![总工资表](docs/images/screenshot-salary.png)

**功能特点：**
- 按大部门分组显示
- 每行显示：姓名、小部门、对数、工资、增扣、合计
- 部门小计和全厂合计
- 支持从做货编辑或快捷计算读取数据

---

### 10. 系统设置

外观、字体、表格、颜色主题、布局、数据导入导出。

![系统设置-外观](docs/images/screenshot-settings-appearance.png)

![系统设置-字体](docs/images/screenshot-settings-fonts.png)

![系统设置-表格](docs/images/screenshot-settings-table.png)

![系统设置-颜色](docs/images/screenshot-settings-colors.png)

**功能特点：**
- **外观**：深色/浅色模式切换，圆角/阴影风格
- **字体**：字体大小（基础/标题/大标题）、字体族选择
- **表格**：行高、斑马纹、紧凑模式、分组数量
- **颜色主题**：5种预设（蓝/绿/紫/橙/红）+ 自定义颜色
- **布局**：侧边栏宽度、内容边距、卡片间距
- **数据**：设置导入/导出/重置

---

## 核心特性

### 数据源切换

资源总览页右上角开关控制工资数据源：
- **关闭**（默认）：总工资表和成员详情使用做货编辑数据
- **开启**：总工资表和成员详情使用快捷计算数据

两种数据源独立计算，互不影响。

### 表格自适应

- 员工超过 8 人时自动拆分为多个独立表格纵向排列
- 大额工资使用紧凑格式（<1万显示 ¥1234.56，≥1万显示 ¥1.2万）
- 鼠标悬停显示完整数值

### 撤销/重做

- 做货编辑和快捷计算均支持撤销/重做
- 支持行操作（添加/删除）和单元格编辑的撤销
- 历史栈自动管理，支持连续撤销多步

---

## 技术栈

- **后端**：Python 3 + FastAPI + SQLite
- **前端**：HTML5 + CSS3 + Vanilla JS（零依赖）
- **窗口**：pywebview 5.x（Chromium内核）
- **架构**：FastAPI提供HTTP API + 静态文件服务

---

## 项目结构

```
LMS/
├── main.py              # 程序入口，启动FastAPI和pywebview窗口
├── api_server.py        # FastAPI应用，定义所有HTTP接口
├── api.py               # pywebview桥接层（旧版，保留兼容）
├── requirements.txt     # Python依赖
├── run.bat / run.vbs    # Windows启动脚本
├── data.db              # SQLite数据库文件
├── docs/
│   └── images/          # 截图目录
├── database/
│   ├── db_manager.py    # 数据库连接管理
│   ├── schema.sql       # 数据库表结构
│   └── init_data.sql    # 初始数据
├── services/
│   ├── db.py            # 数据库初始化
│   └── crud.py          # 所有CRUD操作
├── web/
│   ├── index.html       # 主页面
│   ├── css/
│   │   └── style.css    # 样式文件
│   └── js/              # JavaScript模块
│       ├── state.js     # 全局状态管理（撤销/重做）
│       ├── utils.js     # 工具函数
│       ├── api.js       # API调用封装
│       ├── nav.js       # 导航和路由
│       ├── member.js    # 成员管理
│       ├── dept.js      # 部门管理
│       ├── order.js     # 订单管理
│       ├── price.js     # 型号单价表
│       ├── work-edit.js # 做货编辑
│       ├── salary-summary.js  # 总工资表
│       ├── quick-calc.js      # 快捷计算
│       ├── settings.js        # 系统设置
│       └── init.js            # 初始化
└── seed_data.py         # 种子数据生成
```

---

## 打包为 .exe

```bash
pip install pyinstaller
pyinstaller --noconfirm --onefile --add-data "web;web" --add-data "database;database" main.py
```

或使用 `pyinstaller build.spec`（如已有 build.spec）

---

## 版本历史

### v2.2 (2026-04-12)
- 新增加载页面，解决启动白屏问题
- 做货编辑页添加清空对数按钮
- 优化表格样式，统一按钮风格
- 修复工具栏置顶问题
- 更新README和API文档

### v2.1 (2026-04-11)
- 成员姓名颜色改为黑色
- 批量添加成员改为大表格弹窗
- 做货编辑支持直接添加行
- 修复颜色影响其他页面问题
- 修复设置持久化问题

### v2.0 (2026-04-10)
- 新增订单管理模块
- 新增成员详情页
- 新增系统设置页面
- 支持深色模式和主题定制
- 表格支持自适应分组显示
- 大额工资使用紧凑格式显示

---

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `departments` | 大部门（面部、底部） |
| `sub_departments` | 小部门（衣车、折面、折边、底部） |
| `models` | 型号（A2026、B2026等） |
| `model_prices` | 型号-小部门单价 |
| `employees` | 员工信息 |
| `orders` | 订单 |
| `order_models` | 订单-型号关联 |
| `work_records` | 做货记录（对数） |
| `salary_adjustments` | 人工增扣 |
| `quick_calc_saves` | 快捷计算保存 |
| `app_settings` | 全局设置键值 |

---

## 开发说明

### 启动开发服务器
```bash
python api_server.py
```
然后访问 http://localhost:8765

### 生成种子数据
```bash
python seed_data.py
```

---

## 截图清单

请将截图保存到 `docs/images/` 目录，文件名如下：

| 文件名 | 说明 |
|--------|------|
| `screenshot-overview.png` | 资源总览页面 |
| `screenshot-members.png` | 成员管理页面 |
| `screenshot-member-detail.png` | 成员详情页面 |
| `screenshot-depts.png` | 部门管理页面 |
| `screenshot-orders.png` | 订单管理页面 |
| `screenshot-prices.png` | 型号单价表页面 |
| `screenshot-work-edit.png` | 做货编辑页面 |
| `screenshot-quick-calc.png` | 快捷计算页面 |
| `screenshot-salary.png` | 总工资表页面 |
| `screenshot-settings-appearance.png` | 系统设置-外观 |
| `screenshot-settings-fonts.png` | 系统设置-字体 |
| `screenshot-settings-table.png` | 系统设置-表格 |
| `screenshot-settings-colors.png` | 系统设置-颜色主题 |

---

## License

[MIT License](LICENSE)
