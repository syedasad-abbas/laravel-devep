<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class JambonzWebhookController extends Controller
{
    public function incoming(Request $request): JsonResponse
    {
        $this->assertAuthorized($request);

        $streamUrl = config('jambonz.stream_url');
        $webrtcUri = config('jambonz.webrtc_uri');

        if (!$streamUrl || !$webrtcUri) {
            abort(500, 'Jambonz streaming or WebRTC target is not configured.');
        }

        $metadata = [
            'call_id' => $request->input('call_sid') ?? $request->input('call_id'),
            'from' => $request->input('from'),
            'to' => $request->input('to'),
        ];

        $listenVerb = [
            'verb' => 'listen',
            'url' => $streamUrl,
            'mix' => 'mono',
            'statusHook' => route('webhooks.jambonz.listen-status'),
            'metadata' => $metadata,
            'transcription' => [
                'transcriptionHook' => route('webhooks.jambonz.transcription'),
                'recognizer' => [
                    'vendor' => config('jambonz.stt_vendor', 'google'),
                    'language' => config('jambonz.stt_language', 'en-US'),
                ],
            ],
        ];

        $target = [
            'type' => 'webrtc',
            'uri' => $webrtcUri,
        ];

        if (config('jambonz.webrtc_username') && config('jambonz.webrtc_password')) {
            $target['auth'] = [
                'username' => config('jambonz.webrtc_username'),
                'password' => config('jambonz.webrtc_password'),
            ];
        }

        $payload = [
            [
                'verb' => 'say',
                'text' => 'Connecting you to a secure WebRTC console.',
                'voice' => config('jambonz.voice', 'female'),
            ],
            $listenVerb,
            [
                'verb' => 'dial',
                'answerOnBridge' => true,
                'callerId' => $request->input('to'),
                'statusHook' => route('webhooks.jambonz.call-status'),
                'target' => [$target],
            ],
        ];

        return response()->json($payload);
    }

    public function callStatus(Request $request): JsonResponse
    {
        $this->assertAuthorized($request);
        Log::info('jambonz dial status', $request->all());

        return response()->json(['received' => true]);
    }

    public function listenStatus(Request $request): JsonResponse
    {
        $this->assertAuthorized($request);
        Log::info('jambonz listen status', $request->all());

        return response()->json(['received' => true]);
    }

    public function transcription(Request $request): JsonResponse
    {
        $this->assertAuthorized($request);
        Log::info('jambonz transcription', $request->all());

        return response()->json(['received' => true]);
    }

    protected function assertAuthorized(Request $request): void
    {
        $token = config('jambonz.webhook_token');
        if (!$token) {
            return;
        }

        $incoming = (string) $request->bearerToken();
        if ($incoming === '' || !hash_equals($token, $incoming)) {
            abort(401, 'Unauthorized');
        }
    }
}
