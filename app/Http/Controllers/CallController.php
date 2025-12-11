<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CallSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class CallController extends Controller
{
    public function dashboard(Request $request): View
    {
        $sipDomain = config('jambonz.sip_domain');
        $sipDomainStatus = $this->sipDomainStatus($sipDomain);

        return view('call.dashboard', [
            'user' => $request->user(),
            'sipConfig' => $this->sipConfig($request),
            'sipDomain' => $sipDomain,
            'sipDomainReachable' => $sipDomainStatus['reachable'],
            'sipDomainStatus' => $sipDomainStatus,
        ]);
    }

    public function createSession(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dialed_number' => ['nullable', 'string', 'max:32'],
        ]);

        $callCode = $this->generateUniqueCode();

        $session = CallSession::create([
            'call_code' => $callCode,
            'creator_id' => $request->user()->id,
            'dialed_number' => $data['dialed_number'] ?? null,
            'status' => 'pending',
        ]);

        return response()->json($this->formatSession($session));
    }

    public function showSession(string $code): JsonResponse
    {
        $session = $this->findSession($code);

        return response()->json($this->formatSession($session));
    }

    public function storeOffer(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'offer' => ['required', 'array'],
            'dialed_number' => ['nullable', 'string', 'max:32'],
        ]);

        $session = $this->findSession($code);
        $session->update([
            'offer' => $data['offer'],
            'dialed_number' => $data['dialed_number'] ?? $session->dialed_number,
            'status' => 'calling',
            'offer_candidates' => [],
            'answer_candidates' => [],
        ]);

        return response()->json($this->formatSession($session->refresh()));
    }

    public function storeAnswer(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'answer' => ['required', 'array'],
        ]);

        $session = $this->findSession($code);
        $session->update([
            'answer' => $data['answer'],
            'status' => 'in_progress',
        ]);

        return response()->json($this->formatSession($session->refresh()));
    }

    public function storeCandidate(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'candidate' => ['required', 'array'],
            'role' => ['required', Rule::in(['offer', 'answer'])],
        ]);

        $session = $this->findSession($code);
        $field = $data['role'] === 'offer' ? 'offer_candidates' : 'answer_candidates';
        $candidates = $session->$field ?? [];
        $candidates[] = $data['candidate'];
        $session->update([
            $field => $candidates,
        ]);

        return response()->json(['received' => true, 'count' => count($candidates)]);
    }

    public function updateStatus(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'max:32'],
        ]);

        $session = $this->findSession($code);
        $session->update([
            'status' => $data['status'],
        ]);

        return response()->json($this->formatSession($session->refresh()));
    }

    public function sipLogin(Request $request): JsonResponse
    {
        // Validate the agent-provided login credentials that will be forwarded to jambonz.
        $data = $request->validate([
            'email' => ['required', 'email'],
            'username' => ['required', 'string', 'max:80'],
        ]);

        $domain = config('jambonz.sip_domain');
        $domainStatus = $this->sipDomainStatus($domain);
        // Fail early with a descriptive message when DNS or SBC configuration is broken.
        if (!$domainStatus['reachable']) {
            $message = $domainStatus['message'];

            return response()->json([
                'message' => $message,
                'errors' => [
                    'domain' => [$message],
                ],
            ], 422);
        }

        $uri = sprintf('sip:%s@%s', $data['username'], $domain);
        $displayBase = $request->user()->name ?: $data['username'];
        $displayName = sprintf('%s <%s>', $displayBase, $data['email']);

        $config = $this->sipConfig($request, [
            'username' => $data['username'],
            'displayName' => $displayName,
            'uri' => $uri,
            'contact_email' => $data['email'],
        ]);

        return response()->json([
            'config' => $config,
            'message' => __('Registration request sent to jambonz.'),
        ]);
    }

    protected function findSession(string $code): CallSession
    {
        return CallSession::where('call_code', strtoupper($code))->firstOrFail();
    }

    protected function generateUniqueCode(): string
    {
        do {
            $code = Str::upper(Str::random(6));
        } while (CallSession::where('call_code', $code)->exists());

        return $code;
    }

    protected function formatSession(CallSession $session): array
    {
        return [
            'call_code' => $session->call_code,
            'dialed_number' => $session->dialed_number,
            'status' => $session->status,
            'offer' => $session->offer,
            'answer' => $session->answer,
            'offer_candidates' => $session->offer_candidates ?? [],
            'answer_candidates' => $session->answer_candidates ?? [],
            'updated_at' => $session->updated_at,
        ];
    }

    protected function sipConfig(Request $request, array $overrides = []): array
    {
        $base = [
            'wssServer' => config('jambonz.sip_wss_server'),
            'domain' => config('jambonz.sip_domain'),
            'username' => config('jambonz.sip_username'),
            'password' => config('jambonz.sip_password'),
            'displayName' => config('jambonz.sip_display_name') ?: ($request->user()->name ?: $request->user()->email),
            'uri' => config('jambonz.webrtc_uri'),
        ];

        $filteredOverrides = array_filter($overrides, static fn ($value) => $value !== null);

        return array_merge($base, $filteredOverrides);
    }

    protected function sipDomainStatus(?string $domain): array
    {
        if (!$domain) {
            return [
                'reachable' => false,
                'code' => 'missing',
                'message' => __('SIP domain not configured. Update env settings and reload the page.'),
            ];
        }

        if (filter_var($domain, FILTER_VALIDATE_IP)) {
            return [
                'reachable' => true,
                'code' => 'ip',
                'message' => __('SIP domain resolves to a static IP.'),
            ];
        }

        try {
            if (function_exists('checkdnsrr') && (checkdnsrr($domain, 'A') || checkdnsrr($domain, 'AAAA'))) {
                return [
                    'reachable' => true,
                    'code' => 'dns',
                    'message' => __('SIP domain resolved successfully.'),
                ];
            }

            $resolved = gethostbyname($domain);
            if ($resolved !== false && $resolved !== $domain) {
                return [
                    'reachable' => true,
                    'code' => 'dns',
                    'message' => __('SIP domain resolved successfully.'),
                ];
            }
        } catch (\Throwable $exception) {
            report($exception);
            return [
                'reachable' => false,
                'code' => 'error',
                'message' => __('Unable to verify SIP domain DNS records.'),
            ];
        }

        return [
            'reachable' => false,
            'code' => 'unresolved',
            'message' => __('Address not found for :domain', ['domain' => $domain]),
        ];
    }
}
