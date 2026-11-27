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

    #[Test]
    public function admin_can_save_logo_header_footer_and_display_options(): void
    {
        $this->signIn();
        $logo = 'data:image/png;base64,'.str_repeat('iVBORw0KGgo', 30000);

        $this->putJson('/api/organization', $this->payload(['pdf_options' => [
            'logo' => $logo,
            'logo_position' => 'center',
            'header_text' => 'Wholesale dealers in stationery',
            'title_estimate' => 'QUOTATION',
            'show_tax_column' => false,
            'show_signature' => '1',
            'footer_note' => 'This is a computer generated invoice',
            'paper' => 'A5',
            'evil' => '<script>',
        ]]))->assertOk()
            ->assertJsonPath('pdf_options.logo', $logo)
            ->assertJsonPath('pdf_options.logo_position', 'center')
            ->assertJsonPath('pdf_options.title_estimate', 'QUOTATION')
            ->assertJsonPath('pdf_options.show_tax_column', false)
            ->assertJsonPath('pdf_options.show_signature', true)
            ->assertJsonPath('pdf_options.paper', 'A5')
            ->assertJsonMissingPath('pdf_options.evil');
    }

    #[Test]
    public function pdf_options_reject_non_images_and_bad_values(): void
    {
        $this->signIn();

        $this->putJson('/api/organization', $this->payload(['pdf_options' => [
            'logo' => 'data:image/svg+xml;base64,PHN2Zz4=',
            'signature' => 'https://example.com/sign.png',
            'logo_position' => 'top',
            'paper' => 'A3',
            'show_notes' => 'maybe',
        ]]))->assertUnprocessable()->assertJsonValidationErrors([
            'pdf_options.logo', 'pdf_options.signature', 'pdf_options.logo_position', 'pdf_options.paper', 'pdf_options.show_notes',
        ]);

        $this->putJson('/api/organization', $this->payload(['pdf_options' => [
            'logo' => 'data:image/png;base64,'.str_repeat('A', 500_001),
        ]]))->assertUnprocessable()->assertJsonValidationErrors(['pdf_options.logo']);
    }

    #[Test]
    public function the_new_layouts_can_be_saved(): void
    {
        $this->signIn();

        foreach (['standard', 'elegant', 'bold', 'corporate', 'creative', 'wave', 'geometric', 'gradient', 'splash', 'bilingual'] as $template) {
            $this->putJson('/api/organization', $this->payload(['pdf_template' => $template]))->assertOk()
                ->assertJsonPath('pdf_template', $template);
        }
    }
}
