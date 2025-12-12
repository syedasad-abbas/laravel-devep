<!DOCTYPE html>
<html lang="en" data-theme="dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>Secure Call Console</title>
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body>
        <div
            id="call-app"
            data-call-launch-url="{{ $callLaunchUrl ?? '' }}"
            data-fallback-launch-url="{{ route('call.dashboard') }}"
        >
            <div class="top-banner">
                <div class="top-banner__header">
                    <div>
                        <h1>Secure Call Console</h1>
                        <h2>Welcome, {{ $user->name ?: $user->email }}</h2>
                    </div>
                    <div class="top-banner__actions">
                        <span class="online-chip">
                            <span class="status-dot status-dot--online" id="userPresenceIndicator" aria-label="User online"></span>
                            <span class="presence-text" id="userPresenceText">Online</span>
                        </span>
                        <form method="POST" action="{{ route('logout') }}" id="logoutForm">
                            @csrf
                            <button type="submit" class="btn-secondary">Log out</button>
                        </form>
                    </div>
                </div>
                <hr>
            </div>
            <div class="console-shell">
                <aside class="left-sidebar">
                    <div class="sidebar-brand">
                        <p>Secure Call Console</p>
                        <strong>{{ $user->name ?: $user->email }}</strong>
                    </div>
                    <button type="button" class="theme-toggle button-with-icon" id="themeToggleBtn">
                        <span class="icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-14.5a1 1 0 0 1 1 .9V6a1 1 0 0 1-2 0V4.5a1 1 0 0 1 1-1Zm0 12.5a1 1 0 0 1 1 .88V19.5a1 1 0 0 1-2 .12V17a1 1 0 0 1 1-1Zm6-4a1 1 0 0 1 .12 2H17a1 1 0 0 1-.12-2ZM6 12a1 1 0 0 1 .12 2H5a1 1 0 0 1-.12-2Zm9.03-7.66 1.06 1.06a1 1 0 1 1-1.32 1.5l-1.06-1.06a1 1 0 0 1 1.32-1.5Zm-9.9.08a1 1 0 0 1 1.32 1.5L5.51 6.98a1 1 0 0 1-1.32-1.5Zm11.82 10.53 1.06 1.06a1 1 0 0 1-1.32 1.5l-1.06-1.06a1 1 0 1 1 1.4-1.42Zm-9.9.08 1.06 1.06a1 1 0 0 1-1.32 1.5l-1.06-1.06a1 1 0 0 1 1.32-1.5Z"/></svg>
                        </span>
                        <span class="label">Theme</span>
                    </button>
                    <div class="sidebar-section">
                        <h3>Online users</h3>
                        <ul class="online-list">
                            @forelse ($onlineUsers as $agent)
                                <li class="online-list__item @if ($agent->id === $user->id) online-list__item--current @endif">
                                    <span class="online-dot"></span>
                                    <span>{{ $agent->name ?: $agent->email }}</span>
                                    @if ($agent->is_admin)
                                        <span class="badge badge-admin">Admin</span>
                                    @endif
                                </li>
                            @empty
                                <li class="online-list__item">No active users.</li>
                            @endforelse
                        </ul>
                    </div>
                    @if ($isAdmin)
                        <div class="sidebar-section">
                            <h3>Create user</h3>
                            <form method="POST" action="{{ route('admin.users.store') }}" class="input-stack">
                                @csrf
                                <label for="newUserName">Name</label>
                                <input id="newUserName" type="text" name="name" value="{{ old('name') }}" required>
                                @error('name')<div class="auth-error">{{ $message }}</div>@enderror

                                <label for="newUserEmail">Email</label>
                                <input id="newUserEmail" type="email" name="email" value="{{ old('email') }}" required>
                                @error('email')<div class="auth-error">{{ $message }}</div>@enderror

                                <label for="newUserPassword">Password</label>
                                <input id="newUserPassword" type="password" name="password" required>
                                @error('password')<div class="auth-error">{{ $message }}</div>@enderror

                                <label class="checkbox-field">
                                    <input type="checkbox" name="is_admin" value="1" {{ old('is_admin') ? 'checked' : '' }}>
                                    <span>Grant admin access</span>
                                </label>

                                <button type="submit" class="btn-primary">Create user</button>
                            </form>
                        </div>
                    @endif
                </aside>

                <main class="square-main">
                    @if (session('status'))
                        <div class="alert alert-success" role="status">
                            {{ session('status') }}
                        </div>
                    @endif

                    <div class="square-content">
                    <section class="flat-block dialer-block">
                        <div class="block-header">
                            <h2>Dial pad</h2>
                            <span class="status-pill status-pill--idle" id="statusPill">IDLE</span>
                        </div>
                        <label for="dialInput" class="sr-only">Dial target</label>
                        <input id="dialInput" type="text" placeholder="Enter number" autocomplete="off">
                        <div class="call-actions">
                            <button type="button" class="btn-primary" id="audioCallBtn">Audio call</button>
                            <button type="button" class="btn-call" id="videoCallBtn">Video call</button>
                            <button type="button" class="btn-secondary" id="clearDialBtn">Clear</button>
                        </div>
                        <div class="dialpad-grid" role="group" aria-label="Dialpad">
                            @foreach (['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as $digit)
                                <button type="button" class="dialpad-key" data-digit="{{ $digit }}">
                                    <span class="digit">{{ $digit }}</span>
                                </button>
                            @endforeach
                        </div>
                        <div class="status-bar status-bar--flat">
                            <span class="status-dot status-dot--idle" id="callStatusDot"></span>
                            <div>
                                <strong id="callStatusText">Idle</strong>
                                <div id="callMetaText">No active call</div>
                            </div>
                        </div>
                    </section>

                    <section class="flat-block users-block">
                        <h2>Online users</h2>
                        <ul class="online-list">
                            @forelse ($onlineUsers as $agent)
                                <li class="online-list__item @if ($agent->id === $user->id) online-list__item--current @endif">
                                    <span class="online-dot"></span>
                                    <span>{{ $agent->name ?: $agent->email }}</span>
                                    @if ($agent->is_admin)
                                        <span class="badge badge-admin">Admin</span>
                                    @endif
                                </li>
                            @empty
                                <li class="online-list__item">No active users.</li>
                            @endforelse
                        </ul>
                        @if ($isAdmin)
                            <div class="create-user-block">
                                <h3>Create user</h3>
                                <form method="POST" action="{{ route('admin.users.store') }}" class="input-stack">
                                    @csrf
                                    <label for="newUserName">Name</label>
                                    <input id="newUserName" type="text" name="name" value="{{ old('name') }}" required>
                                    @error('name')<div class="auth-error">{{ $message }}</div>@enderror

                                    <label for="newUserEmail">Email</label>
                                    <input id="newUserEmail" type="email" name="email" value="{{ old('email') }}" required>
                                    @error('email')<div class="auth-error">{{ $message }}</div>@enderror

                                    <label for="newUserPassword">Password</label>
                                    <input id="newUserPassword" type="password" name="password" required>
                                    @error('password')<div class="auth-error">{{ $message }}</div>@enderror

                                    <label class="checkbox-field">
                                        <input type="checkbox" name="is_admin" value="1" {{ old('is_admin') ? 'checked' : '' }}>
                                        <span>Grant admin access</span>
                                    </label>

                                    <button type="submit" class="btn-primary">Create user</button>
                                </form>
                            </div>
                        @endif
                    </section>

                    <section class="flat-block logs-block">
                        <h2>Call console</h2>
                        <div class="call-log" id="callLog"></div>
                        <div class="call-history-card">
                            <h3>Call history</h3>
                            <div class="call-history" id="callHistory">
                                <div class="call-history__empty">No call logs yet.</div>
                            </div>
                            <button type="button" class="btn-secondary call-history__clear" id="clearHistoryBtn">Clear logs</button>
                        </div>
                    </section>
                </div>
                </main>
            </div>
        </div>
        <script type="module">
            {!! file_get_contents(resource_path('js/call.js')) !!}
        </script>
    </body>
</html>
