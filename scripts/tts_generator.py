#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tts_generator.py (v4) - 调用局域网 Index-TTS 服务生成场景配音、语速调节（默认 0.9x）
并提取短语级/字级时间锚点 (phrase_timings / word_timings) 与 visual_choreography 节拍帧区间 (beat_timings)。
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
from typing import List, Dict, Any

try:
    import requests
except ImportError:
    print("[-] Missing 'requests' package. Please install: pip install requests")
    sys.exit(1)


def get_wav_duration_seconds(wav_path: str) -> float:
    """直接解析 RIFF WAV 数据块，兼容 PCM(1) 与 IEEE Float(3) 32位/16位格式"""
    data = Path(wav_path).read_bytes()
    if len(data) < 44 or data[:4] != b'RIFF':
        raise ValueError(f"Invalid WAV file: {wav_path}")

    pos = 12
    fmt_channels = 1
    fmt_rate = 22050
    fmt_bits = 16
    data_size = 0

    while pos < len(data) - 8:
        chunk_id = data[pos:pos+4]
        chunk_size = int.from_bytes(data[pos+4:pos+8], "little")
        if chunk_id == b'fmt ':
            fmt_channels = int.from_bytes(data[pos+10:pos+12], "little")
            fmt_rate = int.from_bytes(data[pos+12:pos+16], "little")
            fmt_bits = int.from_bytes(data[pos+22:pos+24], "little")
        elif chunk_id == b'data':
            data_size = chunk_size
            break
        pos += 8 + chunk_size

    if data_size == 0:
        data_size = len(data) - 44

    bytes_per_sample = max(1, fmt_channels * (fmt_bits // 8))
    samples = data_size / bytes_per_sample
    duration = samples / float(fmt_rate)
    return duration


def spoken_weight(text: str) -> float:
    """计算口播语速权重：汉字记 1.0，英文词记 1.6，标点停顿附加权重"""
    if not text:
        return 1.0
    english_tokens = re.findall(r"[A-Za-z0-9]+", text)
    cjk_chars = re.sub(r"[A-Za-z0-9\s\W_]", "", text)
    pauses = len(re.findall(r"[，。！？；：、,.!?;:]", text)) * 0.45
    return max(0.8, len(cjk_chars) * 1.0 + len(english_tokens) * 1.6 + pauses)


def split_into_phrases(narration: str) -> List[str]:
    """将口播按标点切分为自然语义短语"""
    raw_clauses = re.split(r"(?<=[，。！？；：、,.!?;:])", narration.strip())
    phrases = []
    buf = ""
    for clause in raw_clauses:
        c = clause.strip()
        if not c:
            continue
        if len(buf) + len(c) <= 10 and not re.search(r"[。！？.!?]$", buf):
            buf += c
        else:
            if buf:
                phrases.append(buf)
            buf = c
    if buf:
        phrases.append(buf)
    return phrases if phrases else [narration.strip()]


def detect_wav_pause_anchors(wav_path: str, expected_ratios: List[float], duration: float) -> List[float]:
    """
    扫描 16-bit PCM WAV 能量包络，在预期比例点附近 (±12% 时长窗口) 寻找真实语音停顿低谷，
    使短语时间锚点与真实发音停顿精确对齐。
    """
    if not expected_ratios or duration <= 0.5:
        return [round(r * duration, 3) for r in expected_ratios]

    try:
        data = Path(wav_path).read_bytes()
        if len(data) < 100 or data[:4] != b"RIFF":
            return [round(r * duration, 3) for r in expected_ratios]

        pos = 12
        fmt_channels = 1
        fmt_rate = 24000
        fmt_bits = 16
        pcm_offset = 44
        pcm_size = len(data) - 44

        while pos < len(data) - 8:
            chunk_id = data[pos:pos+4]
            chunk_size = int.from_bytes(data[pos+4:pos+8], "little")
            if chunk_id == b"fmt ":
                fmt_channels = int.from_bytes(data[pos+10:pos+12], "little")
                fmt_rate = int.from_bytes(data[pos+12:pos+16], "little")
                fmt_bits = int.from_bytes(data[pos+22:pos+24], "little")
            elif chunk_id == b"data":
                pcm_offset = pos + 8
                pcm_size = min(chunk_size, len(data) - pcm_offset)
                break
            pos += 8 + chunk_size

        if fmt_bits != 16 or pcm_size <= 0:
            return [round(r * duration, 3) for r in expected_ratios]

        # 以 20ms 为一帧计算平均绝对振幅包络
        win_sec = 0.02
        bytes_per_frame = max(2, fmt_channels * 2)
        samples_per_win = max(1, int(fmt_rate * win_sec))
        step_bytes = samples_per_win * bytes_per_frame
        energies = []
        raw_pcm = memoryview(data)[pcm_offset:pcm_offset + pcm_size]

        for offset in range(0, len(raw_pcm) - step_bytes, step_bytes):
            chunk = raw_pcm[offset:offset + step_bytes]
            # 抽样计算平均振幅
            stride = max(2, (len(chunk) // 64) & ~1)
            total_amp = 0
            count = 0
            for j in range(0, len(chunk) - 1, stride):
                val = int.from_bytes(chunk[j:j+2], "little", signed=True)
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
            radius = max(2, int(0.08 * n_wins))
            lo = max(last_idx + 2, center_idx - radius)
            hi = min(n_wins - 2, center_idx + radius)
            if lo >= hi:
                best_idx = max(last_idx + 1, min(n_wins - 1, center_idx))
            else:
                # 寻找能量最低且距离预期中心不远的停顿点
                best_idx = center_idx
                best_score = float("inf")
                max_e = max(energies[lo:hi+1]) or 1.0
                for idx in range(lo, hi + 1):
                    dist_penalty = abs(idx - center_idx) / max(1.0, float(radius)) * 0.25
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


def compute_phrase_and_beat_timings(
    scene: Dict[str, Any],
    wav_path: str,
    duration_sec: float,
    total_scene_frames: int,
    fps: int = 30
) -> Dict[str, Any]:
    """
    计算短语级时间锚点 (phrase_timings)、词/字级时间锚点 (word_timings)
    以及与 visual_choreography 对齐的动作节拍帧区间 (beat_timings)。
    """
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
        phrases = [""]

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

    for i, phrase_text in enumerate(phrases):
        s_sec = starts[i]
        e_sec = max(s_sec + 0.08, ends[i])
        s_frame = int(round(s_sec * fps))
        e_frame = int(round(e_sec * fps)) if i < len(phrases) - 1 else max(int(round(e_sec * fps)), total_scene_frames - 6)
        Clean_text = re.sub(r"[，。；：、,;:]\s*$", "", phrase_text)

        phrase_timings.append({
            "index": i,
            "text": Clean_text,
            "raw_text": phrase_text,
            "start_sec": round(s_sec, 3),
            "end_sec": round(e_sec, 3),
            "start_frame": s_frame,
            "end_frame": e_frame,
        })

        # 生成细粒度字/词级时间锚点 (word_timings)
        tokens = re.findall(r"[A-Za-z0-9_.-]+|[\u4e00-\u9fff]", Clean_text)
        if tokens:
            t_weights = [1.6 if re.match(r"^[A-Za-z0-9_.-]+$", tk) else 1.0 for tk in tokens]
            tw_sum = sum(t_weights) or 1.0
            t_acc = 0.0
            span_sec = e_sec - s_sec
            for tk, tw in zip(tokens, t_weights):
                w_start = s_sec + (t_acc / tw_sum) * span_sec
                t_acc += tw
                w_end = s_sec + (t_acc / tw_sum) * span_sec
                word_timings.append({
                    "word": tk,
                    "phrase_index": i,
                    "start_sec": round(w_start, 3),
                    "end_sec": round(w_end, 3),
                    "start_frame": int(round(w_start * fps)),
                    "end_frame": int(round(w_end * fps)),
                })

    # 将 visual_choreography 中的每个 beat 锚定到精确的帧窗口
    choreography = scene.get("visual_choreography") or []
    beat_timings = []
    n_beats = len(choreography)

    if n_beats > 0:
        matched_phrase_indices = []
        for b_idx, beat in enumerate(choreography):
            anchor = (beat.get("phrase_anchor") or "").strip()
            best_p_idx = None
            if anchor:
                norm_anchor = re.sub(r"\W+", "", anchor)
                for p in phrase_timings:
                    norm_p = re.sub(r"\W+", "", p["raw_text"])
                    if norm_anchor and (norm_anchor in norm_p or norm_p in norm_anchor):
                        best_p_idx = p["index"]
                        break
            if best_p_idx is None:
                # 按序映射到对应比例的短语索引
                best_p_idx = min(len(phrase_timings) - 1, int(round(b_idx * len(phrase_timings) / max(1, n_beats))))
            matched_phrase_indices.append(best_p_idx)

        # 确保节拍起止帧单调递增且完整覆盖整个镜头时长，不留死寂空白帧
        for b_idx, beat in enumerate(choreography):
            if b_idx == 0:
                b_start_frame = 0
                b_start_sec = 0.0
            else:
                b_start_frame = beat_timings[-1]["end_frame"]
                b_start_sec = beat_timings[-1]["end_sec"]

            if b_idx == n_beats - 1:
                b_end_frame = total_scene_frames
                b_end_sec = round(total_scene_frames / float(fps), 3)
            else:
                next_p_idx = matched_phrase_indices[b_idx + 1]
                cur_p_idx = matched_phrase_indices[b_idx]
                if next_p_idx > cur_p_idx:
                    cand_frame = phrase_timings[next_p_idx]["start_frame"]
                else:
                    cand_frame = int(round(((b_idx + 1) / float(n_beats)) * (total_scene_frames - 6)))
                min_step = max(15, int(total_scene_frames / (n_beats * 2.5)))
                max_allowed = total_scene_frames - (n_beats - 1 - b_idx) * min_step
                b_end_frame = max(b_start_frame + min_step, min(max_allowed, cand_frame))
                b_end_sec = round(b_end_frame / float(fps), 3)

            beat_timings.append({
                "beat_index": b_idx,
                "beat": beat.get("beat", f"beat_{b_idx + 1}"),
                "action": beat.get("action", "transform"),
                "target": beat.get("target", ""),
                "camera": beat.get("camera", "steady_hold"),
                "shot_scale": beat.get("shot_scale", "medium"),
                "phrase_anchor": beat.get("phrase_anchor", ""),
                "start_frame": b_start_frame,
                "end_frame": b_end_frame,
                "mid_frame": (b_start_frame + b_end_frame) // 2,
                "start_sec": b_start_sec,
                "end_sec": b_end_sec,
            })

    return {
        "phrase_timings": phrase_timings,
        "word_timings": word_timings,
        "beat_timings": beat_timings,
    }


def apply_audio_speed(raw_wav: Path, target_wav: Path, speed: float = 0.9):
    """使用 ffmpeg atempo 滤镜在不改变音调(pitch)的前提下调节语速（如 0.9 = 语速调低 1/10）"""
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
    """当 TTS 服务离线时，生成指定时长的占位空白 WAV 音频以保证工程闭环渲染"""
    total_samples = int(duration_sec * sample_rate)
    data_size = total_samples * 2
    header = bytearray(44)
    header[0:4] = b'RIFF'
    header[4:8] = (36 + data_size).to_bytes(4, 'little')
    header[8:12] = b'WAVE'
    header[12:16] = b'fmt '
    header[16:20] = (16).to_bytes(4, 'little')  # Subchunk1Size
    header[20:22] = (1).to_bytes(2, 'little')   # AudioFormat (PCM)
    header[22:24] = (1).to_bytes(2, 'little')   # NumChannels
    header[24:28] = sample_rate.to_bytes(4, 'little')
    header[28:32] = (sample_rate * 2).to_bytes(4, 'little')
    header[32:34] = (2).to_bytes(2, 'little')
    header[34:36] = (16).to_bytes(2, 'little')
    header[36:40] = b'data'
    header[40:44] = data_size.to_bytes(4, 'little')

    with open(wav_path, "wb") as f:
        f.write(header)
        f.write(b'\x00' * data_size)


def call_index_tts(text: str, tts_url: str, voice: str = "yali.wav", emo_alpha: float = 1.0, timeout: int = 180) -> bytes:
    """向 Index-TTS 发送合成请求，支持指定音色（默认 yali.wav）并智能匹配路径"""
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
        payload = {
            "text": text,
            "voice": cand,
            "emo_alpha": emo_alpha
        }
        try:
            response = session.post(
                tts_url,
                json=payload,
                timeout=(5, timeout)
            )
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
    max_scenes: int = None
):
    sb_file = Path(storyboard_path).resolve()
    if not sb_file.exists():
        raise FileNotFoundError(f"Storyboard not found: {sb_file}")

    data = json.loads(sb_file.read_text(encoding="utf-8"))
    scenes = data.get("scenes", [])
    if not scenes:
        raise ValueError("No scenes found in storyboard.json")

    if max_scenes and max_scenes > 0:
        scenes = scenes[:max_scenes]
        print(f"[i] 样板/先导模式: 仅处理前 {len(scenes)} 个镜头", flush=True)

    out_dir = Path(output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    durations_summary = []
    total_video_frames = 0
    subtitles = []
    current_time_offset = 0.0

    print(f"[*] Processing {len(scenes)} scenes with Index-TTS at {tts_url} (speed={speed}x)...", flush=True)

    tts_online = True
    for index, scene in enumerate(scenes):
        scene_id = scene.get("id", f"scene_{index+1}")
        narration = scene.get("narration", "").strip()
        wav_filename = f"{scene_id}.wav"
        wav_path = out_dir / wav_filename
        raw_wav_path = out_dir / f"{scene_id}.raw.wav"
        meta_path = out_dir / f"{scene_id}.meta.json"

        print(f"\n[{index+1}/{len(scenes)}] Scene: {scene_id}", flush=True)
        print(f"   Narration: {narration[:45]}..." if len(narration) > 45 else f"   Narration: {narration}", flush=True)

        if not narration:
            duration = 3.0
            create_placeholder_wav(str(wav_path), duration)
        else:
            cached = False
            if wav_path.exists() and meta_path.exists():
                try:
                    meta = json.loads(meta_path.read_text(encoding="utf-8"))
                    if meta.get("text") == narration and meta.get("voice") == voice and not meta.get("fallback"):
                        cached_speed = float(meta.get("speed", 1.0))
                        if abs(cached_speed - speed) < 1e-3:
                            duration = get_wav_duration_seconds(str(wav_path))
                            print(f"   [=] 命中音频缓存 (speed={speed}x)! 音频时长: {duration:.2f}s (音色: {voice})", flush=True)
                            cached = True
                        else:
                            if not raw_wav_path.exists():
                                shutil.copy2(wav_path, raw_wav_path)
                            apply_audio_speed(raw_wav_path, wav_path, speed=speed)
                            meta["speed"] = speed
                            meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
                            duration = get_wav_duration_seconds(str(wav_path))
                            print(f"   [~] 复用原速缓存并调整语速至 {speed}x! 调整后时长: {duration:.2f}s", flush=True)
                            cached = True
                except Exception as e:
                    print(f"   [!] 缓存变速处理异常，重新合成: {e}", flush=True)

            if not cached:
                success = False
                if tts_online:
                    try:
                        audio_bytes = call_index_tts(narration, tts_url, voice=voice, emo_alpha=emo_alpha)
                        raw_wav_path.write_bytes(audio_bytes)
                        apply_audio_speed(raw_wav_path, wav_path, speed=speed)
                        duration = get_wav_duration_seconds(str(wav_path))
                        meta_path.write_text(
                            json.dumps({"text": narration, "voice": voice, "speed": speed, "fallback": False}, ensure_ascii=False),
                            encoding="utf-8"
                        )
                        print(f"   [+] Index-TTS 生成成功 (speed={speed}x)! 音频时长: {duration:.2f}s (音色: {voice})", flush=True)
                        success = True
                    except Exception as e:
                        print(f"   [!] Index-TTS 请求失败 ({e})", flush=True)
                        if not allow_fallback:
                            raise e
                        tts_online = False
                        print("   [!] 已切换为 Edge-TTS 热备模式...", flush=True)

                if not success:
                    try:
                        import asyncio
                        import edge_tts
                        import imageio_ffmpeg

                        async def _synth():
                            temp_mp3 = str(wav_path) + ".tmp.mp3"
                            comm = edge_tts.Communicate(narration, "zh-CN-YunyangNeural", rate="-5%")
                            await comm.save(temp_mp3)
                            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
                            subprocess.run(
                                [ffmpeg, "-y", "-i", temp_mp3, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", str(raw_wav_path)],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
                            )
                            if os.path.exists(temp_mp3):
                                os.remove(temp_mp3)

                        asyncio.run(_synth())
                        apply_audio_speed(raw_wav_path, wav_path, speed=speed)
                        duration = get_wav_duration_seconds(str(wav_path))
                        meta_path.write_text(
                            json.dumps({"text": narration, "voice": "edge-tts:zh-CN-YunyangNeural", "speed": speed, "fallback": False}, ensure_ascii=False),
                            encoding="utf-8"
                        )
                        print(f"   [+] Edge-TTS 热备合成成功 (speed={speed}x)! 音频时长: {duration:.2f}s", flush=True)
                        success = True
                    except Exception as edge_err:
                        print(f"   [!] Edge-TTS 热备失败 ({edge_err})，执行静音占位降级...", flush=True)
                        word_count = len(narration)
                        duration = max(3.0, round(word_count / (3.8 * speed), 2))
                        create_placeholder_wav(str(wav_path), duration)
                        meta_path.write_text(
                            json.dumps({"text": narration, "voice": voice, "speed": speed, "fallback": True}, ensure_ascii=False),
                            encoding="utf-8"
                        )
                        print(f"   [i] 生成降级占位音频: {wav_filename} (预估时长: {duration:.2f}s)", flush=True)

        frames_count = int(math.ceil(duration * fps)) + 6

        # v4: 计算短语级、词级与动作节拍级时间锚点
        timing_anchors = compute_phrase_and_beat_timings(
            scene=scene,
            wav_path=str(wav_path),
            duration_sec=duration,
            total_scene_frames=frames_count,
            fps=fps
        )
        phrase_timings = timing_anchors["phrase_timings"]
        beat_timings = timing_anchors["beat_timings"]

        if beat_timings:
            beat_str = " | ".join(
                [f"{b['beat']}[{b['start_frame']}..{b['end_frame']}f]" for b in beat_timings]
            )
            print(f"   [⏱] 动作节拍时间锚点: {beat_str}", flush=True)

        # 生成短语级高精度 SRT 字幕
        for p in phrase_timings:
            subtitles.append({
                "index": len(subtitles) + 1,
                "scene_id": scene_id,
                "start": current_time_offset + p["start_sec"],
                "end": current_time_offset + p["end_sec"],
                "text": p["text"]
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
        })

        total_video_frames += frames_count
        current_time_offset += frames_count / float(fps)

    durations_path = out_dir / "durations.json"
    durations_path.write_text(
        json.dumps({
            "total_frames": total_video_frames,
            "total_seconds": round(total_video_frames / fps, 2),
            "fps": fps,
            "speed": speed,
            "scenes": durations_summary
        }, ensure_ascii=False, indent=2),
        encoding="utf-8"
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
    print(f"[+] 音频与短语级时间锚点已保存至: {out_dir}", flush=True)
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
    parser.add_argument("--max-scenes", type=int, default=None, help="Process only the first N scenes (e.g. for first-shot approval)")

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
        max_scenes=args.max_scenes
    )


if __name__ == "__main__":
    main()
