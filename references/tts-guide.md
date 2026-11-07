# 局域网 Index-TTS 集成指南

本技能默认对接用户部署在内网的 Index-TTS 语音合成服务器。

## 接口规范

- **Endpoint**: `http://192.168.8.106:8712/tts`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "text": "要合成的中文讲解文案",
    "voice": "examples/yali.wav",
    "emo_alpha": 1.0
  }
  ```
  > 音色支持传 `yali.wav` 或 `examples/yali.wav`，脚本会自动适配补全路径。默认使用 `yali.wav`。
- **Response**: 二进制流（`audio/wav` 格式）
- **Timeout**: 180 秒（防止大文本渲染排队超时）

## 关键网络注意事项

1. **SOCKS 代理绕过**：
   在很多开发机上设置了 `HTTP_PROXY` / `ALL_PROXY`（如 `socks5://127.0.0.1:60091`）。Python 的 `requests` 库若检测到该变量，会尝试通过 SOCKS 代理去访问内网 IP `192.168.8.106`，从而导致 `Missing dependencies for SOCKS support` 或连接超时报错。
   因此脚本中必须设置：
   ```python
   session = requests.Session()
   session.trust_env = False  # 强制直连内网
   ```

2. **音频时长与音画同步**：
   Index-TTS 返回标准的 RIFF WAV 音频头。
   脚本使用 Python 原生 `wave` 模块：
   ```python
   import wave
   with wave.open("scene_1.wav", "rb") as f:
       duration_sec = f.getnframes() / f.getframerate()
   ```
   计算得到的秒数乘以 FPS（默认 30），即可作为 Remotion 对应组件的渲染帧长，实现 100% 精确的音画对齐。

3. **优雅降级机制**：
   若另一台电脑未开机或 TTS 服务未启动，脚本会自动按中文正常语速（约 3.8~4.2 字/秒）生成同等长度的静音占位 WAV 音频，确保视频合成流水线和 Remotion 预览能够正常跑通，不会由于单点网络故障而彻底中断开发。
