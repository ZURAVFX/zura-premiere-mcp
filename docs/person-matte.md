# Local person matting for Premiere

`render_person_matte` runs a local recurrent model and writes a straight-alpha PNG sequence. Import `first_frame` with `import_image_sequence`, using the receipt's FPS. Place it above captions and match the webcam base's source range and native Motion. The rounded webcam base remains visible below the panel boundary. This operation generates an independent matte; it does not control Adobe's Object Mask tool.

The normal Windows/macOS Zura installer installs ONNX Runtime and FFmpeg through locked Node dependencies, then downloads the official RVM mobilenetv3 FP32 model into a per-user cache. No Python installation or separate model setup is required. First use also repairs a missing model cache. Downloads are verified against SHA256 `88d4531297118f595bf2fd60f6f566aec2e559393802d1f436c380f0cbbd2828` before use. Initial installation requires internet; subsequent inference is local.

Model source: https://github.com/PeterL1n/RobustVideoMatting/releases/tag/v1.0.0 . Upstream project and model licensing: GPL-3.0, https://github.com/PeterL1n/RobustVideoMatting/blob/master/LICENSE . No model weights or upstream Python implementation are bundled in the source archive. FFmpeg's static distribution includes its own licensing notices.

Process each continuous webcam shot separately. Recurrent state is preserved inside each invocation and starts fresh between shots. Output directories must be new. A failure can leave partial PNGs, which must not be imported as a completed matte. Receipt is written only after the requested frame count finishes. No cloud upload or ComfyUI is involved.

Development evidence: 120 frames of 600x402 webcam footage processed in 4.56 seconds on CPU. A 30-frame sequence imported into live Premiere at verified 60 FPS. One composited frame was visually inspected. This is not evidence of full-shot temporal quality, GPU performance or arbitrary-subject selection. The model is designed for people, not arbitrary objects. Review hair, hands, microphones and motion before delivery.

Next product work: cancellable background jobs, persistent cache keyed by media/trim/model, cut-aware reset, long-shot review and native layer placement. The current bounded operation is a tested development route, not a production-ready replacement for every rotoscoping workflow.

Integrated Node runtime validation on Windows: automatic model preparation, cached reuse and 30-frame inference through the built MCP handler passed (1.79 seconds inference/write). Package contents include the runtime. macOS native dependency installation remains unverified on a Mac.
