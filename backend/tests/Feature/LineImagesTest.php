<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class LineImagesTest extends TestCase
{
    use RefreshDatabase;

    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn();
    }

    #[Test]
    public function item_photo_is_only_sent_when_one_item_is_opened(): void
    {
        $id = $this->postJson('/api/items', ['name' => 'LED panel', 'type' => 'goods', 'sales_price' => 40, 'image' => self::PNG])
            ->assertCreated()->assertJsonPath('image', self::PNG)->json('id');

        $this->getJson('/api/items')->assertJsonPath('data.0.has_image', true)->assertJsonMissingPath('data.0.image');
        $this->getJson("/api/items/$id")->assertJsonPath('image', self::PNG);
        $this->postJson('/api/items', ['name' => 'Bad', 'type' => 'goods', 'sales_price' => 1, 'image' => 'javascript:alert(1)'])
            ->assertUnprocessable()->assertJsonValidationErrors('image');
    }

    #[Test]
    public function estimate_lines_keep_their_photo_and_it_carries_to_the_invoice(): void
    {
        $c = $this->customer();
        $est = $this->postJson('/api/documents', [
            'type' => 'estimate', 'contact_id' => $c->id, 'date' => today()->toDateString(),
            'items' => [['name' => 'LED panel', 'quantity' => 2, 'rate' => 40, 'image' => self::PNG], ['name' => 'Fitting', 'quantity' => 1, 'rate' => 5]],
        ])->assertCreated()->assertJsonPath('items.0.image', self::PNG)->assertJsonPath('items.1.image', null)->json();

        $this->postJson("/api/documents/{$est['id']}/convert")->assertCreated()->assertJsonPath('items.0.image', self::PNG);
    }

    #[Test]
    public function photo_settings_are_validated(): void
    {
        $this->putJson('/api/organization/preferences', ['line_images' => true, 'line_image_docs' => ['estimate', 'invoice'], 'line_image_size' => 'l', 'line_image_layout' => 'gallery'])
            ->assertOk()->assertJsonPath('preferences.line_image_docs', ['estimate', 'invoice'])->assertJsonPath('preferences.line_image_layout', 'gallery');
        $this->putJson('/api/organization/preferences', ['line_image_docs' => ['nope']])->assertUnprocessable();
        $this->putJson('/api/organization/preferences', ['line_image_size' => 'xl'])->assertUnprocessable();
    }
}
