<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recipe Extractor - Submit URL</title>
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

        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }

        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
        }

        input[type="url"] {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.3s;
        }

        input[type="url"]:focus {
            outline: none;
            border-color: #667eea;
        }

        button {
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
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }

        button:active {
            transform: translateY(0);
        }

        .help-text {
            color: #666;
            font-size: 14px;
            margin-top: 8px;
        }

        .example {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
        }

        .example h3 {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
        }

        .example code {
            display: block;
            color: #667eea;
            font-size: 13px;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🍳 Recipe Extractor</h1>
        <p class="subtitle">Extract recipe data from any cooking website</p>

        <form method="POST" action="/">
            <div class="form-group">
                <label for="url">Recipe URL</label>
                <input
                    type="url"
                    id="url"
                    name="url"
                    placeholder="https://example.com/recipe/chocolate-chip-cookies"
                    required
                    autofocus
                >
                <p class="help-text">Enter the full URL of the recipe page you want to extract</p>
            </div>

            <button type="submit">Extract Recipe</button>
        </form>

        <div class="example">
            <h3>Example URLs:</h3>
            <code>https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/</code>
        </div>
    </div>
</body>
</html>
