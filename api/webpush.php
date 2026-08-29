<?php
/**
 * Web Push（RFC 8291 aes128gcm + VAPID ES256）— 纯 PHP 实现，无第三方依赖
 * 订阅存储：api/push_subs.json（服务器文件，避免新增 DB 表/迁移）
 * 仅被 api/index.php 引入调用；所有发送失败都被吞掉，不影响主流程。
 */

if (!defined('SR_WEBPUSH_LOADED')) {
    define('SR_WEBPUSH_LOADED', 1);

    // ── base64url ──
    function wp_b64url($data) { return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); }
    function wp_b64url_decode($s) { return base64_decode(strtr($s, '-_', '+/')); }

    // ── 存储：读/写 push_subs.json（原子写 + flock）──
    function wp_subs_file() { return __DIR__ . '/push_subs.json'; }
    function wp_subs_load() {
        $f = wp_subs_file();
        if (!is_file($f)) return [];
        $fp = @fopen($f, 'r');
        if (!$fp) return [];
        flock($fp, LOCK_SH);
        $raw = stream_get_contents($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
    function wp_subs_save($data) {
        $f = wp_subs_file();
        $fp = @fopen($f, 'c+');
        if (!$fp) return false;
        flock($fp, LOCK_EX);
        ftruncate($fp, 0);
        rewind($fp);
        $ok = fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        return $ok !== false;
    }
    function wp_subs_get($userId) {
        $d = wp_subs_load();
        return isset($d[(string)$userId]) ? $d[(string)$userId] : null;
    }
    function wp_subs_put($userId, $entry) {
        $d = wp_subs_load();
        $d[(string)$userId] = $entry;
        wp_subs_save($d);
    }
    function wp_subs_delete($userId) {
        $d = wp_subs_load();
        unset($d[(string)$userId]);
        wp_subs_save($d);
    }

    // ── P-256 公钥：裸点(65B) → SPKI DER PEM（供 openssl_pkey_derive）──
    function wp_publicKeyToPem($point) {
        $point = wp_b64url_decode($point);
        if (strlen($point) !== 65 || $point[0] !== "\x04") return false;
        $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $point;
        $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
        return $pem;
    }

    // ── ECDSA DER 签名 → r||s（64B 原始）──
    function wp_derToRawSig($der) {
        $p = 0; $n = strlen($der);
        if ($n < 8 || ord($der[$p++]) !== 0x30) return false;
        $seqLen = ord($der[$p++]);
        if ($seqLen & 0x80) $p += ($seqLen & 0x7f);
        $parts = [];
        for ($i = 0; $i < 2; $i++) {
            if ($p >= $n || ord($der[$p++]) !== 0x02) return false;
            $len = ord($der[$p++]);
            if ($len & 0x80) { $cnt = $len & 0x7f; $len = 0; for ($j = 0; $j < $cnt; $j++) { if ($p >= $n) return false; $len = ($len << 8) | ord($der[$p++]); } }
            if ($p + $len > $n) return false;
            $parts[] = substr($der, $p, $len); $p += $len;
        }
        $raw = '';
        foreach ($parts as $part) {
            $b = ltrim($part, "\x00");
            if (strlen($b) > 32) $b = substr($b, -32);
            $raw .= str_pad($b, 32, "\x00", STR_PAD_LEFT);
        }
        return $raw;
    }

    // ── VAPID JWT（ES256）──
    function wp_vapidJwt($privatePem, $sub, $aud) {
        $header = wp_b64url(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $payload = wp_b64url(json_encode(['aud' => $aud, 'exp' => time() + 3600, 'sub' => $sub]));
        $signing = $header . '.' . $payload;
        if (!openssl_sign($signing, $sig, $privatePem, OPENSSL_ALGO_SHA256)) return false;
        $raw = wp_derToRawSig($sig);
        if (!$raw) return false;
        return $signing . '.' . wp_b64url($raw);
    }

    // ── 公钥裸点（本机私钥）──
    function wp_localPublicPoint($pkey) {
        $d = openssl_pkey_get_details($pkey);
        if (!$d || !isset($d['ec'])) return false;
        return "\x04" . $d['ec']['x'] . $d['ec']['y'];
    }

    // ── 生成临时 P-256 密钥对 ──
    function wp_genEphemeralKey() {
        return openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
    }

    // ── 加密 payload（RFC 8291 aes128gcm）──
    function wp_encryptPayload($payload, $uaPublicPoint, $authSecretRaw, $asKey) {
        $peerPem = wp_publicKeyToPem(wp_b64url($uaPublicPoint));
        if (!$peerPem) return false;
        $shared = openssl_pkey_derive($peerPem, $asKey);
        if ($shared === false) return false;
        $asPublic = wp_localPublicPoint($asKey);
        if (!$asPublic) return false;

        $authInfo = 'WebPush: info' . "\x00" . $uaPublicPoint . $asPublic;
        $prk = hash_hmac('sha256', $shared, $authSecretRaw, true);
        $ikm = hash_hkdf('sha256', $prk, 32, $authInfo, '');
        $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\x00", '');
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\x00", '');
        $tag = '';
        $cipher = openssl_encrypt($payload, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
        if ($cipher === false) return false;
        $salt = random_bytes(16);
        $rs = 4096;
        return $salt . pack('N', $rs) . chr(65) . $asPublic . $cipher . $tag;
    }

    // ── 发送单条推送；成功 true，失败 false ──
    function wp_send_push($sub, $title, $body) {
        $vapidPrivate = defined('VAPID_PRIVATE_KEY') ? VAPID_PRIVATE_KEY : '';
        $vapidSubject = defined('VAPID_SUBJECT') ? VAPID_SUBJECT : 'mailto:admin@gaocaihk.com';
        $vapidPublic  = defined('VAPID_PUBLIC_KEY') ? VAPID_PUBLIC_KEY : '';
        if (!$vapidPrivate || !$vapidPublic) return false;
        $endpoint = isset($sub['endpoint']) ? $sub['endpoint'] : '';
        $p256dh = isset($sub['keys']['p256dh']) ? $sub['keys']['p256dh'] : '';
        $auth = isset($sub['keys']['auth']) ? $sub['keys']['auth'] : '';
        if (!$endpoint || !$p256dh || !$auth) return false;

        $jwt = wp_vapidJwt($vapidPrivate, $vapidSubject, parse_url($endpoint, PHP_URL_SCHEME) . '://' . parse_url($endpoint, PHP_URL_HOST));
        if (!$jwt) return false;
        $asKey = wp_genEphemeralKey();
        $payload = json_encode(['title' => $title, 'body' => $body, 'url' => '/'], JSON_UNESCAPED_UNICODE);
        $record = wp_encryptPayload($payload, wp_b64url_decode($p256dh), wp_b64url_decode($auth), $asKey);
        if (!$record) return false;

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $record,
            CURLOPT_HTTPHEADER => [
                'Authorization: vapid t=' . $jwt . ', k=' . $vapidPublic,
                'Content-Encoding: aes128gcm',
                'Content-Type: application/octet-stream',
                'TTL: 86400',
                'Urgency: normal'
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $code >= 200 && $code < 300;
    }

    // ── 该用户今天是否已打卡（任一活跃档案任一愿望有今日 checkin）──
    function wp_hasCheckinToday($pdo, $userId) {
        try {
            $stmt = $pdo->prepare('SELECT 1 FROM checkins c JOIN family_members fm ON fm.family_id = c.family_id WHERE fm.user_id = ? AND c.checkin_date = ? LIMIT 1');
            $stmt->execute([$userId, date('Y-m-d')]);
            return (bool)$stmt->fetch(PDO::FETCH_COLUMN);
        } catch (Exception $e) {
            return true; // 查询失败时保守：不打扰
        }
    }

    // ── 触发一次"该用户今日提醒"（幂等：当天只发一次；已打卡则不打扰）──
    function wp_tryRemind($pdo, $userId, $force = false) {
        $entry = wp_subs_get($userId);
        if (!$entry || empty($entry['enabled']) || empty($entry['sub'])) return 'disabled';
        $today = date('Y-m-d');
        if (!$force && isset($entry['last_sent_date']) && $entry['last_sent_date'] === $today) return 'sent';
        if (wp_hasCheckinToday($pdo, $userId)) {
            $entry['last_sent_date'] = $today;
            wp_subs_put($userId, $entry);
            return 'checked';
        }
        $ok = wp_send_push($entry['sub'], 'Star Rewards', '今天还没打卡哦，孩子的目标在等你 · Don\'t forget today\'s check-in');
        $entry['last_sent_date'] = $today;
        wp_subs_put($userId, $entry);
        return $ok ? 'sent' : 'send_failed';
    }

    // ── 全量提醒（供 cron 调用，需密钥）──
    function wp_remindAll($pdo) {
        $sent = 0;
        foreach (wp_subs_load() as $userId => $entry) {
            if (empty($entry['enabled']) || empty($entry['sub'])) continue;
            $today = date('Y-m-d');
            if (isset($entry['last_sent_date']) && $entry['last_sent_date'] === $today) continue;
            if (wp_hasCheckinToday($pdo, (int)$userId)) {
                $entry['last_sent_date'] = $today;
                wp_subs_put($userId, $entry);
                continue;
            }
            $ok = wp_send_push($entry['sub'], 'Star Rewards', '今天还没打卡哦，孩子的目标在等你 · Don\'t forget today\'s check-in');
            $entry['last_sent_date'] = $today;
            wp_subs_put($userId, $entry);
            if ($ok) $sent++;
        }
        return $sent;
    }
}
