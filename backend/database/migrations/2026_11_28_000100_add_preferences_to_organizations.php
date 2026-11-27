<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** App feature switches per organization (table filters, line images, scanning, voice…), stored as JSON. */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('organizations', 'preferences')) {
            Schema::table('organizations', function (Blueprint $table) {
                $table->json('preferences')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('preferences');
        });
    }
};
