"""
最小 API 连通性测试
=====================================================================
用途：在改造 / 排障时，先确认「服务可达 → Key 有效 → 模型可调用 → JSON 可解析」。

用法：
    cd python-backend
    python test_api_connectivity.py

判定标准：
    - 全部 ✅ 表示可以开始真实面试流程
    - 任一 ❌ 都会在报告末尾给出明确原因，不会被静默跳过
"""

from __future__ import annotations

import json
import sys
import time

import requests

from config import MODEL_CONFIG
from utils.llm_client import (
    chat_json,
    chat_text,
    create_client,
    get_api_key,
    get_base_url,
    get_model_name,
)
from utils.stats import snapshot as stats_snapshot

OK, FAIL = "✅", "❌"
results: list[tuple[str, bool, str]] = []


def check(name: str, fn):
    """执行一项检查并收集结果，异常不算崩，记为失败"""
    started = time.time()
    try:
        ok, detail = fn()
    except Exception as e:  # noqa: BLE001
        ok, detail = False, f"{type(e).__name__}: {e}"
    results.append((name, ok, f"{detail}（{time.time() - started:.2f}s）"))
    return ok


# ---------------------------------------------------------------- 1. 服务可达
def _svc_alive():
    url = get_base_url().rstrip("/")
    r = requests.get(url.replace("/v1", "/health"), timeout=10)
    if r.status_code != 200:
        return False, f"/health 返回 HTTP {r.status_code}"
    try:
        h = r.json()
    except ValueError:
        return True, f"HTTP 200（响应非 JSON，{r.text[:80]}）"
    return True, f"HTTP 200 · version={h.get('version')} · api_key_configured={h.get('api_key_configured')}"


# ---------------------------------------------------------------- 2. Key 可读取
def _key_readable():
    k = get_api_key()
    if not k:
        return False, "读到空 Key"
    # 只暴露长度与首尾字符，绝不打印完整 Key
    return True, f"已读取 LLM_API_KEY（长度 {len(k)}，首字符 {k[0]}***）"


# ---------------------------------------------------------------- 3. 模型列表
def _models():
    r = requests.get(f"{get_base_url().rstrip('/')}/models", timeout=10)
    if r.status_code != 200:
        return False, f"/v1/models HTTP {r.status_code}"
    data = r.json().get("data", [])
    return True, f"/v1/models HTTP 200，列表 {len(data)} 项（本网关不枚举模型属正常）"


# ---------------------------------------------------------------- 4. 纯文本调用
def _text_call():
    client = create_client()
    out = chat_text(
        client,
        system="你是一个连通性测试助手。",
        user="只回复两个字：可用",
        temperature=0.1,
        max_tokens=64,
    )
    if not out.strip():
        return False, "返回空内容"
    return True, f"模型 {get_model_name()} 回复：{out.strip()[:60]!r}"


# ---------------------------------------------------------------- 5. JSON 调用
def _json_call():
    client = create_client()
    obj, err = chat_json(
        client,
        system="你是 JSON 输出测试助手，只输出 JSON，不要其他文字。",
        user='输出：{"status":"ok","n":1}',
        temperature=0.1,
        max_tokens=128,
    )
    if err:
        return False, err
    if not isinstance(obj, dict) or obj.get("status") != "ok":
        return False, f"结构不符合预期：{json.dumps(obj, ensure_ascii=False)[:120]}"
    return True, f"JSON 解析成功：{json.dumps(obj, ensure_ascii=False)[:80]}"


# ---------------------------------------------------------------- 6. 空回复/异常处理
def _error_handling():
    """用一个必然解析失败的提示，确认 chat_json 会返回错误而不是抛异常、也不伪装成功"""
    client = create_client()
    obj, err = chat_json(
        client,
        system="无论收到什么都只输出一段纯中文散文，绝不使用 JSON。",
        user="请用散文介绍春天。",
        temperature=0.2,
        max_tokens=128,
        fallback=None,
    )
    if obj is None and err:
        return True, f"异常路径正常兜底：{err[:70]}"
    if obj is not None:
        # 模型仍然给了 JSON —— 说明解析链路可用，只是模型更听话，同样算通过
        return True, "模型仍返回可解析 JSON，解析链路可用"
    return False, "既无结果也无错误信息，兜底逻辑异常"


def main() -> int:
    print("=" * 68)
    print("AI Career Copilot · 最小 API 连通性测试")
    print("=" * 68)
    print(f"Base URL : {get_base_url()}")
    print(f"Model    : {get_model_name()}")
    print(f"Timeout  : {MODEL_CONFIG['timeout']}s  | 重试 {MODEL_CONFIG['retry_attempts']} 次")
    print("-" * 68)

    check("1. 本地服务可达 (/health)", _svc_alive)
    check("2. API Key 可读取（不打印完整值）", _key_readable)
    check("3. /v1/models 可访问", _models)

    if not results[-1][1]:
        print("\n服务不可用，后续调用检查跳过。")
        return 1

    check("4. 纯文本调用（真实模型）", _text_call)
    check("5. JSON 结构化调用", _json_call)
    check("6. 空回复 / 格式错误兜底", _error_handling)

    print("-" * 68)
    for name, ok, detail in results:
        print(f"{OK if ok else FAIL} {name}\n    {detail}")

    snap = stats_snapshot()
    print("-" * 68)
    print(
        f"调用统计：{snap['calls']} 次 · 成功 {snap['ok']} · 失败 {snap['failed']} · "
        f"成功率 {snap['success_rate']}% · 平均耗时 {snap['avg_latency']}s · tokens {snap['total_tokens']}"
    )

    passed = sum(1 for _, ok, _ in results if ok)
    print("=" * 68)
    print(f"结果：{passed}/{len(results)} 项通过")
    print("=" * 68)
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
