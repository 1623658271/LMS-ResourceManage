"""FastAPI 后端 - 所有 HTTP API"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import os

from services.db import init_database
from services import crud

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")

app = FastAPI(title="立杰HR API")

# CORS：允许 pywebview 本地窗口请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 挂载静态文件（前端页面） ───────────────────────────
# 挂载 JS 目录
app.mount("/js", StaticFiles(directory=os.path.join(WEB_DIR, "js")), name="js")
# 挂载 CSS 目录
app.mount("/css", StaticFiles(directory=os.path.join(WEB_DIR, "css")), name="css")


# ── 挂载静态文件（前端页面） ───────────────────────────
@app.get("/")
async def root():
    return FileResponse(os.path.join(WEB_DIR, "index.html"))


# ── 部门管理 ────────────────────────────────────────────

@app.get("/api/departments")
async def api_get_departments():
    return crud.get_departments()


@app.post("/api/departments")
async def api_add_department(body: dict):
    return crud.add_department(body.get("name", ""))


@app.delete("/api/departments/{dept_id}")
async def api_delete_department(dept_id: int):
    return crud.delete_department(dept_id)


@app.get("/api/sub-departments")
async def api_get_sub_departments(dept_id: Optional[int] = Query(None)):
    return crud.get_sub_departments(dept_id)


@app.post("/api/sub-departments")
async def api_add_sub_department(body: dict):
    return crud.add_sub_department(body.get("dept_id"), body.get("name", ""))


@app.delete("/api/sub-departments/{sub_dept_id}")
async def api_delete_sub_department(sub_dept_id: int):
    return crud.delete_sub_department(sub_dept_id)


# ── 员工管理 ────────────────────────────────────────────

@app.get("/api/employees")
async def api_get_employees():
    return crud.get_employees()


@app.post("/api/employees")
async def api_add_employee(body: dict):
    return crud.add_employee(
        body.get("name", ""), body.get("gender", "男"),
        body.get("dept_id"), body.get("sub_dept_id")
    )


@app.put("/api/employees/{emp_id}")
async def api_update_employee(emp_id: int, body: dict):
    return crud.update_employee(
        emp_id,
        body.get("name", ""), body.get("gender", "男"),
        body.get("dept_id"), body.get("sub_dept_id")
    )


@app.delete("/api/employees/{emp_id}")
async def api_delete_employee(emp_id: int):
    return crud.delete_employee(emp_id)


@app.get("/api/employees/{emp_id}/detail")
async def api_employee_detail(emp_id: int, year: int = Query(...), month: int = Query(...)):
    return crud.get_employee_detail(emp_id, year, month)


@app.get("/api/employees/{emp_id}/work-history")
async def api_employee_work_history(emp_id: int, source: str = "work"):
    return crud.get_employee_work_history(emp_id, source)


# ── 订单管理 ────────────────────────────────────────────

@app.get("/api/orders")
async def api_get_orders(
    year: Optional[int] = Query(None), month: Optional[int] = Query(None)
):
    return crud.get_orders(year, month)


@app.post("/api/orders")
async def api_add_order(body: dict):
    return crud.add_order(
        body.get("order_no", ""),
        body.get("year"),
        body.get("month"),
        body.get("model_ids", []),
        body.get("remark", ""),
    )


@app.put("/api/orders/{order_id}")
async def api_update_order(order_id: int, body: dict):
    return crud.update_order(
        order_id,
        order_no=body.get("order_no"),
        model_ids=body.get("model_ids"),
        remark=body.get("remark"),
    )


@app.delete("/api/orders/{order_id}")
async def api_delete_order(order_id: int):
    return crud.delete_order(order_id)


# ── 工资计算明细 ───────────────────────────────────────

@app.get("/api/wage-detail")
async def api_wage_detail(year: int = Query(...), month: int = Query(...)):
    return crud.get_order_wage_detail(year, month)


# ── 型号管理 ────────────────────────────────────────────

@app.get("/api/models")
async def api_get_models():
    return crud.get_models()


@app.post("/api/models")
async def api_add_model(body: dict):
    return crud.add_model(body.get("model_no", ""))


@app.put("/api/models/{model_id}")
async def api_update_model(model_id: int, body: dict):
    return crud.update_model(model_id, body.get("model_no", ""))


@app.delete("/api/models/{model_id}")
async def api_delete_model(model_id: int):
    return crud.delete_model(model_id)


# ── 型号单价表 ──────────────────────────────────────────

@app.get("/api/price-table")
async def api_get_price_table():
    return crud.get_price_table()


@app.put("/api/price-table")
async def api_update_price(body: dict):
    return crud.update_price(body.get("model_id"), body.get("sub_dept_id"), body.get("unit_price"))


@app.post("/api/model-prices")
async def api_save_model_prices(body: dict):
    """批量保存某型号所有小部门的单价"""
    model_id = body.get("model_id")
    items = body.get("items", [])
    results = []
    for item in items:
        r = crud.update_price(model_id, item["sub_dept_id"], item["unit_price"])
        results.append(r)
    return {"ok": True, "saved": len(results)}


# ── 做货编辑 ────────────────────────────────────────────

@app.get("/api/work-records")
async def api_get_work_records(year: int = Query(...), month: int = Query(...)):
    return crud.get_work_records(year, month)


class WorkRecordBody(BaseModel):
    year: int
    month: int
    order_id: int
    model_id: int
    emp_id: int
    quantity: int
    line_id: int = 0   # 逻辑行号，同 (order_id,model_id) 可有多行


@app.post("/api/work-records")
async def api_save_work_record(body: WorkRecordBody):
    return crud.save_work_record(
        body.year, body.month, body.order_id,
        body.model_id, body.emp_id, body.quantity,
        body.line_id
    )


@app.delete("/api/work-records")
async def api_delete_work_record(
    year: int = Query(...), month: int = Query(...),
    order_id: int = Query(...), model_id: int = Query(...),
    emp_id: int = Query(...), line_id: int = Query(0)
):
    return crud.delete_work_record(year, month, order_id, model_id, emp_id, line_id)


@app.delete("/api/work-row")
async def api_delete_work_row(
    year: int = Query(...), month: int = Query(...),
    order_id: int = Query(...), model_id: int = Query(...), line_id: int = Query(0)
):
    """批量删除一整行（同一订单+型号+line_id的所有员工记录）"""
    return crud.delete_work_row(year, month, order_id, model_id, line_id)


# ── 人工增扣 ────────────────────────────────────────────

@app.post("/api/adjustments")
async def api_save_adjustment(body: dict):
    return crud.save_adjustment(
        body.get("emp_id"), body.get("year"), body.get("month"),
        body.get("adj_quantity", 0), body.get("adj_amount", 0), body.get("reason", "")
    )


# ── 总工资表 ────────────────────────────────────────────

@app.get("/api/salary-summary")
async def api_get_salary_summary(
    year: int = Query(...), month: int = Query(...),
    source: Optional[str] = Query(None)  # "work" 或 "qc"，默认 "work"
):
    if source == "qc":
        return crud.get_qc_salary_summary(year, month)
    return crud.get_salary_summary(year, month)


@app.get("/api/qc-salary-summary")
async def api_get_qc_salary_summary(year: int = Query(...), month: int = Query(...)):
    return crud.get_qc_salary_summary(year, month)


# ── 单价模板 ────────────────────────────────────────────

@app.get("/api/price-templates")
async def api_get_price_templates():
    return crud.get_price_templates()


class PriceTemplateBody(BaseModel):
    name: str
    items: List[dict]  # [{"model_id":1,"sub_dept_id":1,"unit_price":0.8}, ...]


@app.post("/api/price-templates")
async def api_save_price_template(body: PriceTemplateBody):
    return crud.save_price_template(body.name, body.items)


@app.get("/api/price-templates/{template_id}")
async def api_load_price_template(template_id: int):
    return crud.load_price_template(template_id)


@app.delete("/api/price-templates/{template_id}")
async def api_delete_price_template(template_id: int):
    return crud.delete_price_template(template_id)


# ── 快捷计算自动保存 ─────────────────────────────────────

@app.post("/api/quick-calc-save")
async def api_save_quick_calc(payload: dict):
    return crud.save_quick_calc(
        year=payload["year"],
        month=payload["month"],
        dept_rows=payload.get("dept_rows", {}),
        qty_data=payload.get("qty_data", {}),
    )


@app.get("/api/quick-calc-save")
async def api_load_quick_calc(year: int, month: int):
    return crud.load_quick_calc(year, month)


# ── 初始化 ────────────────────────────────────────────

@app.get("/api/init")
async def api_init():
    init_database()
    return {"ok": True}


@app.get("/api/app-settings/{key}")
async def api_get_app_setting(key: str):
    return crud.get_app_setting(key)


@app.post("/api/app-settings")
async def api_set_app_setting(body: dict):
    return crud.set_app_setting(body.get("key", ""), body.get("value", ""))
