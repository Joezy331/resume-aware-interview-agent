"""
运行统计
=====================================================================
记录真实模型调用的次数 / 令牌 / 耗时 / 失败率，供 Streamlit 统计面板展示。
只保留进程内聚合结果，不落盘、不记录任何密钥或回答原文。
"""

from __future__ import annotations

import time
from threading import Lock

_LOCK = Lock()

_STATE = {
    "started_at": time.time(),
    "calls": 0,
    "ok": 0,
    "failed": 0,
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0,
    "latency_sum": 0.0,
    "latency_max": 0.0,
    "errors": {},          # 错误类型 -> 次数
    "by_tag": {},          # tag -> 次数
}


def record_call(ok: bool, latency: float, usage: dict, error: str = "", tag: str = "chat") -> None:
    """记录一次模型调用"""
    with _LOCK:
        _STATE["calls"] += 1
        if ok:
            _STATE["ok"] += 1
        else:
            _STATE["failed"] += 1
            if error:
                _STATE["errors"][error] = _STATE["errors"].get(error, 0) + 1

        _STATE["by_tag"][tag] = _STATE["by_tag"].get(tag, 0) + 1

        _STATE["prompt_tokens"] += int(usage.get("prompt_tokens", 0) or 0)
        _STATE["completion_tokens"] += int(usage.get("completion_tokens", 0) or 0)
        _STATE["total_tokens"] += int(usage.get("total_tokens", 0) or 0)

        _STATE["latency_sum"] += float(latency or 0.0)
        _STATE["latency_max"] = max(_STATE["latency_max"], float(latency or 0.0))


def snapshot() -> dict:
    """返回统计快照"""
    with _LOCK:
        calls = _STATE["calls"]
        return {
            "started_at": _STATE["started_at"],
            "elapsed_sec": round(time.time() - _STATE["started_at"], 1),
            "calls": calls,
            "ok": _STATE["ok"],
            "failed": _STATE["failed"],
            "success_rate": round(_STATE["ok"] / calls * 100, 1) if calls else 0.0,
            "prompt_tokens": _STATE["prompt_tokens"],
            "completion_tokens": _STATE["completion_tokens"],
            "total_tokens": _STATE["total_tokens"],
            "avg_latency": round(_STATE["latency_sum"] / calls, 2) if calls else 0.0,
            "max_latency": round(_STATE["latency_max"], 2),
            "errors": dict(_STATE["errors"]),
            "by_tag": dict(_STATE["by_tag"]),
        }


def reset() -> None:
    """清空统计"""
    with _LOCK:
        _STATE.update(
            started_at=time.time(),
            calls=0,
            ok=0,
            failed=0,
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            latency_sum=0.0,
            latency_max=0.0,
            errors={},
            by_tag={},
        )
