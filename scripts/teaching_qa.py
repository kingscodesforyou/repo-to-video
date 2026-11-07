#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
teaching_qa.py (v4.4) - 特级教师教学质量审核门禁 (Teaching QA Agent & Validator)：
位于 Scriptwriter 与 Visual Director 之间，强制校验 `script_draft.json` 的教学完整性与零基础友好度。

职责 (7 项)：
1. 检查普通观众（零编程基础）能否听懂
2. 检查专业术语是否先用白话解释清楚、英文缩写首次出现是否展开
3. 检查是否有循序渐进的「强制六步教学法」逻辑 (problem -> analogy -> concept -> mechanism -> application -> transfer)
4. 检查生活类比是否准确且包含明确的类比边界说明 (boundary)
5. 检查是否存在未解释术语连续堆砌或用术语解释术语
6. 检查是否存在逻辑跳步（如工作原理缺少 输入->处理->为什么这样设计->输出）
7. 检查观众看完是否真正学会该知识点 (understanding_check)

评分标准（满分 100 分，通过线 >= 85 分）：
- 通俗易懂 (plain_comprehensibility): 25 分
- 知识完整 (knowledge_completeness): 25 分
- 术语解释 (term_explanation): 20 分
- 教学逻辑 (pedagogical_logic): 15 分
- 案例质量 (case_quality): 10 分
- 语言自然 (natural_language): 5 分

一票否决 (One-Vote Veto)：
- 核心技术事实错误 (factual_errors 或 application 阶段缺失真实源码引用/捏造事实)
- 关键专业术语或英文缩写未解释 (unexplained_key_terms / explained_before_jargon=False / 术语解释术语)
- 生活类比缺失边界说明 (missing_analogy_boundary)
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

try:
    from jsonschema import Draft202012Validator
except ModuleNotFoundError:
    from animation_contract import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
SCRIPT_SCHEMA_PATH = ROOT / "script-contract.schema.json"
SCRIPT_SCHEMA = json.loads(SCRIPT_SCHEMA_PATH.read_text(encoding="utf-8"))
SCRIPT_VALIDATOR = Draft202012Validator(SCRIPT_SCHEMA)

REQUIRED_PEDAGOGICAL_STAGES = [
    "problem",
    "analogy",
    "concept",
    "mechanism",
    "application",
    "transfer",
]

FORBIDDEN_PREREQUISITE_JARGON = {
    "指针",
    "多线程并发锁",
    "红黑树",
    "B+树",
    "反向传播推导",
    "AST抽象语法树",
    "内核态",
    "系统调用表",
}


def count_spoken_units(text: str) -> int:
    """统计中文字符与英文单词数，用于计算口播语速（字/分钟）"""
    cleaned = re.sub(r"[\s，。！？、；：“”‘’（）()\[\]—…·,.!?;:\"'`\-]+", " ", text)
    cjk_chars = re.findall(r"[\u4e00-\u9fff]", cleaned)
    en_words = re.findall(r"[A-Za-z0-9_]+", cleaned)
    return len(cjk_chars) + len(en_words)


def extract_acronyms(text: str) -> List[str]:
    """提取口播文案中出现的全大写英文缩写（如 API, SQL, AST, CLI, LLM, RAG, SDK 等）"""
    found = re.findall(r"\b[A-Z][A-Z0-9]{1,9}\b", text)
    ignored = {"OK", "VS", "II", "III", "IV"}
    result: List[str] = []
    for item in found:
        if item not in ignored and item not in result:
            result.append(item)
    return result


