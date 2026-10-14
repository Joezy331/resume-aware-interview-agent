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
    NotFoundError,
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
    """当前生效模型名（默认 Cline；经 set_active_config 可切换为外接 API）。"""
    return _active["model_name"]


def get_base_url() -> str:
    """当前生效 Base URL（默认 Cline；可切换为外接 API）。"""
    return _active["base_url"]


# ---------------------------------------------------------------- 运行时生效配置
# 默认使用 Cline 本地 API；外接 API 通过 set_active_config() 切换。
# 模块级全局状态，生命周期与 Streamlit 进程一致；进程重启后回到默认。

def _default_config() -> dict:
    return {
        "base_url": os.getenv("LLM_BASE_URL", "").strip() or MODEL_CONFIG["base_url"],
        "model_name": os.getenv("MODEL_NAME", "").strip() or MODEL_CONFIG["model_name"],
        "api_key": None,  # 默认延迟解析：走 get_api_key()
        "service_name": "",
        "timeout": MODEL_CONFIG["timeout"],
        "max_retries": MODEL_CONFIG["max_retries"],
        "is_default": True,
    }


_active = _default_config()


def get_active_config() -> dict:
    """返回当前生效配置（不含明文 Key，仅供界面展示）。"""
    return {
        "is_default": _active.get("is_default", True),
        "service_name": _active.get("service_name", ""),
        "base_url": _active["base_url"],
        "model_name": _active["model_name"],
        "has_api_key": bool(_active.get("api_key")),
        "timeout": _active["timeout"],
    }


def set_active_config(
    base_url: str,
    api_key: str,
    model_name: str,
    service_name: str = "",
    timeout: float | None = None,
    max_retries: int | None = None,
) -> None:
    """
    将后续请求切换到指定的外接 OpenAI 兼容 API。

    仅切换「连接配置」（base_url / key / model），不触碰任何业务
    Prompt、追问策略、评分规则或报告结构。
    """
    global _active
    _active = {
        "base_url": base_url.strip().rstrip("/"),
        "api_key": api_key,
        "model_name": model_name.strip(),
        "service_name": (service_name or "").strip(),
        "timeout": float(timeout) if timeout else MODEL_CONFIG["timeout"],
        "max_retries": int(max_retries) if max_retries else MODEL_CONFIG["max_retries"],
        "is_default": False,
    }


def reset_active_config() -> None:
    """恢复为项目默认 Cline 配置（不删除用户已保存的外接配置）。"""
    global _active
    _active = _default_config()


def create_client() -> OpenAI:
    """
    创建 OpenAI 客户端实例。

    默认连接 Cline 本地 API；若已通过 set_active_config() 切换，
    则连接用户指定的外接 API。仅切换连接配置，不改业务逻辑。
    """
    cfg = _active
    api_key = cfg["api_key"] if cfg["api_key"] else get_api_key()
    return OpenAI(
        api_key=api_key,
        base_url=cfg["base_url"],
        timeout=cfg["timeout"],
        max_retries=cfg["max_retries"],
    )


# ---------------------------------------------------------------- 连接测试（独立客户端，不影响当前生效配置）

def test_connection(
    base_url: str,
    api_key: str,
    model_name: str,
    timeout: float = 20.0,
) -> tuple[bool, str]:
    """
    用给定 Base URL / Key / Model 单独创建测试客户端并发送一句测试请求。

    - 不读取、不覆盖当前生效配置。
    - 不输出 API Key，也不写入日志。
    - 只有真实收到模型非空响应才返回成功。
    """
    try:
        client = OpenAI(
            api_key=(api_key or "x"),
            base_url=base_url.strip().rstrip("/"),
            timeout=timeout,
            max_retries=0,
        )
        resp = client.chat.completions.create(
            model=model_name.strip(),
            messages=[{"role": "user", "content": "请只回复两个字：连接成功"}],
            max_tokens=20,
            temperature=0,
        )
        content = ""
        try:
            content = (resp.choices[0].message.content or "").strip()
        except Exception:
            content = ""
    except APIConnectionError:
        return False, "无法连接到该 Base URL（地址不可达或连接被拒绝）。"
    except AuthenticationError:
        return False, "API Key 无效或权限不足。"
    except NotFoundError:
        return False, "模型名称错误或该接口路径不存在（HTTP 404）。"
    except BadRequestError as e:
        msg = str(e)
        if "model" in msg.lower():
            return False, "模型名称错误，或服务不支持该模型。"
        return False, f"请求参数错误：{msg[:120]}"
    except APITimeoutError:
        return False, f"请求超时（>{timeout:.0f}s），服务响应过慢或地址不正确。"
    except RateLimitError:
        return False, "服务端限流（HTTP 429），请稍后重试。"
    except InternalServerError:
        return False, "服务端内部错误（HTTP 5xx）。"
    except APIStatusError as e:
        return False, f"服务端返回异常状态 HTTP {getattr(e, 'status_code', '?')}。"
    except Exception as e:
        return False, f"接口协议不兼容或未知错误：{type(e).__name__}: {str(e)[:120]}"

    if not content:
        return False, "模型返回空内容，连接测试未通过。"
    return True, f"连接成功（模型已响应：{content[:30]}）"


# ---------------------------------------------------------------- 外接配置持久化

_EXT_FILE = Path(__file__).resolve().parent.parent / ".streamlit" / "external_api.json"


def load_external_config() -> dict | None:
    """读取本地已保存的外接 API 配置（文件位于 .streamlit/，已被 Git 忽略）。"""
    try:
        if _EXT_FILE.is_file():
            return json.loads(_EXT_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None
    return None


def save_external_config(cfg: dict) -> None:
    """
    保存外接 API 配置到本地 .streamlit/external_api.json。

    说明：明文本地存储（非加密 KMS）。该路径已被 .gitignore 的 `.streamlit/` 规则忽略，
    不会提交到 Git。不会写入代码、日志或 secrets.toml 原文件。
    """
    _EXT_FILE.parent.mkdir(parents=True, exist_ok=True)
    _EXT_FILE.write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2),
        encoding="utf-8",
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
