#!/usr/bin/env python3
"""Offline evaluation tests. No Node, Chrome, TTS or network is started."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run_evals import (ROOT, RENDER_SETTINGS, build_eval_props, check_frame_inventory,
                       compare_goldens, frame_path, image_metrics, json_hash,
                       make_contact_sheet, make_samples, render_cases, run_command,
                       update_goldens, write_json)


class GoldenComparisonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.current, self.golden = root / "current", root / "golden"
        self.current.mkdir()
        (self.current / "frames").mkdir()
        self.sample = {"frame": 0, "file": "frames/frame_000000.png", "labels": ["scene_01/beat_01/start"]}
        self.manifest = {
            "format_version": 1, "case": "01_test", "samples": [self.sample],
            "contract": {"props_sha256": "fixed", "environment": {"chrome": "test-only"},
                         "render_settings": {**RENDER_SETTINGS, "width": 16, "height": 16}},
        }
        Image.new("RGB", (8, 8), "#123456").save(self.current / self.sample["file"])

    def candidate(self, approved=False):
        update_goldens(self.current, self.golden, self.manifest)
        if approved:
            # Fixture-only approval; production code never writes APPROVED.
            manifest = json.loads((self.golden / "manifest.json").read_text(encoding="utf-8"))
            manifest["approval"] = {"status": "APPROVED", "reviewer": "unit-test-fixture",
                                    "reviewed_at": "2000-01-01T00:00:00Z"}
            write_json(self.golden / "manifest.json", manifest)

    def compare(self):
        return compare_goldens(self.current, self.golden, self.manifest)

    def test_missing_baseline_is_pending_not_pass_and_not_created(self):
        result = self.compare()
        self.assertEqual(result["status"], "BASELINE_MISSING")
        self.assertFalse(self.golden.exists())

    def test_identical_approved_images_pass(self):
        self.candidate(approved=True)
        result = self.compare()
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["frames"][0]["mean_absolute_error"], 0)
        self.assertEqual(result["frames"][0]["changed_pixel_ratio"], 0)

    def test_identical_unapproved_images_stay_pending(self):
        self.candidate()
        self.assertEqual(self.compare()["status"], "BASELINE_PENDING_REVIEW")

    def test_update_revokes_previous_approval_even_if_identical(self):
        self.candidate(approved=True)
        update_goldens(self.current, self.golden, self.manifest)
        self.assertEqual(self.compare()["status"], "BASELINE_PENDING_REVIEW")

    def test_missing_current_frame_fails(self):
        self.candidate(approved=True)
        (self.current / self.sample["file"]).unlink()
        self.assertEqual(self.compare()["status"], "FAIL")

    def test_missing_golden_frame_fails(self):
        self.candidate(approved=True)
        (self.golden / self.sample["file"]).unlink()
        self.assertEqual(self.compare()["status"], "FAIL")

    def test_missing_current_frame_cannot_hide_behind_missing_baseline(self):
        (self.current / self.sample["file"]).unlink()
        self.assertEqual(self.compare()["status"], "FAIL")

    def test_obvious_pixel_change_fails(self):
        self.candidate(approved=True)
        Image.new("RGB", (8, 8), "white").save(self.current / self.sample["file"])
        result = self.compare()
        self.assertEqual(result["status"], "FAIL")
        self.assertEqual(result["frames"][0]["changed_pixel_ratio"], 1.0)

    def test_dimension_change_fails(self):
        self.candidate(approved=True)
        Image.new("RGB", (9, 8), "#123456").save(self.current / self.sample["file"])
        self.assertEqual(self.compare()["status"], "FAIL")

    def test_extra_current_or_golden_frame_fails(self):
        self.candidate(approved=True)
        for directory in (self.current, self.golden):
            extra = directory / "frames" / "frame_000099.png"
            Image.new("RGB", (8, 8)).save(extra)
            self.assertEqual(self.compare()["status"], "FAIL")
            extra.unlink()

    def test_changed_sample_labels_fail_even_when_pixels_match(self):
        self.candidate(approved=True)
        self.manifest["samples"][0]["labels"] = ["different sampling protocol"]
        self.assertEqual(self.compare()["status"], "FAIL")

    def test_changed_props_render_parameters_and_environment_fail(self):
        self.candidate(approved=True)
        original = copy.deepcopy(self.manifest)
        variants = [
            {**original["contract"], "props_sha256": "changed"},
            {**original["contract"], "render_settings": {"fps": 60}},
            {**original["contract"], "environment": {"chrome": "other"}},
        ]
        for contract in variants:
            with self.subTest(contract=contract):
                self.manifest["contract"] = contract
                self.assertEqual(self.compare()["status"], "FAIL")

    def test_corrupt_image_fails(self):
        self.candidate(approved=True)
        (self.current / self.sample["file"]).write_bytes(b"not a PNG")
        self.assertEqual(self.compare()["status"], "FAIL")

    def test_invalid_manifest_and_unsafe_paths_fail(self):
        self.candidate(approved=True)
        (self.golden / "manifest.json").write_text("not JSON", encoding="utf-8")
        self.assertEqual(self.compare()["status"], "FAIL")
        with self.assertRaises(ValueError):
            frame_path(self.current, "../../outside.png")

    def test_tolerance_is_applied(self):
        other = self.current / "near.png"
        Image.new("RGB", (8, 8), "#123457").save(other)
        strict = {"pixel_threshold": 0, "max_mean_absolute_error": 0, "max_changed_pixel_ratio": 0}
        tolerant = {"pixel_threshold": 1, "max_mean_absolute_error": 1, "max_changed_pixel_ratio": 0}
        self.assertEqual(image_metrics(other, self.current / self.sample["file"], strict)["status"], "FAIL")
        self.assertEqual(image_metrics(other, self.current / self.sample["file"], tolerant)["status"], "PASS")

    def test_cannot_update_from_incomplete_or_wrong_size_render(self):
        Image.new("RGB", (7, 8)).save(self.current / self.sample["file"])
        with self.assertRaises(ValueError):
            update_goldens(self.current, self.golden, self.manifest)
        self.assertFalse(self.golden.exists())

    def test_contact_sheet_is_real_image(self):
        make_contact_sheet(self.current, self.manifest["samples"])
        with Image.open(self.current / "contact_sheet.png") as image:
            self.assertEqual(image.size, (960, 234))

    def test_duplicate_sample_fails(self):
        self.manifest["samples"].append(self.sample.copy())
        self.assertTrue(check_frame_inventory(self.current, self.manifest["samples"]))


class PropsAndSamplesTests(unittest.TestCase):
    def test_all_five_cases_preserve_original_fields_and_deterministic_timings(self):
        cases = sorted((ROOT / "evals").glob("0*.json"))
        self.assertEqual(len(cases), 9)
        for case in cases:
            with self.subTest(case=case.name):
                storyboard = json.loads(case.read_text(encoding="utf-8"))
                before = copy.deepcopy(storyboard)
                props = build_eval_props(storyboard)
                self.assertEqual(storyboard, before)
                self.assertEqual(json_hash(props), json_hash(build_eval_props(storyboard)))
                self.assertEqual(props["fps"], 30)
                total = 0
                for source, scene in zip(storyboard["scenes"], props["scenes"]):
                    for key, value in source.items():
                        self.assertEqual(scene[key], value, key)
                    self.assertNotIn("audioUrl", scene)
                    self.assertEqual(scene["phrase_timings"], [])
                    self.assertEqual(scene["word_timings"], [])
                    self.assertEqual(scene["startFrame"], total)
                    self.assertEqual(scene["durationInFrames"], len(scene["visual_choreography"]) * 40)
                    total += scene["durationInFrames"]
                    for bi, timing in enumerate(scene["beat_timings"]):
                        self.assertEqual(timing["start_frame"], bi * 40)
                        self.assertEqual(timing["end_frame"], bi * 40 + 39)
                self.assertEqual(props["totalFrames"], total)
                samples = make_samples(props)
                frames = [s["frame"] for s in samples]
                self.assertEqual(frames, sorted(set(frames)))
                self.assertGreaterEqual(min(frames), 0)
                self.assertEqual(max(frames), total - 1)
                for start in range(0, total, 40):
                    for frame in (start, start + 20, start + 39):
                        self.assertIn(frame, frames)
                    if start:
                        for frame in (start - 1, start, start + 1):
                            self.assertIn(frame, frames)

    def test_samples_include_cross_scene_boundary(self):
        storyboard = json.loads((ROOT / "evals" / "01_ai_info_filter.json").read_text(encoding="utf-8"))
        storyboard["scenes"].append(copy.deepcopy(storyboard["scenes"][0]))
        storyboard["scenes"][1]["id"] = "second_scene"
        props = build_eval_props(storyboard)
        frames = {s["frame"] for s in make_samples(props)}
        boundary = props["scenes"][1]["startFrame"]
        self.assertTrue({boundary - 1, boundary, boundary + 1}.issubset(frames))

    def test_command_failure_is_recorded(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / "command.log"
            result = run_command([sys.executable, "-c", "raise SystemExit(7)"], log)
            self.assertEqual(result["status"], "FAIL")
            self.assertEqual(result["returncode"], 7)
            self.assertTrue(log.is_file())

    def test_stale_render_cannot_be_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            case_dir = output / "01_test"
            write_json(case_dir / "render_result.json", {"status": "PASS", "run_id": "old"})
            job = {"case": "01_test", "output_dir": str(case_dir), "run_id": "new"}
            reports = {"01_test": {"render": {"status": "NOT_RUN"}}}
            args = type("Args", (), {"browser_executable": None, "update_goldens": False})()
            with patch("run_evals.run_command", return_value={"status": "FAIL", "log": "fixture"}):
                render_cases([job], reports, output, args)
            self.assertEqual(reports["01_test"]["render"]["status"], "FAIL")
            self.assertIn("Stale", reports["01_test"]["render"]["error"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
