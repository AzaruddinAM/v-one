<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PdfTemplateTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $extra = []): array
    {
        return ['name' => 'Acme', 'currency' => 'INR', 'currency_symbol' => '₹', 'fiscal_year_start' => 4] + $extra;
    }

    #[Test]
    public function organization_defaults_to_the_classic_template(): void
    {
        $this->signIn();

        $this->getJson('/api/organization')->assertOk()
            ->assertJsonPath('pdf_template', 'classic')
            ->assertJsonPath('pdf_accent', '#4f46e5');
    }

    #[Test]
    public function admin_can_choose_a_template_accent_and_footer(): void
    {
        $this->signIn();

        $this->putJson('/api/organization', $this->payload([
            'pdf_template' => 'gst',
            'pdf_accent' => '#0F766E',
            'pdf_footer' => "Bank: HDFC · A/c 1234 · IFSC HDFC0001",
        ]))->assertOk()
            ->assertJsonPath('pdf_template', 'gst')
            ->assertJsonPath('pdf_accent', '#0F766E')
            ->assertJsonPath('pdf_footer', 'Bank: HDFC · A/c 1234 · IFSC HDFC0001');
    }

    #[Test]
    public function unknown_templates_and_bad_colours_are_rejected(): void
    {
        $this->signIn();

        $this->putJson('/api/organization', $this->payload(['pdf_template' => 'fancy', 'pdf_accent' => 'red']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['pdf_template', 'pdf_accent']);
    }

    #[Test]
    public function saving_without_template_fields_keeps_the_current_choice(): void
    {
        $this->signIn();
        $this->putJson('/api/organization', $this->payload(['pdf_template' => 'modern']))->assertOk();

        $this->putJson('/api/organization', $this->payload())->assertOk()
            ->assertJsonPath('pdf_template', 'modern');
    }
}
