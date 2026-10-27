<?php

namespace Tests\Unit;

use App\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class PhoneNormalizationTest extends TestCase
{
    public static function phones(): array
    {
        return [
            ['98765 43210', '9876543210'],
            ['+91 98765-43210', '+919876543210'],
            ['(987) 654-3210', '9876543210'],
            ['', ''],
        ];
    }

    #[Test]
    #[DataProvider('phones')]
    public function it_normalizes_phone_numbers(string $input, string $expected): void
    {
        $this->assertSame($expected, User::normalizePhone($input));
    }
}
