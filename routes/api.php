<?php

declare(strict_types=1);

use App\Http\Controllers\JambonzWebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('webhooks/jambonz')->group(function (): void {
    Route::post('/incoming', [JambonzWebhookController::class, 'incoming'])->name('webhooks.jambonz.incoming');
    Route::post('/call-status', [JambonzWebhookController::class, 'callStatus'])->name('webhooks.jambonz.call-status');
    Route::post('/listen-status', [JambonzWebhookController::class, 'listenStatus'])->name('webhooks.jambonz.listen-status');
    Route::post('/transcription', [JambonzWebhookController::class, 'transcription'])->name('webhooks.jambonz.transcription');
});
