# Agent1/repair_service.py
import os
from groq import Groq

from django.conf import settings
client = Groq(api_key=settings.GROQ_API_KEY)

MODEL = "openai/gpt-oss-120b"  # good balance of quality/speed for code

def _format_diagnostics(diagnostics: dict) -> str:
    lines = []
    for err in diagnostics.get("compiler_errors", []):
        lines.append(f"Line {err['line']}: [{err['severity']}] {err['message']}")
    for warn in diagnostics.get("static_warnings", []):
        lines.append(f"Line {warn['line']}: [{warn['severity']}] {warn['message']}")
    return "\n".join(lines) if lines else "No errors reported."

def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]  # drop opening fence (```cpp or ```)
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]  # drop closing fence
        text = "\n".join(lines)
    return text.strip()

def repair_code(code: str, diagnostics: dict) -> str:
    diagnostics_text = _format_diagnostics(diagnostics)

    prompt = f"""You are a C++ code repair tool. Fix the following code so it compiles cleanly.

Original code:
{code}

Compiler/static analysis diagnostics:
{diagnostics_text}

Rules:
- Return ONLY the corrected C++ code.
- Do not include explanations, comments about what you changed, or markdown code fences.
- Preserve the original program's intent and structure as much as possible; fix only what's broken."""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        raw_output = response.choices[0].message.content
        return _strip_code_fences(raw_output)
    except Exception as e:
        # Surface failure clearly rather than passing garbage downstream
        raise RuntimeError(f"Repair call failed: {e}")