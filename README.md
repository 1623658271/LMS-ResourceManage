# 立杰人力资源管理系统

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://www.microsoft.com/windows)

一款基于 **Python + pywebview** 的本地人力资源管理系统，支持员工管理、做货记录与工资计算，数据存储于本地 SQLite，无需网络连接。

---

## 界面预览

### 资源总览

系统导航首页，快速访问各功能模块，并可切换总工资表的数据来源。

![资源总览](docs/images/screenshot-overview.png)

### 成员管理 & 成员详情

紧凑卡片展示员工信息，支持批量添加；点击「详情」查看员工历史做货记录与累计收入。

![成员管理](docs/images/screenshot-members.png)

![成员详情](docs/images/screenshot-member-detail.png)

### 做货编辑

Excel 风格录入做货对数，支持 Tab 跳转、自动保存，可切换工资视角查看每格收益。

![做货编辑](docs/images/screenshot-work-edit.png)

### 快捷计算

按大部门分组的独立表格，单价与对数均可手工输入，实时计算各员工工资。

![快捷计算](docs/images/screenshot-quick-calc.png)

### 总工资表

按部门汇总全厂工资，支持在做货编辑与快捷计算两种数据源之间切换。

![总工资表](docs/images/screenshot-salary.png)

### 订单管理 & 型号单价

管理订单与关联型号，并配置各型号在不同小部门的单价。

![订单管理](docs/images/screenshot-orders.png)

![型号单价表](docs/images/screenshot-prices.png)

### 系统设置

支持外观、字体、颜色主题、布局等个性化配置，以及数据库导入导出。

![外观设置](docs/images/screenshot-settings-appearance.png)

![字体设置](docs/images/screenshot-settings-fonts.png)

![颜色主题](docs/images/screenshot-settings-colors.png)

![表格设置](docs/images/screenshot-settings-table.png)

---

## 功能特性

- **资源总览** — 系统导航首页，快速访问各功能模块
- **成员管理** — 员工档案管理，支持批量导入
- **成员详情** — 查看员工历史工资记录和做货明细
- **部门管理** — 大部门/小部门两级结构管理
- **订单管理** — 订单与型号关联管理
- **型号单价表** — 设置各型号在不同小部门的单价
- **做货编辑** — Excel 风格录入做货对数，Tab 跳转，自动保存
- **快捷计算** — 实时工资计算，支持大部门分组表格
- **总工资表** — 按部门汇总全厂工资，支持数据源切换
- **系统设置** — 外观、字体、颜色主题等个性化配置，支持数据库导入导出

---

## 快速开始

### 环境要求

- Windows 7 / 10 / 11
- Python 3.8+

### 启动

```bash
# 推荐：双击启动（无命令行窗口）
run.vbs

# 或命令行启动
python main.py
```

首次运行会自动创建虚拟环境（`venv/`）并安装依赖，如移动了项目文件夹，venv 会自动重建。

### 打包为独立可执行文件

如需在无 Python 环境的机器上运行，可使用 PyInstaller 打包：

```bash
# 图形界面打包（推荐）
build.bat

# 命令行打包
python build.py          # 无控制台窗口
python build.py --debug  # 带控制台窗口（调试用）
```

打包产物位于 `dist/` 目录，将整个文件夹复制到目标机器即可运行。

---

## 项目结构

```
LMS/
├── main.py              # 程序入口（启动 FastAPI + pywebview）
├── api_server.py        # FastAPI 后端服务
├── api.py               # pywebview JS 桥接层
├── services/
│   ├── db.py            # 数据库连接管理
│   └── crud.py          # 数据库 CRUD 操作
├── database/
│   ├── db_manager.py    # 数据库初始化与迁移
│   └── schema.sql       # 数据库表结构定义
├── web/                 # 前端文件
│   ├── index.html       # 主页面
│   ├── css/style.css    # 样式
│   └── js/              # JavaScript 模块（13 个）
├── data.db              # SQLite 数据库（自动创建）
├── requirements.txt     # Python 依赖
├── run.bat / run.vbs    # Windows 启动脚本
├── build.bat / build.py # PyInstaller 打包脚本
└── seed_data.py         # 测试数据生成
```

---

## 开发

```bash
# 安装依赖
pip install -r requirements.txt

# 启动应用
python main.py

# 生成测试数据
python seed_data.py
```

---

## 许可证

[MIT](LICENSE) © 2026 立杰人力资源管理系统
