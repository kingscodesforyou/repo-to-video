#!/usr/bin/env node
/** Remotion Node API worker. Invoked once by run_evals.py after schema gates.
 * Dependencies are resolved from templates/package.json, never root node_modules.
 * Does not create/approve goldens or run TTS. See render_jobs.json for inputs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templates = path.join(root, 'templates');
const require = createRequire(path.join(templates, 'package.json'));
const writeJson = async (file, data) => {
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
};
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const errorText = (error) => error?.stack || String(error);

async function sourceProvenance() {
  const files = [];
  async function walk(dir) {
    for (const item of (await fs.readdir(dir, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) await walk(file);
      else {
        const bytes = await fs.readFile(file);
        // Fixed seeded Remotion random() is supported; ambient entropy is not.
        // This also prevents concurrency/page reuse from changing random sequences.
        if (/\.(?:tsx?|jsx?)$/.test(file) && /\bMath\.random\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandom\s*\(\s*null\s*\)/.test(bytes.toString('utf8'))) {
          throw new Error(`Non-deterministic time/random source is forbidden in evals: ${file}`);
        }
        files.push({file: path.relative(templates, file).replaceAll('\\', '/'), sha256: sha256(bytes)});
      }
    }
  }
  await walk(path.join(templates, 'src'));
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) {
    files.push({file: name, sha256: sha256(await fs.readFile(path.join(templates, name)))});
  }
  return {source_sha256: sha256(JSON.stringify(files)), files};
}

async function parallelLimit(items, limit, action) {
  let cursor = 0;
  const errors = [];
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try { await action(item); } catch (error) { errors.push(error); }
    }
  }));
  if (errors.length) throw new AggregateError(errors, errors.map(errorText).join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--jobs') {
    throw new Error('Usage: node scripts/render_evals.mjs --jobs /absolute/path/render_jobs.json (prepared by run_evals.py)');
  }
  const jobFile = path.resolve(args[1]);
  const outputDir = path.dirname(jobFile);
  const batch = await readJson(jobFile);
  const {settings, cases} = batch;
  if (!Array.isArray(cases) || !cases.length) throw new Error('No render cases');
  if (settings.fps !== 30 || settings.frames_per_beat !== 40 || settings.width !== 1920 ||
      settings.height !== 1080 || settings.scale !== 0.5 || settings.concurrency !== 2 ||
      settings.seed !== 430 || settings.bundle_cache !== false || settings.audio !== false) {
    throw new Error('Unexpected benchmark settings: use run_evals.py to prepare jobs');
  }
  if (new Set(cases.map((job) => job.case)).size !== cases.length) throw new Error('Duplicate cases');
  for (const job of cases) {
    if (!/^0\d_[a-z0-9_]+$/.test(job.case) || path.resolve(job.output_dir) !== path.join(outputDir, job.case)) {
      throw new Error(`Unexpected case output directory: ${job.output_dir}`);
    }
  }
  const results = new Map();
  async function record(job, result) {
    results.set(job.case, result);
    await writeJson(path.join(job.output_dir, 'render_result.json'), result);
  }
  for (const job of cases) {
    await record(job, {status: 'RUNNING', run_id: job.run_id, case: job.case, started_at: new Date().toISOString()});
  }

  let browser;
  let environment;
  let provenance;
  let failed = false;
  try {
    const {bundle} = require('@remotion/bundler');
    const {openBrowser, selectComposition, renderMedia, renderStill} = require('@remotion/renderer');
    const versions = Object.fromEntries(['remotion', '@remotion/cli', '@remotion/bundler', '@remotion/renderer', 'react', 'react-dom']
      .map((name) => [name, require(`${name}/package.json`).version]));
    if (new Set(['remotion', '@remotion/cli', '@remotion/bundler', '@remotion/renderer'].map((name) => versions[name])).size !== 1) {
      throw new Error(`Remotion package versions must match: ${JSON.stringify(versions)}`);
    }
    provenance = await sourceProvenance();
    // One fresh compilation for the entire batch. No npx, per-frame compilation,
    // persisted webpack cache, or dependence on CLI remotion.config.ts defaults.
    const serveUrl = await bundle({
      entryPoint: path.join(templates, 'src', 'index.ts'),
      rootDir: templates,
      outDir: path.join(outputDir, '_bundle'),
      enableCaching: false,
    });
    const chromiumOptions = {gl: settings.gl, darkMode: false, enableMultiProcessOnLinux: true};
    browser = await openBrowser('chrome', {
      browserExecutable: batch.browser_executable || undefined,
      chromiumOptions, forceDeviceScaleFactor: 1, logLevel: 'info',
    });
    const {value: chrome} = await browser.connection.send('Browser.getVersion');
    if (!chrome?.product) throw new Error('Chrome version metadata unavailable');
    environment = {
      packages: versions, chrome: chrome.product, chrome_revision: chrome.revision,
      chrome_js_version: chrome.jsVersion, node: process.version,
      platform: process.platform, os_release: os.release(), arch: process.arch,
      locale: 'en-US', timezone: 'UTC', device_scale_factor: 1,
      random_policy: 'EVAL_SEED=430; deterministic Remotion random only; ambient random/time rejected',
      cache_policy: 'fresh bundle and browser profile; no webpack persistent cache',
    };
    // Exposed to the browser for any seeded procedural renderer; current scenes
    // are frame-derived. This does not rewrite or strip their original payloads.
    const envVariables = {EVAL_SEED: String(settings.seed), TZ: 'UTC', LANG: 'en_US.UTF-8'};
    const baseOptions = {serveUrl, puppeteerInstance: browser, chromiumOptions,
      envVariables, logLevel: 'info', timeoutInMilliseconds: 120000};
    for (const job of cases) {
      const start = Date.now();
      let stage = 'props';
      try {
        const props = await readJson(job.props_path);
        if (!Array.isArray(props.scenes) || !props.scenes.length || props.fps !== settings.fps ||
            props.scenes.some((s) => s.audioUrl || s.durationInFrames !== s.visual_choreography.length * settings.frames_per_beat)) {
          throw new Error('Invalid silent benchmark props');
        }
        if (!job.samples.length || new Set(job.samples.map((s) => s.file)).size !== job.samples.length) {
          throw new Error('Empty/duplicate sample list');
        }
        for (const sample of job.samples) {
          if (!/^frames\/frame_\d{6,}\.png$/.test(sample.file) || !Number.isInteger(sample.frame) ||
              sample.frame < 0 || sample.frame >= props.totalFrames) throw new Error('Invalid sample frame');
        }
        // Only generated artifact names are cleared. A previous run cannot fill a
        // missing frame or masquerade as the current run after a partial failure.
        await fs.rm(path.join(job.output_dir, 'frames'), {recursive: true, force: true});
        await fs.mkdir(path.join(job.output_dir, 'frames'), {recursive: true});
        for (const name of ['video.mp4', 'contact_sheet.png', 'visual_comparison.json', 'render_manifest.json']) {
          await fs.rm(path.join(job.output_dir, name), {force: true});
        }
        stage = 'composition';
        const composition = await selectComposition({...baseOptions, id: settings.composition_id, inputProps: props});
        if (composition.fps !== settings.fps || composition.width !== settings.width ||
            composition.height !== settings.height || composition.durationInFrames !== props.totalFrames) {
          throw new Error(`Unexpected composition geometry/timing: ${JSON.stringify(composition)}`);
        }
        stage = 'video';
        await renderMedia({...baseOptions, composition, inputProps: props,
          outputLocation: path.join(job.output_dir, 'video.mp4'), codec: settings.codec,
          crf: settings.crf, pixelFormat: settings.pixel_format, imageFormat: 'png',
          scale: settings.scale, concurrency: settings.concurrency, overwrite: true,
          muted: true, enforceAudioTrack: false, hardwareAcceleration: 'disable',
          offthreadVideoCacheSizeInBytes: 64 * 1024 * 1024, mediaCacheSizeInBytes: 128 * 1024 * 1024,
        });
        stage = 'sampled_stills';
        await parallelLimit(job.samples, settings.concurrency, async (sample) => {
          await renderStill({...baseOptions, composition, inputProps: props,
            frame: sample.frame, output: path.join(job.output_dir, sample.file),
            scale: settings.scale, imageFormat: 'png', overwrite: true,
          });
        });
        await record(job, {status: 'PASS', run_id: job.run_id, case: job.case,
          elapsed_ms: Date.now() - start, environment, provenance, settings,
          video: path.join(job.output_dir, 'video.mp4'), samples: job.samples,
          rendered_dimensions: [settings.width * settings.scale, settings.height * settings.scale],
          duration_in_frames: composition.durationInFrames, audio: 'NONE',
          semantic_review: 'PENDING_REVIEW', finished_at: new Date().toISOString(),
        });
        console.log(`${job.case}: rendered ${composition.durationInFrames} frames; ${job.samples.length} sampled PNGs`);
      } catch (error) {
        failed = true;
        await record(job, {status: 'FAIL', run_id: job.run_id, case: job.case, stage,
          error: errorText(error), environment, provenance, elapsed_ms: Date.now() - start});
        console.error(`${job.case} failed at ${stage}: ${errorText(error)}`);
      }
    }
  } catch (error) {
    failed = true;
    for (const job of cases) {
      if (results.get(job.case)?.status === 'RUNNING') {
        await record(job, {status: 'FAIL', run_id: job.run_id, case: job.case,
          stage: 'batch_setup', error: errorText(error), environment, provenance});
      }
    }
    console.error(errorText(error));
  } finally {
    if (browser) {
      try { await browser.close({silent: true}); }
      catch (error) { failed = true; console.error(`Browser cleanup: ${errorText(error)}`); }
    }
    await writeJson(path.join(outputDir, 'render_batch.json'), {
      status: failed ? 'FAIL' : 'PASS', bundle_compilations: 1,
      environment, provenance, settings, cases: [...results.values()],
      semantic_review: 'PENDING_REVIEW',
    });
  }
  return failed ? 1 : 0;
}

// Keep process-side locale/timezone stable as well as the supplied browser env.
process.env.TZ = 'UTC';
process.env.LANG = 'en_US.UTF-8';
main().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(errorText(error));
  process.exitCode = 1;
});
