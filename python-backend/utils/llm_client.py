"""
LLM 客户端工具
=====================================================================
模型接口：Cline 提供的本地 OpenAI 兼容 API
  - Base URL : http://localhost:8787/v1
  - Model    : cline-free/mimo-v2.6-flash
  - API Key  : 从 .streamlit/secrets.toml 的 LLM_API_KEY 读取（绝不硬编码）

本模块对外只暴露三个能力：
  1. create_client()  —— 构造带超时/重试的 OpenAI 客户端
  2. chat_text()      —— 纯文本调用
  3. chat_json()      —— 强制 JSON 结构化调用（含解析容错）

所有请求统一处理：超时、连接异常、空回复、JSON 格式错误、鉴权失败。
调用指标统一写入 utils.stats，供"运行统计"展示。
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    OpenAI,
    RateLimitError,
)

from config import MODEL_CONFIG

# ---------------------------------------------------------------- 密钥读取

_SECRET_CANDIDATES = [
    # 项目内：python-backend/.streamlit/secrets.toml
    Path(__file__).resolve().parent.parent / ".streamlit" / "secrets.toml",
    # 仓库根：resume-aware-interview-agent/.streamlit/secrets.toml
    Path(__file__).resolve().parent.parent.parent / ".streamlit" / "secrets.toml",
    # 用户级
    Path.home() / ".streamlit" / "secrets.toml",
]


def _load_secret_from_toml(path: Path) -> str | None:
    """极简 TOML 解析：只取 LLM_API_KEY 一行，避免引入额外依赖。"""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    m = re.search(r'^\s*LLM_API_KEY\s*=\s*["\']([^"\']+)["\']', text, re.MULTILINE)
    if m:
        return m.group(1)
    m = re.search(r"^\s*LLM_API_KEY\s*=\s*([^\s#]+)", text, re.MULTILINE)
    return m.group(1) if m else None


def get_api_key() -> str:
    """
    按优先级读取 API Key：
      1. 环境变量 LLM_API_KEY（便于命令行测试 / CI）
      2. .streamlit/secrets.toml 中的 LLM_API_KEY（Streamlit 正式路径）
    读取不到时抛明确异常，绝不使用任何内置默认值。
    """
    key = os.getenv("LLM_API_KEY", "").strip()
    if key:
        return key

    for path in _SECRET_CANDIDATES:
        if path.is_file():
            key = _load_secret_from_toml(path)
            if key:
                return key

    raise RuntimeError(
        "未读到 API Key。请在以下任一位置配置：\n"
        "  1) python-backend/.streamlit/secrets.toml 写入 LLM_API_KEY = \"...\"\n"
        "  2) 或设置环境变量 LLM_API_KEY\n"
        "注意：Key 不得写入代码、日志或 Git。"
    )


def get_model_name() -> str:
    """模型名称（可被环境变量 MODEL_NAME 覆盖，默认 cline-free/mimo-v2.6-flash）"""
    return os.getenv("MODEL_NAME", "").strip() or MODEL_CONFIG["model_name"]


def get_base_url() -> str:
    """Base URL（可被环境变量 LLM_BASE_URL 覆盖）"""
    return os.getenv("LLM_BASE_URL", "").strip() or MODEL_CONFIG["base_url"]


def create_client() -> OpenAI:
    """
    创建 OpenAI 客户端实例（连接 Cline 本地 API）

    Returns:
        OpenAI 客户端实例
    """
    return OpenAI(
        api_key=get_api_key(),
        base_url=get_base_url(),
        timeout=MODEL_CONFIG["timeout"],
        max_retries=MODEL_CONFIG["max_retries"],
    )


# ---------------------------------------------------------------- 统计埋点

def _record(ok: bool, latency: float, usage: dict | None, error: str = "", tag: str = "") -> None:
    """把一次调用指标写入统计模块（导入失败时静默降级，不影响主流程）"""
    try:
        from utils.stats import record_call

        record_call(ok=ok, latency=latency, usage=usage or {}, error=error, tag=tag)
    except Exception:
        pass


# ---------------------------------------------------------------- 底层调用

def _extract_content(resp: Any) -> str:
    """从响应中安全取文本，兼容空 choices / 空 content"""
    try:
        choices = resp.choices
        if not choices:
            return ""
        msg = choices[0].message
        content = getattr(msg, "content", None)
        return content.strip() if isinstance(content, str) else ""
    except Exception:
        return ""


def _extract_usage(resp: Any) -> dict:
    try:
        u = resp.usage
        if not u:
            return {}
        return {
            "prompt_tokens": getattr(u, "prompt_tokens", 0) or 0,
            "completion_tokens": getattr(u, "completion_tokens", 0) or 0,
            "total_tokens": getattr(u, "total_tokens", 0) or 0,
        }
    except Exception:
        return {}


def _raw_create(
    client: OpenAI,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
) -> tuple[str, dict]:
    """
    执行一次真实模型调用（SDK 自带 max_retries 之外的兜底重试）。

    返回：(文本内容, usage)；失败抛 RuntimeError。
    """
    last_err: Exception | None = None
    attempts = int(MODEL_CONFIG.get("retry_attempts", 3))
    backoff = float(MODEL_CONFIG.get("retry_backoff", 1.6))

    for i in range(attempts):
        started = time.time()
        try:
            resp = client.chat.completions.create(
                model=get_model_name(),
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = _extract_content(resp)
            usage = _extract_usage(resp)
            latency = time.time() - started

            if not content:
                _record(False, latency, usage, error="empty content", tag="chat")
                last_err = RuntimeError("模型返回空内容")
            else:
                _record(True, latency, usage, tag="chat")
                return content, usage

        except (APITimeoutError, APIConnectionError) as e:
            _record(False, time.time() - started, {}, error=type(e).__name__, tag="chat")
            last_err = e
        except (AuthenticationError, BadRequestError) as e:
            # 鉴权 / 参数错误，重试无意义
            _record(False, time.time() - started, {}, error=type(e).__name__, tag="chat")
            raise
        except RateLimitError as e:
            _record(False, time.time() - started, {}, error="RateLimitError", tag="chat")
            last_err = e
        except (InternalServerError, APIStatusError) as e:
            # 5xx / 上游故障（本网关常见 "upstream connect failed"）：
            # 属瞬时故障，退避更久再重试
            code = getattr(e, "status_code", None)
            _record(False, time.time() - started, {}, error=f"HTTP{code or '5xx'}", tag="chat")
            last_err = e
            if i < attempts - 1:
                time.sleep(backoff ** i * 2.5)
            continue
        except Exception as e:
            _record(False, time.time() - started, {}, error=type(e).__name__, tag="chat")
            last_err = e

        if i < attempts - 1:
            time.sleep(backoff ** i)

    raise RuntimeError(f"模型调用失败（已重试 {attempts} 次）：{type(last_err).__name__}: {last_err}")


def chat_text(
    client: OpenAI,
    system: str,
    user: str,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    """纯文本调用。失败抛 RuntimeError，由调用方显式处理（不返回假数据）。"""
    content, _ = _raw_create(
        client,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=MODEL_CONFIG["temperature"] if temperature is None else temperature,
        max_tokens=max_tokens or MODEL_CONFIG["max_tokens"],
    )
    return content


# ---------------------------------------------------------------- JSON 解析

def extract_json_block(text: str) -> str:
    """剥离 ```json 围栏与前后废话，返回裸 JSON 串"""
    if not text:
        return ""

    m = re.search(r"```json\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()

    m = re.search(r"```\s*(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()

    start_obj, start_arr = text.find("{"), text.find("[")
    candidates = [i for i in (start_obj, start_arr) if i != -1]
    if not candidates:
        return text.strip()
    start = min(candidates)
    end = max(text.rfind("}"), text.rfind("]"))
    if end <= start:
        return text.strip()
    return text[start : end + 1].strip()


def chat_json(
    client: OpenAI,
    system: str,
    user: str,
    temperature: float | None = None,
    max_tokens: int | None = None,
    fallback: Any = None,
) -> tuple[Any, str | None]:
    """
    结构化 JSON 调用。

    Returns:
        (解析后的对象, 错误信息)
        - 成功：(obj, None)
        - 失败：(fallback, "错误原因")

    约定：解析失败时返回 fallback，但错误信息非空。
    调用方必须据此显式标注"未取得真实模型结果"，不得当成真实输出展示。
    """
    try:
        content, _ = _raw_create(
            client,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=MODEL_CONFIG["temperature"] if temperature is None else temperature,
            max_tokens=max_tokens or MODEL_CONFIG["max_tokens"],
        )
    except Exception as e:
        return fallback, f"调用失败：{e}"

    raw = extract_json_block(content)
    try:
        return json.loads(raw), None
    except json.JSONDecodeError as e:
        preview = raw[:200].replace("\n", " ")
        return fallback, f"JSON 解析失败：{e}；原始片段：{preview}"
