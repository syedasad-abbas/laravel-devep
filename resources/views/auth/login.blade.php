<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>Secure Call Login</title>
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="auth-body">
        <div class="auth-card">
            <div class="auth-card__header">
                <h1>Realtime Call Console</h1>
                <p>Sign in to start a secured WebRTC call session.</p>
            </div>
            <form method="POST" action="{{ route('login.submit') }}" class="auth-form">
                @csrf
                <label class="auth-field">
                    <span>SIP identity (username@domain:port)</span>
                    <input type="text" name="identity" value="{{ old('identity') }}" placeholder="asad@jambonz.local:5060" required autofocus>
                </label>
                <label class="auth-field">
                    <span>Password</span>
                    <input type="password" name="password" required>
                </label>
                @error('identity')
                    <div class="auth-error">{{ $message }}</div>
                @enderror
                @error('password')
                    <div class="auth-error">{{ $message }}</div>
                @enderror
                <button type="submit" class="btn-primary">Login</button>
            </form>
            <div class="auth-footer">
                <span class="status-dot status-dot--idle"></span>
                Awaiting secure login
            </div>
        </div>
    </body>
</html>
