"""
文件解析工具
支持 PDF 和 DOCX 格式的简历文件解析
"""

import io


def extract_text_from_pdf(uploaded_file) -> str:
    """从上传的 PDF 文件中提取文本"""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(uploaded_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except ImportError:
        return "ERROR: PyPDF2 未安装，请运行 pip install PyPDF2"
    except Exception as e:
        return f"ERROR: PDF 解析失败 - {str(e)}"


def extract_text_from_docx(uploaded_file) -> str:
    """从上传的 DOCX 文件中提取文本"""
    try:
        from docx import Document
        doc = Document(io.BytesIO(uploaded_file.read()))
        text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
        return text.strip()
    except ImportError:
        return "ERROR: python-docx 未安装，请运行 pip install python-docx"
    except Exception as e:
        return f"ERROR: DOCX 解析失败 - {str(e)}"


def extract_resume_text(uploaded_file) -> str:
    """
    根据文件类型自动选择解析方式

    Args:
        uploaded_file: Streamlit UploadedFile 对象

    Returns:
        提取的文本内容
    """
    filename = uploaded_file.name.lower()

    if filename.endswith(".pdf"):
        return extract_text_from_pdf(uploaded_file)
    elif filename.endswith(".docx"):
        return extract_text_from_docx(uploaded_file)
    else:
        return "ERROR: 不支持的文件格式，请上传 PDF 或 DOCX 文件"


def validate_resume_text(text: str) -> tuple:
    """
    验证简历文本是否有效

    Returns:
        (is_valid, error_message)
    """
    if not text or len(text.strip()) < 50:
        return False, "简历内容过短，请上传包含更多信息的简历文件"

    if text.startswith("ERROR:"):
        return False, text

    return True, ""
