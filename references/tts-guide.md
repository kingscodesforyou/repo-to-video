# 局域网 Index-TTS 与短语级时间锚点指南 (v4)

本技能对接内网 Index-TTS 语音合成服务（内置 Edge-TTS 与静音占位降级），并在 v4 中新增了**短语级/字级时间锚点（Phrase & Beat Timing Anchors）**，用于驱动 `visual_choreography` 物体动作精准卡点。

## 一、 接口规范

- **Endpoint**: `http://192.168.8.106:8712/tts`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "text": "要合成的中文讲解文案",
    "voice": "examples/yali.wav",
    "emo_alpha": 1.0
  }
  ```
  > 默认使用 `yali.wav` 音色，默认通过 `ffmpeg atempo=0.9` 在保持原音调的前提下放慢 10% 语速。

## 二、 短语级与动作节拍时间锚点（v4 新增）

为了让每个镜头的 `visual_choreography` 动作节拍（Beat）精准对应每一句口播，而不是仅靠整个场景的起止时间粗略均分，`scripts/tts_generator.py` 在合成音频后会执行以下对齐计算：

1. **短语切分与声学停顿检测 (`phrase_timings`)**：
   - 将 `narration` 按语义标点或 `narration_phrases` 拆分为短语序列；
   - 解析 WAV PCM 采样振幅包络，检测句间自然停顿（Silence/Pause Valleys），结合发音权重计算每个短语的精确 `[start_sec, end_sec]` 与 `[start_frame, end_frame]`。
2. **动作节拍锚定 (`beat_timings`)**：
   - 遍历 `visual_choreography` 中的每个 `beat`；
   - 若 `beat` 指定了 `phrase_anchor`，自动匹配对应的短语时间窗口，将动作起止帧锚定在该短语区间；
   - 将计算出的 `phrase_timings` 与 `beat_timings` 写入 `durations.json` 和 `build_props.json`，供 Remotion `ChoreographedScene` 组件逐帧精确驱动物体行为与相机运镜。
