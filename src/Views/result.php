<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recipe Extracted Successfully</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 700px;
            width: 100%;
        }

        .success-icon {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 30px;
            margin: 0 auto 20px;
        }

        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
            text-align: center;
        }

        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
            text-align: center;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .info-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }

        .info-card .label {
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .info-card .value {
            color: #333;
            font-size: 20px;
            font-weight: 600;
        }

        .recipe-title {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .recipe-title .label {
            color: #666;
            font-size: 14px;
            margin-bottom: 8px;
        }

        .recipe-title .title {
            color: #333;
            font-size: 22px;
            font-weight: 600;
            word-break: break-word;
        }

        .metadata {
            background: #f0f4ff;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }

        .metadata-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
        }

        .metadata-row:last-child {
            margin-bottom: 0;
        }

        .metadata-row .label {
            color: #666;
        }

        .metadata-row .value {
            color: #333;
            font-weight: 600;
        }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge.high {
            background: #d4edda;
            color: #155724;
        }

        .badge.medium {
            background: #fff3cd;
            color: #856404;
        }

        .badge.low {
            background: #f8d7da;
            color: #721c24;
        }

        .actions {
            display: flex;
            gap: 10px;
        }

        .btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            text-decoration: none;
            text-align: center;
            display: block;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .btn-secondary {
            background: #f8f9fa;
            color: #333;
            border: 2px solid #e0e0e0;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }

        .btn:active {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✓</div>
        <h1>Recipe Extracted Successfully!</h1>
        <p class="subtitle">Your recipe has been processed and saved</p>

        <?php if (!empty($recipe['title'])): ?>
        <div class="recipe-title">
            <div class="label">Recipe Title</div>
            <div class="title"><?= Validator::sanitize($recipe['title']) ?></div>
        </div>
        <?php endif; ?>

        <div class="info-grid">
            <div class="info-card">
                <div class="label">Ingredients Found</div>
                <div class="value"><?= count($recipe['ingredients'] ?? []) ?></div>
            </div>
            <div class="info-card">
                <div class="label">Steps Found</div>
                <div class="value"><?= count($recipe['steps'] ?? []) ?></div>
            </div>
            <?php if (!empty($recipe['servings']['count'])): ?>
            <div class="info-card">
                <div class="label">Servings</div>
                <div class="value"><?= (int)$recipe['servings']['count'] ?></div>
            </div>
            <?php endif; ?>
        </div>

        <div class="metadata">
            <div class="metadata-row">
                <span class="label">Extraction Method:</span>
                <span class="value"><?= Validator::sanitize($recipe['metadata']['extractionMethod'] ?? 'unknown') ?></span>
            </div>
            <div class="metadata-row">
                <span class="label">Confidence Level:</span>
                <span class="value">
                    <span class="badge <?= Validator::sanitize($recipe['metadata']['confidence'] ?? 'low') ?>">
                        <?= Validator::sanitize($recipe['metadata']['confidence'] ?? 'low') ?>
                    </span>
                </span>
            </div>
            <div class="metadata-row">
                <span class="label">Processing Time:</span>
                <span class="value"><?= (int)($recipe['metadata']['processingTimeMs'] ?? 0) ?> ms</span>
            </div>
            <div class="metadata-row">
                <span class="label">Recipe ID:</span>
                <span class="value"><?= Validator::sanitize($recipe['id'] ?? 'unknown') ?></span>
            </div>
        </div>

        <div class="actions">
            <a href="/" class="btn btn-primary">Extract Another Recipe</a>
        </div>
    </div>
</body>
</html>
