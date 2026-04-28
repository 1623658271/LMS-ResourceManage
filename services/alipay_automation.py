"""Alipay bank transfer form autofill helpers."""
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
    def _press_tab(pyautogui, presses: int = 1):
        for _ in range(max(presses, 0)):
            pyautogui.press("tab")
            time.sleep(0.15)

    def _autofill_via_keyboard(self, pyautogui, payload: dict):
        bank_name = str(payload.get("bank_name") or "").strip()
        card_no = "".join(str(payload.get("card_no") or "").split())
        account_name = str(payload.get("account_name") or "").strip()
        amount = float(payload.get("amount") or 0)
        note = str(payload.get("note") or "").strip()[:20]

        # 假设转账页打开后焦点位于首个表单字段附近，按页面顺序依次填写。
        # 如果支付宝页面后续改版，只需要微调这里的 tab 节奏即可。
        if bank_name:
            self._paste_value(pyautogui, bank_name)
            pyautogui.press("down")
            time.sleep(0.15)
            pyautogui.press("enter")
            time.sleep(0.2)

        self._press_tab(pyautogui, 1)
        if card_no:
            self._paste_value(pyautogui, card_no)

        self._press_tab(pyautogui, 1)
        if account_name:
            self._paste_value(pyautogui, account_name)

        self._press_tab(pyautogui, 1)
        self._paste_value(pyautogui, f"{amount:.2f}")

        if note:
            self._press_tab(pyautogui, 3)
            self._paste_value(pyautogui, note)

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
                self._autofill_via_keyboard(pyautogui, payload)
                return {
                    "ok": True,
                    "message": "已在默认浏览器中尝试自动填写支付宝转账表单，请立即核对内容并手动确认付款。填表期间请不要操作鼠标键盘。",
                    "browser": "default",
                }
            except Exception as exc:
                return {"ok": False, "error": f"默认浏览器自动填表失败：{exc}"}


manager = AlipayAutomationManager()


def autofill_alipay_bank_transfer(payload: dict):
    return manager.autofill_bank_transfer(payload)
