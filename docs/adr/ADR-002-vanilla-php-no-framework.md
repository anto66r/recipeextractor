# ADR-002: Use Vanilla PHP Without Framework

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** System Architect
**Context:** Recipe Extractor technology stack selection

---

## Context and Problem Statement

Recipe Extractor needs a PHP backend implementation strategy. We must choose between:

1. **Full framework** (Laravel, Symfony)
2. **Micro-framework** (Slim, Lumen, Flight)
3. **Vanilla PHP** (no framework)

The solution must be simple to deploy on shared hosting, easy to maintain for a single-user personal tool, and not over-engineered.

---

## Decision Drivers

1. **Simplicity** - Single-purpose app with limited scope
2. **Deployment ease** - Works on shared hosting with FTP upload
3. **Learning curve** - Maintainable by developer without framework expertise
4. **Performance** - Minimal bootstrap overhead on shared hosting
5. **Control** - Full control over behavior (no framework magic)
6. **Scope** - Personal tool, not enterprise application
7. **Dependencies** - Minimize external dependencies

---

## Considered Options

### Option 1: Full Framework (Laravel/Symfony)

**Pros:**
- Rich ecosystem (ORM, validation, routing, security)
- Well-documented patterns and best practices
- Active community and support
- Built-in security features (CSRF, XSS protection)
- Comprehensive testing tools

**Cons:**
- **Massive overkill for simple extraction tool**
- Large codebase and dependencies (Composer required)
- Framework learning curve
- Slower bootstrap on shared hosting
- Complex deployment (not simple FTP upload)
- Requires more server resources (memory, CPU)
- Forces framework conventions (may not fit use case)

**Decision:** **REJECTED** - Overkill for single-purpose tool.

---

### Option 2: Micro-Framework (Slim, Flight)

**Pros:**
- Lightweight (minimal overhead)
- Provides routing and middleware
- Simpler than full framework
- Still allows flexibility
- Easier deployment than Laravel/Symfony

**Cons:**
- **Still adds dependency** (Composer, framework code)
- Adds learning curve (framework patterns)
- More complex than raw PHP for simple app
- Deployment requires Composer (not simple FTP)
- Framework conventions may not align with use case

**Decision:** **CONSIDER IF SCOPE EXPANDS** - Reasonable option if app grows significantly.

---

### Option 3: Vanilla PHP (Selected)

**Pros:**
- **Maximum simplicity** (no framework overhead)
- **Zero dependencies** (no Composer required)
- **Full control** over every aspect
- **Simple deployment** (FTP upload files, done)
- **Fast bootstrap** (no framework initialization)
- **Easy to understand** (no framework magic to learn)
- **Minimal server resources** (important for shared hosting)
- **Complete transparency** (all code is application code)

