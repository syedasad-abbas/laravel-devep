<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | External Call Launch URL
    |--------------------------------------------------------------------------
    |
    | When an agent dials a number the dashboard opens a new browser tab using
    | this base URL. Append the dialed number as a query parameter within the
    | frontend script so your PSTN/WebRTC provider can start the call.
    |
    */
    'launch_url' => env('CALL_PROVIDER_URL', 'https://example.com/webrtc'),
];
