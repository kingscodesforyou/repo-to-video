#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v4.4 Teaching QA & Master Science Teacher Pedagogy unit tests."""

import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from teaching_qa import evaluate_teaching_script

ROOT = Path(__file__).resolve().parent.parent


class TeachingQATests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads((ROOT / "evals" / "teaching-cases.json").read_text(encoding="utf-8"))
        cls.base_script = cls.fixture["base_passing_script"]

    def test_04_zero_background_comprehension_passes_above_85(self):
        """4. 零基础理解测试：完整六步教学法教案必须 >= 85 分且零一票否决"""
        report = evaluate_teaching_script(copy.deepcopy(self.base_script))
        self.assertTrue(report["passed"], report)
        self.assertGreaterEqual(report["total_score"], 85)
        self.assertFalse(report["veto_triggered"])
        self.assertEqual(report["veto_reasons"], [])

    def test_01_professional_term_explanation_rejects_unexpanded_acronyms_and_jargon_chains(self):
        """1. 专业术语解释测试：未展开的英文缩写或用术语解释术语必须触发一票否决"""
        bad = copy.deepcopy(self.base_script)
        bad["concept_steps"][2]["narration"] = (
            "我们直接调用 eBPF 和 gRPC 实现 Raft 共识，通过 WAL 与 MVCC 提升 QPS。"
        )
        bad["key_terms"][0]["plain_first_explanation"] = (
            "通过 WAL 预写日志与 MVCC 多版本并发控制实现 QPS 限制"
        )
        report = evaluate_teaching_script(bad)
        self.assertFalse(report["passed"])
        self.assertTrue(report["veto_triggered"])
        reasons_text = " | ".join(report["veto_reasons"])
        self.assertIn("英文缩写未解释", reasons_text)
        self.assertIn("用术语解释术语", reasons_text)

    def test_02_everyday_analogy_requires_explicit_boundary(self):
        """2. 生活类比测试：缺少类比适用边界（analogy.boundary）必须触发一票否决"""
        bad = copy.deepcopy(self.base_script)
        bad["analogy"]["boundary"] = "太短"
        report = evaluate_teaching_script(bad)
        self.assertFalse(report["passed"])
        self.assertTrue(report["veto_triggered"])
        reasons_text = " | ".join(report["veto_reasons"])
        self.assertIn("生活类比缺少边界说明", reasons_text)

    def test_03_complex_mechanism_breakdown_requires_input_process_why_output(self):
        """3. 复杂原理解构测试：mechanism 阶段缺失输入/处理/为什么这样设计/输出四要素必须扣分拦截"""
        bad = copy.deepcopy(self.base_script)
        for step in bad["concept_steps"]:
            if step["pedagogical_stage"] == "mechanism":
                step.pop("input_state", None)
                step.pop("process_detail", None)
                step.pop("why_designed_this_way", None)
                step.pop("output_state", None)
        report = evaluate_teaching_script(bad)
        self.assertFalse(report["passed"])
        self.assertLess(report["total_score"], 85)


if __name__ == "__main__":
    unittest.main(verbosity=2)
