/*!
 * © 2026 Arbel Live Technologies. All rights reserved.
 *
 * This source file is proprietary and confidential. It is part of
 * the Arbel platform (https://arbel.live) and is protected by
 * copyright and international intellectual-property treaties.
 *
 * NO LICENSE is granted to copy, modify, distribute, sublicense,
 * rehost, mirror, fork, sell, or create derivative works of this
 * code, in whole or in part, without prior written permission
 * from Arbel Live Technologies.
 *
 * Reverse engineering, scraping, or automated extraction is
 * expressly prohibited.
 *
 * Unauthorized use will be pursued under applicable copyright,
 * computer-misuse, and unfair-competition laws.
 *
 * Contact: arbeltechnologies@gmail.com
 */
/* ═══════════════════════════════════════════════
   AI MEDIA — BYOK Video & Image Generation

   All calls go DIRECTLY from browser → provider.
   No middleman server, no logging.
   Keys from ArbelKeyManager (localStorage).

   Supported:
     Video → Replicate (Wan2.1, AnimateDiff),
             Runway Gen-4, Kling 2.0, Luma,
             OpenAI Sora
     Image → Replicate, Stability, OpenAI DALL-E,
             Hugging Face Inference
   ═══════════════════════════════════════════════ */

window.ArbelAIMedia = (function () {
    'use strict';

    /* ─── Provider endpoints ─── */
    var ENDPOINTS = {
        replicate:     'https://api.replicate.com/v1/predictions',
        runway:        'https://api.dev.runwayml.com/v1/image_to_video',
        luma:          'https://api.lumalabs.ai/dream-machine/v1/generations',
        openai_vid:    'https://api.openai.com/v1/images/generations', // Sora via images API
        replicate_img: 'https://api.replicate.com/v1/predictions',
        stability:     'https://api.stability.ai/v2beta/stable-image/generate/sd3',
        openai_img:    'https://api.openai.com/v1/images/generations',
        huggingface:   'https://api-inference.huggingface.co/models/'
    };

    /* ─── Replicate model versions ─── */
    var REPLICATE_MODELS = {
        'wan2.1':        { version: 'wan-ai/wan2.1-t2v-480p', label: 'Wan 2.1 (Text→Video)' },
        'animatediff':   { version: 'lucataco/animate-diff:beecf59c4aee8d81bf04f0381033dfa10dc16e845b4ae00d281e2fa377e48a9f', label: 'AnimateDiff Lightning' },
        'svd':           { version: 'stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438', label: 'Stable Video Diffusion' },
        'sdxl':          { version: 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc', label: 'SDXL (Image)' },
        'flux':          { version: 'black-forest-labs/flux-schnell', label: 'Flux Schnell (Image)' }
    };

    /* ─── Hugging Face models ─── */
    var HF_MODELS = {
        'sdxl-turbo':    'stabilityai/sdxl-turbo',
        'sd3-medium':    'stabilityai/stable-diffusion-3-medium-diffusers',
        'flux-schnell':  'black-forest-labs/FLUX.1-schnell'
    };

    /* ─── Status constants ─── */
    var STATUS = { PENDING: 'pending', PROCESSING: 'processing', SUCCEEDED: 'succeeded', FAILED: 'failed', CANCELED: 'canceled' };

    /* ════════════════════════════════════════════
       VIDEO GENERATION
       ════════════════════════════════════════════ */

    /**
     * Generate a video. Returns { status, id, pollUrl, output? }
     * @param {Object} opts
     * @param {string} opts.prompt - Text description
     * @param {string} [opts.imageUrl] - Source image (for img2vid)
     * @param {string} [opts.model] - Replicate model key
     * @param {string} [opts.resolution] - landscape|portrait|square
     * @param {number} [opts.duration] - seconds (3|5|10)
     * @param {Function} [opts.onProgress] - callback(status, message)
     */
    async function generateVideo(opts) {
        var provider = ArbelKeyManager.getProvider('video');
        var apiKey = ArbelKeyManager.getKey('video');
        if (!apiKey) throw new Error('No video API key configured. Add one in AI Studio → Video tab.');
        if (!opts.prompt && !opts.imageUrl) throw new Error('Please provide a text prompt or source image.');

        if (provider === 'replicate') return _replicateVideo(apiKey, opts);
        if (provider === 'runway') return _runwayVideo(apiKey, opts);
        if (provider === 'luma') return _lumaVideo(apiKey, opts);
        if (provider === 'kling') return _klingVideo(apiKey, opts);
        if (provider === 'openai_vid') return _openaiVideo(apiKey, opts);

        throw new Error('Unsupported video provider: ' + provider);
    }

    /* ── Replicate (Wan2.1 / AnimateDiff / SVD) ── */
    async function _replicateVideo(apiKey, opts) {
        var model = REPLICATE_MODELS[opts.model || 'wan2.1'];
        if (!model) throw new Error('Unknown Replicate model: ' + opts.model);

        var input = { prompt: opts.prompt || '' };
        if (opts.imageUrl) input.image = opts.imageUrl;
        if (opts.duration) input.num_frames = Math.min(opts.duration * 8, 80);

        var resp = await fetch(ENDPOINTS.replicate, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Prefer': 'wait' },
            body: JSON.stringify({ version: model.version, input: input })
        });

        if (!resp.ok) {
            var err = await resp.json().catch(function () { return {}; });
            throw new Error(err.detail || 'Replicate error (' + resp.status + ')');
        }

        var data = await resp.json();

        // If the prediction is still running, poll
        if (data.status === 'starting' || data.status === 'processing') {
            return { status: STATUS.PROCESSING, id: data.id, pollUrl: data.urls && data.urls.get ? data.urls.get : null, provider: 'replicate' };
        }

        if (data.status === 'succeeded' && data.output) {
            var output = Array.isArray(data.output) ? data.output[0] : data.output;
            return { status: STATUS.SUCCEEDED, output: output, provider: 'replicate' };
        }

        if (data.status === 'failed') {
            throw new Error(data.error || 'Replicate prediction failed');
        }

        return { status: STATUS.PROCESSING, id: data.id, pollUrl: data.urls && data.urls.get ? data.urls.get : null, provider: 'replicate' };
    }

    /** Poll a Replicate prediction until done */
    async function pollReplicate(pollUrl) {
        var apiKey = ArbelKeyManager.getKey('video') || ArbelKeyManager.getKey('image');
        if (!apiKey || !pollUrl) throw new Error('Cannot poll — missing key or URL');

        var resp = await fetch(pollUrl, {
            headers: { 'Authorization': 'Bearer ' + apiKey }
        });
        if (!resp.ok) throw new Error('Poll failed (' + resp.status + ')');

        var data = await resp.json();
        if (data.status === 'succeeded') {
            var output = Array.isArray(data.output) ? data.output[0] : data.output;
            return { status: STATUS.SUCCEEDED, output: output };
        }
        if (data.status === 'failed') throw new Error(data.error || 'Prediction failed');
        return { status: STATUS.PROCESSING, pollUrl: pollUrl };
    }

    /* ── Runway Gen-4 ── */
    async function _runwayVideo(apiKey, opts) {
        var body = { prompt: opts.prompt || '', model: 'gen4_turbo' };
        if (opts.imageUrl) body.image = opts.imageUrl;
        if (opts.duration) body.duration = Math.min(opts.duration, 10);
        if (opts.resolution === 'portrait') body.ratio = '720:1280';
        else if (opts.resolution === 'square') body.ratio = '1080:1080';
        else body.ratio = '1280:720';

        var resp = await fetch(ENDPOINTS.runway, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'X-Runway-Version': '2024-11-06' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return {}; });
            throw new Error(err.error || 'Runway error (' + resp.status + ')');
        }
        var data = await resp.json();
        return { status: STATUS.PROCESSING, id: data.id, pollUrl: 'https://api.dev.runwayml.com/v1/tasks/' + data.id, provider: 'runway' };
    }

    /* ── Luma Dream Machine ── */
    async function _lumaVideo(apiKey, opts) {
        var body = { prompt: opts.prompt || '' };
        if (opts.imageUrl) body.keyframes = { frame0: { type: 'image', url: opts.imageUrl } };
        if (opts.resolution === 'portrait') body.aspect_ratio = '9:16';
        else if (opts.resolution === 'square') body.aspect_ratio = '1:1';
        else body.aspect_ratio = '16:9';

        var resp = await fetch(ENDPOINTS.luma, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return {}; });
            throw new Error(err.detail || 'Luma error (' + resp.status + ')');
        }
        var data = await resp.json();
        return { status: STATUS.PROCESSING, id: data.id, pollUrl: ENDPOINTS.luma + '/' + data.id, provider: 'luma' };
    }

    /* ── Kling 2.0 ── */
    async function _klingVideo(apiKey, opts) {
        var body = { prompt: opts.prompt || '', model: 'kling-v2' };
        if (opts.imageUrl) body.image_url = opts.imageUrl;
        if (opts.duration) body.duration = String(Math.min(opts.duration, 10));

        var resp = await fetch('https://api.klingai.com/v1/videos/text2video', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return {}; });
            throw new Error(err.message || 'Kling error (' + resp.status + ')');
        }
        var data = await resp.json();
        var taskId = data.data && data.data.task_id ? data.data.task_id : data.task_id || data.id;
        return { status: STATUS.PROCESSING, id: taskId, pollUrl: 'https://api.klingai.com/v1/videos/text2video/' + taskId, provider: 'kling' };
    }

    /* ── OpenAI Sora ── */
    async function _openaiVideo(apiKey, opts) {
        var body = {
            model: 'sora',
            prompt: opts.prompt || '',
            n: 1,
            size: opts.resolution === 'portrait' ? '1080x1920' : opts.resolution === 'square' ? '1080x1080' : '1920x1080'
        };
        if (opts.duration) body.duration = Math.min(opts.duration, 20);

        var resp = await fetch('https://api.openai.com/v1/video/generations', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return {}; });
            throw new Error((err.error && err.error.message) || 'OpenAI error (' + resp.status + ')');
        }
        var data = await resp.json();
        if (data.data && data.data[0] && data.data[0].url) {
            return { status: STATUS.SUCCEEDED, output: data.data[0].url, provider: 'openai_vid' };
        }
        return { status: STATUS.PROCESSING, id: data.id, provider: 'openai_vid' };
    }

    /* ════════════════════════════════════════════
       IMAGE GENERATION
       ════════════════════════════════════════════ */

    /**
     * Generate an image. Returns { status, output }
     * @param {Object} opts
     * @param {string} opts.prompt
     * @param {string} [opts.model] - Replicate/HF model key
     * @param {string} [opts.resolution] - landscape|portrait|square
     */
    async function generateImage(opts) {
        var provider = ArbelKeyManager.getProvider('image');
        var apiKey = ArbelKeyManager.getKey('image');
        if (!apiKey) throw new Error('No image API key configured. Add one in AI Studio → Image tab.');
        if (!opts.prompt) throw new Error('Please provide a text prompt.');

        if (provider === 'replicate_img') return _replicateImage(apiKey, opts);
        if (provider === 'stability') return _stabilityImage(apiKey, opts);
        if (provider === 'openai_img') return _openaiImage(apiKey, opts);
        if (provider === 'huggingface') return _hfImage(apiKey, opts);

        throw new Error('Unsupported image provider: ' + provider);
    }

    /* ── Replicate Image ── */
    async function _replicateImage(apiKey, opts) {
        var model = REPLICATE_MODELS[opts.model || 'flux'];
        var input = { prompt: opts.prompt };
        if (opts.resolution === 'portrait') { input.width = 768; input.height = 1344; }
        else if (opts.resolution === 'square') { input.width = 1024; input.height = 1024; }
        else { input.width = 1344; input.height = 768; }

        var resp = await fetch(ENDPOINTS.replicate_img, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Prefer': 'wait' },
            body: JSON.stringify({ version: model.version, input: input })
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return {}; });
            throw new Error(err.detail || 'Replicate error (' + resp.status + ')');
        }
        var data = await resp.json();
        if (data.status === 'succeeded' && data.output) {
            return { status: STATUS.SUCCEEDED, output: Array.isArray(data.output) ? data.output[0] : data.output };
        }
        return { status: STATUS.PROCESSING, id: data.id, pollUrl: data.urls && data.urls.get ? data.urls.get : null, provider: 'replicate' };
    }

    /* ── Stability AI ── */
    async function _stabilityImage(apiKey, opts) {
        var formData = new FormData();
        formData.append('prompt', opts.prompt);
        formData.append('output_format', 'png');
        if (opts.resolution === 'portrait') formData.append('aspect_ratio', '9:16');
        else if (opts.resolution === 'square') formData.append('aspect_ratio', '1:1');
        else formData.append('aspect_ratio', '16:9');

        var resp = await fetch(ENDPOINTS.stability, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
            body: formData
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return {}; });
            throw new Error(err.message || 'Stability error (' + resp.status + ')');
        }
        var data = await resp.json();
        if (data.image) {
            return { status: STATUS.SUCCEEDED, output: 'data:image/png;base64,' + data.image };
        }
        throw new Error('Unexpected Stability response');
    }

    /* ── OpenAI DALL-E ── */
    async function _openaiImage(apiKey, opts) {
        var size = '1792x1024';
        if (opts.resolution === 'portrait') size = '1024x1792';
        else if (opts.resolution === 'square') size = '1024x1024';

        var resp = await fetch(ENDPOINTS.openai_img, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'dall-e-3', prompt: opts.prompt, n: 1, size: size, response_format: 'url' })
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return {}; });
            throw new Error((err.error && err.error.message) || 'OpenAI error (' + resp.status + ')');
        }
        var data = await resp.json();
        return { status: STATUS.SUCCEEDED, output: data.data[0].url };
    }

    /* ── Hugging Face Inference ── */
    async function _hfImage(apiKey, opts) {
        var modelId = HF_MODELS[opts.model || 'flux-schnell'] || HF_MODELS['flux-schnell'];
        var resp = await fetch(ENDPOINTS.huggingface + modelId, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: opts.prompt })
        });
        if (!resp.ok) {
            var errText = await resp.text().catch(function () { return ''; });
            throw new Error('Hugging Face error (' + resp.status + '): ' + errText.slice(0, 200));
        }
        var blob = await resp.blob();
        var url = URL.createObjectURL(blob);
        return { status: STATUS.SUCCEEDED, output: url };
    }

    /* ════════════════════════════════════════════
       PHOTO → ANIMATION (client-side CSS effects)
       ════════════════════════════════════════════ */

    /**
     * Create a CSS animation effect from a static image
     * @param {string} imageUrl - URL or data URI of the image
     * @param {string} effect - ken-burns|parallax-zoom|float|pulse|rotate-slow
     * @returns {Object} style + scroll config for cinematic element
     */
    function photoToAnimation(imageUrl, effect) {
        var base = {
            style: {
                backgroundImage: 'url(' + imageUrl + ')',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'absolute',
                top: '0', left: '0', width: '100%', height: '100%',
                overflow: 'hidden'
            },
            scroll: null
        };

        switch (effect) {
            case 'ken-burns':
                base.scroll = { scale: [1, 1.15], x: [0, -30], y: [0, -20], start: 0, end: 1 };
                break;
            case 'parallax-zoom':
                base.scroll = { scale: [1.2, 1], opacity: [0.7, 1], start: 0, end: 0.6 };
                break;
            case 'float':
                base.scroll = { y: [30, -30], rotation: [-1, 1], start: 0, end: 1 };
                break;
            case 'pulse':
                base.scroll = { scale: [0.95, 1.05, 0.95], opacity: [0.8, 1, 0.8], start: 0, end: 1 };
                break;
            case 'rotate-slow':
                base.scroll = { rotation: [0, 5], scale: [1, 1.05], start: 0, end: 1 };
                break;
            case 'blur-reveal':
                base.scroll = { opacity: [0, 1], blur: [20, 0], scale: [1.1, 1], start: 0, end: 0.5 };
                break;
            case 'clip-reveal':
                base.scroll = { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], start: 0, end: 0.5 };
                break;
            default:
                break;
        }
        return base;
    }

    /* ─── Public API ─── */
    return {
        generateVideo: generateVideo,
        generateImage: generateImage,
        pollReplicate: pollReplicate,
        photoToAnimation: photoToAnimation,
        REPLICATE_MODELS: REPLICATE_MODELS,
        HF_MODELS: HF_MODELS,
        STATUS: STATUS
    };
})();
