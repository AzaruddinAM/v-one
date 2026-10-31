<?php

namespace App\Services\Ai;

use RuntimeException;

/** A user-facing AI failure together with the HTTP status to answer with. */
class AiException extends RuntimeException
{
    public function __construct(string $message, private int $status = 422, ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function render()
    {
        return response()->json(['message' => $this->getMessage()], $this->status);
    }
}
