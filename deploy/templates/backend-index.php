<?php

/*
|--------------------------------------------------------------------------
| v-one API entry point for shared hosting (hPanel)
|--------------------------------------------------------------------------
| The Laravel application lives in ./core (blocked from the web by
| core/.htaccess). This file replaces core/public/index.php so the API is
| served at https://yourdomain.com/backend/api/...
*/

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/core/storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/core/vendor/autoload.php';

/** @var Application $app */
$app = require_once __DIR__.'/core/bootstrap/app.php';

$app->usePublicPath(__DIR__);

$app->handleRequest(Request::capture());
