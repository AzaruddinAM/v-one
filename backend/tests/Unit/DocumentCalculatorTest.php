<?php

namespace Tests\Unit;

use App\Services\DocumentCalculator;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class DocumentCalculatorTest extends TestCase
{
    #[Test]
    public function it_calculates_line_amounts_tax_and_totals(): void
    {
        $r = DocumentCalculator::calculate([
            ['quantity' => 2, 'rate' => 100, 'tax_rate' => 18],
            ['quantity' => 1, 'rate' => 50, 'discount_percent' => 10, 'tax_rate' => 5],
        ]);

        $this->assertSame(200.0, $r['lines'][0]['amount']);
        $this->assertSame(36.0, $r['lines'][0]['tax_amount']);
        $this->assertSame(45.0, $r['lines'][1]['amount']);
        $this->assertSame(2.25, $r['lines'][1]['tax_amount']);
        $this->assertSame(245.0, $r['subtotal']);
        $this->assertSame(38.25, $r['tax_total']);
        $this->assertSame(283.25, $r['total']);
    }

    #[Test]
    public function it_applies_document_discount_and_adjustment(): void
    {
        $r = DocumentCalculator::calculate([['quantity' => 1, 'rate' => 1000, 'tax_rate' => 0]], 100, -0.5);

        $this->assertSame(899.5, $r['total']);
    }

    #[Test]
    public function it_clamps_invalid_discounts_and_never_returns_negative_total(): void
    {
        $r = DocumentCalculator::calculate([['quantity' => 1, 'rate' => 100, 'discount_percent' => 150]], 500);

        $this->assertSame(0.0, $r['lines'][0]['amount']);
        $this->assertSame(0.0, $r['total']);
    }

    #[Test]
    public function it_rounds_to_two_decimals(): void
    {
        $r = DocumentCalculator::calculate([['quantity' => 3, 'rate' => 33.333, 'tax_rate' => 18]]);

        $this->assertSame(100.0, $r['subtotal']);
        $this->assertSame(18.0, $r['tax_total']);
    }
}
