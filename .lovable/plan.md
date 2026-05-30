## Diagnóstico

Probé el endpoint de signup directamente y encontré dos causas que juntas explican lo que ves:

### Causa 1 — Tu contraseña está siendo rechazada (probable)
La protección anti-contraseñas filtradas (HIBP) está activa. Cuando uso una contraseña común como `Password12345!` el servidor responde:
```
{"code":422,"error_code":"weak_password","msg":"Password is known to be weak..."}
```
Con una contraseña fuerte y única, el signup funciona perfecto y devuelve sesión inmediatamente (auto-confirm ya está activo).

El formulario sí muestra `error.message`, pero:
- el mensaje viene en inglés ("Password is known to be weak…"),
- no hay pista previa de los requisitos ("mín. 8 caracteres" no basta; también debe no estar filtrada),
- al hacer submit, el botón vuelve a "Crear cuenta" y el texto rojo es discreto → parece que "no pasó nada".

### Causa 2 — Header no reacciona al login
No hay listener `onAuthStateChange` en `__root.tsx`. Si el signup sí tuvo éxito y te redirige a `/`, el header sigue mostrando "Empezar" porque nada invalida el router. Refuerza la sensación de "no me creó la cuenta".

### Lo que NO es el problema
- El trigger `on_auth_user_created` existe y funciona (probado en vivo, crea profile + user_role).
- Auto-confirm de email está activo (la sesión vuelve en la misma respuesta).
- Las funciones de servidor / RLS no intervienen en el signup.

## Plan de cambios

### 1. `src/routes/signup.tsx` — UX honesta
- Traducir / mapear los errores comunes de Supabase a español:
  - `weak_password` / "known to be weak" → "Esta contraseña es muy común o ha aparecido en filtraciones. Usa una más fuerte y única."
  - `user_already_exists` → "Ya existe una cuenta con este correo. Inicia sesión."
  - `over_email_send_rate_limit` → "Demasiados intentos. Espera un minuto y vuelve a intentar."
  - Otros → mostrar `error.message` tal cual.
- Pista bajo el campo de contraseña: "Mínimo 8 caracteres. Evita contraseñas comunes o filtradas."
- Hacer el bloque de error más visible (caja con borde `border-destructive/40 bg-destructive/10 p-3 rounded`).
- Subir `minLength` a 10 para reducir choques con HIBP.
- Tras éxito (con sesión), mostrar `toast.success("Cuenta creada")` antes del `navigate("/")` para feedback inmediato.

### 2. `src/routes/login.tsx` — mismo tratamiento de errores
- Mapear `invalid_credentials` → "Email o contraseña incorrectos.", `email_not_confirmed` → "Confirma tu correo antes de iniciar sesión.", `over_request_rate_limit` → "Demasiados intentos, espera un momento."
- Caja de error con el mismo estilo destacado.

### 3. `src/routes/__root.tsx` — listener global de auth
Añadir dentro de `RootComponent` un `useEffect` que se suscribe a `supabase.auth.onAuthStateChange` y al disparar llama a `router.invalidate()` + `queryClient.invalidateQueries()`. Así el header y las rutas reaccionan inmediatamente al login/signup/logout sin recargar.

### 4. `src/components/site/Header.tsx` — botones de cuenta reactivos
- Leer la sesión actual con un pequeño hook (`useSession`) que use `supabase.auth.getSession()` + suscripción a `onAuthStateChange`.
- Si hay sesión: mostrar botón "Mi cuenta" → `/account` y ocultar "Empezar".
- Si no hay sesión: mantener "Empezar" como ahora.

Esto cierra el bucle visual: tras crear cuenta, el header cambia y queda claro que estás dentro.

## Detalles técnicos

- No hay cambios de schema ni de Supabase Auth config.
- No se modifican `src/integrations/supabase/*` ni `routeTree.gen.ts`.
- El listener se desuscribe en cleanup del `useEffect`.
- `useSession` vive en `src/lib/use-session.ts` (nuevo, ~15 líneas) para reutilizar en Header y futuros componentes.

## Pregunta abierta (opcional)

¿Quieres que también desactive la protección HIBP para que se permitan contraseñas más simples en desarrollo? **No lo recomiendo** (es una de las mejores defensas gratis que ofrece Supabase), pero si lo pides lo hago con `configure_auth`.
