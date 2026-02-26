<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - Recipe Extractor</title>
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
            max-width: 600px;
            width: 100%;
        }

        .error-icon {
            width: 60px;
            height: 60px;
            background: #dc3545;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 30px;
            margin: 0 auto 20px;
            color: white;
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

        .error-message {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            line-height: 1.6;
        }

        .error-message strong {
            display: block;
            margin-bottom: 8px;
            font-size: 16px;
        }

        .suggestions {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .suggestions h3 {
            color: #333;
            font-size: 16px;
            margin-bottom: 12px;
        }

        .suggestions ul {
            margin-left: 20px;
            color: #666;
        }

        .suggestions li {
            margin-bottom: 8px;
            line-height: 1.5;
        }

        .btn {
            display: block;
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            text-decoration: none;
            text-align: center;
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
        <div class="error-icon">✕</div>
        <h1>Extraction Failed</h1>
        <p class="subtitle">We couldn't extract the recipe from the provided URL</p>

        <div class="error-message">
            <strong>Error:</strong>
            <?= Validator::sanitize($errorMessage ?? 'An unknown error occurred') ?>
        </div>

        <div class="suggestions">
            <h3>Possible Solutions:</h3>
            <ul>
                <li>Make sure the URL is correct and points to a recipe page</li>
                <li>Check that the website is accessible and not behind a paywall</li>
                <li>Try a different recipe from a popular cooking website (e.g., AllRecipes, Food Network)</li>
                <li>Ensure the URL starts with http:// or https://</li>
            </ul>
        </div>

        <a href="/" class="btn">Try Another URL</a>
    </div>
</body>
</html>
