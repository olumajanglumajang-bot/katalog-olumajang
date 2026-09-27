<?php
/**
 * Katalog Olumajang - PHP Backend API untuk Hosting cPanel
 * Mendukung penyimpanan JSON, upload gambar, limit 50 foto, dan verifikasi admin password SHA-256.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/../data/catalog.json';
$uploadsDir = __DIR__ . '/../uploads/';

if (!file_exists(dirname($dataFile))) {
    mkdir(dirname($dataFile), 0777, true);
}
if (!file_exists($uploadsDir)) {
    mkdir($uploadsDir, 0777, true);
}

// Password admin rahasia di-hash SHA-256 (Password asli: 231288)
define('ADMIN_PASSWORD_HASH', hash('sha256', '231288'));
define('SECRET_SALT', 'olumajang_secret_salt_2026');

function getCatalog($dataFile) {
    if (file_exists($dataFile)) {
        $content = file_get_contents($dataFile);
        $json = json_decode($content, true);
        if (isset($json['warungs'])) return $json;
    }
    return ['warungs' => []];
}

function saveCatalog($dataFile, $data) {
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function verifyAuth() {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s(\S+)/', $auth, $matches)) {
        $token = $matches[1];
        $parts = explode('.', $token);
        if (count($parts) === 2) {
            $expected = hash_hmac('sha256', $parts[0], SECRET_SALT);
            if (hash_equals($expected, $parts[1])) {
                return true;
            }
        }
    }
    http_response_code(401);
    echo json_encode(['error' => 'Akses ditolak: Autentikasi admin diperlukan.']);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Route: POST /api/admin/login
if (strpos($path, '/admin/login') !== false && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $password = $input['password'] ?? '';
    if (hash_equals(ADMIN_PASSWORD_HASH, hash('sha256', $password))) {
        $payload = time() . '-' . bin2hex(random_bytes(16));
        $signature = hash_hmac('sha256', $payload, SECRET_SALT);
        $token = $payload . '.' . $signature;
        echo json_encode(['success' => true, 'token' => $token]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Kata sandi admin salah.']);
    }
    exit;
}

// Route: GET /api/admin/verify
if (strpos($path, '/admin/verify') !== false && $method === 'GET') {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    $valid = false;
    if (preg_match('/Bearer\s(\S+)/', $auth, $matches)) {
        $parts = explode('.', $matches[1]);
        if (count($parts) === 2 && hash_equals(hash_hmac('sha256', $parts[0], SECRET_SALT), $parts[1])) {
            $valid = true;
        }
    }
    echo json_encode(['authenticated' => $valid]);
    exit;
}

// Route: DELETE /api/warung/{id}/photos/{photoId}
if (preg_match('#/api/warung/([^/]+)/photos/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
    verifyAuth();
    $warungId = $matches[1];
    $photoId = $matches[2];

    $catalog = getCatalog($dataFile);
    $found = false;
    foreach ($catalog['warungs'] as &$w) {
        if ($w['id'] === $warungId) {
            foreach ($w['daftar_foto'] as $idx => $photo) {
                if ($photo['id'] === $photoId) {
                    $url = $photo['file_url'] ?? '';
                    if (strpos($url, '/uploads/') !== false) {
                        $filePath = $uploadsDir . basename($url);
                        if (file_exists($filePath)) {
                            @unlink($filePath);
                        }
                    }
                    array_splice($w['daftar_foto'], $idx, 1);
                    $found = true;
                    break;
                }
            }
            if ($found) {
                // Re-index urutan
                foreach ($w['daftar_foto'] as $i => &$p) {
                    $p['urutan'] = $i + 1;
                }
                $w['updated_at'] = date('c');
                saveCatalog($dataFile, $catalog);
                echo json_encode([
                    'success' => true,
                    'message' => 'Foto berhasil dihapus.',
                    'totalPhotos' => count($w['daftar_foto']),
                    'warung' => $w
                ]);
                exit;
            }
        }
    }

    http_response_code(404);
    echo json_encode(['error' => 'Foto atau warung tidak ditemukan.']);
    exit;
}

// Route: DELETE /api/warung/{id}
if (preg_match('#/api/warung/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
    verifyAuth();
    $warungId = $matches[1];

    $catalog = getCatalog($dataFile);
    $targetIndex = -1;
    foreach ($catalog['warungs'] as $i => $w) {
        if ($w['id'] === $warungId) {
            $targetIndex = $i;
            // Hapus logo warung dari disk
            if (!empty($w['logo']) && strpos($w['logo'], '/uploads/') !== false) {
                $logoPath = $uploadsDir . basename($w['logo']);
                if (file_exists($logoPath)) {
                    @unlink($logoPath);
                }
            }
            // Hapus seluruh foto menu warung dari disk
            if (!empty($w['daftar_foto']) && is_array($w['daftar_foto'])) {
                foreach ($w['daftar_foto'] as $foto) {
                    $fUrl = $foto['file_url'] ?? '';
                    if (strpos($fUrl, '/uploads/') !== false) {
                        $fPath = $uploadsDir . basename($fUrl);
                        if (file_exists($fPath)) {
                            @unlink($fPath);
                        }
                    }
                }
            }
            break;
        }
    }

    if ($targetIndex >= 0) {
        array_splice($catalog['warungs'], $targetIndex, 1);
        saveCatalog($dataFile, $catalog);
        echo json_encode(['success' => true, 'message' => 'Warung dan seluruh fotonya berhasil dihapus.']);
        exit;
    }

    http_response_code(404);
    echo json_encode(['error' => 'Warung tidak ditemukan.']);
    exit;
}

// Route: GET /api/warung
if (strpos($path, '/api/warung') !== false && $method === 'GET') {
    $catalog = getCatalog($dataFile);
    usort($catalog['warungs'], function($a, $b) {
        return strcasecmp($a['nama'], $b['nama']);
    });
    echo json_encode($catalog);
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Endpoint tidak ditemukan.']);
