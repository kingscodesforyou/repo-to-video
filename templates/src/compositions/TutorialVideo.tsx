import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TitleCard } from "../components/TitleCard";
import { BeforeAfterScene } from "../components/BeforeAfterScene";
import { CodeWalkthroughScene } from "../components/CodeWalkthroughScene";
import { TerminalScene } from "../components/TerminalScene";
import { Subtitles, PhraseTiming, WordTiming } from "../components/Subtitles";
import { Background } from "../components/Background";
import { ChapterBar, ChapterSpan } from "../components/ChapterBar";
import {
  ChoreographedScene,
  ChoreographyBeat,
  BeatTiming,
  TextOverlayItem,
  VisualWorldSpec,
} from "../components/ChoreographedScene";
import { GlobalArtDirection, SceneArtDirection } from "../theme";
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
  title?: string;
  type?: string;
  continuity_group?: string;
  narration: string;
  visual_intent?: string;
  art_direction?: SceneArtDirection;
  visual_world?: VisualWorldSpec;
  visual_choreography?: ChoreographyBeat[];
  text_overlays?: TextOverlayItem[];
  phrase_timings?: PhraseTiming[];
  word_timings?: WordTiming[];
  beat_timings?: BeatTiming[];
  durationInFrames: number;
  audioFrames?: number;
  audioUrl?: string;
  data?: any;
}

export interface TutorialVideoProps {
  schemaVersion?: string;
  title: string;
  repoName: string;
  repoUrl?: string;
  repoType: string;
  chapters?: string[];
  globalArtDirection?: GlobalArtDirection;
  scenes: SceneData[];
}

const SceneContainer: React.FC<{
  duration: number;
  sameContinuityAsPrev?: boolean;
  sameContinuityAsNext?: boolean;
  children: React.ReactNode;
}> = ({ duration, sameContinuityAsPrev, sameContinuityAsNext, children }) => {
  const f = useCurrentFrame();
  // 若相邻镜头属于同一个连续三维空间组 (continuity_group)，减少淡入淡出黑场跳变，保持叙事连贯
  const fadeInFrames = sameContinuityAsPrev ? 3 : 8;
  const fadeOutFrames = sameContinuityAsNext ? 3 : 8;
  const fadeIn = interpolate(f, [0, fadeInFrames], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [Math.max(1, duration - fadeOutFrames), duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
};

export const TutorialVideo: React.FC<TutorialVideoProps> = ({
  repoName = "repo-to-video",
  globalArtDirection,
  scenes = [],
}) => {
  let acc = 0;
  const spans: { scene: SceneData; from: number; duration: number }[] = [];
  const chapterMap = new Map<string, ChapterSpan>();

  for (const scene of scenes) {
    const duration = scene.durationInFrames || 120;
    const from = acc;
    const end = acc + duration;
    spans.push({ scene, from, duration });
    const ch = scene.chapter || scene.title || "核心演示";
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
    <AbsoluteFill style={{ backgroundColor: "#0B0D12" }}>
      <ChapterBar chapters={chapterSpans} total={totalFrames} repoName={repoName} />

      {spans.map(({ scene, from, duration }, index) => {
        const d = scene.data || {};
        const audioFrames = scene.audioFrames || Math.max(30, duration - 6);
        const isV4Choreographed =
          Boolean(scene.visual_choreography && scene.visual_choreography.length > 0) ||
          scene.type === "choreographed_v4";

        const prevGroup = index > 0 ? spans[index - 1].scene.continuity_group : undefined;
        const nextGroup =
          index < spans.length - 1 ? spans[index + 1].scene.continuity_group : undefined;
        const sameAsPrev = Boolean(scene.continuity_group && scene.continuity_group === prevGroup);
        const sameAsNext = Boolean(scene.continuity_group && scene.continuity_group === nextGroup);

        return (
          <Sequence key={scene.id || index} from={from} durationInFrames={duration}>
            {/* 每个镜头根据自身 art_direction 和 globalArtDirection 渲染克制统一的演播室背景 */}
            <Background
              artDirection={scene.art_direction}
              globalArtDirection={globalArtDirection}
              environment={scene.visual_world?.environment}
            />

            <SceneContainer
              duration={duration}
              sameContinuityAsPrev={sameAsPrev}
              sameContinuityAsNext={sameAsNext}
            >
              {isV4Choreographed ? (
                <ChoreographedScene
                  scene={{
                    ...scene,
                    durationInFrames: duration,
                  }}
                  globalArtDirection={globalArtDirection}
                />
              ) : (
                <>
                  {scene.type === "hook" && <HookScene title={scene.title || ""} data={d} />}
                  {scene.type === "points" && <PointsScene title={scene.title || ""} data={d} />}
                  {scene.type === "skill_grid" && (
                    <SkillGridScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "skill_card" && (
                    <SkillCardScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "workflow" && (
                    <WorkflowScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "tier_list" && (
                    <TierListScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "outro" && <OutroScene title={scene.title || ""} data={d} />}
                  {(scene.type === "spotlight" || scene.type === "hero_metric") && (
                    <SpotlightScene title={scene.title || ""} data={d} />
                  )}
                  {(scene.type === "architecture" || scene.type === "pipeline") && (
                    <ArchitectureScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "matrix_compare" && (
                    <MatrixCompareScene title={scene.title || ""} data={d} />
                  )}

                  {scene.type === "analogy_3d" && (
                    <AnalogyTheater3DScene title={scene.title || ""} data={d} />
                  )}
                  {(scene.type === "funnel_3d" || scene.type === "funnel_sim") && (
                    <FunnelDistill3DScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "timeline_3d" && (
                    <TimelineEvolution3DScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "exploded_3d" && (
                    <ExplodedArchitecture3DScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "radar_sim" && (
                    <FourSignalRadarSimScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "slider_scrub" && (
                    <SliderScrubCompareScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "terminal_3d" && (
                    <Terminal3DFlightScene title={scene.title || ""} data={d} />
                  )}
                  {scene.type === "carousel_3d" && (
                    <Carousel3DShowcaseScene title={scene.title || ""} data={d} />
                  )}

                  {scene.type === "title_card" && (
                    <TitleCard
                      title={scene.title || ""}
                      headline={d.headline}
                      subheadline={d.subheadline}
                      tag={d.tag}
                    />
                  )}

                  {scene.type === "compare" && (
                    <BeforeAfterScene
                      title={scene.title || ""}
                      before_title={d.before_title}
                      before_text={d.before_text}
                      after_title={d.after_title}
                      after_text={d.after_text}
                    />
                  )}

                  {scene.type === "code_focus" && (
                    <CodeWalkthroughScene
                      title={scene.title || ""}
                      code={d.code || ""}
                      language={d.language || "yaml"}
                      filename={d.filename || "SKILL.md"}
                    />
                  )}

                  {scene.type === "terminal" && (
                    <TerminalScene title={scene.title || ""} commands={d.commands || []} />
                  )}
                </>
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

            <Subtitles
              text={scene.narration}
              audioFrames={audioFrames}
              phraseTimings={scene.phrase_timings}
              words={scene.word_timings}
              artDirection={scene.art_direction}
              globalArtDirection={globalArtDirection}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
