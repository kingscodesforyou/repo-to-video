#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
analyze_repo.py - 智能扫描与分析 GitHub 项目结构、类型与实时 GitHub Star/Fork 数据（防数据过时审查）
"""

import os
import sys
import json
import argparse
import subprocess
import re
from pathlib import Path

def fetch_live_github_stats(repo_path: Path) -> dict:
    """
    通过 git remote origin URL 自动解析 owner/repo，并直连 GitHub API 获取最新实时 Star / Fork 数据，
    防止文案子 Agent 引用网上过时的旧文章数字（如把 68,500+ Star 写成 48,000 Star）。
    """
    stats = {
        "owner_repo": "",
        "repo_url": "",
        "stars": None,
        "stars_formatted": "",
        "forks": None,
        "open_issues": None,
        "description": "",
    }
    try:
        res = subprocess.run(
            ["git", "-C", str(repo_path), "remote", "get-url", "origin"],
            capture_output=True, text=True, timeout=5
        )
        remote_url = res.stdout.strip()
        if remote_url:
            stats["repo_url"] = remote_url
            m = re.search(r"github\.com[:/]([^/]+/[^/.]+?)(?:\.git)?$", remote_url)
            if m:
                owner_repo = m.group(1)
                stats["owner_repo"] = owner_repo
                import requests
                session = requests.Session()
                session.trust_env = False  # 绕过可能损坏的本地 SOCKS 环境变量
                resp = session.get(
                    f"https://api.github.com/repos/{owner_repo}",
                    headers={"Accept": "application/vnd.github+json", "User-Agent": "repo-to-video-analyzer"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    stars = int(data.get("stargazers_count", 0))
                    forks = int(data.get("forks_count", 0))
                    stats["stars"] = stars
                    # 生成精确到百位的人类可读格式，如 68,500+
                    floored_hundreds = (stars // 500) * 500
                    stats["stars_formatted"] = f"{floored_hundreds:,}+" if stars >= 1000 else str(stars)
                    stats["forks"] = forks
                    stats["open_issues"] = int(data.get("open_issues_count", 0))
                    stats["description"] = data.get("description") or ""
                    print(f"[+] 实时 GitHub 数据核验成功 ({owner_repo}): ⭐ {stars:,} Stars ({stats['stars_formatted']}), 🍴 {forks:,} Forks")
    except Exception as e:
        print(f"[i] GitHub 实时数据获取跳过: {e}")
    return stats


def parse_frontmatter(content: str):
    """解析 Markdown 文件中的 YAML frontmatter"""
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", content, re.DOTALL)
    if not match:
        return {}, content
    yaml_text, body = match.groups()
    metadata = {}
    for line in yaml_text.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            metadata[k.strip()] = v.strip().strip("'\"")
    return metadata, body


def scan_skills(repo_path: Path):
    """扫描仓库中的 Agent Skills / 规则"""
    skills = []
    for skill_file in repo_path.glob("**/SKILL.md"):
        try:
            text = skill_file.read_text(encoding="utf-8", errors="ignore")
            meta, body = parse_frontmatter(text)
            skill_name = meta.get("name") or skill_file.parent.name
            desc = meta.get("description") or ""
            if not desc:
                for line in body.splitlines():
                    if line.strip() and not line.startswith("#"):
                        desc = line.strip()
                        break
            rel_path = skill_file.relative_to(repo_path).as_posix()
            skills.append({
                "name": skill_name,
                "description": desc,
                "path": rel_path
            })
        except Exception:
            pass
    return skills


def extract_readme_summary(repo_path: Path):
    """提取 README.md 中的关键概览、特性与真实数字指标"""
    readme_candidates = ["README.md", "readme.md", "README_zh.md", "README.MD"]
    readme_path = None
    for c in readme_candidates:
        p = repo_path / c
        if p.exists():
            readme_path = p
            break

    if not readme_path:
        return {"title": repo_path.name, "description": "", "features": [], "verified_numbers": []}

    content = readme_path.read_text(encoding="utf-8", errors="ignore")
    lines = content.splitlines()

    title = repo_path.name
    desc_lines = []
    features = []

    for i, line in enumerate(lines):
        if line.startswith("# ") and title == repo_path.name:
            title = line.replace("#", "").strip()
            for subline in lines[i+1:]:
                if subline.startswith("#"):
                    break
                if subline.strip() and not subline.startswith("[!["):
                    desc_lines.append(subline.strip())
                if len(desc_lines) >= 3:
                    break
            break

    in_features = False
    for line in lines:
        if re.search(r"^(#+|###)\s*(Features|特性|功能|What's included|Skills|Key Features|Highlights)", line, re.I):
            in_features = True
            continue
        if in_features:
            if line.startswith("# ") or line.startswith("## "):
                in_features = False
                continue
            if line.strip().startswith(("-", "*", "1.", "2.", "3.")):
                clean_feat = re.sub(r"^[-*0-9.]+\s*", "", line.strip())
                clean_feat = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", clean_feat)
                if len(clean_feat) > 3:
                    features.append(clean_feat)
                if len(features) >= 8:
                    break

    # 提取 README 中带百分比或倍数的官方验证指标行，供文案事实核查
    verified_numbers = []
    for line in lines:
        if re.search(r"\b\d+(\.\d+)?%\b", line) and len(line.strip()) < 180:
            clean_line = re.sub(r"[*_`#>]+", "", line).strip()
            if clean_line and clean_line not in verified_numbers:
                verified_numbers.append(clean_line)
            if len(verified_numbers) >= 12:
                break

    return {
        "title": title,
        "description": " ".join(desc_lines),
        "features": features,
        "verified_numbers": verified_numbers,
    }


def analyze_repository(repo_dir: str):
    repo_path = Path(repo_dir).resolve()
    if not repo_path.exists():
        raise FileNotFoundError(f"Repository path does not exist: {repo_path}")

    skills = scan_skills(repo_path)
    github_stats = fetch_live_github_stats(repo_path)

    runnable_markers = {
        "Node/Web": ["package.json", "next.config.js", "vite.config.ts", "pnpm-lock.yaml"],
        "Python": ["pyproject.toml", "requirements.txt", "Pipfile", "setup.py"],
        "Rust": ["Cargo.toml"],
        "Go": ["go.mod"],
        "Docker": ["Dockerfile", "docker-compose.yml"]
    }

    detected_ecosystems = []
    for eco, markers in runnable_markers.items():
        if any((repo_path / m).exists() for m in markers):
            detected_ecosystems.append(eco)

    has_agent_configs = any((repo_path / p).exists() for p in [
        "AGENTS.md", "GEMINI.md", ".claude-plugin", ".antigravity-plugin", ".cursorrules"
    ])

    if len(skills) > 0 or has_agent_configs:
        repo_type = "SKILL"
    elif detected_ecosystems:
        repo_type = "RUNNABLE"
    else:
        repo_type = "GENERAL_DOCS"

    readme_info = extract_readme_summary(repo_path)

    top_entries = []
    for item in sorted(repo_path.iterdir()):
        if not item.name.startswith(".git"):
            top_entries.append({
                "name": item.name,
                "is_dir": item.is_dir()
            })

    profile = {
        "name": repo_path.name,
        "repo_path": str(repo_path),
        "type": repo_type,
        "github_stats": github_stats,
        "detected_ecosystems": detected_ecosystems,
        "readme_title": readme_info["title"],
        "summary": readme_info["description"],
        "features": readme_info["features"],
        "verified_numbers": readme_info["verified_numbers"],
        "skills_count": len(skills),
        "skills": skills,
        "top_entries": top_entries[:15]
    }
    return profile


def main():
    parser = argparse.ArgumentParser(description="Analyze GitHub repository structure, type, and live stats")
    parser.add_argument("--path", required=True, help="Local repository path or clone target")
    parser.add_argument("--output", help="Path to write JSON profile", default=None)
    args = parser.parse_args()

    profile = analyze_repository(args.path)
    output_json = json.dumps(profile, ensure_ascii=False, indent=2)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output_json, encoding="utf-8")
        print(f"[+] Repository profile saved to: {out_path}")
    else:
        print(output_json)


if __name__ == "__main__":
    main()
