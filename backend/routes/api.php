<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\ItemController;
use App\Http\Controllers\Api\JournalController;
use App\Http\Controllers\Api\LookupController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\TaxController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['status' => 'ok', 'app' => config('app.name')]);

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
});

Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::put('/auth/password', [AuthController::class, 'changePassword']);

    Route::get('/lookups', LookupController::class);

    Route::get('/organization', [OrganizationController::class, 'show']);
    Route::put('/organization', [OrganizationController::class, 'update'])->middleware('role:admin');

    Route::middleware('role:admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
    });

    $canDelete = 'role:admin,accountant';

    Route::apiResource('taxes', TaxController::class)->middlewareFor(['store', 'update', 'destroy'], $canDelete);
    Route::apiResource('accounts', AccountController::class)->middlewareFor(['store', 'update', 'destroy'], $canDelete);

    Route::get('contacts/{contact}/statement', [ContactController::class, 'statement']);
    Route::apiResource('contacts', ContactController::class)->middlewareFor('destroy', $canDelete);

    Route::get('items/categories', [ItemController::class, 'categories']);
    Route::post('items/{item}/adjust-stock', [ItemController::class, 'adjustStock']);
    Route::get('items/{item}/movements', [ItemController::class, 'movements']);
    Route::apiResource('items', ItemController::class)->middlewareFor('destroy', $canDelete);

    Route::get('documents/next-number', [DocumentController::class, 'nextNumber']);
    Route::post('documents/{document}/status', [DocumentController::class, 'status']);
    Route::post('documents/{document}/convert', [DocumentController::class, 'convert']);
    Route::apiResource('documents', DocumentController::class)->middlewareFor('destroy', $canDelete);

    Route::apiResource('payments', PaymentController::class)->except('update')->middlewareFor('destroy', $canDelete);
    Route::apiResource('expenses', ExpenseController::class)->middlewareFor('destroy', $canDelete);
    Route::apiResource('journals', JournalController::class)->middleware($canDelete);

    Route::prefix('ai')->controller(AiController::class)->group(function () {
        Route::get('status', 'status');
        Route::post('scan-bill', 'scanBill')->middleware('throttle:ai');
        Route::post('import-bill', 'importBill');
        Route::post('chat', 'chat')->middleware('throttle:ai');
    });

    Route::prefix('reports')->controller(ReportController::class)->group(function () {
        Route::get('dashboard', 'dashboard');
        Route::get('profit-loss', 'profitLoss');
        Route::get('balance-sheet', 'balanceSheet');
        Route::get('receivables', 'receivables');
        Route::get('payables', 'payables');
        Route::get('sales-by-customer', 'salesByCustomer');
        Route::get('sales-by-item', 'salesByItem');
        Route::get('tax-summary', 'taxSummary');
        Route::get('inventory', 'inventory');
    });
});
