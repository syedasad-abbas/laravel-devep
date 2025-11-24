<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('call_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('call_code')->unique();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->string('dialed_number')->nullable();
            $table->json('offer')->nullable();
            $table->json('answer')->nullable();
            $table->json('offer_candidates')->nullable();
            $table->json('answer_candidates')->nullable();
            $table->string('status')->default('idle');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_sessions');
    }
};
