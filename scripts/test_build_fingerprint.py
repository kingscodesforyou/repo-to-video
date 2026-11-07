#!/usr/bin/env python3
"""Offline integrity-contract tests, NOT visual or real Remotion approval.

All QA producer tests explicitly stub rendering, contact sheets, schema and image
comparison. PNG fixtures are generated with stdlib; no network / npm is needed.
"""

import copy
import io
import json
import struct
import sys
import tempfile
import unittest
import zlib
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_fingerprint as fp
import visual_qa as qa


def png_bytes(seed=0):
    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))
    rows = b"".join(b"\0" + bytes((seed + row + col) % 256 for col in range(96)) for row in range(32))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 32, 32, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


class BuildFingerprintTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.repo = self.root / "skill"
        self.project = self.root / "actual-remotion"
        self.out = self.root / "qa"
        self.props_path = self.root / "build_props.json"
        self.repo.mkdir()
        (self.project / "src" / "registry").mkdir(parents=True)
        (self.project / "public" / "audio").mkdir(parents=True)
        self.registry = {"registry_version": "test-4.3", "renderers": []}
        self.json(self.repo / "renderer-registry.json", self.registry)
        self.json(self.project / "src/registry/registry_manifest.json", self.registry)
        self.write("src/index.ts", "import './motion';\n")
        self.write("src/motion.ts", "export const speed = 1;\n")
        self.write("package.json", '{"name":"actual-renderer"}')
        self.write("package-lock.json", '{"lockfileVersion":3}')
        self.write("tsconfig.json", '{"compilerOptions":{"strict":true}}')
        self.write("remotion.config.ts", 'export const fps = 30;\n')
        self.write("public/image.png", png_bytes())
        self.write("public/audio/voice.wav", b"audio bytes, not decoded in contract tests")
        self.props = {
            "fps": 30, "totalFrames": 120, "repoUrl": "https://example.invalid/repo",
            "heroSceneId": "s2", "timings": {"subtitle_delay": 1},
            "scenes": [self.scene("s1"), self.scene("s2")],
        }
        self.save_props()
        self.addCleanup(patch.stopall)
        patch.object(fp, "REPO_ROOT", self.repo).start()

    @staticmethod
    def scene(sid):
        return {
            "id": sid, "renderer_id": "test", "title": sid, "durationInFrames": 60,
            "audioUrl": "audio/voice.wav", "imageUrl": "image.png",
            "visual_world": {"authentic_assets": {"code_snippet": "print('real code')"}},
            "visual_choreography": [{"beat": "a", "action": "move"}, {"beat": "b", "action": "hold"}],
            "beat_timings": [{"beat_index": 0, "beat": "a", "start_frame": 0, "end_frame": 30},
                             {"beat_index": 1, "beat": "b", "start_frame": 30, "end_frame": 60}],
        }

    @staticmethod
    def json(path, value):
        path.write_text(json.dumps(value), encoding="utf-8")

    def write(self, name, content):
        path = self.project / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_text(content, encoding="utf-8")
        return path

    def save_props(self):
        self.json(self.props_path, self.props)

    def fingerprint(self):
        return fp.compute_build_fingerprint(self.props_path, self.project)

    @staticmethod
    def fake_render(remotion_dir, composition_id, props_path, frame, out_png):
        out_png.write_bytes(png_bytes(frame))
        return True

    @staticmethod
    def fake_sheet(items, path, **kwargs):
        if not items or any(not qa.verify_png_file(Path(item["image_path"])) for item in items):
            return False
        path.write_bytes(png_bytes(len(items)))
        return True

    def run_qa(self, render_frames=True, mode="full", render=None, diff=3.0, sheet=None):
        with patch.object(qa, "render_still_frame", side_effect=render or self.fake_render) as renderer, \
             patch.object(qa, "build_contact_sheet_image", side_effect=sheet or self.fake_sheet), \
             patch.object(qa, "run_schema_qa_layer", return_value={"status": "PASS", "issues": []}), \
             patch.object(qa, "compute_image_diff_score", return_value=diff), redirect_stdout(io.StringIO()):
            result = qa.run_visual_qa(self.props_path, self.out, mode=mode,
                                     render_frames=render_frames, remotion_dir=self.project)
            if not render_frames:
                renderer.assert_not_called()
            return result

    def approve(self, mode="full"):
        report = self.run_qa(mode=mode)
        self.assertEqual(report["overall_status"], "PENDING_SEMANTIC_QA_REVIEW")
        path = self.out / "semantic_qa_checklist.json"
        data = fp.read_json(path)
        for scene in data["scenes"]:
            scene["agent_verified"] = True
            for answer in scene["answers"].values():
                answer["pass"] = True
        self.json(path, data)
        return self.run_qa(render_frames=False, mode=mode)

    def final(self):
        return fp.validate_final_qa_report(self.out / "visual_qa_report.json", self.props_path, self.project)

    def test_fingerprint_deterministic_complete_and_json_order_independent(self):
        before = self.fingerprint()
        self.assertEqual(before, self.fingerprint())
        for key in ("storyboard_hash", "registry_hash", "renderer_source_hash", "assets_hash", "audio_hash", "composition_hash"):
            self.assertRegex(before[key], r"^[a-f0-9]{64}$")
        self.props_path.write_text(json.dumps(self.props, sort_keys=True, indent=3), encoding="utf-8")
        self.assertEqual(before, self.fingerprint())

    def test_each_file_class_invalidates_its_hash(self):
        cases = {
            "src/motion.ts": "renderer_source_hash",
            "src/extra.tsx": "renderer_source_hash",
            "public/image.png": "assets_hash",
            "public/unreferenced.svg": "assets_hash",
            "public/audio/voice.wav": "audio_hash",
            "public/extra.mp3": "audio_hash",
            "package.json": "config_hash", "package-lock.json": "config_hash",
            "remotion.config.ts": "config_hash", "tsconfig.json": "config_hash",
        }
        for name, key in cases.items():
            with self.subTest(name=name):
                path = self.project / name
                old = path.read_bytes() if path.exists() else None
                before = self.fingerprint()
                content = b"{}" if name.endswith(".json") else b"changed bytes"
                self.write(name, content)
                after = self.fingerprint()
                self.assertNotEqual(before[key], after[key])
                self.assertNotEqual(before["build_hash"], after["build_hash"])
                if old is None:
                    path.unlink()
                else:
                    path.write_bytes(old)

    def test_full_props_including_independent_timings_and_code(self):
        original = copy.deepcopy(self.props)
        mutations = [
            lambda p: p.update(fps=60), lambda p: p.update(totalFrames=121),
            lambda p: p["timings"].update(subtitle_delay=2),
            lambda p: p["scenes"][0].update(durationInFrames=61),
            lambda p: p["scenes"][0].update(debugMode=True),
            lambda p: p["scenes"][0]["beat_timings"][0].update(end_frame=28),
            lambda p: p["scenes"][0]["visual_world"]["authentic_assets"].update(code_snippet="changed()"),
        ]
        before = self.fingerprint()
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                self.props = copy.deepcopy(original)
                mutate(self.props)
                self.save_props()
                after = self.fingerprint()
                self.assertNotEqual(before["storyboard_hash"], after["storyboard_hash"])
                self.assertNotEqual(before["composition_hash"], after["composition_hash"])
                self.assertEqual(before["renderer_source_hash"], after["renderer_source_hash"])

    def test_registry_drift_and_missing_mirror_rejected(self):
        mirror = self.project / "src/registry/registry_manifest.json"
        mirror.write_text(json.dumps(self.registry, indent=2), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "REJECTED_REGISTRY_DRIFT"):
            self.fingerprint()
        mirror.unlink()
        with self.assertRaisesRegex(ValueError, "REJECTED_MISSING_INPUT"):
            self.fingerprint()

    def test_registry_matched_change_updates_hash(self):
        before = self.fingerprint()
        self.registry["registry_version"] = "changed"
        self.json(self.repo / "renderer-registry.json", self.registry)
        self.json(self.project / "src/registry/registry_manifest.json", self.registry)
        self.assertNotEqual(before["registry_hash"], self.fingerprint()["registry_hash"])

    def test_schema_optional_but_must_match_when_present(self):
        before = self.fingerprint()
        self.json(self.repo / "animation-contract.schema.json", {"type": "object"})
        with self.assertRaisesRegex(ValueError, "REJECTED_MISSING_INPUT"):
            self.fingerprint()
        self.json(self.project / "src/registry/animation_contract.schema.json", {"type": "object"})
        after = self.fingerprint()
        self.assertNotEqual(before["schema_hash"], after["schema_hash"])
        self.json(self.project / "src/registry/animation_contract.schema.json", {"type": "array"})
        with self.assertRaisesRegex(ValueError, "REJECTED_SCHEMA_DRIFT"):
            self.fingerprint()

    def test_actual_project_not_fixed_template_or_cwd(self):
        before = self.fingerprint()
        other = self.repo / "templates/src"
        other.mkdir(parents=True)
        (other / "motion.ts").write_text("unrelated", encoding="utf-8")
        with patch.object(Path, "cwd", return_value=self.repo):
            self.assertEqual(before, self.fingerprint())
        (self.project / "src/motion.ts").unlink()
        with self.assertRaisesRegex(ValueError, "REJECTED_MISSING_INPUT"):
            self.fingerprint()

    def test_empty_audio_is_valid(self):
        for scene in self.props["scenes"]:
            scene["audioUrl"] = ""
        (self.project / "public/audio/voice.wav").unlink()
        self.save_props()
        self.assertRegex(self.fingerprint()["audio_hash"], r"^[a-f0-9]{64}$")

    def test_unpinned_remote_missing_and_escape_references_rejected(self):
        for ref in ("https://example.invalid/voice.wav", "//example.invalid/x.wav", "blob:abc",
                    "../outside.wav", "%2e%2e/outside.wav", "audio\\voice.wav", "audio/missing.wav",
                    "file:///C:/voice.wav", "C:/voice.wav"):
            with self.subTest(ref=ref):
                self.props["scenes"][0]["audioUrl"] = ref
                self.save_props()
                with self.assertRaisesRegex(ValueError, "REJECTED_"):
                    self.fingerprint()

    def test_remote_nested_image_and_source_media_rejected(self):
        self.props["scenes"][0]["payload"] = {"image": {"url": "https://example.invalid/img"}}
        self.save_props()
        with self.assertRaisesRegex(ValueError, "REJECTED_REMOTE_ASSET"):
            self.fingerprint()
        del self.props["scenes"][0]["payload"]
        self.save_props()
        for source in ('const x = staticFile("missing.png");',
                       'const x = <Img src="https://example.invalid/img" />;',
                       'import "../../outside.ts";'):
            with self.subTest(source=source):
                self.write("src/motion.ts", source)
                with self.assertRaisesRegex(ValueError, "REJECTED_"):
                    self.fingerprint()

    def test_lockfile_deletion_invalidates_and_nested_config_is_hashed(self):
        before = self.fingerprint()
        (self.project / "package-lock.json").unlink()
        self.assertNotEqual(before["config_hash"], self.fingerprint()["config_hash"])
        self.write("tsconfig.json", '{"extends":"./config/base.json"}')
        self.write("config/base.json", '{"compilerOptions":{"strict":true}}')
        before = self.fingerprint()
        self.write("config/base.json", '{"compilerOptions":{"strict":false}}')
        self.assertNotEqual(before["config_hash"], self.fingerprint()["config_hash"])

    def test_no_legacy_signature_field_projection_or_missing_png_skip(self):
        scene = self.props["scenes"][0]
        before = qa.compute_scene_signature_hash(scene, "v1", [])
        changed = dict(scene, durationInFrames=61)
        self.assertNotEqual(before, qa.compute_scene_signature_hash(changed, "v1", []))
        with self.assertRaisesRegex(ValueError, "REJECTED_RENDER_FAILURE"):
            qa.compute_scene_signature_hash(scene, "v1", [self.root / "missing.png"])
        self.assertNotEqual(before, qa.compute_scene_signature_hash(scene, "v1", [], self.fingerprint()))

    def test_pending_then_manual_review_reuses_frames_and_passes_contract(self):
        report = self.approve()
        self.assertEqual(report["overall_status"], "APPROVED")
        self.assertEqual(self.final(), self.fingerprint())
        self.assertEqual(report["build_fingerprint"], self.fingerprint())
        self.assertEqual(report["scope"], "full")
        self.assertTrue(any(frame["kind"] == "continuous" for frame in report["scenes"][0]["frames"]))
        copied = self.props_path.parent / "visual_qa_report.json"
        self.assertEqual(fp.validate_final_qa_report(copied, self.props_path, self.project), self.fingerprint())

    def test_sample_report_cannot_approve_full_and_keeps_real_offset(self):
        report = self.approve(mode="first-shot")
        self.assertEqual(report["scope"], "sample")
        self.assertEqual([s["scene_id"] for s in report["scenes"]], ["s2"])
        self.assertTrue(all(frame["frame"] >= 60 for frame in report["scenes"][0]["frames"]))
        with self.assertRaisesRegex(ValueError, "REJECTED_STALE_QA_REPORT"):
            self.final()

    def test_report_missing_extra_duplicate_scene_and_fingerprint_layer_fail(self):
        pristine = self.approve()
        path = self.out / "visual_qa_report.json"
        changes = [
            lambda r: r.pop("build_fingerprint"),
            lambda r: r["build_fingerprint"].pop("audio_hash"),
            lambda r: r["build_fingerprint"].update(extra="unexpected"),
            lambda r: r["scenes"].pop(),
            lambda r: r["scenes"].append(dict(r["scenes"][0], scene_id="extra")),
            lambda r: r["scenes"].append(r["scenes"][0]),
            lambda r: r.pop("layers"),
            lambda r: r.update(overall_status="PENDING_SEMANTIC_QA_REVIEW"),
            lambda r: r["scenes"][0].update(status="FAIL"),
            lambda r: r["scenes"][0].update(scene_signature_hash="old"),
            lambda r: r["scenes"][0]["frames"].pop(),
            lambda r: r.pop("artifact_hashes"),
        ]
        for layer in fp.QA_LAYERS:
            changes += [lambda r, layer=layer: r["layers"].pop(layer),
                        lambda r, layer=layer: r["layers"].update({layer: True})]
        for change in changes:
            with self.subTest(change=change):
                report = copy.deepcopy(pristine)
                change(report)
                self.json(path, report)
                with self.assertRaisesRegex(ValueError, "REJECTED_STALE_QA_REPORT"):
                    self.final()

    def test_checklist_missing_scene_signature_or_real_booleans_rejected(self):
        self.approve()
        path = self.out / "semantic_qa_checklist.json"
        pristine = fp.read_json(path)
        changes = [
            lambda c: c.pop("build_fingerprint"), lambda c: c.update(all_verified="true"),
            lambda c: c["scenes"].pop(), lambda c: c["scenes"].append(c["scenes"][0]),
            lambda c: c["scenes"].append(dict(c["scenes"][0], scene_id="extra")),
            lambda c: c["scenes"][0].pop("agent_verified"),
            lambda c: c["scenes"][0].update(agent_verified="true"),
            lambda c: c["scenes"][0].update(agent_verified=1),
            lambda c: c["scenes"][0].update(scene_signature_hash="wrong"),
            lambda c: c["scenes"][0]["answers"].pop("action_fidelity"),
            lambda c: c["scenes"][0]["answers"]["action_fidelity"].update({"pass": "true"}),
            lambda c: c["scenes"][0]["answers"]["action_fidelity"].update({"pass": 1}),
            lambda c: c["scenes"][0]["answers"]["action_fidelity"].update({"pass": False}),
        ]
        for change in changes:
            with self.subTest(change=change):
                checklist = copy.deepcopy(pristine)
                change(checklist)
                self.json(path, checklist)
                with self.assertRaisesRegex(ValueError, "REJECTED_STALE_QA_REPORT"):
                    self.final()
        path.unlink()
        with self.assertRaisesRegex(ValueError, "REJECTED_STALE_QA_REPORT"):
            self.final()

    def test_no_render_without_existing_report_rejected(self):
        with self.assertRaisesRegex(ValueError, "REJECTED_STALE_QA_CACHE"):
            self.run_qa(render_frames=False)

    def test_no_render_rejects_stale_source_and_does_not_rebind_old_approval(self):
        self.approve()
        old = (self.out / "semantic_qa_checklist.json").read_bytes()
        self.write("src/motion.ts", "export const speed = 2;")
        with self.assertRaisesRegex(ValueError, "REJECTED_STALE_QA_CACHE"):
            self.run_qa(render_frames=False)
        self.assertEqual(old, (self.out / "semantic_qa_checklist.json").read_bytes())
        report = self.run_qa()
        self.assertEqual(report["overall_status"], "PENDING_SEMANTIC_QA_REVIEW")

    def test_no_render_rejects_changed_missing_key_continuous_and_sheet_files(self):
        pristine = self.approve()
        paths = [Path(f["image_path"]) for f in pristine["scenes"][0]["frames"] if f["kind"] == "continuous"][:1]
        paths += [Path(pristine["scenes"][0]["frames"][0]["image_path"]),
                  self.out / "continuous_s1.png", self.out / "contact_sheet.png"]
        for path in paths:
            original = path.read_bytes()
            for change in (lambda: path.write_bytes(png_bytes(211)), path.unlink):
                with self.subTest(path=path, change=change):
                    change()
                    with self.assertRaisesRegex(ValueError, "REJECTED_STALE_QA_CACHE"):
                        self.run_qa(render_frames=False)
                    with self.assertRaisesRegex(ValueError, "REJECTED_STALE_QA_REPORT"):
                        self.final()
                    path.write_bytes(original)

    def test_frame_signatures_bind_continuous_frame_bytes(self):
        report = self.run_qa()
        row = report["scenes"][0]
        frame = next(frame for frame in row["frames"] if frame["kind"] == "continuous")
        Path(frame["image_path"]).write_bytes(png_bytes(201))
        # Even replacing the manifest's file hash cannot preserve scene approval.
        frame["sha256"] = fp.file_sha256(frame["image_path"])
        self.json(self.out / "visual_qa_report.json", report)
        with self.assertRaisesRegex(ValueError, "Scene signature mismatch"):
            self.run_qa(render_frames=False)

    def test_no_render_rejects_scope_frame_plan_and_legacy_cache(self):
        pristine = self.run_qa()
        for change in (lambda r: r.update(mode="first-shot"), lambda r: r.pop("build_fingerprint"),
                       lambda r: r["scenes"][0]["frames"][0].update(frame=42),
                       lambda r: r["layers"].update(render_qa="FAIL")):
            report = copy.deepcopy(pristine)
            change(report)
            self.json(self.out / "visual_qa_report.json", report)
            with self.assertRaisesRegex(ValueError, "REJECTED_STALE_QA_CACHE"):
                self.run_qa(render_frames=False)

    def test_build_mutation_during_render_is_rejected(self):
        def render(*args):
            self.write("src/motion.ts", "export const speed = 99;")
            return self.fake_render(*args)
        with self.assertRaisesRegex(ValueError, "REJECTED_BUILD_CHANGED_DURING_QA"):
            self.run_qa(render=render)
        self.assertFalse((self.out / "visual_qa_report.json").exists())

    def test_missing_png_or_failed_comparison_is_fail_not_skip(self):
        report = self.run_qa(render=lambda *args: True)
        self.assertEqual(report["overall_status"], "REJECTED_RENDER_FAILURE")
        self.assertEqual(report["layers"]["render_qa"], "FAIL")
        for score in (-1, float("nan")):
            report = self.run_qa(diff=score)
            self.assertEqual(report["layers"]["motion_qa"], "FAIL")
            self.assertNotEqual(report["overall_status"], "APPROVED")

    def test_renderer_false_cannot_reuse_existing_good_png(self):
        self.run_qa()
        report = self.run_qa(render=lambda *args: False)
        self.assertEqual(report["layers"]["render_qa"], "FAIL")

    def test_hold_is_intentionally_static_but_move_is_not(self):
        for scene in self.props["scenes"]:
            for beat in scene["visual_choreography"]:
                beat["action"] = "hold"
        self.save_props()
        report = self.run_qa(diff=0.0)
        self.assertEqual(report["layers"]["motion_qa"], "PASS")
        self.props["scenes"][0]["visual_choreography"][0]["action"] = "move"
        self.save_props()
        report = self.run_qa(diff=0.0)
        self.assertEqual(report["layers"]["motion_qa"], "FAIL")

    def test_invalid_png_and_unavailable_image_decoder_fail_closed(self):
        good = self.root / "valid.png"
        good.write_bytes(png_bytes())
        self.assertTrue(qa.verify_png_file(good))
        bad = self.root / "bad.png"
        bad.write_bytes(b"\x89PNG\r\n\x1a\n" + b"x" * 1024)
        self.assertFalse(qa.verify_png_file(bad))
        self.assertEqual(qa.compute_image_diff_score(good, bad), -1)
        with patch.dict(sys.modules, {"PIL": None}):
            self.assertEqual(qa.compute_image_diff_score(good, good), -1)

    def test_invalid_json_duplicates_and_non_finite_props_rejected(self):
        for text in ('{"fps":30,"fps":60}', '{"fps":NaN}', '[]'):
            self.props_path.write_text(text, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "REJECTED_"):
                self.fingerprint()

    def test_duplicate_or_unsafe_current_scene_ids_rejected(self):
        for sid in ("s1", "../escape", "a/b"):
            self.props["scenes"][1]["id"] = sid
            self.save_props()
            with self.assertRaisesRegex(ValueError, "REJECTED_INVALID_PROPS"):
                self.run_qa()

    def test_legacy_three_argument_signature_semantic_helper_compatibility(self):
        scene = self.props["scenes"][0]
        signature = qa.compute_scene_signature_hash(scene, "4.2", [])
        self.out.mkdir()
        self.json(self.out / "semantic_qa_checklist.json", {"scenes": [{
            "scene_id": scene["id"], "scene_signature_hash": signature, "agent_verified": True,
            "answers": {q["id"]: {"pass": True} for q in qa.MANDATORY_SEMANTIC_QUESTIONS},
        }]})
        result = qa.generate_semantic_qa_artifacts([scene], {scene["id"]: "changed"}, self.out, self.out / "sheet.png")
        self.assertEqual(result["status"], "PENDING_AGENT_REVIEW")


if __name__ == "__main__":
    unittest.main()
