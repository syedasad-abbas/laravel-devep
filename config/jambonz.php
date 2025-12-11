<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Shared Secret For Webhooks
    |--------------------------------------------------------------------------
    |
    | Incoming requests from jambonz can be secured with a bearer token.
    | Provide the same token when configuring your jambonz application hooks.
    |
    */
    'webhook_token' => env('JAMBONZ_WEBHOOK_TOKEN'),

    /*
    |--------------------------------------------------------------------------
    | Live Audio Streaming (listen verb)
    |--------------------------------------------------------------------------
    |
    | When jambonz executes a "listen" verb it needs a streaming endpoint.
    | In most deployments this is a wss:// URL that points to a media worker
    | or transcription engine. We also expose status hooks handled by Laravel.
    |
    */
    'stream_url' => env('JAMBONZ_STREAM_URL'),

    /*
    |--------------------------------------------------------------------------
    | Speech Recognition Defaults
    |--------------------------------------------------------------------------
    |
    | The transcription hook can request transcripts via jambonz. Configure
    | vendor and locale used in recognizer payloads.
    |
    */
    'stt_vendor' => env('JAMBONZ_STT_VENDOR', 'google'),
    'stt_language' => env('JAMBONZ_STT_LANGUAGE', 'en-US'),

    /*
    |--------------------------------------------------------------------------
    | WebRTC Target
    |--------------------------------------------------------------------------
    |
    | jambonz "dial" verb targets one or more endpoints. For this dashboard
    | we connect the PSTN caller to a WebRTC agent that logs into the app.
    |
    */
    'webrtc_uri' => env('JAMBONZ_WEBRTC_URI', 'sip:agent@sbc.jambonz.local'),
    'webrtc_username' => env('JAMBONZ_WEBRTC_USERNAME'),
    'webrtc_password' => env('JAMBONZ_WEBRTC_PASSWORD'),

    /*
    |--------------------------------------------------------------------------
    | Voice Settings
    |--------------------------------------------------------------------------
    |
    | Control the synthesised voice used for short "say" prompts that play
    | before bridging the caller.
    |
    */
    'voice' => env('JAMBONZ_TTS_VOICE', 'female'),

    /*
    |--------------------------------------------------------------------------
    | SIP/WebRTC Client Registration
    |--------------------------------------------------------------------------
    |
    | The browser acts as a SIP user agent registering over WebSocket so
    | jambonz can deliver calls using the dial verb. Provide SBC endpoint
    | (WSS), SIP domain, and credentials issued by your carrier/app.
    |
    */
    'sip_wss_server' => env('JAMBONZ_SIP_WSS', 'wss://sbc.jambonz.local:8443'),
    'sip_domain' => env('JAMBONZ_SIP_DOMAIN', 'sbc.jambonz.local'),
    'sip_username' => env('JAMBONZ_SIP_USERNAME'),
    'sip_password' => env('JAMBONZ_SIP_PASSWORD'),
    'sip_display_name' => env('JAMBONZ_SIP_DISPLAY_NAME'),
];
