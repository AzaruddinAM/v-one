<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tier 2 accounting: transaction locking, retainer (advance) invoices and bank reconciliation.
 * Retainer invoices reuse the documents table (new type value only).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->date('lock_date')->nullable()->after('reminder_template'); // nothing on or before this date can change
        });

        Schema::table('payments', function (Blueprint $table) {
            // Set when a retainer payment is applied to an invoice (mode = retainer, no cash moves).
            $table->foreignId('retainer_id')->nullable()->after('document_id')->constrained('documents')->nullOnDelete();
        });

        Schema::create('reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->date('statement_date');
            $table->decimal('statement_balance', 15, 2);
            $table->decimal('cleared_balance', 15, 2);
            $table->unsignedInteger('entries_count')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['organization_id', 'account_id', 'statement_date']);
        });

        Schema::create('reconciled_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reconciliation_id')->constrained()->cascadeOnDelete();
            $table->string('entry_key', 60); // e.g. payment:12, expense:5, journal_line:44
            $table->unique(['organization_id', 'account_id', 'entry_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reconciled_entries');
        Schema::dropIfExists('reconciliations');
        Schema::table('payments', fn (Blueprint $table) => $table->dropConstrainedForeignId('retainer_id'));
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('lock_date'));
    }
};
