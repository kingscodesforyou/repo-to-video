import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TitleCard } from "../components/TitleCard";
import { BeforeAfterScene } from "../components/BeforeAfterScene";
import { CodeWalkthroughScene } from "../components/CodeWalkthroughScene";
import { TerminalScene } from "../components/TerminalScene";
import { Subtitles } from "../components/Subtitles";
import { Background } from "../components/Background";
import { ChapterBar, ChapterSpan } from "../components/ChapterBar";
import {
  HookScene,
  PointsScene,
  SkillGridScene,
  SkillCardScene,
  WorkflowScene,
  TierListScene,
  OutroScene,
  SpotlightScene,
  ArchitectureScene,
  MatrixCompareScene,
} from "../components/Scenes";
import {
  AnalogyTheater3DScene,
  FunnelDistill3DScene,
  TimelineEvolution3DScene,
  ExplodedArchitecture3DScene,
  FourSignalRadarSimScene,
  SliderScrubCompareScene,
  Terminal3DFlightScene,
  Carousel3DShowcaseScene,
} from "../components/ShotcraftScenes";

export interface SceneData {
  id: string;
  chapter?: string;
  title: string;
  type: string;
  narration: string;
  durationInFrames: number;
  audioFrames?: number;
  audioUrl?: string;
  data?: any;
}

export interface TutorialVideoProps {
  title: string;
  repoName: string;
  repoType: string;
  chapters?: string[];
  scenes: SceneData[];
}

const SceneContainer: React.FC<{ duration: number; children: React.ReactNode }> = ({
  duration,
  children,
}) => {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [Math.max(1, duration - 8), duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
};

export const TutorialVideo: React.FC<TutorialVideoProps> = ({
  repoName = "superpowers",
  scenes = [],
}) => {
  let acc = 0;
  const spans: { scene: SceneData; from: number; duration: number }[] = [];
  const chapterMap = new Map<string, ChapterSpan>();

  for (const scene of scenes) {
    const duration = scene.durationInFrames || 90;
    const from = acc;
    const end = acc + duration;
    spans.push({ scene, from, duration });
    const ch = scene.chapter || "讲解";
    const existing = chapterMap.get(ch);
    if (!existing) {
      chapterMap.set(ch, { name: ch, start: from, end });
    } else {
      existing.end = end;
    }
    acc = end;
  }

  const chapterSpans = Array.from(chapterMap.values());
  const totalFrames = Math.max(1, acc);

  return (
    <AbsoluteFill style={{ backgroundColor: "#1e1b4b" }}>
      <Background />
      <ChapterBar chapters={chapterSpans} total={totalFrames} repoName={repoName} />

      {spans.map(({ scene, from, duration }, index) => {
        const d = scene.data || {};
        const audioFrames = scene.audioFrames || Math.max(30, duration - 6);

        return (
          <Sequence key={scene.id || index} from={from} durationInFrames={duration}>
            <SceneContainer duration={duration}>
              {scene.type === "hook" && <HookScene title={scene.title} data={d} />}
              {scene.type === "points" && <PointsScene title={scene.title} data={d} />}
              {scene.type === "skill_grid" && <SkillGridScene title={scene.title} data={d} />}
              {scene.type === "skill_card" && <SkillCardScene title={scene.title} data={d} />}
              {scene.type === "workflow" && <WorkflowScene title={scene.title} data={d} />}
              {scene.type === "tier_list" && <TierListScene title={scene.title} data={d} />}
              {scene.type === "outro" && <OutroScene title={scene.title} data={d} />}
              {(scene.type === "spotlight" || scene.type === "hero_metric") && (
                <SpotlightScene title={scene.title} data={d} />
              )}
              {(scene.type === "architecture" || scene.type === "pipeline") && (
                <ArchitectureScene title={scene.title} data={d} />
              )}
              {scene.type === "matrix_compare" && (
                <MatrixCompareScene title={scene.title} data={d} />
              )}

              {/* Shotcraft 3D & 特级教师互动仿真镜头库 */}
              {scene.type === "analogy_3d" && (
                <AnalogyTheater3DScene title={scene.title} data={d} />
              )}
              {(scene.type === "funnel_3d" || scene.type === "funnel_sim") && (
                <FunnelDistill3DScene title={scene.title} data={d} />
              )}
              {scene.type === "timeline_3d" && (
                <TimelineEvolution3DScene title={scene.title} data={d} />
              )}
              {scene.type === "exploded_3d" && (
                <ExplodedArchitecture3DScene title={scene.title} data={d} />
              )}
              {scene.type === "radar_sim" && (
                <FourSignalRadarSimScene title={scene.title} data={d} />
              )}
              {scene.type === "slider_scrub" && (
                <SliderScrubCompareScene title={scene.title} data={d} />
              )}
              {scene.type === "terminal_3d" && (
                <Terminal3DFlightScene title={scene.title} data={d} />
              )}
              {scene.type === "carousel_3d" && (
                <Carousel3DShowcaseScene title={scene.title} data={d} />
              )}

              {scene.type === "title_card" && (
                <TitleCard
                  title={scene.title}
                  headline={d.headline}
                  subheadline={d.subheadline}
                  tag={d.tag}
                />
              )}

              {scene.type === "compare" && (
                <BeforeAfterScene
                  title={scene.title}
                  before_title={d.before_title}
                  before_text={d.before_text}
                  after_title={d.after_title}
                  after_text={d.after_text}
                />
              )}

              {scene.type === "code_focus" && (
                <CodeWalkthroughScene
                  title={scene.title}
                  code={d.code || ""}
                  language={d.language || "yaml"}
                  filename={d.filename || "SKILL.md"}
                />
              )}

              {scene.type === "terminal" && (
                <TerminalScene title={scene.title} commands={d.commands || []} />
              )}
            </SceneContainer>

            {scene.audioUrl && (
              <Audio
                src={
                  scene.audioUrl.startsWith("http")
                    ? scene.audioUrl
                    : staticFile(scene.audioUrl)
                }
              />
            )}

            <Subtitles text={scene.narration} audioFrames={audioFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
