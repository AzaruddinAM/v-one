<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Zoho-style billing features: tax regime (India GST / UAE VAT), custom number series,
 * payment terms & reminders, recurring invoices / bills. Vendor credits and delivery
 * challans reuse the documents table (new type values only).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('tax_regime', 10)->default('gst')->after('gstin'); // gst | vat | none
            $table->text('number_series')->nullable()->after('pdf_options');   // JSON per document type
            $table->text('reminder_template')->nullable()->after('number_series');
        });

        Schema::table('contacts', function (Blueprint $table) {
            $table->string('code', 12)->nullable()->after('company_name'); // used by {CODE} in number series
        });

        Schema::create('recurring_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20); // invoice | bill
            $table->string('name', 100);
            $table->foreignId('contact_id')->constrained()->restrictOnDelete();
            $table->string('frequency', 10); // week | month | year
            $table->unsignedSmallInteger('interval')->default(1);
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('next_date');
            $table->string('status', 10)->default('active'); // active | paused | expired
            $table->boolean('auto_send')->default(false); // false = create as draft
            $table->string('payment_terms', 30)->nullable();
            $table->longText('template'); // JSON: items, discount, adjustment, notes, terms, reference
            $table->unsignedInteger('generated_count')->default(0);
            $table->timestamp('last_generated_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['organization_id', 'type', 'status']);
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->string('payment_terms', 30)->nullable()->after('due_date');
            $table->foreignId('recurring_profile_id')->nullable()->after('converted_from_id')
                ->constrained('recurring_profiles')->nullOnDelete();
            $table->timestamp('reminded_at')->nullable()->after('recurring_profile_id');
            $table->unsignedSmallInteger('reminder_count')->default(0)->after('reminded_at');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recurring_profile_id');
            $table->dropColumn(['payment_terms', 'reminded_at', 'reminder_count']);
        });
        Schema::dropIfExists('recurring_profiles');
        Schema::table('contacts', fn (Blueprint $table) => $table->dropColumn('code'));
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn(['tax_regime', 'number_series', 'reminder_template']));
    }
};
