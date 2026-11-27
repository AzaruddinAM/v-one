<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            // Logo / signature (data URLs), header & footer text and show/hide switches for PDFs.
            $table->longText('pdf_options')->nullable()->after('pdf_footer');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('pdf_options');
        });
    }
};
