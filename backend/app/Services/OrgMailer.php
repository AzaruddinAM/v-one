<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Support\Facades\Mail;

/**
 * Email for one organization: its own SMTP server when set in Settings → Email,
 * otherwise the server's mailer from .env (MAIL_*).
 */
class OrgMailer
{
    public const DEFAULT_SUBJECT = '{type} {number} from {org}';

    public const DEFAULT_BODY = "Dear {customer},\n\nPlease find attached {type} {number} for {amount}.\n\nThank you for your business.\n{org}";

    public static function rules(): array
    {
        return [
            'mode' => ['required', 'in:default,smtp'],
            'host' => ['nullable', 'required_if:mode,smtp', 'string', 'max:190', 'regex:/^[A-Za-z0-9.\-]+$/'],
            'port' => ['nullable', 'integer', 'between:1,65535'],
            'encryption' => ['nullable', 'in:tls,ssl,none'],
            'username' => ['nullable', 'string', 'max:190'],
            'password' => ['nullable', 'string', 'max:190'],
            'from_address' => ['nullable', 'email', 'max:190'],
            'from_name' => ['nullable', 'string', 'max:100'],
            'reply_to' => ['nullable', 'email', 'max:190'],
            'subject_template' => ['nullable', 'string', 'max:200'],
            'body_template' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /** Stored settings, decrypted (password included: server side only). */
    public static function settings(Organization $org): array
    {
        return is_array($org->mail_settings) ? $org->mail_settings : [];
    }

    /** What the browser may see: no password, plus whether sending is possible right now. */
    public static function publicSettings(Organization $org): array
    {
        $s = self::settings($org);

        return [
            'mode' => $s['mode'] ?? 'default',
            'host' => $s['host'] ?? '',
            'port' => $s['port'] ?? 587,
            'encryption' => $s['encryption'] ?? 'tls',
            'username' => $s['username'] ?? '',
            'has_password' => ! empty($s['password']),
            'from_address' => $s['from_address'] ?? '',
            'from_name' => $s['from_name'] ?? '',
            'reply_to' => $s['reply_to'] ?? '',
            'subject_template' => ($s['subject_template'] ?? '') ?: self::DEFAULT_SUBJECT,
            'body_template' => ($s['body_template'] ?? '') ?: self::DEFAULT_BODY,
            'server_ready' => self::serverReady(),
            'ready' => self::ready($org),
        ];
    }

    /** The server's own mailer actually delivers (log / array only write to a file or memory). */
    public static function serverReady(): bool
    {
        return ! in_array(config('mail.default'), ['log', 'array', null], true) || app()->runningUnitTests();
    }

    public static function usesSmtp(Organization $org): bool
    {
        $s = self::settings($org);

        return ($s['mode'] ?? 'default') === 'smtp' && ! empty($s['host']);
    }

    public static function ready(Organization $org): bool
    {
        return self::usesSmtp($org) || self::serverReady();
    }

    public static function mailer(Organization $org): Mailer
    {
        if (! self::usesSmtp($org)) {
            return Mail::mailer();
        }
        $s = self::settings($org);

        return Mail::build([
            'transport' => 'smtp',
            // smtps = SSL from the first byte (usually port 465); smtp upgrades with STARTTLS when offered (587).
            'scheme' => ($s['encryption'] ?? 'tls') === 'ssl' ? 'smtps' : 'smtp',
            'host' => $s['host'],
            'port' => (int) ($s['port'] ?? 587),
            'username' => ($s['username'] ?? '') ?: null,
            'password' => ($s['password'] ?? '') ?: null,
            'timeout' => 20,
        ]);
    }

    public static function from(Organization $org): Address
    {
        $s = self::settings($org);
        $name = ($s['from_name'] ?? '') ?: $org->name;
        // With the server's mailer the sender must stay the server's own address (or mail is marked as spam);
        // replies still reach the organization through Reply-To.
        $address = self::usesSmtp($org)
            ? (($s['from_address'] ?? '') ?: ($s['username'] ?? '') ?: config('mail.from.address'))
            : config('mail.from.address');

        return new Address((string) $address, $name);
    }

    /** A short, safe reason for a failed send (no password or server internals). */
    public static function explain(\Throwable $e): string
    {
        $m = $e->getMessage();

        return match (true) {
            str_contains($m, '535') || stripos($m, 'authenticat') !== false => 'the mail server rejected the username or password.',
            stripos($m, 'Connection could not be established') !== false || stripos($m, 'timed out') !== false => 'could not reach the mail server. Check the host and port.',
            stripos($m, 'certificate') !== false || stripos($m, 'SSL') !== false || stripos($m, 'TLS') !== false => 'secure connection failed. Try SSL with port 465 or TLS with port 587.',
            stripos($m, 'sender') !== false || str_contains($m, '553') || str_contains($m, '550') => 'the mail server refused the sender address. Use the address of the mailbox you log in with.',
            default => 'the mail server returned an error ('.mb_substr(preg_replace('/\s+/', ' ', $m), 0, 160).').',
        };
    }

    /** Reply-To: the address set in Settings → Email, else the organization's email. */
    public static function replyTo(Organization $org): ?string
    {
        $s = self::settings($org);

        return ($s['reply_to'] ?? '') ?: ($org->email ?: null);
    }
}
