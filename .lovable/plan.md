# Fase 3 · Mensaje 1 — Vendor Performance

Métricas operacionales para Admin (marketplace + ranking) y Seller (tienda propia vs. benchmark anonimizado).

## Archivos

### Nuevo: `src/lib/performance.functions.ts`
Server function única `getPerformance({ sellerId?, days })`:
- `days`: 7 | 30 | 90 (default 30)
- Admin sin `sellerId` → modo marketplace + ranking de sellers
- Admin con `sellerId` → métricas de ese seller
- Seller (no admin) → siempre forzado a su propio `sellerId` (validación server-side)
- Una sola query trae 2× ventana (actual + período anterior) y se separa en memoria para trends
- Benchmark de marketplace para vista seller (anonimizado: solo promedios)

### Nueva ruta: `src/routes/_authenticated/admin.performance.tsx`
- Selector de rango (7/30/90 días) con `Tabs`
- KPI cards con trend (% vs período anterior, flecha ±, color semántico):
  - GMV, Pedidos, AOV, Unidades
- KPI operacionales:
  - Fulfillment rate, Cancellation rate, Repeat buyer rate
- Stock health (out of stock + low stock counts)
- Chart: GMV diario (AreaChart) + Pedidos diarios overlay
- Tabla **Seller Ranking** (solo admin marketplace): seller, GMV, pedidos, fulfillment %, cancelación %, con badges color-coded (verde/ámbar/rojo)
- Top 5 productos por revenue

### Nueva ruta: `src/routes/_authenticated/seller.performance.tsx`
- Mismas KPIs que admin pero sin ranking
- Cada KPI operacional muestra **benchmark** (promedio marketplace) al lado, con badge "Above avg" / "Below avg"
- Top productos propios

## Navegación + i18n
- `admin.tsx`: agregar item "Performance" en grupo `ops` (después de Customers)
- `seller.tsx`: agregar item "Performance" en grupo `overview` (después de Overview)
- `src/lib/i18n.ts`: añadir bloque `dash.performance.*` en EN + ES:
  - title, sub, ranges (7d/30d/90d), kpis, ranking columns, benchmark labels, stock labels, "Above/Below average"

## Detalles técnicos
- Query única con join `orders!inner` + filtro por `created_at >= sincePrev`, split en memoria
- Fulfillment rate = items con `fulfillment_status ∈ {delivered, shipped}` / total items
- Cancellation rate = items con `fulfillment_status ∈ {cancelled, refunded}` / total
- Repeat rate = buyers con ≥2 orders / unique buyers
- Trend = (curr − prev) / prev, con flecha y color (verde positivo / rojo negativo, invertido para cancellation)
- Color thresholds: fulfillment >95% verde, 80–95% ámbar, <80% rojo
- Sin tabla nueva: todo deriva de `orders`, `order_items`, `product_variants`, `sellers`
- Stock health para marketplace usa `count: exact, head: true` (no carga filas)

## Fuera de alcance
- Export CSV de métricas (Fase 4)
- Vista de Performance por seller individual desde admin (drill-down se hace pasando `sellerId` por query param — UI futura)
- Cron de alertas (low stock notifications)

## Siguiente (Mensaje 2)
Mass Upload CSV de productos (seller + admin).
