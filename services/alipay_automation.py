"""Alipay bank transfer form autofill helpers."""
import os
import threading
from typing import Optional

from services.db import get_base_dir

TRANSFER_URL = "https://shenghuo.alipay.com/transfercore/fill.htm?_tosheet=true&_pdType=afcabecbcahiibffiiih"


class AlipayAutomationManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._playwright = None
        self._context = None
        self._page = None
        self._channel = None

    def _load_playwright(self):
        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
            return sync_playwright, PlaywrightTimeoutError, None
        except ImportError:
            return None, None, "缺少 Playwright 依赖，请先重新运行项目安装依赖。"

    def _profile_dir(self):
        path = os.path.join(get_base_dir(), "alipay_browser_profile")
        os.makedirs(path, exist_ok=True)
        return path

    def _ensure_context(self):
        sync_playwright, _, import_error = self._load_playwright()
        if import_error:
            return None, import_error

        if self._context and self._page:
            try:
                if not self._page.is_closed():
                    return self._page, None
            except Exception:
                self._page = None
                self._context = None

        if self._playwright is None:
            self._playwright = sync_playwright().start()

        last_error = None
        for channel in ("msedge", "chrome", None):
            try:
                kwargs = {
                    "user_data_dir": self._profile_dir(),
                    "headless": False,
                    "viewport": None,
                    "args": ["--start-maximized"],
                }
                if channel:
                    kwargs["channel"] = channel
                context = self._playwright.chromium.launch_persistent_context(**kwargs)
                page = context.pages[0] if context.pages else context.new_page()
                self._context = context
                self._page = page
                self._channel = channel or "chromium"
                return page, None
            except Exception as exc:
                last_error = str(exc)

        return None, f"自动化浏览器启动失败：{last_error or '未知错误'}"

    @staticmethod
    def _page_contains_text(page, text: str):
        try:
            return page.get_by_text(text, exact=False).first.is_visible(timeout=800)
        except Exception:
            return False

    def _needs_login(self, page):
        try:
            url = page.url or ""
        except Exception:
            url = ""
        if "login" in url.lower():
            return True
        login_markers = ("登录", "扫码登录", "支付宝登录", "请登录")
        return any(self._page_contains_text(page, marker) for marker in login_markers)

    @staticmethod
    def _clear_and_fill(locator, value: str):
        locator.click()
        locator.press("Control+A")
        locator.fill(str(value))

    def _find_field_after_labels(self, page, labels: list[str], field_tags: tuple[str, ...] = ("input", "textarea")):
        for label in labels:
            for tag in field_tags:
                xpaths = [
                    f"xpath=(//*[self::label or self::span or self::div or self::td][contains(normalize-space(.), '{label}')])[last()]/following::{tag}[1]",
                    f"xpath=(//*[contains(normalize-space(text()), '{label}')])[last()]/following::{tag}[1]",
                ]
                for xp in xpaths:
                    locator = page.locator(xp).first
                    try:
                        if locator.count() and locator.is_visible():
                            return locator
                    except Exception:
                        continue
        return None

    def _visible_fill_fields(self, page):
        candidates = []
        for tag in ("input", "textarea"):
            locator = page.locator(tag)
            try:
                count = min(locator.count(), 40)
            except Exception:
                count = 0
            for idx in range(count):
                node = locator.nth(idx)
                try:
                    input_type = (node.get_attribute("type") or "").lower()
                    if input_type in ("hidden", "submit", "radio", "checkbox", "button"):
                        continue
                    if node.is_visible() and not node.is_disabled():
                        candidates.append(node)
                except Exception:
                    continue
        return candidates

    def _fill_transfer_form(self, page, payload: dict):
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(1500)

        bank_field = self._find_field_after_labels(page, ["收款方", "收款银行", "银行"])
        card_field = self._find_field_after_labels(page, ["银行卡号", "卡号", "收款卡号"])
        name_field = self._find_field_after_labels(page, ["姓名", "收款人姓名", "开户姓名", "户名"])
        amount_field = self._find_field_after_labels(page, ["付款金额", "金额"])
        note_field = self._find_field_after_labels(page, ["付款说明", "备注"], ("input", "textarea"))

        fallbacks = self._visible_fill_fields(page)
        fallback_index = 0

        def pick(field):
            nonlocal fallback_index
            if field is not None:
                return field
            if fallback_index < len(fallbacks):
                field = fallbacks[fallback_index]
                fallback_index += 1
                return field
            return None

        bank_field = pick(bank_field)
        card_field = pick(card_field)
        name_field = pick(name_field)
        amount_field = pick(amount_field)
        note_field = pick(note_field)

        if bank_field and payload.get("bank_name"):
            self._clear_and_fill(bank_field, payload["bank_name"])
            try:
                bank_field.press("ArrowDown")
                bank_field.press("Enter")
                page.wait_for_timeout(300)
            except Exception:
                pass

        if card_field and payload.get("card_no"):
            self._clear_and_fill(card_field, payload["card_no"])

        if name_field and payload.get("account_name"):
            self._clear_and_fill(name_field, payload["account_name"])

        if amount_field and payload.get("amount") is not None:
            self._clear_and_fill(amount_field, f"{float(payload['amount']):.2f}")

        if note_field and payload.get("note"):
            self._clear_and_fill(note_field, payload["note"])

        page.wait_for_timeout(500)

    def autofill_bank_transfer(self, payload: dict):
        with self._lock:
            page, error = self._ensure_context()
            if error:
                return {"ok": False, "error": error}

            try:
                page.goto(TRANSFER_URL, wait_until="domcontentloaded")
                page.bring_to_front()
                page.wait_for_timeout(1200)

                if self._needs_login(page):
                    return {
                        "ok": False,
                        "requires_login": True,
                        "error": "请先在自动化浏览器中登录支付宝，登录完成后再次点击工资打款。",
                    }

                self._fill_transfer_form(page, payload)
                page.bring_to_front()
                return {
                    "ok": True,
                    "message": "已自动填写支付宝转账表单，请在浏览器中核对后手动确认付款。",
                    "browser": self._channel or "",
                }
            except Exception as exc:
                return {"ok": False, "error": f"自动填表失败：{exc}"}


manager = AlipayAutomationManager()


def autofill_alipay_bank_transfer(payload: dict):
    return manager.autofill_bank_transfer(payload)
