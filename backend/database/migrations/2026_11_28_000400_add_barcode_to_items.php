<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Barcode / QR code per item, for camera and USB scanners. */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('items', 'barcode')) {
            Schema::table('items', function (Blueprint $t) {
                $t->string('barcode', 64)->nullable();
                $t->index(['organization_id', 'barcode']);
            });
        }
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $t) {
            $t->dropIndex(['organization_id', 'barcode']);
            $t->dropColumn('barcode');
        });
    }
};
