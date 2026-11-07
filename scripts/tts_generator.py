#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tts_generator.py - 调用局域网 Index-TTS 服务生成场景配音、语速调节（默认 0.9x 放慢 1/10）与精准音画时间轴
"""

import os
import sys
import json
import struct
import math
import shutil
import subprocess
import argparse
from pathlib import Path

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
        print(f"[i] 先导片模式 (Pilot): 仅处理前 {len(scenes)} 个场景", flush=True)

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
                            # 文本相同但语速参数改变：复用原速音频直接变速，免重新合成
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

        frames_count = int(math.ceil(duration * fps))
        frames_count += 6

        start_sec = current_time_offset
        end_sec = current_time_offset + duration
        subtitles.append({
            "index": index + 1,
            "scene_id": scene_id,
            "start": start_sec,
            "end": end_sec,
            "text": narration
        })

        durations_summary.append({
            "scene_id": scene_id,
            "title": scene.get("title", ""),
            "type": scene.get("type", "title_card"),
            "audio_file": wav_filename,
            "duration_sec": round(duration, 2),
            "frame_count": frames_count,
            "start_frame": total_video_frames,
            "end_frame": total_video_frames + frames_count
        })

        total_video_frames += frames_count
        current_time_offset = end_sec

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
    print(f"[+] 音频与配置文件已保存至: {out_dir}", flush=True)
    return durations_summary


def main():
    parser = argparse.ArgumentParser(description="Generate voiceovers & subtitles via Index-TTS")
    parser.add_argument("--input", required=True, help="Path to storyboard.json")
    parser.add_argument("--output-dir", required=True, help="Directory to save wav and subtitles")
    parser.add_argument("--tts-url", default="http://192.168.8.106:8712/tts", help="Index-TTS service URL")
    parser.add_argument("--voice", default="yali.wav", help="Index-TTS voice timbre (default: yali.wav)")
    parser.add_argument("--emo-alpha", type=float, default=1.0, help="Emotion alpha factor")
    parser.add_argument("--speed", type=float, default=0.9, help="Audio playback speed factor (default: 0.9, i.e., 10% slower)")
    parser.add_argument("--fps", type=int, default=30, help="Target video frames per second")
    parser.add_argument("--no-fallback", action="store_true", help="Disallow fallback if TTS server is offline")
    parser.add_argument("--max-scenes", type=int, default=None, help="Process only the first N scenes (e.g. for pilot preview)")

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
