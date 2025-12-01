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
        return view('call.dashboard', [
            'user' => $request->user(),
            'sipConfig' => $this->sipConfig($request),
            'sipIdentity' => $this->sipIdentity($request),
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

    protected function sipConfig(Request $request): array
    {
        $username = (string) $request->session()->get('jambonz_sip_username');
        $domain = (string) $request->session()->get('jambonz_sip_domain');
        $password = (string) $request->session()->get('jambonz_sip_password');
        $username = $username !== '' ? $username : null;
        $domain = $domain !== '' ? $domain : null;
        $password = $password !== '' ? $password : null;

        return [
            'wssServer' => config('jambonz.sip_wss_server'),
            'domain' => $domain,
            'username' => $username,
            'password' => $password,
            'displayName' => $request->user()?->name ?: $username,
            'uri' => $username && $domain ? sprintf('sip:%s@%s', $username, $domain) : null,
            'referDomain' => $domain,
        ];
    }

    protected function sipIdentity(Request $request): ?string
    {
        $username = (string) $request->session()->get('jambonz_sip_username');
        $domain = (string) $request->session()->get('jambonz_sip_domain');
        if ($username === '' || $domain === '') {
            return null;
        }

        return sprintf('%s@%s', $username, $domain);
    }
}
