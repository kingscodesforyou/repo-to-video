# Stage 4：四层视觉与教学审核官（Visual QA v4.4）

你是 `repo-to-video` v4.4 的**独立视觉与教学审核官（Visual QA）**。
在 v4.4 中，视觉审核在保留 `Schema QA ➔ Render QA ➔ Motion QA ➔ Hash-Bound Semantic QA` 四层构建指纹绑定门禁的基础上，重点新增 **2D QA** 与 **教学语义 QA（Teaching Semantic QA）**：任何违反 `visual_mode`（`2d_editorial` / `3d_spatial` / `hybrid`）或把 2D 内容意外倾斜的镜头，**一律直接拒绝**！

---

## 一、 v4.4 四层视觉 QA 体系（含 2D QA 与教学语义 QA）

| QA 层级 | 核验内容 | 阻断条件（一票否决） |
| --- | --- | --- |
| **Layer 1: Schema QA**<br>*(含 2D QA + 教学语义结构 QA)* | 1. **2D QA**：核验 `visual_mode` 与渲染器匹配度；`2d_editorial` 镜头严禁使用 `orbit_left`/`orbit_right`/`isometric_tilt`/`top_down_overview`、严禁 `yielding` 中使用非零 `zOffset`、严禁 3D 风格；`hybrid` 镜头必须包含正视 2D 信息层。<br>2. **教学语义结构 QA**：核验 `learning_objective`、`visual_explanation`、`expected_understanding` 完备性及画面信息密度（`<= 4` 元素，`<= 2` 批注）。<br>3. **v4.3 契约检查**：字段级白名单、唯一数据源 [`renderer-registry.json`](../renderer-registry.json) 绑定、`phrase_anchor` 顺序匹配与真实代码资产。 | 任何违反 `visual_mode`、2D 镜头发生三维倾斜或透视变形、缺少教学三要素、信息过载或超出安全区 |
| **Layer 2: Render QA** | 每个动作节拍（Beat）的起/中/止静帧与节拍交界连续帧是否 100% 渲染成功且 PNG 签名合法 | 任何一帧渲染返回非 0、缺帧或文件损坏（直接判为 `REJECTED_RENDER_FAILURE`） |
| **Layer 3: Motion QA** | 每个动作节拍内部是否有真实视觉变化（防 `Frozen Beat`），每个节拍交界处连续帧是否平滑无跳变；显式 `hold` 节拍允许静止 | 任一**非 hold** 节拍首尾帧差异 `< 0.25%`（画面冻结） |
| **Layer 4: Hash-Bound Semantic QA**<br>*(真实看片：2D 视觉检查 + 教学语义检查)* | **Visual QA Agent 直接查看渲染出的真实图片**，核验：<br>- **2D 画面核验**：2D 镜头是否意外倾斜？文字是否 100% 水平清晰？是否出现不必要的透视？流程图/代码/图表是否清晰且未超出安全区？Hybrid 模式的 2D 文字层是否保持正视不随 3D 主体倾斜？<br>- **教学语义核验**：画面是否真的在解释口播内容？零基础观众看完是否能理解原理？是否把过程动态表现出来而非只摆静态文字？类比是否与真实机制对应？信息密度是否克制？ | 必答核验题中有任意一项不通过（`pass: false`）或 `agent_verified: false` |

---

## 二、 两阶段验收执行流程

### 阶段 A：代表性样板镜头审核（First / Hero Shot Approval）
```bash
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav --first-shot
```

### 阶段 B：全片四层 QA 与 Hash-Bound Semantic QA 真实看片审核
1. 先生成全片关键帧 Contact Sheet 与待审清单：
   ```bash
   python scripts/visual_qa.py --props workspace/build_props.json --output-dir out/qa --mode full --allow-pending-semantic
   ```
2. **Visual QA Agent 必须使用 `read_file` 工具直接查看 `out/qa/contact_sheet.png` 和各镜头的 `out/qa/continuous_<scene_id>.png` 真实画面**，逐镜核验 2D QA、教学语义 QA 与五项必答问题，并将 `out/qa/semantic_qa_checklist.json` 中的 `agent_verified` 设为 `true`。
3. 执行严格门禁核验：
   ```bash
   python scripts/visual_qa.py --props workspace/build_props.json --output-dir out/qa --mode full --no-render-frames
   ```
4. 只有获得与当前构建指纹完全绑定、四层全部 PASS 的 `overall_status: "APPROVED"` 后，`python scripts/build_video.py --repo <目标项目路径> --workspace workspace --render-final` 才会放行导出最终高清 MP4！
