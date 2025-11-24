<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CallSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'call_code',
        'creator_id',
        'dialed_number',
        'offer',
        'answer',
        'offer_candidates',
        'answer_candidates',
        'status',
    ];

    protected $casts = [
        'offer' => 'array',
        'answer' => 'array',
        'offer_candidates' => 'array',
        'answer_candidates' => 'array',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }
}
