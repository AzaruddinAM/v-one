<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<\App\Models\Item> */
class ItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => ucfirst(fake()->words(2, true)),
            'sku' => strtoupper(fake()->unique()->bothify('SKU-####')),
            'type' => 'goods',
            'unit' => 'pcs',
            'sales_price' => 100,
            'purchase_price' => 60,
            'track_inventory' => true,
            'stock_on_hand' => 0,
            'reorder_level' => 5,
            'is_active' => true,
        ];
    }

    public function service(): static
    {
        return $this->state(fn () => ['type' => 'service', 'track_inventory' => false]);
    }
}
