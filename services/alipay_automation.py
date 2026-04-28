"""Alipay bank transfer form autofill helpers."""
import json
import threading
import time
import webbrowser

TRANSFER_URL = "https://shenghuo.alipay.com/transfercore/fill.htm?_tosheet=true&_pdType=afcabecbcahiibffiiih"


class AlipayAutomationManager:
    def __init__(self):
        self._lock = threading.Lock()

    @staticmethod
    def _load_pyautogui():
        try:
            import pyautogui
            pyautogui.FAILSAFE = True
            pyautogui.PAUSE = 0.12
            return pyautogui, None
        except ImportError:
            return None, "缺少 pyautogui 依赖，请先执行 `pip install -r requirements.txt`。"

    @staticmethod
    def _set_clipboard(text: str):
        import tkinter as tk

        root = tk.Tk()
        root.withdraw()
        root.clipboard_clear()
        root.clipboard_append(text)
        root.update()
        root.destroy()

    def _paste_value(self, pyautogui, value: str):
        self._set_clipboard(str(value or ""))
        time.sleep(0.08)
        pyautogui.hotkey("ctrl", "v")
        time.sleep(0.2)

    @staticmethod
    def _build_injection_script(payload: dict):
        bank_name = str(payload.get("bank_name") or "").strip()
        card_no = "".join(str(payload.get("card_no") or "").split())
        account_name = str(payload.get("account_name") or "").strip()
        amount = f"{float(payload.get('amount') or 0):.2f}"
        note = str(payload.get("note") or "").strip()[:20]

        fields = {
            "bankName": bank_name,
            "bankCardNo": card_no,
            "bankCardName": account_name,
            "amount": amount,
            "reason": note,
        }
        fields_json = json.dumps(fields, ensure_ascii=False)
        return (
            "javascript:(function(){"
            f"var fields={fields_json};"
            "var setVal=function(id,val){"
            "var el=document.getElementById(id);"
            "if(!el||val==null)return;"
            "el.focus();"
            "el.value=val;"
            "el.dispatchEvent(new Event('input',{bubbles:true}));"
            "el.dispatchEvent(new Event('change',{bubbles:true}));"
            "el.dispatchEvent(new Event('blur',{bubbles:true}));"
            "};"
            "setVal('bankName',fields.bankName);"
            "setVal('bankCardNo',fields.bankCardNo);"
            "setVal('bankCardName',fields.bankCardName);"
            "setVal('amount',fields.amount);"
            "setVal('reason',fields.reason);"
            "var bankInput=document.getElementById('bankName');"
            "if(bankInput){bankInput.focus();}"
            "})();"
        )

    def _autofill_via_address_bar(self, pyautogui, payload: dict):
        script = self._build_injection_script(payload)
        pyautogui.hotkey("ctrl", "l")
        time.sleep(0.2)
        self._paste_value(pyautogui, script)
        pyautogui.press("enter")
        time.sleep(0.8)

    def autofill_bank_transfer(self, payload: dict):
        pyautogui, error = self._load_pyautogui()
        if error:
            return {"ok": False, "error": error}

        with self._lock:
            try:
                opened = webbrowser.open(TRANSFER_URL, new=1)
                if not opened:
                    return {"ok": False, "error": "未能打开系统默认浏览器。"}

                # 给默认浏览器和支付宝页面一些加载时间，尽量复用当前登录态。
                time.sleep(3.6)
                self._autofill_via_address_bar(pyautogui, payload)
                return {
                    "ok": True,
                    "message": "已按支付宝表单元素自动填写默认浏览器中的转账页，请立即核对内容并手动确认付款。执行期间请暂时不要操作鼠标键盘。",
                    "browser": "default",
                }
            except Exception as exc:
                return {"ok": False, "error": f"默认浏览器自动填表失败：{exc}"}


manager = AlipayAutomationManager()


def autofill_alipay_bank_transfer(payload: dict):
    return manager.autofill_bank_transfer(payload)
