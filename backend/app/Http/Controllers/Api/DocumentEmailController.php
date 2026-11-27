<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\DocumentMail;
use App\Models\Document;
use App\Models\DocumentEmail;
use App\Services\DocumentService;
use App\Services\OrgMailer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** "Send by email" on an invoice, estimate, purchase order…: the PDF is made in the browser and attached here. */
class DocumentEmailController extends Controller
{
    /** A base64 PDF of up to ~10 MB. */
    private const PDF_MAX = 14_000_000;

    public function index(Document $document)
    {
        return DocumentEmail::where('document_id', $document->id)->with('sender:id,name')->latest('id')->limit(50)->get();
    }

    public function send(Request $request, Document $document, DocumentService $documents)
    {
        $data = $request->validate([
            'to' => ['required', 'array', 'min:1', 'max:10'],
            'to.*' => ['required', 'email:filter', 'max:190'],
            'cc' => ['nullable', 'array', 'max:10'],
            'cc.*' => ['email:filter', 'max:190'],
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:10000'],
            'pdf' => ['nullable', 'string', 'max:'.self::PDF_MAX],
            'mark_sent' => ['boolean'],
        ]);
        abort_if($document->status === 'void', 422, 'Void documents cannot be emailed.');

        $org = $request->user()->organization;
        abort_unless(OrgMailer::ready($org), 422, 'Email is not set up yet. An administrator can add the mail server in Settings → Email.');

        $pdf = null;
        if (! empty($data['pdf'])) {
            $pdf = base64_decode(preg_replace('#^data:application/pdf;base64,#', '', $data['pdf']), true);
            abort_if($pdf === false || ! str_starts_with($pdf, '%PDF-'), 422, 'The PDF could not be read. Please try again.');
        }

        $name = Str::slug($document->number.($document->contact?->name ? ' '.$document->contact->name : ''), '-') ?: 'document';
        try {
            OrgMailer::mailer($org)
                ->to($data['to'])
                ->cc($data['cc'] ?? [])
                ->send(new DocumentMail(
                    $data['subject'],
                    $data['body'],
                    OrgMailer::from($org),
                    OrgMailer::replyTo($org),
                    $pdf,
                    $name.'.pdf',
                ));
        } catch (\Throwable $e) {
            report($e);
            abort(422, 'Could not send: '.OrgMailer::explain($e));
        }

        $log = DocumentEmail::create([
            'document_id' => $document->id,
            'to' => implode(', ', $data['to']),
            'cc' => ! empty($data['cc']) ? implode(', ', $data['cc']) : null,
            'subject' => $data['subject'],
            'with_pdf' => $pdf !== null,
            'sent_by' => $request->user()->id,
        ]);

        if (($data['mark_sent'] ?? false) && $document->status === 'draft') {
            $sent = in_array($document->type, ['invoice', 'estimate', 'retainer_invoice'], true) ? 'sent' : 'open';
            if (in_array($sent, Document::MANUAL_STATUSES[$document->type] ?? [], true)) {
                $documents->changeStatus($document, $sent);
            }
        }

        return response()->json(['email' => $log->load('sender:id,name'), 'status' => $document->fresh()->status], 201);
    }
}
