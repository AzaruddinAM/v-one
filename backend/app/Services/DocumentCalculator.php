<?php

namespace App\Services;

/**
 * Pure calculation of line items and document totals.
 * Kept free of framework dependencies so it is trivially unit-testable
 * and mirrors the Angular `calculateTotals()` helper exactly.
 */
class DocumentCalculator
{
    /**
     * @param  array<int, array{quantity: float|int|string, rate: float|int|string, discount_percent?: float|int|string|null, tax_rate?: float|int|string|null}>  $lines
     * @return array{lines: array<int, array>, subtotal: float, tax_total: float, discount: float, adjustment: float, total: float}
     */
    public static function calculate(array $lines, float $discount = 0, float $adjustment = 0): array
    {
        $subtotal = 0.0;
        $taxTotal = 0.0;
        $out = [];

        foreach ($lines as $line) {
            $qty = (float) ($line['quantity'] ?? 0);
            $rate = (float) ($line['rate'] ?? 0);
            $discPct = min(100, max(0, (float) ($line['discount_percent'] ?? 0)));
            $taxRate = max(0, (float) ($line['tax_rate'] ?? 0));

            $gross = $qty * $rate;
            $amount = round($gross - ($gross * $discPct / 100), 2);
            $tax = round($amount * $taxRate / 100, 2);

            $subtotal += $amount;
            $taxTotal += $tax;
            $out[] = array_merge($line, [
                'discount_percent' => $discPct,
                'tax_rate' => $taxRate,
                'amount' => $amount,
                'tax_amount' => $tax,
            ]);
        }

        $subtotal = round($subtotal, 2);
        $taxTotal = round($taxTotal, 2);
        $discount = round(max(0, $discount), 2);
        $total = round($subtotal + $taxTotal - $discount + $adjustment, 2);

        return [
            'lines' => $out,
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'discount' => $discount,
            'adjustment' => round($adjustment, 2),
            'total' => max(0.0, $total),
        ];
    }
}
