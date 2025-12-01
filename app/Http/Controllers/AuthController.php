<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Auth\GenericUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function showLogin(): View|RedirectResponse
    {
        if (Auth::check()) {
            return redirect()->route('call.dashboard');
        }

        return view('auth.login');
    }

    public function login(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'identity' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        [$username, $domainHost, $port] = $this->parseIdentity($data['identity']);
        $hostPort = sprintf('%s:%s', $domainHost, $port);

        $this->storeSipCredentials($request, $username, $domainHost, $port, $data['password']);

        $user = new GenericUser([
            'id' => sprintf('%s@%s', $username, $hostPort),
            'name' => $username,
            'email' => sprintf('%s@%s', $username, $domainHost),
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->intended(route('call.dashboard'));
    }

    public function logout(Request $request): RedirectResponse
    {
        $this->forgetSipCredentials($request);
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }

    protected function parseIdentity(string $identity): array
    {
        $identity = trim($identity);
        $atPos = strpos($identity, '@');
        if ($atPos === false) {
            throw ValidationException::withMessages([
                'identity' => __('Use the format username@domain:port'),
            ]);
        }
        $username = substr($identity, 0, $atPos);
        $hostPort = substr($identity, $atPos + 1);

        $portSep = strrpos($hostPort, ':');
        if ($portSep === false) {
            throw ValidationException::withMessages([
                'identity' => __('Provide a domain and numeric port after the @ symbol.'),
            ]);
        }
        $domain = substr($hostPort, 0, $portSep);
        $port = substr($hostPort, $portSep + 1);

        if ($username === '' || $domain === '' || $port === '' || !ctype_digit($port)) {
            throw ValidationException::withMessages([
                'identity' => __('Provide username@domain:port with a numeric port.'),
            ]);
        }

        return [$username, $domain, $port];
    }

    protected function storeSipCredentials(Request $request, string $username, string $domain, string $port, string $password): void
    {
        $request->session()->put([
            'jambonz_sip_username' => $username,
            'jambonz_sip_domain' => sprintf('%s:%s', $domain, $port),
            'jambonz_sip_password' => $password,
        ]);
    }

    protected function forgetSipCredentials(Request $request): void
    {
        $request->session()->forget([
            'jambonz_sip_username',
            'jambonz_sip_domain',
            'jambonz_sip_password',
        ]);
    }
}
