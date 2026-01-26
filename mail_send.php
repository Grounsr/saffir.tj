<?php
/**
 * ========================================
 * SAFFIR GROUP - Contact Form Handler
 * ========================================
 * 
 * Этот файл обрабатывает отправку формы обратной связи
 * и отправляет письмо на указанный email адрес.
 */

// Установка заголовков для CORS и JSON ответа
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// ===== НАСТРОЙКИ =====
// Измените эти значения на свои
$config = [
    'recipient_email' => 'info@saffir-group.com',  // Email получателя
    'recipient_name'  => 'Saffir Group',            // Имя получателя
    'smtp_host'       => '',                        // SMTP сервер (оставьте пустым для mail())
    'smtp_port'       => 587,                       // SMTP порт
    'smtp_user'       => '',                        // SMTP логин
    'smtp_pass'       => '',                        // SMTP пароль
    'smtp_secure'     => 'tls',                     // tls или ssl
];

// ===== ОБРАБОТКА ЗАПРОСА =====

// Проверка метода запроса
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Метод запроса не поддерживается');
    exit;
}

// Получение и очистка данных
$name = sanitizeInput($_POST['name'] ?? '');
$email = sanitizeInput($_POST['email'] ?? '');
$company = sanitizeInput($_POST['company'] ?? '');
$message = sanitizeInput($_POST['message'] ?? '');

// Валидация данных
$errors = [];

if (empty($name)) {
    $errors[] = 'Введите ваше имя';
}

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Введите корректный email';
}

if (empty($company)) {
    $errors[] = 'Выберите компанию';
}

if (empty($message)) {
    $errors[] = 'Введите сообщение';
}

if (!empty($errors)) {
    sendResponse(false, implode(', ', $errors));
    exit;
}

// Определение названия компании
$companyNames = [
    'saffir' => 'LLC "Saffir"',
    'cc_saffir' => 'LLC "CC Saffir"',
    'both' => 'Both Companies'
];
$companyName = $companyNames[$company] ?? $company;

// Формирование письма
$subject = "Новое сообщение с сайта Saffir Group - {$companyName}";

$htmlBody = "
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb, #06b6d4); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
        .field { margin-bottom: 20px; }
        .label { font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
        .value { font-size: 16px; color: #1e293b; }
        .message-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1>📩 Новое сообщение</h1>
        </div>
        <div class='content'>
            <div class='field'>
                <div class='label'>Имя</div>
                <div class='value'>{$name}</div>
            </div>
            <div class='field'>
                <div class='label'>Email</div>
                <div class='value'><a href='mailto:{$email}'>{$email}</a></div>
            </div>
            <div class='field'>
                <div class='label'>Компания</div>
                <div class='value'>{$companyName}</div>
            </div>
            <div class='field'>
                <div class='label'>Сообщение</div>
                <div class='message-box'>" . nl2br(htmlspecialchars($message)) . "</div>
            </div>
        </div>
        <div class='footer'>
            <p>Это автоматическое уведомление с сайта Saffir Group</p>
            <p>Дата: " . date('d.m.Y H:i:s') . "</p>
        </div>
    </div>
</body>
</html>
";

$plainBody = "
Новое сообщение с сайта Saffir Group
=====================================

Имя: {$name}
Email: {$email}
Компания: {$companyName}

Сообщение:
{$message}

=====================================
Дата: " . date('d.m.Y H:i:s');

// Отправка письма
$sent = sendEmail(
    $config['recipient_email'],
    $config['recipient_name'],
    $subject,
    $htmlBody,
    $plainBody,
    $email,
    $name,
    $config
);

if ($sent) {
    // Сохранение в лог (опционально)
    logMessage($name, $email, $company, $message);
    sendResponse(true, 'Сообщение успешно отправлено');
} else {
    sendResponse(false, 'Ошибка при отправке сообщения');
}

// ===== ФУНКЦИИ =====

/**
 * Очистка входных данных
 */
function sanitizeInput($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}

/**
 * Отправка JSON ответа
 */
function sendResponse($success, $message) {
    echo json_encode([
        'success' => $success,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * Отправка email
 */
function sendEmail($to, $toName, $subject, $htmlBody, $plainBody, $replyTo, $replyToName, $config) {
    // Если указан SMTP сервер, используем PHPMailer или другую библиотеку
    // В базовой версии используем стандартную функцию mail()

    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-type: text/html; charset=UTF-8';
    $headers[] = 'From: Saffir Group <noreply@saffir-group.com>';
    $headers[] = "Reply-To: {$replyToName} <{$replyTo}>";
    $headers[] = 'X-Mailer: PHP/' . phpversion();

    $headerString = implode("\r\n", $headers);

    // Попытка отправки
    $result = @mail($to, $subject, $htmlBody, $headerString);

    return $result;
}

/**
 * Логирование сообщений (опционально)
 */
function logMessage($name, $email, $company, $message) {
    $logFile = __DIR__ . '/contact_log.txt';
    $logEntry = date('Y-m-d H:i:s') . " | {$name} | {$email} | {$company} | " . substr($message, 0, 100) . "\n";
    @file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * Для использования PHPMailer (расширенная версия)
 * Раскомментируйте и настройте при необходимости
 */
/*
function sendEmailSMTP($to, $toName, $subject, $htmlBody, $plainBody, $replyTo, $replyToName, $config) {
    require 'vendor/autoload.php'; // Установите PHPMailer через Composer

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);

    try {
        // SMTP настройки
        $mail->isSMTP();
        $mail->Host       = $config['smtp_host'];
        $mail->SMTPAuth   = true;
        $mail->Username   = $config['smtp_user'];
        $mail->Password   = $config['smtp_pass'];
        $mail->SMTPSecure = $config['smtp_secure'];
        $mail->Port       = $config['smtp_port'];
        $mail->CharSet    = 'UTF-8';

        // Получатели
        $mail->setFrom('noreply@saffir-group.com', 'Saffir Group');
        $mail->addAddress($to, $toName);
        $mail->addReplyTo($replyTo, $replyToName);

        // Контент
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        $mail->AltBody = $plainBody;

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("Mail Error: " . $mail->ErrorInfo);
        return false;
    }
}
*/
?>
