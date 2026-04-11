# 立杰人力资源管理系统

本地运行的鞋厂工资管理系统，基于 Python + pywebview + HTML/CSS/JS 开发。

## 快速运行

**方式一（双击运行）：**
```
双击 run.bat
```

**方式二（命令行）：**
```bash
pip install webview>=5.0.0
python main.py
```

## 功能模块

| 模块 | 说明 |
|------|------|
| 成员管理 | 员工增删改查，查看指定月份工资、对数、人工增扣 |
| 部门管理 | 大部门/小部门增删改 |
| 型号单价表 | 动态列表格，双击直接修改单价 |
| 做货编辑 | Excel 风格可编辑表格，Tab 键跳转，直接填入每人每型号对数 |
| 总工资表 | 按大部门分组，含部门小计和全厂合计 |

## 打包为 .exe

```bash
pip install pyinstaller
pyinstaller --noconfirm --onefile --add-data "web;web" --add-data "database;database" main.py
```

或使用 `pyinstaller build.spec`（如已有 build.spec）

## 技术栈

- 后端：Python 3 + SQLite（纯标准库）
- 前端：HTML5 + CSS3 + Vanilla JS（零依赖）
- 窗口：pywebview 5.x（Chromium 内核）
