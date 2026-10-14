"""
文件解析工具
支持 PDF / DOCX / TXT / MD 格式的简历文件解析

说明：
- PDF 解析优先用 pypdf，其次回退 PyPDF2（两个包只装一个也能跑）
- extract_resume_text() 同时兼容两种入参：
    1) extract_resume_text(streamlit_uploaded_file)         —— Streamlit UploadedFile
    2) extract_resume_text(io.BytesIO(...), "resume.pdf")    —— 文件对象 + 文件名
"""

from __future__ import annotations

import io


def _as_stream_and_name(file_obj, name: str | None = None):
    """统一成 (可读流, 小写文件名)"""
    # 情况 1：Streamlit UploadedFile（自带 .name）
    if hasattr(file_obj, "name") and isinstance(getattr(file_obj, "name", None), str):
        return file_obj, file_obj.name.lower()

    # 情况 2：显式传入 name
    if name:
        return file_obj, name.lower()

    # 情况 3：纯路径字符串
    if isinstance(file_obj, str):
        with open(file_obj, "rb") as fh:
            return io.BytesIO(fh.read()), file_obj.lower()

    raise ValueError("无法确定文件名，请传入 Streamlit UploadedFile 或 (file_obj, name)")


def extract_text_from_pdf(file_obj, name: str | None = None) -> str:
    """从 PDF 文件对象中提取文本（pypdf 优先，PyPDF2 回退）"""
    stream, fname = _as_stream_and_name(file_obj, name)

    try:
        from pypdf import PdfReader
    except ImportError:
        try:
            from PyPDF2 import PdfReader  # type: ignore
        except ImportError:
            return "ERROR: 未安装 PDF 解析库，请运行 pip install pypdf"

    try:
        if hasattr(stream, "seek"):
            stream.seek(0)
        reader = PdfReader(stream)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        text = text.strip()
        return text or "ERROR: PDF 中未提取到文本（可能是扫描件，请改用可复制文本的 PDF）"
    except Exception as e:  # noqa: BLE001
        return f"ERROR: PDF 解析失败 - {e}"


def extract_text_from_docx(file_obj, name: str | None = None) -> str:
    """从 DOCX 文件对象中提取文本"""
    stream, _ = _as_stream_and_name(file_obj, name)

    try:
        from docx import Document
    except ImportError:
        return "ERROR: python-docx 未安装，请运行 pip install python-docx"

    try:
        if hasattr(stream, "read"):
            data = stream.read()
        else:
            data = stream
        doc = Document(io.BytesIO(data) if isinstance(data, (bytes, bytearray)) else data)
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()
        return text or "ERROR: DOCX 中未提取到文本"
    except Exception as e:  # noqa: BLE001
        return f"ERROR: DOCX 解析失败 - {e}"


def extract_text_from_txt(file_obj, name: str | None = None) -> str:
    """从纯文本文件（TXT / MD）中读取文本"""
    stream, _ = _as_stream_and_name(file_obj, name)
    try:
        data = stream.read() if hasattr(stream, "read") else stream
        if isinstance(data, (bytes, bytearray)):
            data = data.decode("utf-8", errors="ignore")
        return data.strip()
    except Exception as e:  # noqa: BLE001
        return f"ERROR: 文本文件读取失败 - {e}"


def extract_resume_text(file_obj, name: str | None = None) -> str:
    """
    根据文件类型自动选择解析方式。

    Args:
        file_obj: Streamlit UploadedFile、文件对象、BytesIO 或路径字符串
        name: 文件名（当 file_obj 不带 .name 时必传）

    Returns:
        提取的文本内容；失败时以 "ERROR: ..." 开头（由 validate_resume_text 识别）
    """
    _, fname = _as_stream_and_name(file_obj, name)

    if fname.endswith(".pdf"):
        return extract_text_from_pdf(file_obj, name)
    if fname.endswith(".docx"):
        return extract_text_from_docx(file_obj, name)
    if fname.endswith((".txt", ".md")):
        return extract_text_from_txt(file_obj, name)
    return f"ERROR: 不支持的文件格式（{fname}），请上传 PDF / DOCX / TXT / MD"


def validate_resume_text(text: str) -> tuple[bool, str]:
    """
    验证简历文本是否有效

    Returns:
        (is_valid, error_message)
    """
    if not text or not text.strip():
        return False, "简历内容为空"
    if text.startswith("ERROR:"):
        return False, text[len("ERROR:") :].strip() or "解析失败"
    if len(text.strip()) < 50:
        return False, "简历内容过短（少于 50 字），请上传包含更多信息的简历"
    return True, ""
