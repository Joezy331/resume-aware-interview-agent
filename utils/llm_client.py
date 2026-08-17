"""
LLM 客户端工具
初始化 OpenAI SDK 客户端，连接 SiliconFlow API
"""

import os
from openai import OpenAI


def create_client() -> OpenAI:
    """
    创建 OpenAI 客户端实例（连接 SiliconFlow API）

    Returns:
        OpenAI 客户端实例
    """
    api_key = os.getenv("SILICONFLOW_API_KEY", "")
    base_url = os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")

    if not api_key:
        raise ValueError(
            "未配置 SILICONFLOW_API_KEY，请在 .env 文件中设置。"
            "\n获取地址：https://cloud.siliconflow.cn/"
        )

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
    )

    return client


def get_model_name() -> str:
    """获取模型名称"""
    return os.getenv("MODEL_NAME", "Qwen/Qwen2.5-72B-Instruct")
