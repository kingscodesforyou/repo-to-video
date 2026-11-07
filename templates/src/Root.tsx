import React from "react";
import { Composition } from "remotion";
import { TutorialVideo, TutorialVideoProps } from "./compositions/TutorialVideo";

const defaultProps: TutorialVideoProps = {
  title: "GitHub Repo Tutorial",
  repoName: "superpowers",
  repoType: "SKILL",
  scenes: [
    {
      id: "scene_1_hook",
      title: "普通 AI 编程 vs 挂载 superpowers",
      type: "compare",
      narration: "你是不是也经常遇到 AI 写代码不遵循单测、随意产生幻觉？今天介绍的开源库彻底改变了这一切。",
      durationInFrames: 120,
      data: {
        before_title: "原生大模型",
        before_text: "❌ 拿到任务直接写代码\n❌ 幻觉凭空编造函数\n❌ 没有任何单测验证\n❌ 改坏现有代码后交差",
        after_title: "挂载 superpowers",
        after_text: "✅ 先写需求规范与设计方案\n✅ 遵循测试驱动开发(TDD)红绿循环\n✅ 4步系统化根因排查\n✅ 完成前运行真机验证测试",
      },
    },
    {
      id: "scene_2_skills",
      title: "核心 Superpowers 技能树",
      type: "code_focus",
      narration: "整个仓库精挑细选了十五个顶级开发技能，涵盖测试驱动开发、系统化调试排障与多 Agent 并行分工。",
      durationInFrames: 120,
      data: {
        code: "- test-driven-development: RED-GREEN-REFACTOR cycle\n- systematic-debugging: 4-phase root cause process\n- verification-before-completion: Ensure it's actually fixed\n- dispatching-parallel-agents: Parallel subagent execution",
        language: "markdown",
      },
    },
    {
      id: "scene_3_terminal",
      title: "一键安装到本地 Agent",
      type: "terminal",
      narration: "安装极其简单，只需要克隆到项目目录或者全局配置中，各大主流智能体生态即可自动加载。",
      durationInFrames: 120,
      data: {
        commands: [
          "git clone https://github.com/obra/superpowers.git .agents/superpowers",
          "agy --version",
          "# Skills loaded automatically!",
        ],
      },
    },
  ],
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="TutorialVideo"
        component={TutorialVideo}
        durationInFrames={360}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          const totalFrames = (props.scenes || []).reduce(
            (acc, s) => acc + (s.durationInFrames || 90),
            0
          );
          return {
            durationInFrames: Math.max(1, totalFrames),
            props,
          };
        }}
      />

      {/* 30 秒先导样片（Pilot Checkpoint Preview） */}
      <Composition
        id="PilotVideo"
        component={TutorialVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          // 若为先导片且未专门切分，自动截取前 2~3 个场景或不超过 900 帧（30秒）
          const scenes = props.scenes || [];
          let pilotFrames = 0;
          const pilotScenes = [];
          for (const s of scenes) {
            const dur = s.durationInFrames || 90;
            if (pilotScenes.length >= 1 && pilotFrames + dur > 960) {
              break;
            }
            pilotScenes.push(s);
            pilotFrames += dur;
            if (pilotScenes.length >= 3) break;
          }
          return {
            durationInFrames: Math.max(1, pilotFrames),
            props: {
              ...props,
              scenes: pilotScenes.length > 0 ? pilotScenes : scenes.slice(0, 2),
            },
          };
        }}
      />
    </>
  );
};
