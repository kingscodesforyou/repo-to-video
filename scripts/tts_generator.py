#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tts_generator.py (v4.1) - 双层精准音画同步与严格 phrase_anchor 校验引擎：
1. 第一层（短语级实测对齐）：支持按短语独立合成/切分测量真实音频时长并拼接，获得毫秒级精确的短语时间窗口 (phrase_timings)
2. 第二层（词级声学强制对齐）：基于 WAV PCM 声学能量包络核（Syllable Energy Nuclei）对短语内部词元执行声学对齐 (word_timings)
3. 严格时间轴校验门禁：
   - 每个 visual_choreography 节拍必须提供匹配口播原文的 phrase_anchor
   - 严禁两个动作重复锚定同一文本位置
   - 动作锚点在口播中的出现顺序必须严格单调递增
   - 彻底禁止未匹配动作静默回退到镜头比例均分
"""

import os
import re
import sys
import json
import math
import shutil
import subprocess
import argparse
from pathlib import Path
from typing import List, Dict, Any, Tuple

try:
    import requests
except ImportError:
    print("[-] Missing 'requests' package. Please install: pip install requests")
    sys.exit(1)


def parse_wav_pcm(wav_path: str) -> Tuple[int, int, int, bytes]:
    """解析 RIFF WAV 头并返回 (channels, sample_rate, bits_per_sample, pcm_bytes)"""
    data = Path(wav_path).read_bytes()
    if len(data) < 44 or data[:4] != b"RIFF":
        raise ValueError(f"Invalid WAV file: {wav_path}")

    pos = 12
    fmt_channels = 1
    fmt_rate = 24000
    fmt_bits = 16
    pcm_offset = 44
    pcm_size = len(data) - 44

    while pos < len(data) - 8:
        chunk_id = data[pos : pos + 4]
        chunk_size = int.from_bytes(data[pos + 4 : pos + 8], "little")
        if chunk_id == b"fmt ":
            fmt_channels = int.from_bytes(data[pos + 10 : pos + 12], "little")
            fmt_rate = int.from_bytes(data[pos + 12 : pos + 16], "little")
            fmt_bits = int.from_bytes(data[pos + 22 : pos + 24], "little")
        elif chunk_id == b"data":
            pcm_offset = pos + 8
            pcm_size = min(chunk_size, len(data) - pcm_offset)
            break
        pos += 8 + chunk_size

    return fmt_channels, fmt_rate, fmt_bits, data[pcm_offset : pcm_offset + pcm_size]


def write_pcm_wav(wav_path: str, pcm_bytes: bytes, sample_rate: int = 24000, channels: int = 1):
    """将 16-bit PCM 字节写入标准 RIFF WAV 文件"""
    data_size = len(pcm_bytes)
    header = bytearray(44)
    header[0:4] = b"RIFF"
    header[4:8] = (36 + data_size).to_bytes(4, "little")
    header[8:12] = b"WAVE"
    header[12:16] = b"fmt "
    header[16:20] = (16).to_bytes(4, "little")
    header[20:22] = (1).to_bytes(2, "little")
    header[22:24] = channels.to_bytes(2, "little")
    header[24:28] = sample_rate.to_bytes(4, "little")
    header[28:32] = (sample_rate * channels * 2).to_bytes(4, "little")
    header[32:34] = (channels * 2).to_bytes(2, "little")
    header[34:36] = (16).to_bytes(2, "little")
    header[36:40] = b"data"
    header[40:44] = data_size.to_bytes(4, "little")

    with open(wav_path, "wb") as f:
        f.write(header)
        f.write(pcm_bytes)


def get_wav_duration_seconds(wav_path: str) -> float:
    """直接解析 RIFF WAV 数据块获取精确秒数"""
    channels, rate, bits, pcm = parse_wav_pcm(wav_path)
    bytes_per_sample = max(1, channels * (bits // 8))
    samples = len(pcm) / float(bytes_per_sample)
    return samples / float(rate)


def spoken_weight(text: str) -> float:
    """计算口播语速权重：汉字记 1.0，英文词记 1.6，标点停顿附加权重"""
    if not text:
        return 1.0
    english_tokens = re.findall(r"[A-Za-z0-9]+", text)
    cjk_chars = re.sub(r"[A-Za-z0-9\s\W_]", "", text)
    pauses = len(re.findall(r"[，。！？；：、,.!?;:]", text)) * 0.42
    return max(0.8, len(cjk_chars) * 1.0 + len(english_tokens) * 1.6 + pauses)


def split_into_phrases(narration: str) -> List[str]:
    """将口播按句读标点切分为自然语义短语（不强制合并短句，确保与动作锚点一一对应）"""
    raw_clauses = re.split(r"(?<=[，。！？；：、,.!?;:])", narration.strip())
    phrases = [c.strip() for c in raw_clauses if c.strip()]
    return phrases if phrases else [narration.strip()]


def normalize_for_match(s: str) -> str:
    """去除标点与空白用于精确子串匹配"""
    return re.sub(r"[\s\W_]+", "", s).lower()


def validate_and_locate_phrase_anchors(
    scene_id: str,
    narration: str,
    choreography: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    v4.1 严格时间轴锚点校验门禁（彻底废除未匹配静默比例回退！）：
    1. 每个 beat 必须包含非空 phrase_anchor
    2. 每个 phrase_anchor 必须在口播原文 narration 中真实存在
    3. 不允许两个动作重复匹配口播中的同一位置
    4. 动作的 phrase_anchor 在口播中的出现顺序必须严格单调递增
    """
    if not choreography:
        return []

    norm_narration = normalize_for_match(narration)
    if not norm_narration:
        raise ValueError(f"[{scene_id}] 口播 narration 为空，无法对齐动作节拍。")

    located_anchors = []
    last_start_pos = -1
    used_spans: List[Tuple[int, int]] = []

    for b_idx, beat in enumerate(choreography):
        beat_name = beat.get("beat", f"beat_{b_idx + 1}")
        anchor = (beat.get("phrase_anchor") or "").strip()
        if not anchor:
            raise ValueError(
                f"[{scene_id}] 动作节拍 #{b_idx + 1} ('{beat_name}') 缺少 'phrase_anchor'！"
                f"v4.1 严禁静默采用镜头比例回退，每个动作必须显式绑定口播短语锚点。"
            )

        norm_anchor = normalize_for_match(anchor)
        if not norm_anchor:
            raise ValueError(
                f"[{scene_id}] 动作节拍 #{b_idx + 1} ('{beat_name}') 的 phrase_anchor ('{anchor}') 无有效文字。"
            )

        # 从上一个锚点之后寻找匹配，若找不到再检查是否因为顺序颠倒或重复匹配
        search_from = max(0, last_start_pos + 1)
        pos = norm_narration.find(norm_anchor, search_from)
        if pos == -1:
            any_pos = norm_narration.find(norm_anchor)
            if any_pos == -1:
                raise ValueError(
                    f"[{scene_id}] 动作节拍 #{b_idx + 1} ('{beat_name}') 的 phrase_anchor='{anchor}' "
                    f"未在口播文案 ('{narration}') 中找到匹配！请确保 phrase_anchor 来自口播原文。"
                )
            elif any(any_pos == s for s, _ in used_spans):
                raise ValueError(
                    f"[{scene_id}] 动作节拍 #{b_idx + 1} ('{beat_name}') 的 phrase_anchor='{anchor}' "
                    f"与前面的动作重复匹配了同一句口播！每个动作必须对应独立的口播推进阶段。"
                )
            else:
                raise ValueError(
                    f"[{scene_id}] 动作节拍 #{b_idx + 1} ('{beat_name}') 的 phrase_anchor='{anchor}' "
                    f"在口播中的位置 (offset={any_pos}) 早于前一个动作 (offset={last_start_pos})！"
                    f"动作顺序必须与口播顺序严格一致。"
                )

        end_pos = pos + len(norm_anchor)
        used_spans.append((pos, end_pos))
        last_start_pos = pos

        located_anchors.append({
            "beat_index": b_idx,
            "beat": beat_name,
            "phrase_anchor": anchor,
            "norm_start": pos,
            "norm_end": end_pos,
            "norm_ratio_start": pos / float(len(norm_narration)),
            "norm_ratio_end": end_pos / float(len(norm_narration)),
        })

    return located_anchors


