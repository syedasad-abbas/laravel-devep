<?php

declare(strict_types=1);

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CallController;
use Illuminate\Support\Facades\Route;

Route::get('/', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login'])->name('login.submit');

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::get('/call', [CallController::class, 'dashboard'])->name('call.dashboard');
    Route::post('/users', [CallController::class, 'storeUser'])->name('admin.users.store');

    Route::post('/call-sessions', [CallController::class, 'createSession'])->name('call.sessions.create');
    Route::get('/call-sessions/{code}', [CallController::class, 'showSession'])->name('call.sessions.show');
    Route::post('/call-sessions/{code}/offer', [CallController::class, 'storeOffer'])->name('call.sessions.offer');
    Route::post('/call-sessions/{code}/answer', [CallController::class, 'storeAnswer'])->name('call.sessions.answer');
    Route::post('/call-sessions/{code}/candidate', [CallController::class, 'storeCandidate'])->name('call.sessions.candidate');
    Route::post('/call-sessions/{code}/status', [CallController::class, 'updateStatus'])->name('call.sessions.status');
});
