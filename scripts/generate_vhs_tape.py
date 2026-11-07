#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_vhs_tape.py - 自动生成 Charmbracelet VHS 终端录制脚本 (.tape)
"""

import sys
import json
import argparse
from pathlib import Path

DEFAULT_TAPE_HEADER = """# VHS tape generated for RemotionAgent
Output {output_path}

Set FontSize 24
Set Width 1280
Set Height 720
Set Padding 40
Set Theme "TokyoNight"
Set FontFamily "JetBrains Mono"
Set TypingSpeed 60ms

"""

def generate_tape(commands: list, output_media_path: str) -> str:
    tape_content = DEFAULT_TAPE_HEADER.format(output_path=output_media_path)
    tape_content += "Sleep 1s\n"
    
    for item in commands:
        if isinstance(item, str):
            cmd = item
            sleep_time = "2s"
        elif isinstance(item, dict):
            cmd = item.get("cmd", "")
            sleep_time = item.get("sleep", "2s")
        else:
            continue
            
        tape_content += f'Type "{cmd}"\n'
        tape_content += "Enter\n"
        tape_content += f"Sleep {sleep_time}\n"

    tape_content += "Sleep 2s\n"
    return tape_content

def main():
    parser = argparse.ArgumentParser(description="Generate VHS tape script for terminal recording")
    parser.add_argument("--commands", nargs="+", required=True, help="List of shell commands")
    parser.add_argument("--output-tape", required=True, help="Path to write the .tape file")
    parser.add_argument("--output-media", default="terminal.mp4", help="Target output video/gif path")
    args = parser.parse_args()

    tape = generate_tape(args.commands, args.output_media)
    out_file = Path(args.output_tape)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(tape, encoding="utf-8")
    print(f"[+] VHS tape file generated at: {out_file}")

if __name__ == "__main__":
    main()