def evaluate_teaching_script(script_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    对 script_draft.json 执行 v4.4 Teaching QA 六维评分与一票否决核验。
    """
    schema_errors = [
        f"{'.'.join(map(str, err.absolute_path)) or 'root'}: {err.message}"
        for err in SCRIPT_VALIDATOR.iter_errors(script_data)
    ]

    issues: List[str] = list(schema_errors)
    veto_reasons: List[str] = []

    # 六维初始满分
    scores = {
        "plain_comprehensibility": 25,  # 通俗易懂 25
        "knowledge_completeness": 25,   # 知识完整 25
        "term_explanation": 20,         # 术语解释 20
        "pedagogical_logic": 15,        # 教学逻辑 15
        "case_quality": 10,             # 案例质量 10
        "natural_language": 5,          # 语言自然 5
    }

    if schema_errors:
        scores["knowledge_completeness"] = max(0, scores["knowledge_completeness"] - 15)

    steps = script_data.get("concept_steps") if isinstance(script_data.get("concept_steps"), list) else []
    key_terms = script_data.get("key_terms") if isinstance(script_data.get("key_terms"), list) else []
    analogy = script_data.get("analogy") if isinstance(script_data.get("analogy"), dict) else {}
    prereqs = script_data.get("prerequisite_knowledge") if isinstance(script_data.get("prerequisite_knowledge"), list) else []
    u_check = script_data.get("understanding_check") if isinstance(script_data.get("understanding_check"), dict) else {}

    # -------------------------------------------------------------------------
    # 一票否决检查 0: 核心技术事实错误 (factual_errors)
    # -------------------------------------------------------------------------
    if script_data.get("factual_errors"):
        veto_reasons.append(f"一票否决 [核心技术事实错误]: {script_data.get('factual_errors')}")
        issues.append(f"检测到核心技术事实错误: {script_data.get('factual_errors')}")

    # -------------------------------------------------------------------------
    # 维度 1: 通俗易懂 (25 分) & 动态节奏 (180-220 字/分钟)
    # -------------------------------------------------------------------------
    for p in prereqs:
        if any(bad in str(p) for bad in FORBIDDEN_PREREQUISITE_JARGON):
            scores["plain_comprehensibility"] -= 10
            issues.append(f"前置知识包含非零基础专业门槛: '{p}'（必须面向零编程基础普通观众）")

    total_chars = 0
    total_seconds = 0.0
    for idx, step in enumerate(steps):
        if not isinstance(step, dict):
            continue
        narration = str(step.get("narration") or "")
        duration = float(step.get("estimated_duration_seconds") or 0.0)
        units = count_spoken_units(narration)
        total_chars += units
        total_seconds += max(0.1, duration)

        # 检查单句内是否连续堆砌 >= 3 个英文缩写/专业词而无中文解释过渡
        clauses = re.split(r"[，。！？；,.!?]", narration)
        for clause in clauses:
            acronyms_in_clause = re.findall(r"\b[A-Za-z][A-Za-z0-9_-]{2,}\b", clause)
            cjk_in_clause = re.findall(r"[\u4e00-\u9fff]", clause)
            if len(acronyms_in_clause) >= 3 and len(cjk_in_clause) < 8:
                scores["plain_comprehensibility"] -= 8
                scores["term_explanation"] -= 6
                issues.append(
                    f"concept_steps[{idx}] 存在未拆解的术语连续堆砌: '{clause.strip()}'"
                )

    overall_cpm = (total_chars / total_seconds) * 60.0 if total_seconds > 0 else 0.0
    if overall_cpm < 180.0 or overall_cpm > 220.0:
        scores["plain_comprehensibility"] -= 6
        issues.append(
            f"整体口播语速为 {overall_cpm:.1f} 字/分钟，偏离特级教师教学标准区间 (180-220 字/分钟)。"
        )

    # -------------------------------------------------------------------------
    # 维度 2: 知识完整 (25 分) —— 六步教学法与工作原理四要素
    # -------------------------------------------------------------------------
    present_stages = [s.get("pedagogical_stage") for s in steps if isinstance(s, dict)]
    missing_stages = [st for st in REQUIRED_PEDAGOGICAL_STAGES if st not in present_stages]
    if missing_stages:
        scores["knowledge_completeness"] -= min(20, len(missing_stages) * 5)
        issues.append(f"缺少强制六步教学法环节: {missing_stages}")

    mech_steps = [s for s in steps if isinstance(s, dict) and s.get("pedagogical_stage") == "mechanism"]
    if not mech_steps:
        scores["knowledge_completeness"] -= 10
        issues.append("缺少 'mechanism'（工作原理）步骤。")
    else:
        for ms in mech_steps:
            for req_field in ("input_state", "process_detail", "why_designed_this_way", "output_state"):
                if not str(ms.get(req_field) or "").strip():
                    scores["knowledge_completeness"] -= 4
                    scores["pedagogical_logic"] -= 3
                    issues.append(
                        f"工作原理步骤 '{ms.get('title', 'mechanism')}' 缺少 '{req_field}'（必须完整拆解 输入->处理->为什么这样设计->输出）。"
                    )

    if not u_check.get("questions") or not u_check.get("takeaway") or not u_check.get("transfer_scenarios"):
        scores["knowledge_completeness"] -= 5
        issues.append("understanding_check 缺少完整的问题自检、核心总结或迁移场景。")

    # -------------------------------------------------------------------------
    # 维度 3: 术语解释 (20 分) —— 先白话后术语、缩写必展开、一票否决检查
    # -------------------------------------------------------------------------
    declared_terms_map: Dict[str, Dict[str, Any]] = {}
    for kt in key_terms:
        if not isinstance(kt, dict):
            continue
        term_str = str(kt.get("term") or "").strip()
        plain_exp = str(kt.get("plain_first_explanation") or "").strip()
        full_exp = str(kt.get("full_expansion") or "").strip()
        explained_first = kt.get("explained_before_jargon")

        if term_str:
            declared_terms_map[term_str.upper()] = kt

        if explained_first is not True:
            scores["term_explanation"] -= 10
            veto_reasons.append(
                f"一票否决 [关键术语未先白话解释]: 术语 '{term_str}' 的 explained_before_jargon 不为 True"
            )
            issues.append(f"术语 '{term_str}' 未遵循「先用白话解释，再给术语名称」规则。")

        if len(plain_exp) < 8:
            scores["term_explanation"] -= 8
            veto_reasons.append(
                f"一票否决 [关键术语解释过于简略或缺失]: 术语 '{term_str}' 的白话解释过短 ('{plain_exp}')"
            )
            issues.append(f"术语 '{term_str}' 的 plain_first_explanation 过于简略。")

        # 检查是否用未解释的英文缩写去解释另一个术语（用术语解释术语）
        nested_acronyms = extract_acronyms(plain_exp)
        if any(na != term_str.upper() for na in nested_acronyms):
            scores["term_explanation"] -= 8
            veto_reasons.append(
                f"一票否决 [用术语解释术语]: 术语 '{term_str}' 的白话解释中夹杂了其它缩写术语 {nested_acronyms}"
            )
            issues.append(f"禁止用术语解释术语：'{term_str}' 的白话解释中出现了 {nested_acronyms}。")

        if len(full_exp) < 2:
            scores["term_explanation"] -= 5
            issues.append(f"术语 '{term_str}' 缺少完整含义说明 full_expansion。")

    full_narration = "\n".join(str(s.get("narration") or "") for s in steps if isinstance(s, dict))
    narration_acronyms = extract_acronyms(full_narration)
    for acr in narration_acronyms:
        if acr not in declared_terms_map and not any(acr in k for k in declared_terms_map):
            scores["term_explanation"] -= 10
            veto_reasons.append(
                f"一票否决 [英文缩写未解释]: 口播中出现了英文缩写 '{acr}'，但未在 key_terms 中登记并解释含义"
            )
            issues.append(f"口播中出现的英文缩写 '{acr}' 未在 key_terms 中提供白话解释与展开说明。")

    # -------------------------------------------------------------------------
    # 维度 4: 教学逻辑 (15 分) —— 顺序递进、无逻辑跳步
    # -------------------------------------------------------------------------
    stage_order_index = {name: i for i, name in enumerate(REQUIRED_PEDAGOGICAL_STAGES)}
    observed_indices = [
        stage_order_index[s.get("pedagogical_stage")]
        for s in steps
        if isinstance(s, dict) and s.get("pedagogical_stage") in stage_order_index
    ]
    if observed_indices != sorted(observed_indices):
        scores["pedagogical_logic"] -= 8
        issues.append(
            f"教学步骤顺序发生逻辑跳步或倒置: {present_stages}（标准顺序应为 {REQUIRED_PEDAGOGICAL_STAGES}）。"
        )

    for s in mech_steps:
        if count_spoken_units(str(s.get("narration") or "")) < 35:
            scores["pedagogical_logic"] -= 6
            issues.append(
                f"工作原理步骤 '{s.get('title')}' 口播过短，违反「复杂主题禁止压缩在一句话里」规则。"
            )

    # -------------------------------------------------------------------------
    # 维度 5: 案例质量 (10 分) —— 生活类比贴切度 + 类比边界 + 真实源码应用
    # -------------------------------------------------------------------------
    everyday = str(analogy.get("everyday_analogy") or "").strip()
    mapping = str(analogy.get("mapping") or "").strip()
    boundary = str(analogy.get("boundary") or "").strip()

    if len(everyday) < 10 or len(mapping) < 10:
        scores["case_quality"] -= 5
        issues.append("生活类比 everyday_analogy 或 mapping 过于单薄。")

    if len(boundary) < 10:
        scores["case_quality"] -= 6
        veto_reasons.append("一票否决 [生活类比缺少边界说明]: analogy.boundary 缺失或过短，未说明类比与真实技术的区别")
        issues.append("生活类比必须明确指出类比边界 (analogy.boundary)，说明它和真实技术的区别。")

    app_steps = [s for s in steps if isinstance(s, dict) and s.get("pedagogical_stage") == "application"]
    if not app_steps or not any(str(s.get("authentic_code_reference") or "").strip() for s in app_steps):
        scores["case_quality"] -= 4
        veto_reasons.append("一票否决 [实际应用未绑定真实源码]: application 阶段缺少 authentic_code_reference")
        issues.append("实际应用 (application) 步骤必须提供仓库真实源码与功能引用 authentic_code_reference。")

    # -------------------------------------------------------------------------
    # 维度 6: 语言自然 (5 分)
    # -------------------------------------------------------------------------
    if any("1." in str(s.get("narration") or "") or "第一点：" in str(s.get("narration") or "") for s in steps if isinstance(s, dict)):
        scores["natural_language"] -= 2
        issues.append("口播文案存在生硬的列表编号朗读腔，建议使用自然过渡连接词。")

    # 裁剪各维度分数至 >= 0
    for k in scores:
        scores[k] = max(0, int(scores[k]))

    total_score = sum(scores.values())
    passed = (total_score >= 85) and (len(veto_reasons) == 0) and (len(schema_errors) == 0)

    return {
        "qa_version": "4.4.0",
        "status": "APPROVED" if passed else "REJECTED",
        "passed": passed,
        "total_score": total_score,
        "pass_threshold": 85,
        "scores": scores,
        "veto_triggered": len(veto_reasons) > 0,
        "veto_reasons": veto_reasons,
        "speaking_rate_cpm": round(overall_cpm, 1),
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="repo-to-video v4.4 Teaching QA Validator")
    parser.add_argument("--script", required=True, help="script_draft.json 路径")
    parser.add_argument("--out", default=None, help="输出报告 JSON 路径")
    args = parser.parse_args()

    script_path = Path(args.script).resolve()
    if not script_path.exists():
        print(f"[✗] Teaching QA 失败: 未找到文稿文件 {script_path}")
        return 1

    data = json.loads(script_path.read_text(encoding="utf-8"))
    report = evaluate_teaching_script(data)

    if args.out:
        out_path = Path(args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        f"[Teaching QA v4.4] 状态: {report['status']} | 总分: {report['total_score']}/100 "
        f"(通过线 >= {report['pass_threshold']}) | 语速: {report['speaking_rate_cpm']} 字/分钟"
    )
    if report["veto_reasons"]:
        for v in report["veto_reasons"]:
            print(f"  [VETO] {v}")
    if report["issues"]:
        for issue in report["issues"]:
            print(f"  - {issue}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
