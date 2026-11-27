<?php

namespace App\Mail;

use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** An invoice / estimate / PO… sent to a customer or vendor, with its PDF attached. */
class DocumentMail extends Mailable
{
    public function __construct(
        public string $subjectLine,
        public string $bodyText,
        public ?Address $fromAddress = null,
        public ?string $replyToAddress = null,
        public ?string $pdf = null,
        public string $filename = 'document.pdf',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: $this->fromAddress,
            replyTo: $this->replyToAddress ? [new Address($this->replyToAddress)] : [],
            subject: $this->subjectLine,
        );
    }

    public function content(): Content
    {
        // Plain text typed by the user, shown as simple HTML (escaped, line breaks kept).
        $html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2937">'
            .nl2br(e($this->bodyText)).'</div>';

        return new Content(htmlString: $html);
    }

    public function attachments(): array
    {
        if (! $this->pdf) {
            return [];
        }

        return [Attachment::fromData(fn () => $this->pdf, $this->filename)->withMime('application/pdf')];
    }
}
