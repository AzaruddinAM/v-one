<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Send documents by email: per-organization SMTP settings (encrypted) and a log of what was sent. */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('organizations', 'mail_settings')) {
            Schema::table('organizations', fn (Blueprint $t) => $t->text('mail_settings')->nullable());
        }

        if (! Schema::hasTable('document_emails')) {
            Schema::create('document_emails', function (Blueprint $table) {
                $table->id();
                $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
                $table->foreignId('document_id')->constrained()->cascadeOnDelete();
                $table->string('to', 500);
                $table->string('cc', 500)->nullable();
                $table->string('subject', 200);
                $table->boolean('with_pdf')->default(true);
                $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('created_at')->nullable();
                $table->index(['organization_id', 'document_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_emails');
        Schema::table('organizations', fn (Blueprint $t) => $t->dropColumn('mail_settings'));
    }
};
