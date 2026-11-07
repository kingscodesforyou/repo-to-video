#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_evals.py (v4.2) - Visual Benchmark 自动化验证套件：
1. 遍历 evals/01..05 五个标准视觉基准案例（AI 信息过滤、软件架构、Agent/Skill 工作流、CLI 工具执行、API 调用全过程）
2. 验证每个基准案例通过 validate_storyboard_v4_2、Renderer Registry 严格绑定、结构化让位校验、phrase_anchor 顺序校验与 Schema QA
3. 执行 4 项负向门禁回归测试（未注册 renderer_id 拦截、伪造代码拦截、重复锚点拦截、Semantic QA 签名哈希失效拦截）
4. 输出 evals/benchmark_report.json
"""

import sys
import json
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.resolve()))

from build_video import load_registry_manifest, validate_storyboard_v4_2
from tts_generator import validate_and_locate_phrase_anchors
from visual_qa import (
    run_schema_qa_layer,
    compute_scene_signature_hash,
    generate_semantic_qa_artifacts,
)


def run_negative_regression_tests(manifest: dict) -> list:
    """运行 4 项核心负向回归测试，确保门禁不会漏放任何违规分镜"""
    results = []

    # Test 1: 缺失或未注册的 renderer_id 必须被 Schema QA 拦截
    bad_scene_1 = {
        "id": "neg_01",
        "renderer_id": "non_existent_renderer_v99",
        "narration": "测试口播文案。",
        "visual_intent": "测试意图",
        "art_direction": {"accent_color": "#78A9FF"},
        "visual_world": {"primary_object": "3d_filter_machine", "secondary_objects": ["waste_container"]},
        "visual_choreography": [
            {"beat": "B1", "phrase_anchor": "测试口播文案", "action": "particles_flow", "target": "3d_filter_machine"}
        ],
    }
    r1 = run_schema_qa_layer(bad_scene_1, manifest)
    results.append({
        "test": "reject_unregistered_renderer_id",
        "passed": r1["status"] == "FAIL",
        "details": r1["issues"],
    })

    # Test 2: product_interface_v1 缺失 authentic_assets 必须被拦截
    bad_scene_2 = {
        "id": "neg_02",
        "renderer_id": "product_interface_v1",
        "narration": "展示真实代码视口。",
        "visual_intent": "测试代码展示",
        "art_direction": {"accent_color": "#78A9FF"},
        "visual_world": {
            "primary_object": "authentic_code_viewport",
            "secondary_objects": ["authentic_terminal_bench"],
        },
        "visual_choreography": [
            {"beat": "B1", "phrase_anchor": "展示真实代码视口", "action": "reveal_ui", "target": "authentic_code_viewport"}
        ],
    }
    r2 = run_schema_qa_layer(bad_scene_2, manifest)
    results.append({
        "test": "reject_missing_authentic_assets_in_product_interface",
        "passed": r2["status"] == "FAIL",
        "details": r2["issues"],
    })

    # Test 3: 动作顺序与口播顺序颠倒必须被 validate_and_locate_phrase_anchors 拦截
    caught_order_error = False
    try:
        validate_and_locate_phrase_anchors(
            "neg_03",
            "第一步数据进入，第二步完成提纯。",
            [
                {"beat": "B1", "phrase_anchor": "第二步完成提纯"},
                {"beat": "B2", "phrase_anchor": "第一步数据进入"},
            ],
        )
    except ValueError:
        caught_order_error = True
    results.append({
        "test": "reject_out_of_order_phrase_anchors",
        "passed": caught_order_error,
    })

    # Test 4: 修改分镜内容但保持相同 scene_id 时，Semantic QA 旧审批必须自动失效
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        scene_v1 = {
            "id": "scene_01",
            "renderer_id": "particle_filter_v1",
            "narration": "原始口播版本",
            "visual_intent": "原始意图",
            "visual_choreography": [{"beat": "B1", "phrase_anchor": "原始口播版本", "action": "particles_flow"}],
        }
        sig_v1 = compute_scene_signature_hash(scene_v1, "4.2.0", [])
        # 模拟旧版已通过审批的 checklist
        checklist_path = tmp_dir / "semantic_qa_checklist.json"
        checklist_path.write_text(
            json.dumps({
                "version": "4.2",
                "scenes": [
                    {
                        "scene_id": "scene_01",
                        "scene_signature_hash": sig_v1,
                        "agent_verified": True,
                        "answers": {
                            "blind_comprehension": {"pass": True},
                            "action_fidelity": {"pass": True},
                            "anti_card_check": {"pass": True},
                            "visual_restraint": {"pass": True},
                            "shot_continuity": {"pass": True},
                        },
                    }
                ],
            }),
            encoding="utf-8",
        )
        # 修改分镜文案与动作，但保持 scene_id="scene_01"
        scene_v2 = {
            **scene_v1,
            "narration": "修改后的口播版本",
        }
        sig_v2 = compute_scene_signature_hash(scene_v2, "4.2.0", [])
        sem_res = generate_semantic_qa_artifacts(
            [scene_v2], {"scene_01": sig_v2}, tmp_dir, tmp_dir / "contact_sheet.png"
        )
        results.append({
            "test": "invalidate_semantic_qa_on_scene_content_change",
            "passed": sem_res["status"] == "PENDING_AGENT_REVIEW" and sig_v1 != sig_v2,
            "old_hash": sig_v1,
            "new_hash": sig_v2,
        })

    return results


def main():
    root_dir = Path(__file__).parent.parent.resolve()
    evals_dir = root_dir / "evals"
    manifest = load_registry_manifest()

    eval_files = sorted(evals_dir.glob("0*.json"))
    if not eval_files:
        print("[✗] 未找到 evals/0*.json 基准测试文件！")
        sys.exit(1)

    print(f"=== Running repo-to-video v4.2 Visual Benchmark Suite ({len(eval_files)} cases) ===")
    case_reports = []
    all_passed = True

    for ef in eval_files:
        data = validate_storyboard_v4_2(ef)
        scenes = data.get("scenes", [])
        schema_results = [run_schema_qa_layer(s, manifest) for s in scenes]
        case_ok = all(r["status"] == "PASS" for r in schema_results)
        if not case_ok:
            all_passed = False

        case_reports.append({
            "benchmark": ef.name,
            "video_title": data.get("video_title"),
            "renderer_ids": [s.get("renderer_id") for s in scenes],
            "scenes_count": len(scenes),
            "beats_count": sum(len(s.get("visual_choreography", [])) for s in scenes),
            "status": "PASS" if case_ok else "FAIL",
        })
        print(
            f"  [✓] {ef.name}: {data.get('video_title')} -> Renderers={ [s.get('renderer_id') for s in scenes] }"
        )

    print("\n=== Running 4 Negative Gate Regression Tests ===")
    neg_reports = run_negative_regression_tests(manifest)
    for nr in neg_reports:
        status_str = "PASS" if nr["passed"] else "FAIL"
        print(f"  [{'✓' if nr['passed'] else '✗'}] {nr['test']}: {status_str}")
        if not nr["passed"]:
            all_passed = False

    summary = {
        "version": "4.2",
        "overall_status": "PASS" if all_passed else "FAIL",
        "benchmarks": case_reports,
        "negative_regressions": neg_reports,
    }
    report_out = evals_dir / "benchmark_report.json"
    report_out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[+] Benchmark 报告已写入: {report_out}")

    if not all_passed:
        sys.exit(1)


if __name__ == "__main__":
    main()