**Cons:**
- **Must implement utilities manually** (routing, validation, logging)
- **No built-in security features** (must implement carefully)
- **Less structure** (requires discipline to stay organized)
- **No ORM** (manual data handling, but we're using flat files anyway)
- **No testing framework integration** (but simple tests still possible)

**Decision:** **ACCEPTED** - Best fit for simple, single-purpose tool.

---

## Decision Outcome

**Chosen Option:** **Vanilla PHP (No Framework)**

**Rationale:**
- **Simplicity matches use case** - This is a personal recipe extraction tool, not an enterprise application
- **Deployment simplicity** - Upload files via FTP, no Composer, no build process
- **Performance** - Minimal overhead on shared hosting (no framework bootstrap)
- **Maintainability** - All code is application code (no framework magic to debug)
- **Adequate for scope** - Routing, validation, logging can be implemented simply

---

## Implementation Strategy

### Build Minimal Custom Utilities

We will implement only what we need:

**1. Simple Router** (`src/Core/Router.php`):
```php
class Router {
    private $routes = [];

    public function get(string $path, string $handler): void {
        $this->routes['GET'][$path] = $handler;
    }

    public function post(string $path, string $handler): void {
        $this->routes['POST'][$path] = $handler;
    }

    public function dispatch(string $method, string $uri): void {
        // Match route, call handler
    }
}
```

**2. Validator** (`src/Utils/Validator.php`):
```php
class Validator {
    public static function isValidUrl(string $url): bool {
        return filter_var($url, FILTER_VALIDATE_URL) !== false;
    }

    public static function sanitizeUrl(string $url): string {
        return filter_var($url, FILTER_SANITIZE_URL);
    }
}
```

**3. Logger** (`src/Utils/Logger.php`):
```php
class Logger {
    public static function error(string $message, array $context = []): void {
        $log = sprintf(
            "[%s] ERROR: %s\nContext: %s\n",
            date('Y-m-d H:i:s'),
            $message,
            json_encode($context)
        );
        file_put_contents(LOG_PATH, $log, FILE_APPEND | LOCK_EX);
    }
}
```

### Class Organization

Use clear folder structure to maintain organization:

```
/src/
  /Core/           - Core application logic
  /Extractors/     - Recipe extraction strategies
  /Services/       - Business logic services
  /Utils/          - Utility classes
  /Views/          - Simple PHP templates
```

### Autoloading

Simple PSR-4-style autoloader without Composer:

```php
// config.php
spl_autoload_register(function ($class) {
    $prefix = 'RecipeExtractor\\';
    $base_dir = __DIR__ . '/src/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});
```

### Security Considerations

Without framework security features, we must implement carefully:

**1. Input Validation:**
- Use `filter_var()` for URL validation
- Sanitize all user input
- Validate file uploads (if added later)

**2. Output Escaping:**
- Use `htmlspecialchars()` for all output
- Escape JSON output properly
- Set proper Content-Type headers

**3. CSRF Protection:**
- Not needed for v1 (single user, no authentication)
- Add token-based CSRF if multi-user support added

**4. File System Security:**
- Validate file paths (prevent directory traversal)
- Use `.htaccess` to prevent access to sensitive files
- Set proper file permissions (644 for files, 755 for dirs)

**5. Error Handling:**
- Never show raw PHP errors to users
- Log all errors to file
- Return generic error messages

---

## Consequences

### Positive Consequences

- **Simple deployment** - Upload via FTP, no build process, no Composer
- **Fast performance** - No framework bootstrap overhead
- **Full control** - Complete transparency, no framework magic
- **Minimal dependencies** - Only PHP standard library
- **Easy debugging** - All code is application code
- **Small footprint** - Important for shared hosting resource limits

### Negative Consequences

- **Manual utility implementation** - Must build routing, validation, logging
- **Less structure** - Requires discipline to stay organized
- **No framework security features** - Must implement carefully
- **No ORM** - Manual data handling (acceptable with flat files)
- **Limited community patterns** - Can't leverage framework conventions

### Mitigation Strategies

1. **Structure:**
   - Use clear folder organization (`/src/Core/`, `/src/Services/`, etc.)
   - Follow consistent naming conventions
   - Document class responsibilities clearly

2. **Security:**
   - Implement validation and sanitization utilities
   - Use `.htaccess` for access control
   - Never show raw PHP errors
   - Log all errors with context

3. **Maintainability:**
   - Write self-documenting code with docblocks
   - Keep classes small and focused (single responsibility)
   - Add simple tests where critical (extraction logic)

4. **If Scope Expands:**
   - Revisit decision if app grows beyond single-user tool
   - Consider migrating to Slim or Laravel if complexity increases
   - Framework migration path is available if needed

---

## When to Reconsider

Consider migrating to a framework if:

1. **Multi-user support** is required (need authentication, sessions, CSRF)
2. **Complex UI** is built (need templating engine, asset pipeline)
3. **API** is exposed (need robust routing, middleware, rate limiting)
4. **Team grows** (framework conventions help coordination)
5. **Security requirements increase** (need framework security features)

**Trigger:** Any of the above requirements emerge.

**Migration Path:** Slim micro-framework is easiest migration target.

---

## Related Decisions

- ADR-001: Flat-File JSON Storage (no ORM needed)
- ADR-003: Multi-Strategy Extraction Pattern (custom implementation)

---

## References

- PHP SPL Autoloading: https://www.php.net/manual/en/function.spl-autoload-register.php
- PHP Security Best Practices: https://www.php.net/manual/en/security.php
- Simple PHP routing patterns: https://phprouter.com/

---

**Status:** Accepted
**Last Reviewed:** 2026-02-26
**Next Review:** After Sprint 2 completion (reassess if complexity increases)
