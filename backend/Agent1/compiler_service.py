# Agent1/compiler_service.py
import subprocess
import tempfile
import os
import re

COMPILE_TIMEOUT = 10
ANALYSIS_TIMEOUT = 10

def _parse_gcc_errors(stderr_text):
    pattern = r"[^:]+:(\d+):(\d+):\s*(error|warning):\s*(.+)"
    errors = []
    for line in stderr_text.splitlines():
        match = re.match(pattern, line)
        if match:
            errors.append({
                "line": int(match.group(1)),
                "column": int(match.group(2)),
                "severity": match.group(3),
                "message": match.group(4).strip(),
            })
    return errors

def _parse_cppcheck_output(stderr_text):
    pattern = r"[^:]+:(\d+):(\d+):\s*(warning|style|error):\s*(.+)"
    findings = []
    for line in stderr_text.splitlines():
        match = re.match(pattern, line)
        if match:
            findings.append({
                "line": int(match.group(1)),
                "column": int(match.group(2)),
                "severity": match.group(3),
                "message": match.group(4).strip(),
            })
    return findings

def compile_check(code: str) -> dict:
    """
    Pure compile check — used by both Agent A (initial analysis)
    and Agent C (verifying a repaired version).
    Returns {compiles, compiler_errors}
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        src_path = os.path.join(tmpdir, "submission.cpp")
        with open(src_path, "w") as f:
            f.write(code)

        try:
            compile_result = subprocess.run(
                ["g++", "-c", src_path, "-o", os.devnull, "-std=c++17"],
                capture_output=True,
                text=True,
                timeout=COMPILE_TIMEOUT,
            )
        except subprocess.TimeoutExpired:
            return {
                "compiles": False,
                "compiler_errors": [{"line": 0, "column": 0, "severity": "error",
                                      "message": "Compilation timed out"}],
            }

        return {
            "compiles": compile_result.returncode == 0,
            "compiler_errors": _parse_gcc_errors(compile_result.stderr),
        }

def analyze_cpp(code: str) -> dict:
    """
    Full Agent A analysis: compile + static analysis (only if it compiles).
    """
    compile_result = compile_check(code)
    static_warnings = []

    if compile_result["compiles"]:
        with tempfile.TemporaryDirectory() as tmpdir:
            src_path = os.path.join(tmpdir, "submission.cpp")
            with open(src_path, "w") as f:
                f.write(code)
            try:
                cppcheck_result = subprocess.run(
                    ["cppcheck", "--enable=warning,style", src_path],
                    capture_output=True,
                    text=True,
                    timeout=ANALYSIS_TIMEOUT,
                )
                static_warnings = _parse_cppcheck_output(cppcheck_result.stderr)
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass

    return {
        "compiles": compile_result["compiles"],
        "compiler_errors": compile_result["compiler_errors"],
        "static_warnings": static_warnings,
    }