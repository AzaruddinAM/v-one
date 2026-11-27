<?php

namespace Tests\Feature;

use App\Mail\DocumentMail;
use App\Models\Organization;
use App\Services\OrgMailer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DocumentEmailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn();
        Mail::fake();
    }

    private function estimate(): array
    {
        return $this->postJson('/api/documents', [
            'type' => 'estimate', 'contact_id' => $this->customer(['name' => 'Ravi Stores'])->id, 'date' => today()->toDateString(),
            'items' => [['name' => 'LED strip', 'quantity' => 2, 'rate' => 50]],
        ])->assertCreated()->json();
    }

    #[Test]
    public function sends_the_document_with_its_pdf_and_logs_it(): void
    {
        $est = $this->estimate();
        $pdf = base64_encode("%PDF-1.4\n%fake\n");

        $this->postJson("/api/documents/{$est['id']}/email", [
            'to' => ['ravi@example.com'], 'cc' => ['boss@example.com'], 'subject' => 'Estimate '.$est['number'],
            'body' => "Dear Ravi,\n<b>hello</b>", 'pdf' => $pdf, 'mark_sent' => true,
        ])->assertCreated()->assertJsonPath('status', 'sent')->assertJsonPath('email.to', 'ravi@example.com');

        Mail::assertSent(DocumentMail::class, function (DocumentMail $m) use ($est) {
            $html = $m->content()->htmlString;

            return $m->hasTo('ravi@example.com') && $m->hasCc('boss@example.com')
                && count($m->attachments()) === 1 && str_contains($html, '&lt;b&gt;') && str_contains($html, '<br />')
                && str_starts_with($m->filename, strtolower($est['number']));
        });
        $this->getJson("/api/documents/{$est['id']}/emails")->assertJsonCount(1)->assertJsonPath('0.with_pdf', true);
    }

    #[Test]
    public function rejects_bad_input(): void
    {
        $est = $this->estimate();
        $this->postJson("/api/documents/{$est['id']}/email", ['to' => ['not-an-email'], 'subject' => 'x', 'body' => 'y'])
            ->assertUnprocessable()->assertJsonValidationErrors('to.0');
        $this->postJson("/api/documents/{$est['id']}/email", ['to' => ['a@b.co'], 'subject' => 'x', 'body' => 'y', 'pdf' => base64_encode('<html>')])
            ->assertUnprocessable();
        Mail::assertNothingSent();
    }

    #[Test]
    public function smtp_password_is_stored_encrypted_and_never_returned(): void
    {
        $this->putJson('/api/organization/mail', [
            'mode' => 'smtp', 'host' => 'smtp.hostinger.com', 'port' => 465, 'encryption' => 'ssl',
            'username' => 'billing@example.com', 'password' => 'secret-pass', 'from_name' => 'Sapphire',
        ])->assertOk()->assertJsonPath('has_password', true)->assertJsonMissingPath('password');

        $org = Organization::first();
        $this->assertStringNotContainsString('secret-pass', $org->getRawOriginal('mail_settings'));
        $this->assertSame('secret-pass', OrgMailer::settings($org)['password']);
        $this->assertSame('billing@example.com', OrgMailer::from($org)->address);
        $this->getJson('/api/organization')->assertJsonMissingPath('mail_settings');
        $this->getJson('/api/organization/mail')->assertJsonMissingPath('password')->assertJsonPath('mode', 'smtp');

        // Saving again with an empty password keeps it.
        $this->putJson('/api/organization/mail', ['mode' => 'smtp', 'host' => 'smtp.hostinger.com', 'port' => 465, 'password' => ''])->assertOk();
        $this->assertSame('secret-pass', OrgMailer::settings($org->fresh())['password']);
    }

    #[Test]
    public function only_admins_change_mail_settings(): void
    {
        $this->signIn('staff');
        $this->putJson('/api/organization/mail', ['mode' => 'default'])->assertForbidden();
    }
}
