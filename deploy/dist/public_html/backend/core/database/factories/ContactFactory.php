<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<\App\Models\Contact> */
class ContactFactory extends Factory
{
    public function definition(): array
    {
        return [
            'type' => 'customer',
            'name' => fake()->name(),
            'company_name' => fake()->company(),
            'email' => fake()->safeEmail(),
            'phone' => fake()->numerify('9#########'),
            'city' => fake()->city(),
            'payment_terms' => 30,
            'is_active' => true,
        ];
    }

    public function vendor(): static
    {
        return $this->state(fn () => ['type' => 'vendor']);
    }
}