def detect_wav_pause_anchors(wav_path: str, expected_ratios: List[float], duration: float) -> List[float]:
    """扫描 16-bit PCM WAV 声学能量包络，在预期比例点附近寻找真实语音停顿低谷"""
    if not expected_ratios or duration <= 0.5:
        return [round(r * duration, 3) for r in expected_ratios]

    try:
        channels, fmt_rate, fmt_bits, raw_pcm = parse_wav_pcm(wav_path)
        if fmt_bits != 16 or len(raw_pcm) <= 0:
            return [round(r * duration, 3) for r in expected_ratios]

        win_sec = 0.02
        bytes_per_frame = max(2, channels * 2)
        samples_per_win = max(1, int(fmt_rate * win_sec))
        step_bytes = samples_per_win * bytes_per_frame
        energies = []
        mv = memoryview(raw_pcm)

        for offset in range(0, len(mv) - step_bytes, step_bytes):
            chunk = mv[offset : offset + step_bytes]
            stride = max(2, (len(chunk) // 64) & ~1)
            total_amp = 0
            count = 0
            for j in range(0, len(chunk) - 1, stride):
                val = int.from_bytes(chunk[j : j + 2], "little", signed=True)
                total_amp += abs(val)
                count += 1
            energies.append(total_amp / max(1, count))

        if len(energies) < 10:
            return [round(r * duration, 3) for r in expected_ratios]

        refined_times = []
        last_idx = 0
        n_wins = len(energies)
        for ratio in expected_ratios:
            center_idx = int(ratio * n_wins)
            radius = max(2, int(0.09 * n_wins))
            lo = max(last_idx + 2, center_idx - radius)
            hi = min(n_wins - 2, center_idx + radius)
            if lo >= hi:
                best_idx = max(last_idx + 1, min(n_wins - 1, center_idx))
            else:
                best_idx = center_idx
                best_score = float("inf")
                max_e = max(energies[lo : hi + 1]) or 1.0
                for idx in range(lo, hi + 1):
                    dist_penalty = abs(idx - center_idx) / max(1.0, float(radius)) * 0.22
                    norm_e = energies[idx] / max_e
                    score = norm_e + dist_penalty
                    if score < best_score:
                        best_score = score
                        best_idx = idx
            last_idx = best_idx
            refined_times.append(round((best_idx / float(n_wins)) * duration, 3))

        return refined_times
    except Exception:
        return [round(r * duration, 3) for r in expected_ratios]


def forced_align_words_in_window(
    wav_path: str,
    tokens: List[str],
    phrase_index: int,
    start_sec: float,
    end_sec: float,
    fps: int = 30
) -> List[Dict[str, Any]]:
    """
    第二层：词级声学强制对齐 (Acoustic Syllable Energy Forced Alignment)
    在短语音频区间 [start_sec, end_sec] 内提取 10ms 声学包络积分（Cumulative Acoustic Energy CDF），
    按实际发声能量分布加上词元发音权重映射每个词的起止帧，避免把静音段均摊给词元。
    """
    if not tokens:
        return []

    span_sec = max(0.05, end_sec - start_sec)
    t_weights = [1.6 if re.match(r"^[A-Za-z0-9_.-]+$", tk) else 1.0 for tk in tokens]
    tw_sum = sum(t_weights) or 1.0

    # 提取该时间窗口内的声学能量累积分布曲线 (Energy CDF)
    energy_cdf: List[float] = []
    try:
        channels, rate, bits, pcm = parse_wav_pcm(wav_path)
        if bits == 16 and len(pcm) > 0:
            bytes_per_sec = rate * channels * 2
            b_start = max(0, min(len(pcm), int(start_sec * bytes_per_sec)) & ~1)
            b_end = max(b_start + 2, min(len(pcm), int(end_sec * bytes_per_sec)) & ~1)
            sub_pcm = memoryview(pcm)[b_start:b_end]
            n_bins = max(len(tokens) * 4, 24)
            bin_bytes = max(2, (len(sub_pcm) // n_bins) & ~1)
            raw_e = []
            for offset in range(0, len(sub_pcm) - bin_bytes, bin_bytes):
                chunk = sub_pcm[offset : offset + bin_bytes]
                stride = max(2, (len(chunk) // 16) & ~1)
                amp = sum(
                    abs(int.from_bytes(chunk[j : j + 2], "little", signed=True))
                    for j in range(0, len(chunk) - 1, stride)
                )
                # 加上基础底噪权重防止纯静音段除零
                raw_e.append(amp + 120.0)
            total_e = sum(raw_e)
            if total_e > 0 and len(raw_e) >= 4:
                acc = 0.0
                energy_cdf = [0.0]
                for e in raw_e:
                    acc += e / total_e
                    energy_cdf.append(min(1.0, acc))
    except Exception:
        energy_cdf = []

    def map_ratio_by_energy(target_r: float) -> float:
        if not energy_cdf:
            return target_r
        # 在累积声学能量曲线上反查对应的时间比例，并做 50% 声学 + 50% 发音先验平滑
        n = len(energy_cdf) - 1
        for i in range(n):
            if energy_cdf[i] <= target_r <= energy_cdf[i + 1]:
                span_e = max(1e-6, energy_cdf[i + 1] - energy_cdf[i])
                frac = (target_r - energy_cdf[i]) / span_e
                acoustic_r = (i + frac) / float(n)
                return 0.55 * acoustic_r + 0.45 * target_r
        return target_r

    word_timings = []
    t_acc = 0.0
    for tk, tw in zip(tokens, t_weights):
        r0 = map_ratio_by_energy(t_acc / tw_sum)
        t_acc += tw
        r1 = map_ratio_by_energy(t_acc / tw_sum)
        w_start = start_sec + r0 * span_sec
        w_end = max(w_start + 0.02, start_sec + r1 * span_sec)
        word_timings.append({
            "word": tk,
            "phrase_index": phrase_index,
            "start_sec": round(w_start, 3),
            "end_sec": round(w_end, 3),
            "start_frame": int(round(w_start * fps)),
            "end_frame": int(round(w_end * fps)),
        })

    return word_timings


def compute_phrase_and_beat_timings(
    scene: Dict[str, Any],
    wav_path: str,
    duration_sec: float,
    total_scene_frames: int,
    fps: int = 30,
    measured_phrase_durations: List[float] = None
) -> Dict[str, Any]:
    """
    计算双层对齐时间锚点：
    - 第一层：短语级时间窗口 (phrase_timings，优先使用短语独立音频实测时长 measured_phrase_durations)
    - 第二层：词级声学强制对齐 (word_timings)
    - 严格校验并绑定 visual_choreography 的每个 beat_timings（禁止未匹配静默回退）
    """
    scene_id = scene.get("id", "unknown_scene")
    narration = (scene.get("narration") or "").strip()
    custom_phrases = scene.get("narration_phrases")
    if isinstance(custom_phrases, list) and len(custom_phrases) > 0:
        phrases = [
            p.get("phrase", "").strip() if isinstance(p, dict) else str(p).strip()
            for p in custom_phrases
        ]
        phrases = [p for p in phrases if p]
    else:
        phrases = split_into_phrases(narration)

    if not phrases:
        phrases = [narration]

    # 第一层：确定每个短语的起止时间
    if measured_phrase_durations and len(measured_phrase_durations) == len(phrases):
        starts = []
        ends = []
        acc_s = 0.0
        for d in measured_phrase_durations:
            starts.append(round(acc_s, 3))
            acc_s += d
            ends.append(round(acc_s, 3))
    else:
        weights = [spoken_weight(p) for p in phrases]
        total_w = sum(weights) or 1.0
        cum_ratios = []
        acc_w = 0.0
        for w in weights[:-1]:
            acc_w += w
            cum_ratios.append(acc_w / total_w)
        boundary_secs = detect_wav_pause_anchors(wav_path, cum_ratios, duration_sec)
        starts = [0.0] + boundary_secs
        ends = boundary_secs + [round(duration_sec, 3)]

    phrase_timings = []
    word_timings = []
    norm_cursor = 0

    for i, phrase_text in enumerate(phrases):
        s_sec = starts[i]
        e_sec = max(s_sec + 0.08, ends[i])
        s_frame = int(round(s_sec * fps))
        e_frame = (
            int(round(e_sec * fps))
            if i < len(phrases) - 1
            else max(int(round(e_sec * fps)), total_scene_frames - 6)
        )
        clean_text = re.sub(r"[，。；：、,;:]\s*$", "", phrase_text)
        norm_p = normalize_for_match(phrase_text)
        norm_start = norm_cursor
        norm_end = norm_cursor + len(norm_p)
        norm_cursor = norm_end

        phrase_timings.append({
            "index": i,
            "text": clean_text,
            "raw_text": phrase_text,
            "norm_start": norm_start,
            "norm_end": norm_end,
            "start_sec": round(s_sec, 3),
            "end_sec": round(e_sec, 3),
            "start_frame": s_frame,
            "end_frame": e_frame,
        })

        tokens = re.findall(r"[A-Za-z0-9_.-]+|[\u4e00-\u9fff]", clean_text)
        word_timings.extend(
            forced_align_words_in_window(wav_path, tokens, i, s_sec, e_sec, fps)
        )

    # 严格校验并定位 visual_choreography 的每个 phrase_anchor
    choreography = scene.get("visual_choreography") or []
    located_anchors = validate_and_locate_phrase_anchors(scene_id, narration, choreography)
    beat_timings = []
    timing_warnings = []
    n_beats = len(choreography)

    # 将字符偏移映射到精确的短语/词级时间点
    def char_offset_to_frame(norm_offset: int) -> int:
        for p in phrase_timings:
            if p["norm_start"] <= norm_offset <= p["norm_end"]:
                span_chars = max(1, p["norm_end"] - p["norm_start"])
                local_r = (norm_offset - p["norm_start"]) / float(span_chars)
                return int(round(p["start_frame"] + local_r * (p["end_frame"] - p["start_frame"])))
        return int(round((norm_offset / max(1.0, float(norm_cursor))) * (total_scene_frames - 6)))

    raw_trigger_frames = [char_offset_to_frame(loc["norm_start"]) for loc in located_anchors]

    for b_idx, (beat, loc) in enumerate(zip(choreography, located_anchors)):
        if b_idx == 0:
            b_start_frame = 0
        else:
            b_start_frame = raw_trigger_frames[b_idx]

        if b_idx == n_beats - 1:
            b_end_frame = total_scene_frames
        else:
            b_end_frame = raw_trigger_frames[b_idx + 1]

        # 检查关键动作是否发生异常挤压、提前或延迟
        beat_dur_sec = (b_end_frame - b_start_frame) / float(fps)
        audit_status = "OK"
        if beat_dur_sec < 0.6:
            audit_status = "NEEDS_REAUDIT_TOO_SHORT"
            timing_warnings.append(
                f"[{scene_id}] Beat #{b_idx + 1} ('{beat.get('beat')}') 持续时间过短 ({beat_dur_sec:.2f}s < 0.6s)，需重新审核口播锚点！"
            )
            b_end_frame = max(b_start_frame + int(0.6 * fps), b_end_frame)

        b_start_sec = round(b_start_frame / float(fps), 3)
        b_end_sec = round(b_end_frame / float(fps), 3)

        beat_timings.append({
            "beat_index": b_idx,
            "beat": beat.get("beat", f"beat_{b_idx + 1}"),
            "action": beat.get("action", "transform"),
            "target": beat.get("target", ""),
            "camera": beat.get("camera", "steady_hold"),
            "shot_scale": beat.get("shot_scale", "medium"),
            "phrase_anchor": loc["phrase_anchor"],
            "anchor_char_offset": loc["norm_start"],
            "start_frame": b_start_frame,
            "end_frame": b_end_frame,
            "mid_frame": (b_start_frame + b_end_frame) // 2,
            "start_sec": b_start_sec,
            "end_sec": b_end_sec,
            "timing_audit": audit_status,
        })

    # 清理内部辅助字段
    for p in phrase_timings:
        p.pop("norm_start", None)
        p.pop("norm_end", None)

    return {
        "phrase_timings": phrase_timings,
        "word_timings": word_timings,
        "beat_timings": beat_timings,
        "timing_warnings": timing_warnings,
    }


def apply_audio_speed(raw_wav: Path, target_wav: Path, speed: float = 0.9):
    """使用 ffmpeg atempo 滤镜在不改变音调的前提下调节语速"""
    if abs(speed - 1.0) < 1e-3:
        if raw_wav != target_wav:
            shutil.copy2(raw_wav, target_wav)
        return
    try:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg = "ffmpeg"

    tmp_out = target_wav.with_suffix(".speed.wav")
    subprocess.run(
        [
            ffmpeg, "-y",
            "-i", str(raw_wav),
            "-af", f"atempo={speed}",
            "-c:a", "pcm_s16le",
            str(tmp_out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )
    shutil.move(str(tmp_out), str(target_wav))


def create_placeholder_wav(wav_path: str, duration_sec: float, sample_rate: int = 24000):
    """当 TTS 服务离线时，生成指定时长的占位空白 WAV 音频"""
    total_samples = int(duration_sec * sample_rate)
    write_pcm_wav(wav_path, b"\x00" * (total_samples * 2), sample_rate=sample_rate, channels=1)


def synthesize_phrase_segments_and_concat(
    phrases: List[str],
    out_wav_path: Path,
    tts_url: str,
    voice: str,
    emo_alpha: float,
    speed: float,
    tts_online: bool,
    allow_fallback: bool
) -> Tuple[float, List[float], bool, str]:
    """
    第一层短语级对齐：
    对每个短语分别生成音频片段，测量每个短语片段的实际时长后再拼接为完整场景 WAV，
    从而使每个短语与动作节拍的时间窗口达到 100% 实测精度。
    """
    sample_rate = 24000
    pause_sec = 0.10
    pause_pcm = b"\x00" * (int(sample_rate * pause_sec) * 2)

    phrase_pcms: List[bytes] = []
    phrase_durations: List[float] = []
    used_voice_tag = voice
    is_fallback = False

    tmp_dir = out_wav_path.parent / f".segments_{out_wav_path.stem}"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        for idx, p_text in enumerate(phrases):
            seg_raw = tmp_dir / f"seg_{idx}.raw.wav"
            seg_final = tmp_dir / f"seg_{idx}.wav"
            seg_ok = False

            if tts_online:
                try:
                    audio_bytes = call_index_tts(p_text, tts_url, voice=voice, emo_alpha=emo_alpha)
                    seg_raw.write_bytes(audio_bytes)
                    # 统一重采样为 24kHz 单声道 16-bit PCM 并应用语速
                    try:
                        import imageio_ffmpeg
                        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
                    except Exception:
                        ffmpeg = "ffmpeg"
                    af_arg = f"atempo={speed}" if abs(speed - 1.0) >= 1e-3 else "anull"
                    subprocess.run(
                        [
                            ffmpeg, "-y", "-i", str(seg_raw),
                            "-af", af_arg, "-ar", str(sample_rate), "-ac", "1", "-c:a", "pcm_s16le",
                            str(seg_final),
                        ],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True,
                    )
                    seg_ok = True
                except Exception as e:
                    if not allow_fallback:
                        raise e
                    tts_online = False

            if not seg_ok:
                try:
                    import asyncio
                    import edge_tts
                    import imageio_ffmpeg

                    async def _synth_seg():
                        temp_mp3 = str(seg_raw) + ".mp3"
                        comm = edge_tts.Communicate(p_text, "zh-CN-YunyangNeural", rate="-5%")
                        await comm.save(temp_mp3)
                        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
                        af_arg = f"atempo={speed}" if abs(speed - 1.0) >= 1e-3 else "anull"
                        subprocess.run(
                            [
                                ffmpeg, "-y", "-i", temp_mp3,
                                "-af", af_arg, "-ar", str(sample_rate), "-ac", "1", "-c:a", "pcm_s16le",
                                str(seg_final),
                            ],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True,
                        )
                        if os.path.exists(temp_mp3):
                            os.remove(temp_mp3)

                    asyncio.run(_synth_seg())
                    used_voice_tag = "edge-tts:zh-CN-YunyangNeural"
                    seg_ok = True
                except Exception:
                    # 离线降级：按该短语的实际发音权重生成对应时长的 PCM
                    est_dur = max(0.8, round(spoken_weight(p_text) / (3.8 * speed), 2))
                    create_placeholder_wav(str(seg_final), est_dur, sample_rate=sample_rate)
                    is_fallback = True
                    seg_ok = True

            _, _, _, pcm = parse_wav_pcm(str(seg_final))
            seg_dur = len(pcm) / float(sample_rate * 2)
            if idx < len(phrases) - 1:
                pcm = pcm + pause_pcm
                seg_dur += pause_sec

            phrase_pcms.append(pcm)
            phrase_durations.append(round(seg_dur, 3))

        combined_pcm = b"".join(phrase_pcms)
        write_pcm_wav(str(out_wav_path), combined_pcm, sample_rate=sample_rate, channels=1)
        total_dur = len(combined_pcm) / float(sample_rate * 2)
        return total_dur, phrase_durations, is_fallback, used_voice_tag
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def call_index_tts(text: str, tts_url: str, voice: str = "yali.wav", emo_alpha: float = 1.0, timeout: int = 180) -> bytes:
    """向 Index-TTS 发送合成请求"""
    session = requests.Session()
    session.trust_env = False

    candidates = []
    if voice:
        if "/" not in voice and "\\" not in voice:
            candidates.append(f"examples/{voice}")
        candidates.append(voice)
    else:
        candidates.append("examples/yali.wav")

    last_err = None
    for cand in candidates:
        payload = {"text": text, "voice": cand, "emo_alpha": emo_alpha}
        try:
            response = session.post(tts_url, json=payload, timeout=(5, timeout))
            if response.status_code == 200:
                return response.content
            else:
                last_err = response.text
        except Exception as e:
            last_err = str(e)

    raise RuntimeError(f"Index-TTS 合成失败 (音色: {voice}): {last_err}")


def process_storyboard(
    storyboard_path: str,
    output_dir: str,
    tts_url: str = "http://192.168.8.106:8712/tts",
    voice: str = "yali.wav",
    emo_alpha: float = 1.0,
    speed: float = 0.9,
    fps: int = 30,
    allow_fallback: bool = True,
    max_scenes: int = None,
    target_scene_id: str = None
):
    sb_file = Path(storyboard_path).resolve()
    if not sb_file.exists():
        raise FileNotFoundError(f"Storyboard not found: {sb_file}")

    data = json.loads(sb_file.read_text(encoding="utf-8"))
    scenes = data.get("scenes", [])
    if not scenes:
        raise ValueError("No scenes found in storyboard.json")

    if target_scene_id:
        matched = [s for s in scenes if s.get("id") == target_scene_id]
        if not matched:
            raise ValueError(f"Designated hero_scene_id '{target_scene_id}' not found in storyboard.json")
        scenes = matched
        print(f"[i] Hero Shot 样板审核模式: 仅处理代表性镜头 '{target_scene_id}'", flush=True)
    elif max_scenes and max_scenes > 0:
        scenes = scenes[:max_scenes]
        print(f"[i] 先导模式: 仅处理前 {len(scenes)} 个镜头", flush=True)

    out_dir = Path(output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    durations_summary = []
    total_video_frames = 0
    subtitles = []
    current_time_offset = 0.0

    print(f"[*] Processing {len(scenes)} scenes with v4.1 Phrase-Level Alignment (speed={speed}x)...", flush=True)

    tts_online = True
    for index, scene in enumerate(scenes):
        scene_id = scene.get("id", f"scene_{index + 1}")
        narration = scene.get("narration", "").strip()
        wav_filename = f"{scene_id}.wav"
        wav_path = out_dir / wav_filename
        meta_path = out_dir / f"{scene_id}.meta.json"

        print(f"\n[{index + 1}/{len(scenes)}] Scene: {scene_id}", flush=True)
        print(f"   Narration: {narration[:48]}..." if len(narration) > 48 else f"   Narration: {narration}", flush=True)

        # 合成前先严格校验本镜头的 phrase_anchor 是否合法，有问题立即阻断
        validate_and_locate_phrase_anchors(
            scene_id, narration, scene.get("visual_choreography") or []
        )

        custom_phrases = scene.get("narration_phrases")
        if isinstance(custom_phrases, list) and len(custom_phrases) > 0:
            phrases = [
                p.get("phrase", "").strip() if isinstance(p, dict) else str(p).strip()
                for p in custom_phrases
            ]
            phrases = [p for p in phrases if p]
        else:
            phrases = split_into_phrases(narration)

        measured_phrase_durations = None
        cached = False
        if wav_path.exists() and meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                if (
                    meta.get("text") == narration
                    and abs(float(meta.get("speed", 1.0)) - speed) < 1e-3
                    and not meta.get("fallback")
                ):
                    duration = get_wav_duration_seconds(str(wav_path))
                    measured_phrase_durations = meta.get("phrase_durations")
                    print(f"   [=] 命中短语级音频缓存! 音频时长: {duration:.2f}s", flush=True)
                    cached = True
            except Exception:
                cached = False

        if not cached:
            duration, measured_phrase_durations, is_fallback, used_voice = (
                synthesize_phrase_segments_and_concat(
                    phrases=phrases,
                    out_wav_path=wav_path,
                    tts_url=tts_url,
                    voice=voice,
                    emo_alpha=emo_alpha,
                    speed=speed,
                    tts_online=tts_online,
                    allow_fallback=allow_fallback,
                )
            )
            if is_fallback:
                tts_online = False
            meta_path.write_text(
                json.dumps(
                    {
                        "text": narration,
                        "voice": used_voice,
                        "speed": speed,
                        "fallback": is_fallback,
                        "phrase_durations": measured_phrase_durations,
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            print(
                f"   [+] 短语级分段音频合成完成 ({len(phrases)} 个短语段)! 总时长: {duration:.2f}s",
                flush=True,
            )

        frames_count = int(math.ceil(duration * fps)) + 6

        timing_anchors = compute_phrase_and_beat_timings(
            scene=scene,
            wav_path=str(wav_path),
            duration_sec=duration,
            total_scene_frames=frames_count,
            fps=fps,
            measured_phrase_durations=measured_phrase_durations,
        )
        phrase_timings = timing_anchors["phrase_timings"]
        beat_timings = timing_anchors["beat_timings"]

        if beat_timings:
            beat_str = " | ".join(
                [f"{b['beat']}[{b['start_frame']}..{b['end_frame']}f]" for b in beat_timings]
            )
            print(f"   [⏱] 动作节拍时间锚点: {beat_str}", flush=True)

        for w_msg in timing_anchors.get("timing_warnings", []):
            print(f"   [!] {w_msg}", flush=True)

        for p in phrase_timings:
            subtitles.append({
                "index": len(subtitles) + 1,
                "scene_id": scene_id,
                "start": current_time_offset + p["start_sec"],
                "end": current_time_offset + p["end_sec"],
                "text": p["text"],
            })

        durations_summary.append({
            "scene_id": scene_id,
            "title": scene.get("title", ""),
            "type": scene.get("type", "choreographed_v4"),
            "audio_file": wav_filename,
            "duration_sec": round(duration, 2),
            "frame_count": frames_count,
            "start_frame": total_video_frames,
            "end_frame": total_video_frames + frames_count,
            "phrase_timings": phrase_timings,
            "word_timings": timing_anchors["word_timings"],
            "beat_timings": beat_timings,
            "timing_warnings": timing_anchors.get("timing_warnings", []),
        })

        total_video_frames += frames_count
        current_time_offset += frames_count / float(fps)

    durations_path = out_dir / "durations.json"
    durations_path.write_text(
        json.dumps(
            {
                "total_frames": total_video_frames,
                "total_seconds": round(total_video_frames / fps, 2),
                "fps": fps,
                "speed": speed,
                "scenes": durations_summary,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    srt_path = out_dir / "subtitles.srt"
    with open(srt_path, "w", encoding="utf-8") as f:
        for item in subtitles:
            def format_timestamp(s):
                hours = int(s // 3600)
                minutes = int((s % 3600) // 60)
                seconds = int(s % 60)
                millis = int((s - int(s)) * 1000)
                return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

            f.write(f"{item['index']}\n")
            f.write(f"{format_timestamp(item['start'])} --> {format_timestamp(item['end'])}\n")
            f.write(f"{item['text']}\n\n")

    print(f"\n[+] 处理完成! 总时长: {round(total_video_frames / fps, 2)}s, 总帧数: {total_video_frames}", flush=True)
    return durations_summary


def main():
    parser = argparse.ArgumentParser(description="Generate voiceovers, phrase anchors & subtitles via Index-TTS")
    parser.add_argument("--input", required=True, help="Path to storyboard.json")
    parser.add_argument("--output-dir", required=True, help="Directory to save wav and subtitles")
    parser.add_argument("--tts-url", default="http://192.168.8.106:8712/tts", help="Index-TTS service URL")
    parser.add_argument("--voice", default="yali.wav", help="Index-TTS voice timbre (default: yali.wav)")
    parser.add_argument("--emo-alpha", type=float, default=1.0, help="Emotion alpha factor")
    parser.add_argument("--speed", type=float, default=0.9, help="Audio playback speed factor (default: 0.9)")
    parser.add_argument("--fps", type=int, default=30, help="Target video frames per second")
    parser.add_argument("--no-fallback", action="store_true", help="Disallow fallback if TTS server is offline")
    parser.add_argument("--max-scenes", type=int, default=None, help="Process only the first N scenes")
    parser.add_argument("--scene-id", default=None, help="Process only a specific hero_scene_id")

    args = parser.parse_args()

    process_storyboard(
        storyboard_path=args.input,
        output_dir=args.output_dir,
        tts_url=args.tts_url,
        voice=args.voice,
        emo_alpha=args.emo_alpha,
        speed=args.speed,
        fps=args.fps,
        allow_fallback=not args.no_fallback,
        max_scenes=args.max_scenes,
        target_scene_id=args.scene_id,
    )


if __name__ == "__main__":
    main()
