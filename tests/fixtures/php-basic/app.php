<?php
use App\Models\User;
use Illuminate\Support\Facades\DB as Database;

function greet(string $name): string {
    return "hi " . $name;
}

class UserController {
    public function index() {
        return Database::table('users')->get();
    }
}

interface Repository {}
