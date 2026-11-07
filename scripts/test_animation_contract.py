import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from animation_contract import ROOT, validate_animation_scene
from sync_registry import GENERATED_FILES, sync_registry


class AnimationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = sync_registry(check=True)
        cls.base = json.loads((ROOT / "evals/01_ai_info_filter.json").read_text(encoding="utf-8"))["scenes"][0]

    def test_shared_cases(self):
        cases = json.loads((ROOT / "evals/contract-cases.json").read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case=case["name"]):
                scene = copy.deepcopy(self.base)
                parent = scene
                for key in case["path"][:-1]:
                    parent = parent[key]
                if case.get("delete"):
                    del parent[case["path"][-1]]
                else:
                    parent[case["path"][-1]] = case["value"]
                errors = validate_animation_scene(scene, self.manifest)
                self.assertEqual(not errors, case["valid"], errors)

    def test_five_positive_cases(self):
        for path in sorted((ROOT / "evals").glob("0*.json")):
            for scene in json.loads(path.read_text(encoding="utf-8"))["scenes"]:
                with self.subTest(case=path.name):
                    self.assertEqual(validate_animation_scene(scene, self.manifest), [])

    def test_non_finite_rejected(self):
        for value in (float("nan"), float("inf"), float("-inf")):
            scene = copy.deepcopy(self.base)
            scene["visual_choreography"][0]["yielding"][0]["opacity"] = value
            self.assertTrue(validate_animation_scene(scene, self.manifest))

    def test_hold_is_explicitly_supported(self):
        scene = copy.deepcopy(self.base)
        scene["visual_choreography"][0].update(action="hold", payload={})
        self.assertEqual(validate_animation_scene(scene, self.manifest), [])

    def test_generated_mirror_drift_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            registry_dir = target / "src/registry"
            registry_dir.mkdir(parents=True)
            sync_registry(target)
            sync_registry(target, check=True)
            for generated_name in GENERATED_FILES.values():
                with self.subTest(file=generated_name):
                    file = registry_dir / generated_name
                    file.write_bytes(file.read_bytes() + b" ")
                    with self.assertRaisesRegex(ValueError, "REGISTRY_DRIFT"):
                        sync_registry(target, check=True)
                    sync_registry(target)


if __name__ == "__main__":
    unittest.main()
