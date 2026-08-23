from typing import TypedDict, List, Dict
from langgraph.graph import StateGraph, END

from Agent1.compiler_service import analyze_cpp
from Agent1.compiler_service import compile_check as verify_code
from Agent2.repair_service import repair_code

MAX_ITERATIONS = 5  # generous enough for medium-toughness bugs, bounded so it can't hang

class DebugState(TypedDict):
    original_code: str
    current_code: str
    compiles: bool
    compiler_errors: List[Dict]
    static_warnings: List[Dict]
    iteration: int
    max_iterations: int

def analyze_node(state: DebugState) -> DebugState:
    result = analyze_cpp(state["current_code"])
    state["compiles"] = result["compiles"]
    state["compiler_errors"] = result["compiler_errors"]
    state["static_warnings"] = result["static_warnings"]
    return state

def repair_node(state: DebugState) -> DebugState:
    diagnostics = {
        "compiler_errors": state["compiler_errors"],
        "static_warnings": state["static_warnings"],
    }
    fixed = repair_code(state["current_code"], diagnostics)
    state["current_code"] = fixed
    state["iteration"] += 1
    return state

def verify_node(state: DebugState) -> DebugState:
    result = verify_code(state["current_code"])
    state["compiles"] = result["compiles"]
    state["compiler_errors"] = result["compiler_errors"]
    return state

def should_continue(state: DebugState) -> str:
    if state["compiles"]:
        return END
    if state["iteration"] >= state["max_iterations"]:
        return END
    return "analyze"

def _build_graph():
    workflow = StateGraph(DebugState)
    workflow.add_node("analyze", analyze_node)
    workflow.add_node("repair", repair_node)
    workflow.add_node("verify", verify_node)

    workflow.set_entry_point("analyze")
    workflow.add_edge("analyze", "repair")
    workflow.add_edge("repair", "verify")
    workflow.add_conditional_edges(
        "verify",
        should_continue,
        {"analyze": "analyze", END: END},
    )
    return workflow.compile()

_agent = _build_graph()

def run_debug_agent(code: str) -> dict:
    initial_state: DebugState = {
        "original_code": code,
        "current_code": code,
        "compiles": False,
        "compiler_errors": [],
        "static_warnings": [],
        "iteration": 0,
        "max_iterations": MAX_ITERATIONS,
    }
    final_state = _agent.invoke(initial_state)
    return {
        "compiles": final_state["compiles"],
        "compiler_errors": final_state["compiler_errors"],
        "corrected_code": final_state["current_code"],
        "iterations": final_state["iteration"],
    }