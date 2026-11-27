<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Product photos: one per item, copied onto document lines (estimates etc.) where they can also be set per line. */
return new class extends Migration
{
    public function up(): void
    {
        // Small data URLs (resized in the browser), like the PDF logo.
        if (! Schema::hasColumn('items', 'image')) {
            Schema::table('items', fn (Blueprint $t) => $t->mediumText('image')->nullable());
        }
        if (! Schema::hasColumn('document_items', 'image')) {
            Schema::table('document_items', fn (Blueprint $t) => $t->mediumText('image')->nullable());
        }
    }

    public function down(): void
    {
        Schema::table('document_items', fn (Blueprint $t) => $t->dropColumn('image'));
        Schema::table('items', fn (Blueprint $t) => $t->dropColumn('image'));
    }
};
