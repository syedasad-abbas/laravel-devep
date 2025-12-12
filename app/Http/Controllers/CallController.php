<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CallSession;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class CallController extends Controller
{
    public function dashboard(Request $request): View
    {
        $user = $request->user();

        return view('call.dashboard', [
            'user' => $user,
            'callLaunchUrl' => config('call.launch_url'),
            'isAdmin' => (bool) $user?->is_admin,
            'onlineUsers' => User::orderBy('name')
                ->get(['id', 'name', 'email', 'is_admin']),
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

    public function storeUser(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->is_admin, 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'is_admin' => ['sometimes', 'boolean'],
        ]);

        User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'is_admin' => (bool) ($data['is_admin'] ?? false),
        ]);

        return redirect()
            ->route('call.dashboard')
            ->with('status', __('User :email created successfully.', ['email' => $data['email']]));
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

}
