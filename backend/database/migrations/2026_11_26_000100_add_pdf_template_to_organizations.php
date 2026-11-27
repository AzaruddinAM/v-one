<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('pdf_template', 20)->default('classic')->after('invoice_notes');
            $table->string('pdf_accent', 7)->default('#4f46e5')->after('pdf_template');
            $table->text('pdf_footer')->nullable()->after('pdf_accent');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['pdf_template', 'pdf_accent', 'pdf_footer']);
        });
    }
};
